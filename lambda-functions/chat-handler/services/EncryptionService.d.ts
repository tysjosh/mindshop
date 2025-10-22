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
export declare class EncryptionService {
    private kmsClient;
    private dynamoClient;
    private keyTableName;
    private defaultKeyId;
    private keyCache;
    private readonly KEY_CACHE_TTL;
    constructor();
    /**
     * Encrypt data using envelope encryption with KMS
     */
    encryptData(plaintext: string | Buffer, encryptionContext: EncryptionContext, keyId?: string): Promise<EncryptedData>;
    /**
     * Decrypt data using envelope encryption with KMS
     */
    decryptData(encryptedData: EncryptedData): Promise<Buffer>;
    /**
     * Encrypt sensitive string data with automatic context
     */
    encryptString(data: string, merchantId: string, dataType: string, purpose?: string): Promise<string>;
    /**
     * Decrypt sensitive string data
     */
    decryptString(encryptedString: string): Promise<string>;
    /**
     * Create a new KMS key for a specific merchant
     */
    createMerchantKey(merchantId: string, description?: string): Promise<string>;
    /**
     * Get or create a key for a merchant
     */
    getMerchantKey(merchantId: string): Promise<string>;
    /**
     * Rotate encryption keys
     */
    rotateKey(keyId: string): Promise<void>;
    /**
     * Get key rotation information
     */
    getKeyRotationInfo(keyId: string): Promise<KeyRotationInfo>;
    /**
     * Encrypt data at rest for database storage
     */
    encryptForStorage(data: any, merchantId: string, tableName: string): Promise<string>;
    /**
     * Decrypt data from database storage
     */
    decryptFromStorage(encryptedData: string): Promise<any>;
    /**
     * Secure hash function for data integrity
     */
    createSecureHash(data: string | Buffer, salt?: string): string;
    /**
     * Verify secure hash
     */
    verifySecureHash(data: string | Buffer, hash: string): boolean;
    /**
     * Generate cryptographically secure random token
     */
    generateSecureToken(length?: number): string;
    /**
     * Store key information in DynamoDB
     */
    private storeKeyInfo;
    /**
     * Get stored key information from DynamoDB
     */
    private getStoredKeyInfo;
    /**
     * Clean up expired cached keys
     */
    cleanupKeyCache(): void;
    /**
     * Get encryption service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        kmsConnectivity: boolean;
        dynamoConnectivity: boolean;
        keysCached: number;
        lastError?: string;
    }>;
}
export declare const getEncryptionService: () => EncryptionService;
//# sourceMappingURL=EncryptionService.d.ts.map