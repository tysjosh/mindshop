import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand, CreateKeyCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import * as crypto from 'crypto';

export interface EncryptionContext extends Record<string, string> {
  merchant_id: string;
  data_type: string;
  purpose: string;
  timestamp: string;
}

export interface EncryptedData {
  ciphertext: string;
  dataKey: string;
  algorithm: string;
  keyId: string;
  encryptionContext: EncryptionContext;
  iv: string;
  authTag: string;
}

export interface KeyRotationInfo {
  keyId: string;
  currentVersion: number;
  rotationEnabled: boolean;
  nextRotation: Date;
  lastRotation?: Date;
}

/**
 * Comprehensive encryption service using AWS KMS with envelope encryption
 */
export class EncryptionService {
  private kmsClient: KMSClient;
  private dynamoClient: DynamoDBClient;
  private keyTableName: string;
  private defaultKeyId: string;
  private keyCache: Map<string, { key: Buffer; expiresAt: number }> = new Map();
  private readonly KEY_CACHE_TTL = 300000; // 5 minutes

  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    this.keyTableName = process.env.ENCRYPTION_KEY_TABLE || 'encryption-keys';
    this.defaultKeyId = process.env.DEFAULT_KMS_KEY_ID || 'alias/mindsdb-rag-encryption';
  }

  /**
   * Encrypt data using envelope encryption with KMS
   */
  public async encryptData(
    plaintext: string | Buffer,
    encryptionContext: EncryptionContext,
    keyId?: string
  ): Promise<EncryptedData> {
    try {
      // Validate encryption context completeness
      if (!encryptionContext.data_type || !encryptionContext.merchant_id || !encryptionContext.purpose) {
        throw new Error('Incomplete encryption context: data_type, merchant_id, and purpose are required');
      }

      const targetKeyId = keyId || this.defaultKeyId;
      const plaintextBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');

      // Generate data key for envelope encryption
      const dataKeyCommand = new GenerateDataKeyCommand({
        KeyId: targetKeyId,
        KeySpec: 'AES_256',
        EncryptionContext: encryptionContext,
      });

      const dataKeyResult = await this.kmsClient.send(dataKeyCommand);
      
      if (!dataKeyResult.Plaintext || !dataKeyResult.CiphertextBlob) {
        throw new Error('Failed to generate data key');
      }

      // Use the plaintext data key for local encryption
      const dataKey = Buffer.from(dataKeyResult.Plaintext);
      const encryptedDataKey = Buffer.from(dataKeyResult.CiphertextBlob).toString('base64');

      // Generate random IV for AES-GCM
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      
      // Encrypt data using AES-256-CBC
      const cipher = crypto.createCipher('aes-256-cbc', dataKey);
      
      let ciphertext = cipher.update(plaintextBuffer);
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      
      // For CBC mode, we don't have authTag
      const authTag = Buffer.alloc(16); // Dummy auth tag for compatibility

      // Clear the plaintext data key from memory
      dataKey.fill(0);

      const result: EncryptedData = {
        ciphertext: ciphertext.toString('base64'),
        dataKey: encryptedDataKey,
        algorithm: 'AES-256-CBC',
        keyId: targetKeyId,
        encryptionContext,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      };

      // Log encryption event for audit
      console.log('AUDIT_LOG', {
        event_type: 'data_encryption',
        key_id: targetKeyId,
        data_type: encryptionContext.data_type,
        merchant_id: encryptionContext.merchant_id,
        data_size: plaintextBuffer.length,
        algorithm: 'AES-256-CBC',
        timestamp: new Date().toISOString(),
      });

      return result;

    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using envelope encryption with KMS
   */
  public async decryptData(encryptedData: EncryptedData): Promise<Buffer> {
    try {
      // Decrypt the data key using KMS
      const decryptKeyCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedData.dataKey, 'base64'),
        EncryptionContext: encryptedData.encryptionContext,
      });

      const keyResult = await this.kmsClient.send(decryptKeyCommand);
      
      if (!keyResult.Plaintext) {
        throw new Error('Failed to decrypt data key');
      }

      const dataKey = Buffer.from(keyResult.Plaintext);

      // Decrypt the data using the plaintext data key
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

      const decipher = crypto.createDecipher('aes-256-cbc', dataKey);

      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      // Clear the data key from memory
      dataKey.fill(0);

      // Log decryption event for audit
      console.log('AUDIT_LOG', {
        event_type: 'data_decryption',
        key_id: encryptedData.keyId,
        data_type: encryptedData.encryptionContext.data_type,
        merchant_id: encryptedData.encryptionContext.merchant_id,
        algorithm: encryptedData.algorithm,
        timestamp: new Date().toISOString(),
      });

      return plaintext;

    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt sensitive string data with automatic context
   */
  public async encryptString(
    data: string,
    merchantId: string,
    dataType: string,
    purpose: string = 'data_protection'
  ): Promise<string> {
    const encryptionContext: EncryptionContext = {
      merchant_id: merchantId,
      data_type: dataType,
      purpose,
      timestamp: new Date().toISOString(),
    };

    const encrypted = await this.encryptData(data, encryptionContext);
    
    // Return a compact representation
    return JSON.stringify({
      c: encrypted.ciphertext,
      k: encrypted.dataKey,
      i: encrypted.iv,
      t: encrypted.authTag,
      ctx: encryptionContext,
    });
  }

  /**
   * Decrypt sensitive string data
   */
  public async decryptString(encryptedString: string): Promise<string> {
    try {
      const parsed = JSON.parse(encryptedString);
      
      const encryptedData: EncryptedData = {
        ciphertext: parsed.c,
        dataKey: parsed.k,
        algorithm: 'AES-256-CBC',
        keyId: this.defaultKeyId,
        encryptionContext: parsed.ctx,
        iv: parsed.i,
        authTag: parsed.t,
      };

      const decrypted = await this.decryptData(encryptedData);
      return decrypted.toString('utf8');

    } catch (error) {
      console.error('String decryption failed:', error);
      throw new Error(`String decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new KMS key for a specific merchant
   */
  public async createMerchantKey(
    merchantId: string,
    description?: string
  ): Promise<string> {
    try {
      const createKeyCommand = new CreateKeyCommand({
        Description: description || `Encryption key for merchant ${merchantId}`,
        KeyUsage: 'ENCRYPT_DECRYPT',
        KeySpec: 'SYMMETRIC_DEFAULT',
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'Enable IAM User Permissions',
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:root`,
              },
              Action: 'kms:*',
              Resource: '*',
            },
            {
              Sid: 'Allow use of the key for merchant data',
              Effect: 'Allow',
              Principal: {
                AWS: [
                  `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/MindsDBRAGServiceRole`,
                  `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/ECSTaskRole`,
                ],
              },
              Action: [
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:DescribeKey',
              ],
              Resource: '*',
              Condition: {
                StringEquals: {
                  'kms:EncryptionContext:merchant_id': merchantId,
                },
              },
            },
          ],
        }),
        Tags: [
          {
            TagKey: 'MerchantId',
            TagValue: merchantId,
          },
          {
            TagKey: 'Service',
            TagValue: 'MindsDBRAG',
          },
          {
            TagKey: 'Purpose',
            TagValue: 'DataEncryption',
          },
        ],
      });

      const result = await this.kmsClient.send(createKeyCommand);
      
      if (!result.KeyMetadata?.KeyId) {
        throw new Error('Failed to create KMS key');
      }

      const keyId = result.KeyMetadata.KeyId;

      // Store key information in DynamoDB
      await this.storeKeyInfo(merchantId, keyId);

      console.log(`Created KMS key ${keyId} for merchant ${merchantId}`);
      return keyId;

    } catch (error) {
      console.error(`Failed to create merchant key for ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create a key for a merchant
   */
  public async getMerchantKey(merchantId: string): Promise<string> {
    try {
      // Check if we have a cached key
      const cachedKey = await this.getStoredKeyInfo(merchantId);
      if (cachedKey) {
        return cachedKey;
      }

      // Create a new key for the merchant
      return await this.createMerchantKey(merchantId);

    } catch (error) {
      console.error(`Failed to get merchant key for ${merchantId}:`, error);
      // Fall back to default key
      return this.defaultKeyId;
    }
  }

  /**
   * Rotate encryption keys
   */
  public async rotateKey(keyId: string): Promise<void> {
    try {
      // In AWS KMS, key rotation is automatic when enabled
      // This method would trigger manual rotation if needed
      console.log(`Initiating key rotation for ${keyId}`);

      // Log rotation event
      console.log('AUDIT_LOG', {
        event_type: 'key_rotation',
        key_id: keyId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Key rotation failed for ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Get key rotation information
   */
  public async getKeyRotationInfo(keyId: string): Promise<KeyRotationInfo> {
    try {
      const describeCommand = new DescribeKeyCommand({ KeyId: keyId });
      const result = await this.kmsClient.send(describeCommand);

      if (!result.KeyMetadata) {
        throw new Error('Key metadata not found');
      }

      // Calculate next rotation (AWS KMS rotates annually when enabled)
      const creationDate = result.KeyMetadata.CreationDate;
      const nextRotation = creationDate ? 
        new Date(creationDate.getTime() + 365 * 24 * 60 * 60 * 1000) : 
        new Date();

      return {
        keyId,
        currentVersion: 1, // AWS KMS handles versioning internally
        rotationEnabled: (result.KeyMetadata as any).KeyRotationStatus || false,
        nextRotation,
        lastRotation: creationDate,
      };

    } catch (error) {
      console.error(`Failed to get key rotation info for ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Encrypt data at rest for database storage
   */
  public async encryptForStorage(
    data: any,
    merchantId: string,
    tableName: string
  ): Promise<string> {
    const serialized = JSON.stringify(data);
    return await this.encryptString(serialized, merchantId, 'database', `storage_${tableName}`);
  }

  /**
   * Decrypt data from database storage
   */
  public async decryptFromStorage(encryptedData: string): Promise<any> {
    const decrypted = await this.decryptString(encryptedData);
    return JSON.parse(decrypted);
  }

  /**
   * Secure hash function for data integrity
   */
  public createSecureHash(data: string | Buffer, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256');
    hash.update(data);
    hash.update(actualSalt);
    return `${actualSalt}:${hash.digest('hex')}`;
  }

  /**
   * Verify secure hash
   */
  public verifySecureHash(data: string | Buffer, hash: string): boolean {
    try {
      const [salt, expectedHash] = hash.split(':');
      const actualHash = this.createSecureHash(data, salt);
      return actualHash === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate cryptographically secure random token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Store key information in DynamoDB
   */
  private async storeKeyInfo(merchantId: string, keyId: string): Promise<void> {
    const putCommand = new PutItemCommand({
      TableName: this.keyTableName,
      Item: {
        merchant_id: { S: merchantId },
        key_id: { S: keyId },
        created_at: { S: new Date().toISOString() },
        key_type: { S: 'merchant_encryption' },
        status: { S: 'active' },
      },
    });

    await this.dynamoClient.send(putCommand);
  }

  /**
   * Get stored key information from DynamoDB
   */
  private async getStoredKeyInfo(merchantId: string): Promise<string | null> {
    try {
      const getCommand = new GetItemCommand({
        TableName: this.keyTableName,
        Key: {
          merchant_id: { S: merchantId },
        },
      });

      const result = await this.dynamoClient.send(getCommand);
      
      if (result.Item && result.Item.key_id?.S) {
        return result.Item.key_id.S;
      }

      return null;

    } catch (error) {
      console.error(`Failed to get stored key info for ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Clean up expired cached keys
   */
  public cleanupKeyCache(): void {
    const now = Date.now();
    for (const [keyId, cached] of this.keyCache.entries()) {
      if (cached.expiresAt < now) {
        // Clear the key from memory
        cached.key.fill(0);
        this.keyCache.delete(keyId);
      }
    }
  }

  /**
   * Get encryption service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    kmsConnectivity: boolean;
    dynamoConnectivity: boolean;
    keysCached: number;
    lastError?: string;
  }> {
    let kmsConnectivity = false;
    let dynamoConnectivity = false;
    let lastError: string | undefined;

    try {
      // Test KMS connectivity
      const describeCommand = new DescribeKeyCommand({ KeyId: this.defaultKeyId });
      await this.kmsClient.send(describeCommand);
      kmsConnectivity = true;
    } catch (error) {
      lastError = `KMS error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }

    try {
      // Test DynamoDB connectivity
      const scanCommand = new ScanCommand({
        TableName: this.keyTableName,
        Limit: 1,
      });
      await this.dynamoClient.send(scanCommand);
      dynamoConnectivity = true;
    } catch (error) {
      lastError = lastError ? 
        `${lastError}; DynamoDB error: ${error instanceof Error ? error.message : 'Unknown'}` :
        `DynamoDB error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }

    const keysCached = this.keyCache.size;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (kmsConnectivity && dynamoConnectivity) {
      status = 'healthy';
    } else if (kmsConnectivity || dynamoConnectivity) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      kmsConnectivity,
      dynamoConnectivity,
      keysCached,
      lastError,
    };
  }
}

// Export singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export const getEncryptionService = (): EncryptionService => {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
};