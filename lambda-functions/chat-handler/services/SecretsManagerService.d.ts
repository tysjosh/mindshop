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
export declare class SecretsManagerService {
    private secretsClient;
    private kmsClient;
    private cloudTrailClient;
    private secretCache;
    private readonly CACHE_TTL;
    constructor();
    /**
     * Get secret value with caching and audit logging
     */
    getSecret(secretName: string, versionId?: string): Promise<SecretValue>;
    /**
     * Create a new secret with encryption and rotation configuration
     */
    createSecret(config: SecretConfig, initialValue: string): Promise<string>;
    /**
     * Update secret value
     */
    updateSecret(secretName: string, newValue: string): Promise<void>;
    /**
     * Enable automatic rotation for a secret
     */
    enableRotation(secretName: string, rotationIntervalDays: number, rotationLambdaArn?: string): Promise<void>;
    /**
     * Get rotation status for a secret
     */
    getRotationStatus(secretName: string): Promise<RotationStatus>;
    /**
     * Get all secrets with their rotation status
     */
    getAllSecretsStatus(): Promise<RotationStatus[]>;
    /**
     * Rotate secret immediately
     */
    rotateSecretNow(secretName: string): Promise<void>;
    /**
     * Get database credentials from secrets manager
     */
    getDatabaseCredentials(secretName: string): Promise<{
        username: string;
        password: string;
        host: string;
        port: number;
        dbname: string;
    }>;
    /**
     * Get API key from secrets manager
     */
    getAPIKey(secretName: string, keyName?: string): Promise<string>;
    /**
     * Get service configuration from secrets manager
     */
    getServiceConfig<T = any>(secretName: string): Promise<T>;
    /**
     * Get audit events for secrets access
     */
    getSecretAuditEvents(secretName: string, startTime: Date, endTime?: Date): Promise<SecretAuditEvent[]>;
    /**
     * Check secrets that need rotation
     */
    getSecretsNeedingRotation(): Promise<{
        secretName: string;
        daysSinceLastRotation: number;
        rotationOverdue: boolean;
    }[]>;
    /**
     * Validate KMS key access for secrets
     */
    validateKMSAccess(kmsKeyId: string): Promise<{
        accessible: boolean;
        keyExists: boolean;
        error?: string;
    }>;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        secretsManagerConnectivity: boolean;
        kmsConnectivity: boolean;
        cloudTrailConnectivity: boolean;
        cacheSize: number;
        lastError?: string;
    }>;
    /**
     * Invalidate cache for a specific secret
     */
    private invalidateSecretCache;
    /**
     * Clean up expired cache entries
     */
    cleanupCache(): void;
    /**
     * Clear all cached secrets (for security)
     */
    clearCache(): void;
}
export declare const getSecretsManager: () => SecretsManagerService;
//# sourceMappingURL=SecretsManagerService.d.ts.map