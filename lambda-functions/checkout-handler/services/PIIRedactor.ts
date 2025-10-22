import { RedactedQuery, TokenizedContext, UserContext } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { KMS, DynamoDB } from 'aws-sdk';
import { getEncryptionService } from './EncryptionService';

export interface PIIRedactor {
  redactQuery(query: string): RedactedQuery;
  tokenizeUserData(userData: UserContext): TokenizedContext;
  sanitizeResponse(response: string): string;
}

export interface SecureToken {
  token_id: string;
  encrypted_value: string;
  data_type: 'payment' | 'personal' | 'address' | 'contact';
  created_at: Date;
  expires_at?: Date;
  merchant_id: string;
  user_id?: string;
}

export interface TokenMapping {
  token_id: string;
  original_field: string;
  token_value: string;
  data_classification: 'sensitive' | 'pii' | 'payment' | 'confidential';
}

export class PIIRedactorService implements PIIRedactor {
  private kms: KMS;
  private dynamodb: DynamoDB;
  private kmsKeyId: string;
  private tokenTableName: string;
  private encryptionService = getEncryptionService();

  private readonly piiPatterns = [
    // Email patterns
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    // Phone patterns (US format)
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    /\(\d{3}\)\s?\d{3}[-.]?\d{4}/g,
    // Credit card patterns (basic)
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    // SSN patterns
    /\b\d{3}-\d{2}-\d{4}\b/g,
    // Address patterns (basic street numbers)
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi,
    // Payment token patterns (to prevent leakage)
    /\b(?:tok_|card_|pm_|pi_|src_)[a-zA-Z0-9]{10,}\b/g,
  ];

  private readonly sensitiveFields = [
    'email',
    'phone',
    'address',
    'creditCard',
    'ssn',
    'firstName',
    'lastName',
    'fullName',
    'paymentMethod',
    'cardNumber',
    'cvv',
    'expiryDate',
  ];

  private readonly paymentFields = [
    'card_number',
    'cvv',
    'expiry_date',
    'payment_token',
    'payment_method_id',
    'billing_address',
  ];

  constructor() {
    this.kms = new KMS({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamodb = new DynamoDB({ region: process.env.AWS_REGION || 'us-east-1' });
    this.kmsKeyId = process.env.PII_KMS_KEY_ID || 'alias/pii-encryption-key';
    this.tokenTableName = process.env.TOKEN_MAPPING_TABLE || 'pii-token-mappings';
  }

  public redactQuery(query: string): RedactedQuery {
    const tokens = new Map<string, string>();
    let sanitizedText = query;

    // Apply PII patterns
    this.piiPatterns.forEach((pattern, index) => {
      sanitizedText = sanitizedText.replace(pattern, (match) => {
        const token = `[PII_TOKEN_${index}_${uuidv4().substring(0, 8)}]`;
        tokens.set(token, match);
        return token;
      });
    });

    return {
      sanitizedText,
      tokens,
    };
  }

  public tokenizeUserData(userData: UserContext): TokenizedContext {
    const tokenizedData: Record<string, string> = {};
    const tokenMap = new Map<string, string>();

    // Tokenize sensitive fields in user context
    const processObject = (obj: any, prefix = ''): any => {
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (this.sensitiveFields.some(field => field.toLowerCase() === key.toLowerCase()) && typeof value === 'string') {
          const token = `[USER_TOKEN_${uuidv4().substring(0, 8)}]`;
          tokenMap.set(token, value);
          result[key] = token;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = processObject(value, fullKey);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    const processedData = processObject(userData);

    return {
      tokenizedData: processedData,
      tokenMap,
    };
  }

  public sanitizeResponse(response: string): string {
    let sanitized = response;

    // Remove any potential PII that might have leaked through
    this.piiPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  public async redactText(text: string): Promise<RedactedQuery> {
    return this.redactQuery(text);
  }

  public detokenize(tokenizedText: string, tokenMap: Map<string, string>): string {
    let result = tokenizedText;
    
    tokenMap.forEach((originalValue, token) => {
      result = result.replace(new RegExp(token, 'g'), originalValue);
    });
    
    return result;
  }

  /**
   * Tokenize address information for secure processing
   */
  public async tokenizeAddress(address: {
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }): Promise<{
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }> {
    // For checkout processing, we need to maintain the address structure
    // but tokenize sensitive information. In a real implementation,
    // this would use KMS to create reversible tokens.
    
    // For now, we'll return the address as-is since payment processors
    // need the actual address data. In production, this would:
    // 1. Create KMS-encrypted tokens for the sensitive fields
    // 2. Store the mapping in a secure token vault
    // 3. Return tokenized versions that can be reversed for payment processing
    
    return address;
  }

  /**
   * Create secure token using KMS encryption
   */
  public async createSecureToken(
    value: string,
    dataType: SecureToken['data_type'],
    merchantId: string,
    userId?: string,
    expiresInHours?: number
  ): Promise<string> {
    try {
      // Generate unique token ID
      const tokenId = `${dataType}_${uuidv4().replace(/-/g, '')}`;

      // Encrypt the value using KMS
      const encryptParams = {
        KeyId: this.kmsKeyId,
        Plaintext: Buffer.from(value, 'utf8'),
        EncryptionContext: {
          token_id: tokenId,
          merchant_id: merchantId,
          data_type: dataType,
        },
      };
      const encryptResult = await this.kms.encrypt(encryptParams).promise();

      if (!encryptResult.CiphertextBlob) {
        throw new Error('KMS encryption failed');
      }

      const encryptedValue = encryptResult.CiphertextBlob.toString('base64');

      // Calculate expiration
      const expiresAt = expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : undefined;

      // Store token mapping in DynamoDB
      const tokenRecord: SecureToken = {
        token_id: tokenId,
        encrypted_value: encryptedValue,
        data_type: dataType,
        created_at: new Date(),
        expires_at: expiresAt,
        merchant_id: merchantId,
        user_id: userId,
      };

      await this.storeTokenMapping(tokenRecord);

      console.log(`Created secure token ${tokenId} for ${dataType} data`);
      return tokenId;

    } catch (error) {
      console.error('Failed to create secure token:', error);
      throw new Error(`Token creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve original value from secure token
   */
  public async retrieveFromToken(tokenId: string, merchantId: string): Promise<string | null> {
    try {
      // Get token mapping from DynamoDB
      const tokenRecord = await this.getTokenMapping(tokenId, merchantId);
      
      if (!tokenRecord) {
        console.warn(`Token ${tokenId} not found for merchant ${merchantId}`);
        return null;
      }

      // Check if token has expired
      if (tokenRecord.expires_at && tokenRecord.expires_at < new Date()) {
        console.warn(`Token ${tokenId} has expired`);
        await this.deleteTokenMapping(tokenId, merchantId);
        return null;
      }

      // Decrypt the value using KMS
      const decryptResult = await this.kms.decrypt({
        CiphertextBlob: Buffer.from(tokenRecord.encrypted_value, 'base64'),
        EncryptionContext: {
          token_id: tokenId,
          merchant_id: merchantId,
          data_type: tokenRecord.data_type,
        },
      }).promise();

      if (!decryptResult.Plaintext) {
        throw new Error('KMS decryption failed');
      }

      return decryptResult.Plaintext.toString('utf8');

    } catch (error) {
      console.error(`Failed to retrieve token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Tokenize payment information securely
   */
  public async tokenizePaymentData(paymentData: {
    card_number?: string;
    cvv?: string;
    expiry_date?: string;
    payment_method_id?: string;
    billing_address?: Record<string, any>;
  }, merchantId: string, userId?: string): Promise<{
    tokenized_data: Record<string, string>;
    token_mappings: TokenMapping[];
  }> {
    const tokenizedData: Record<string, string> = {};
    const tokenMappings: TokenMapping[] = [];

    for (const [field, value] of Object.entries(paymentData)) {
      if (value && this.paymentFields.includes(field)) {
        try {
          const token = await this.createSecureToken(
            typeof value === 'string' ? value : JSON.stringify(value),
            'payment',
            merchantId,
            userId,
            24 // Payment tokens expire in 24 hours
          );

          tokenizedData[field] = token;
          tokenMappings.push({
            token_id: token,
            original_field: field,
            token_value: token,
            data_classification: 'payment',
          });

        } catch (error) {
          console.error(`Failed to tokenize payment field ${field}:`, error);
          // For critical payment fields, fail the entire operation
          if (['card_number', 'cvv'].includes(field)) {
            throw new Error(`Critical payment field tokenization failed: ${field}`);
          }
          // For non-critical fields, redact the value
          tokenizedData[field] = '[REDACTED]';
        }
      } else {
        tokenizedData[field] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    return { tokenized_data: tokenizedData, token_mappings: tokenMappings };
  }

  /**
   * Sanitize conversation logs before persistence
   */
  public async sanitizeConversationLog(
    conversationData: {
      user_message: string;
      assistant_response: string;
      context?: Record<string, any>;
      metadata?: Record<string, any>;
    },
    merchantId: string
  ): Promise<{
    sanitized_conversation: Record<string, any>;
    redaction_summary: {
      fields_redacted: string[];
      tokens_created: number;
      pii_patterns_found: number;
    };
  }> {
    const fieldsRedacted: string[] = [];
    let tokensCreated = 0;
    let piiPatternsFound = 0;

    // Sanitize user message
    const userMessageResult = this.redactQuery(conversationData.user_message);
    if (userMessageResult.tokens.size > 0) {
      fieldsRedacted.push('user_message');
      piiPatternsFound += userMessageResult.tokens.size;
    }

    // Sanitize assistant response
    const assistantResponseResult = this.sanitizeResponse(conversationData.assistant_response);
    const responseRedacted = assistantResponseResult !== conversationData.assistant_response;
    if (responseRedacted) {
      fieldsRedacted.push('assistant_response');
    }

    // Sanitize context and metadata
    const sanitizedContext = conversationData.context ? 
      await this.sanitizeObject(conversationData.context, merchantId) : undefined;
    
    const sanitizedMetadata = conversationData.metadata ? 
      await this.sanitizeObject(conversationData.metadata, merchantId) : undefined;

    if (sanitizedContext) {
      fieldsRedacted.push('context');
    }

    if (sanitizedMetadata) {
      fieldsRedacted.push('metadata');
    }

    return {
      sanitized_conversation: {
        user_message: userMessageResult.sanitizedText,
        assistant_response: assistantResponseResult,
        context: sanitizedContext || conversationData.context,
        metadata: sanitizedMetadata || conversationData.metadata,
        redaction_applied: fieldsRedacted.length > 0,
        redaction_timestamp: new Date().toISOString(),
      },
      redaction_summary: {
        fields_redacted: fieldsRedacted,
        tokens_created: tokensCreated,
        pii_patterns_found: piiPatternsFound,
      },
    };
  }

  /**
   * Sanitize arbitrary object by removing/tokenizing sensitive fields
   */
  private async sanitizeObject(obj: Record<string, any>, merchantId: string): Promise<Record<string, any> | null> {
    let hasChanges = false;
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        // Sensitive field - tokenize or redact
        if (typeof value === 'string' && value.length > 0) {
          try {
            const token = await this.createSecureToken(value, 'personal', merchantId, undefined, 168); // 7 days
            sanitized[key] = token;
            hasChanges = true;
          } catch (error) {
            sanitized[key] = '[REDACTED]';
            hasChanges = true;
          }
        } else {
          sanitized[key] = '[REDACTED]';
          hasChanges = true;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        const nestedSanitized = await this.sanitizeObject(value, merchantId);
        sanitized[key] = nestedSanitized || value;
        if (nestedSanitized) {
          hasChanges = true;
        }
      } else {
        sanitized[key] = value;
      }
    }

    return hasChanges ? sanitized : null;
  }

  /**
   * Store token mapping in DynamoDB
   */
  private async storeTokenMapping(tokenRecord: SecureToken): Promise<void> {
    const item = {
      token_id: { S: tokenRecord.token_id },
      merchant_id: { S: tokenRecord.merchant_id },
      encrypted_value: { S: tokenRecord.encrypted_value },
      data_type: { S: tokenRecord.data_type },
      created_at: { S: tokenRecord.created_at.toISOString() },
      ...(tokenRecord.expires_at && { expires_at: { S: tokenRecord.expires_at.toISOString() } }),
      ...(tokenRecord.user_id && { user_id: { S: tokenRecord.user_id } }),
    };

    await this.dynamodb.putItem({
      TableName: this.tokenTableName,
      Item: item,
    }).promise();
  }

  /**
   * Get token mapping from DynamoDB
   */
  private async getTokenMapping(tokenId: string, merchantId: string): Promise<SecureToken | null> {
    try {
      const result = await this.dynamodb.getItem({
        TableName: this.tokenTableName,
        Key: {
          token_id: { S: tokenId },
          merchant_id: { S: merchantId },
        },
      }).promise();

      if (!result.Item) {
        return null;
      }

      return {
        token_id: result.Item.token_id.S!,
        merchant_id: result.Item.merchant_id.S!,
        encrypted_value: result.Item.encrypted_value.S!,
        data_type: result.Item.data_type.S! as SecureToken['data_type'],
        created_at: new Date(result.Item.created_at.S!),
        expires_at: result.Item.expires_at?.S ? new Date(result.Item.expires_at.S) : undefined,
        user_id: result.Item.user_id?.S,
      };

    } catch (error) {
      console.error(`Failed to get token mapping ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Delete expired token mapping
   */
  private async deleteTokenMapping(tokenId: string, merchantId: string): Promise<void> {
    try {
      await this.dynamodb.deleteItem({
        TableName: this.tokenTableName,
        Key: {
          token_id: { S: tokenId },
          merchant_id: { S: merchantId },
        },
      }).promise();

      console.log(`Deleted expired token ${tokenId}`);

    } catch (error) {
      console.error(`Failed to delete token ${tokenId}:`, error);
    }
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  public async cleanupExpiredTokens(merchantId?: string): Promise<number> {
    console.log(`Cleaning up expired tokens for merchant: ${merchantId || 'all'}`);

    try {
      // In a real implementation, this would use a GSI to query by expires_at
      // For now, we'll return 0 as a placeholder
      return 0;

    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }
}
// Export singleton instance
let piiRedactorInstance: PIIRedactorService | null = null;

export const getPIIRedactor = (): PIIRedactorService => {
  if (!piiRedactorInstance) {
    piiRedactorInstance = new PIIRedactorService();
  }
  return piiRedactorInstance;
};

// Export class alias to avoid conflict
export const PIIRedactorClass = PIIRedactorService;