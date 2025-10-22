"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecretsManager = exports.SecretsManagerService = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_kms_1 = require("@aws-sdk/client-kms");
const client_cloudtrail_1 = require("@aws-sdk/client-cloudtrail");
/**
 * Comprehensive secrets management service with rotation and auditing
 */
class SecretsManagerService {
    constructor() {
        this.secretCache = new Map();
        this.CACHE_TTL = 300000; // 5 minutes
        const region = process.env.AWS_REGION || 'us-east-1';
        this.secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region });
        this.kmsClient = new client_kms_1.KMSClient({ region });
        this.cloudTrailClient = new client_cloudtrail_1.CloudTrailClient({ region });
    }
    /**
     * Get secret value with caching and audit logging
     */
    async getSecret(secretName, versionId) {
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
            const command = new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretName,
                VersionId: versionId,
            });
            const response = await this.secretsClient.send(command);
            if (!response.SecretString) {
                throw new Error(`Secret ${secretName} has no string value`);
            }
            const secretValue = {
                value: response.SecretString,
                version: response.VersionId,
                createdDate: response.CreatedDate,
                lastChangedDate: response.LastChangedDate,
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
        }
        catch (error) {
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
    async createSecret(config, initialValue) {
        try {
            const command = new client_secrets_manager_1.CreateSecretCommand({
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
        }
        catch (error) {
            console.error(`Failed to create secret ${config.secretName}:`, error);
            throw error;
        }
    }
    /**
     * Update secret value
     */
    async updateSecret(secretName, newValue) {
        try {
            const command = new client_secrets_manager_1.PutSecretValueCommand({
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
        }
        catch (error) {
            console.error(`Failed to update secret ${secretName}:`, error);
            throw error;
        }
    }
    /**
     * Enable automatic rotation for a secret
     */
    async enableRotation(secretName, rotationIntervalDays, rotationLambdaArn) {
        try {
            const command = new client_secrets_manager_1.RotateSecretCommand({
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
        }
        catch (error) {
            console.error(`Failed to enable rotation for secret ${secretName}:`, error);
            throw error;
        }
    }
    /**
     * Get rotation status for a secret
     */
    async getRotationStatus(secretName) {
        try {
            const command = new client_secrets_manager_1.DescribeSecretCommand({
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
        }
        catch (error) {
            console.error(`Failed to get rotation status for secret ${secretName}:`, error);
            throw error;
        }
    }
    /**
     * Get all secrets with their rotation status
     */
    async getAllSecretsStatus() {
        try {
            const command = new client_secrets_manager_1.ListSecretsCommand({
                MaxResults: 100,
            });
            const response = await this.secretsClient.send(command);
            const statuses = [];
            if (response.SecretList) {
                for (const secret of response.SecretList) {
                    if (secret.Name) {
                        const status = await this.getRotationStatus(secret.Name);
                        statuses.push(status);
                    }
                }
            }
            return statuses;
        }
        catch (error) {
            console.error('Failed to get all secrets status:', error);
            throw error;
        }
    }
    /**
     * Rotate secret immediately
     */
    async rotateSecretNow(secretName) {
        try {
            const command = new client_secrets_manager_1.RotateSecretCommand({
                SecretId: secretName,
                ForceRotateSecrets: true,
            });
            await this.secretsClient.send(command);
            // Invalidate cache
            this.invalidateSecretCache(secretName);
            // Log manual rotation
            console.log('AUDIT_LOG', {
                event_type: 'secret_manual_rotation',
                secret_name: secretName,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`Failed to rotate secret ${secretName}:`, error);
            throw error;
        }
    }
    /**
     * Get database credentials from secrets manager
     */
    async getDatabaseCredentials(secretName) {
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
        }
        catch (error) {
            throw new Error(`Invalid database credentials format in secret ${secretName}`);
        }
    }
    /**
     * Get API key from secrets manager
     */
    async getAPIKey(secretName, keyName = 'apiKey') {
        const secret = await this.getSecret(secretName);
        try {
            const parsed = JSON.parse(secret.value);
            if (!parsed[keyName]) {
                throw new Error(`API key '${keyName}' not found in secret`);
            }
            return parsed[keyName];
        }
        catch (error) {
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
    async getServiceConfig(secretName) {
        const secret = await this.getSecret(secretName);
        try {
            return JSON.parse(secret.value);
        }
        catch (error) {
            throw new Error(`Invalid JSON format in secret ${secretName}`);
        }
    }
    /**
     * Get audit events for secrets access
     */
    async getSecretAuditEvents(secretName, startTime, endTime = new Date()) {
        try {
            const command = new client_cloudtrail_1.LookupEventsCommand({
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
            const events = [];
            if (response.Events) {
                for (const event of response.Events) {
                    if (event.EventTime && event.EventName && event.Username) {
                        events.push({
                            eventTime: event.EventTime,
                            eventName: event.EventName,
                            userIdentity: event.Username,
                            sourceIPAddress: event.SourceIPAddress || 'unknown',
                            secretName,
                            eventId: event.EventId || 'unknown',
                        });
                    }
                }
            }
            return events;
        }
        catch (error) {
            console.error(`Failed to get audit events for secret ${secretName}:`, error);
            return [];
        }
    }
    /**
     * Check secrets that need rotation
     */
    async getSecretsNeedingRotation() {
        const allSecrets = await this.getAllSecretsStatus();
        const needingRotation = [];
        const now = new Date();
        for (const secret of allSecrets) {
            if (secret.rotationEnabled && secret.lastRotationDate) {
                const daysSinceRotation = Math.floor((now.getTime() - secret.lastRotationDate.getTime()) / (1000 * 60 * 60 * 24));
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
    async validateKMSAccess(kmsKeyId) {
        try {
            const command = new client_kms_1.DescribeKeyCommand({
                KeyId: kmsKeyId,
            });
            const response = await this.kmsClient.send(command);
            return {
                accessible: true,
                keyExists: !!response.KeyMetadata,
            };
        }
        catch (error) {
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
    async getHealthStatus() {
        let secretsManagerConnectivity = false;
        let kmsConnectivity = false;
        let cloudTrailConnectivity = false;
        let lastError;
        // Test Secrets Manager connectivity
        try {
            await this.secretsClient.send(new client_secrets_manager_1.ListSecretsCommand({ MaxResults: 1 }));
            secretsManagerConnectivity = true;
        }
        catch (error) {
            lastError = `SecretsManager: ${error instanceof Error ? error.message : 'Unknown'}`;
        }
        // Test KMS connectivity
        try {
            await this.kmsClient.send(new client_kms_1.DescribeKeyCommand({ KeyId: 'alias/aws/secretsmanager' }));
            kmsConnectivity = true;
        }
        catch (error) {
            const kmsError = `KMS: ${error instanceof Error ? error.message : 'Unknown'}`;
            lastError = lastError ? `${lastError}; ${kmsError}` : kmsError;
        }
        // Test CloudTrail connectivity
        try {
            await this.cloudTrailClient.send(new client_cloudtrail_1.LookupEventsCommand({ MaxResults: 1 }));
            cloudTrailConnectivity = true;
        }
        catch (error) {
            const ctError = `CloudTrail: ${error instanceof Error ? error.message : 'Unknown'}`;
            lastError = lastError ? `${lastError}; ${ctError}` : ctError;
        }
        let status;
        if (secretsManagerConnectivity && kmsConnectivity) {
            status = 'healthy';
        }
        else if (secretsManagerConnectivity) {
            status = 'degraded';
        }
        else {
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
    invalidateSecretCache(secretName) {
        const keysToDelete = [];
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
    cleanupCache() {
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
    clearCache() {
        this.secretCache.clear();
        console.log('AUDIT_LOG', {
            event_type: 'secrets_cache_cleared',
            timestamp: new Date().toISOString(),
        });
    }
}
exports.SecretsManagerService = SecretsManagerService;
// Export singleton instance
let secretsManagerInstance = null;
const getSecretsManager = () => {
    if (!secretsManagerInstance) {
        secretsManagerInstance = new SecretsManagerService();
    }
    return secretsManagerInstance;
};
exports.getSecretsManager = getSecretsManager;
//# sourceMappingURL=SecretsManagerService.js.map