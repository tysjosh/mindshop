import { 
  SecretsManagerClient, 
  GetSecretValueCommand, 
  CreateSecretCommand, 
  UpdateSecretCommand,
  RotateSecretCommand,
  DescribeSecretCommand,
  ListSecretsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { KMSClient, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { CloudTrailClient, LookupEventsCommand } from '@aws-sdk/client-cloudtrail';

export interface SecretConfig {
  secretName: string;
  description: string;
  kmsKeyId?: string;
  rotationEnabled?: boolean;
  rotationIntervalDays?: number;
  tags?: Record<string, string>;
}

export interface SecretValue {
  value: string;
  version?: string;
  createdDate?: Date;
  lastChangedDate?: Date;
  lastAccessedDate?: Date;
}

export interface RotationStatus {
  secretName: string;
  rotationEnabled: boolean;
  lastRotationDate?: Date;
  nextRotationDate?: Date;
  rotationInProgress: boolean;
  rotationLambdaArn?: string;
}

export interface SecretAuditEvent {
  eventTime: Date;
  eventName: string;
  userIdentity: string;
  sourceIPAddress: string;
  secretName: string;
  eventId: string;
}

/**
 * Comprehensive secrets management service with rotation and auditing
 */
export class SecretsManagerService {
  private secretsClient: SecretsManagerClient;
  private kmsClient: KMSClient;
  private cloudTrailClient: CloudTrailClient;
  private secretCache: Map<string, { value: SecretValue; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    
    this.secretsClient = new SecretsManagerClient({ region });
    this.kmsClient = new KMSClient({ region });
    this.cloudTrailClient = new CloudTrailClient({ region });
  }

  /**
   * Get secret value with caching and audit logging
   */
  public async getSecret(secretName: string, versionId?: string): Promise<SecretValue> {
    const cacheKey = `${secretName}:${versionId || 'current'}`;
    
    // Check cache first
    const cached = this.secretCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Log cache hit for monitoring
      console.log('AUDIT_LOG', {
        event_type: 'secret_cache_hit',
        secret_name: secretName,
        version_id: versionId,
        timestamp: new Date().toISOString(),
      });
      
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionId: versionId,
      });

      const response = await this.secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} has no string value`);
      }

      const secretValue: SecretValue = {
        value: response.SecretString,
        version: response.VersionId,
        createdDate: response.CreatedDate,
        lastChangedDate: (response as any).LastChangedDate,
        lastAccessedDate: new Date(),
      };

      // Cache the secret
      this.secretCache.set(cacheKey, {
        value: secretValue,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      // Log secret access for audit
      console.log('AUDIT_LOG', {
        event_type: 'secret_accessed',
        secret_name: secretName,
        version_id: versionId || 'current',
        arn: response.ARN,
        timestamp: new Date().toISOString(),
      });

      return secretValue;

    } catch (error) {
      console.error(`Failed to get secret ${secretName}:`, error);
      
      // Log security event
      console.log('SECURITY_EVENT', {
        event_type: 'secret_access_failed',
        secret_name: secretName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Create a new secret with encryption and rotation configuration
   */
  public async createSecret(config: SecretConfig, initialValue: string): Promise<string> {
    try {
      const command = new CreateSecretCommand({
        Name: config.secretName,
        Description: config.description,
        SecretString: initialValue,
        KmsKeyId: config.kmsKeyId,
        Tags: config.tags ? Object.entries(config.tags).map(([Key, Value]) => ({ Key, Value })) : undefined,
      });

      const response = await this.secretsClient.send(command);

      if (!response.ARN) {
        throw new Error('Failed to create secret - no ARN returned');
      }

      // Enable rotation if requested
      if (config.rotationEnabled && config.rotationIntervalDays) {
        await this.enableRotation(config.secretName, config.rotationIntervalDays);
      }

      // Log secret creation
      console.log('AUDIT_LOG', {
        event_type: 'secret_created',
        secret_name: config.secretName,
        arn: response.ARN,
        rotation_enabled: config.rotationEnabled || false,
        kms_key_id: config.kmsKeyId,
        timestamp: new Date().toISOString(),
      });

      return response.ARN;

    } catch (error) {
      console.error(`Failed to create secret ${config.secretName}:`, error);
      throw error;
    }
  }

  /**
   * Update secret value
   */
  public async updateSecret(secretName: string, newValue: string): Promise<void> {
    try {
      const command = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: newValue,
      });

      await this.secretsClient.send(command);

      // Invalidate cache
      this.invalidateSecretCache(secretName);

      // Log secret update
      console.log('AUDIT_LOG', {
        event_type: 'secret_updated',
        secret_name: secretName,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Failed to update secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Enable automatic rotation for a secret
   */
  public async enableRotation(
    secretName: string, 
    rotationIntervalDays: number,
    rotationLambdaArn?: string
  ): Promise<void> {
    try {
      const command = new RotateSecretCommand({
        SecretId: secretName,
        RotationRules: {
          AutomaticallyAfterDays: rotationIntervalDays,
        },
        RotationLambdaARN: rotationLambdaArn,
      });

      await this.secretsClient.send(command);

      // Log rotation enablement
      console.log('AUDIT_LOG', {
        event_type: 'secret_rotation_enabled',
        secret_name: secretName,
        rotation_interval_days: rotationIntervalDays,
        rotation_lambda_arn: rotationLambdaArn,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Failed to enable rotation for secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Get rotation status for a secret
   */
  public async getRotationStatus(secretName: string): Promise<RotationStatus> {
    try {
      const command = new DescribeSecretCommand({
        SecretId: secretName,
      });

      const response = await this.secretsClient.send(command);

      return {
        secretName,
        rotationEnabled: response.RotationEnabled || false,
        lastRotationDate: response.LastRotatedDate,
        nextRotationDate: response.NextRotationDate,
        rotationInProgress: !!(response.RotationEnabled && 
          response.NextRotationDate && 
          response.NextRotationDate <= new Date()),
        rotationLambdaArn: response.RotationLambdaARN,
      };

    } catch (error) {
      console.error(`Failed to get rotation status for secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Get all secrets with their rotation status
   */
  public async getAllSecretsStatus(): Promise<RotationStatus[]> {
    try {
      const command = new ListSecretsCommand({
        MaxResults: 100,
      });

      const response = await this.secretsClient.send(command);
      const statuses: RotationStatus[] = [];

      if (response.SecretList) {
        for (const secret of response.SecretList) {
          if (secret.Name) {
            const status = await this.getRotationStatus(secret.Name);
            statuses.push(status);
          }
        }
      }

      return statuses;

    } catch (error) {
      console.error('Failed to get all secrets status:', error);
      throw error;
    }
  }

  /**
   * Rotate secret immediately
   */
  public async rotateSecretNow(secretName: string): Promise<void> {
    try {
      const command = new RotateSecretCommand({
        SecretId: secretName,
        ForceRotateSecrets: true,
      } as any);

      await this.secretsClient.send(command);

      // Invalidate cache
      this.invalidateSecretCache(secretName);

      // Log manual rotation
      console.log('AUDIT_LOG', {
        event_type: 'secret_manual_rotation',
        secret_name: secretName,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Failed to rotate secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Get database credentials from secrets manager
   */
  public async getDatabaseCredentials(secretName: string): Promise<{
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
  }> {
    const secret = await this.getSecret(secretName);
    
    try {
      const credentials = JSON.parse(secret.value);
      
      return {
        username: credentials.username,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port || 5432,
        dbname: credentials.dbname || 'postgres',
      };

    } catch (error) {
      throw new Error(`Invalid database credentials format in secret ${secretName}`);
    }
  }

  /**
   * Get API key from secrets manager
   */
  public async getAPIKey(secretName: string, keyName: string = 'apiKey'): Promise<string> {
    const secret = await this.getSecret(secretName);
    
    try {
      const parsed = JSON.parse(secret.value);
      
      if (!parsed[keyName]) {
        throw new Error(`API key '${keyName}' not found in secret`);
      }
      
      return parsed[keyName];

    } catch (error) {
      if (error instanceof SyntaxError) {
        // Assume the entire secret value is the API key
        return secret.value;
      }
      throw error;
    }
  }

  /**
   * Get service configuration from secrets manager
   */
  public async getServiceConfig<T = any>(secretName: string): Promise<T> {
    const secret = await this.getSecret(secretName);
    
    try {
      return JSON.parse(secret.value) as T;
    } catch (error) {
      throw new Error(`Invalid JSON format in secret ${secretName}`);
    }
  }

  /**
   * Get audit events for secrets access
   */
  public async getSecretAuditEvents(
    secretName: string,
    startTime: Date,
    endTime: Date = new Date()
  ): Promise<SecretAuditEvent[]> {
    try {
      const command = new LookupEventsCommand({
        LookupAttributes: [
          {
            AttributeKey: 'ResourceName',
            AttributeValue: secretName,
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
        MaxResults: 50,
      });

      const response = await this.cloudTrailClient.send(command);
      const events: SecretAuditEvent[] = [];

      if (response.Events) {
        for (const event of response.Events) {
          if (event.EventTime && event.EventName && event.Username) {
            events.push({
              eventTime: event.EventTime,
              eventName: event.EventName,
              userIdentity: event.Username,
              sourceIPAddress: (event as any).SourceIPAddress || 'unknown',
              secretName,
              eventId: event.EventId || 'unknown',
            });
          }
        }
      }

      return events;

    } catch (error) {
      console.error(`Failed to get audit events for secret ${secretName}:`, error);
      return [];
    }
  }

  /**
   * Check secrets that need rotation
   */
  public async getSecretsNeedingRotation(): Promise<{
    secretName: string;
    daysSinceLastRotation: number;
    rotationOverdue: boolean;
  }[]> {
    const allSecrets = await this.getAllSecretsStatus();
    const needingRotation: {
      secretName: string;
      daysSinceLastRotation: number;
      rotationOverdue: boolean;
    }[] = [];

    const now = new Date();

    for (const secret of allSecrets) {
      if (secret.rotationEnabled && secret.lastRotationDate) {
        const daysSinceRotation = Math.floor(
          (now.getTime() - secret.lastRotationDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Consider rotation overdue if it's been more than 95 days (assuming 90-day rotation)
        const rotationOverdue = daysSinceRotation > 95;

        if (daysSinceRotation > 80 || rotationOverdue) {
          needingRotation.push({
            secretName: secret.secretName,
            daysSinceLastRotation: daysSinceRotation,
            rotationOverdue,
          });
        }
      }
    }

    return needingRotation;
  }

  /**
   * Validate KMS key access for secrets
   */
  public async validateKMSAccess(kmsKeyId: string): Promise<{
    accessible: boolean;
    keyExists: boolean;
    error?: string;
  }> {
    try {
      const command = new DescribeKeyCommand({
        KeyId: kmsKeyId,
      });

      const response = await this.kmsClient.send(command);

      return {
        accessible: true,
        keyExists: !!response.KeyMetadata,
      };

    } catch (error) {
      return {
        accessible: false,
        keyExists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    secretsManagerConnectivity: boolean;
    kmsConnectivity: boolean;
    cloudTrailConnectivity: boolean;
    cacheSize: number;
    lastError?: string;
  }> {
    let secretsManagerConnectivity = false;
    let kmsConnectivity = false;
    let cloudTrailConnectivity = false;
    let lastError: string | undefined;

    // Test Secrets Manager connectivity
    try {
      await this.secretsClient.send(new ListSecretsCommand({ MaxResults: 1 }));
      secretsManagerConnectivity = true;
    } catch (error) {
      lastError = `SecretsManager: ${error instanceof Error ? error.message : 'Unknown'}`;
    }

    // Test KMS connectivity
    try {
      await this.kmsClient.send(new DescribeKeyCommand({ KeyId: 'alias/aws/secretsmanager' }));
      kmsConnectivity = true;
    } catch (error) {
      const kmsError = `KMS: ${error instanceof Error ? error.message : 'Unknown'}`;
      lastError = lastError ? `${lastError}; ${kmsError}` : kmsError;
    }

    // Test CloudTrail connectivity
    try {
      await this.cloudTrailClient.send(new LookupEventsCommand({ MaxResults: 1 }));
      cloudTrailConnectivity = true;
    } catch (error) {
      const ctError = `CloudTrail: ${error instanceof Error ? error.message : 'Unknown'}`;
      lastError = lastError ? `${lastError}; ${ctError}` : ctError;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (secretsManagerConnectivity && kmsConnectivity) {
      status = 'healthy';
    } else if (secretsManagerConnectivity) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      secretsManagerConnectivity,
      kmsConnectivity,
      cloudTrailConnectivity,
      cacheSize: this.secretCache.size,
      lastError,
    };
  }

  /**
   * Invalidate cache for a specific secret
   */
  private invalidateSecretCache(secretName: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.secretCache.keys()) {
      if (key.startsWith(`${secretName}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.secretCache.delete(key));
  }

  /**
   * Clean up expired cache entries
   */
  public cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.secretCache.entries()) {
      if (cached.expiresAt < now) {
        this.secretCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached secrets (for security)
   */
  public clearCache(): void {
    this.secretCache.clear();
    
    console.log('AUDIT_LOG', {
      event_type: 'secrets_cache_cleared',
      timestamp: new Date().toISOString(),
    });
  }
}

// Export singleton instance
let secretsManagerInstance: SecretsManagerService | null = null;

export const getSecretsManager = (): SecretsManagerService => {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManagerService();
  }
  return secretsManagerInstance;
};