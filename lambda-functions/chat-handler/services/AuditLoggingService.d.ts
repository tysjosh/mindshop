import { AuditLogRepository } from '../repositories/AuditLogRepository';
export interface AuditLoggingConfig {
    s3BucketName: string;
    kmsKeyId: string;
    cloudWatchLogGroup: string;
    region: string;
    retentionDays: number;
}
export interface ConversationAuditEntry {
    id: string;
    sessionId: string;
    merchantId: string;
    userId: string;
    timestamp: Date;
    messageType: 'user_input' | 'assistant_response' | 'system_event';
    content: string;
    metadata: {
        requestPayloadHash: string;
        responseReference: string;
        latency?: number;
        toolsUsed?: string[];
        confidence?: number;
        intent?: string;
        sources?: Array<{
            id: string;
            score: number;
        }>;
        predictions?: Array<{
            sku: string;
            confidence: number;
        }>;
        errorDetails?: string;
    };
    piiRedacted: boolean;
    encryptionKeyId?: string;
}
export interface AuditSearchQuery {
    merchantId: string;
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    messageType?: ConversationAuditEntry['messageType'];
    limit?: number;
}
export interface AuditSearchResult {
    entries: ConversationAuditEntry[];
    totalCount: number;
    hasMore: boolean;
    nextToken?: string;
}
export declare class AuditLoggingService {
    private s3Client;
    private kmsClient;
    private cloudWatchClient;
    private auditLogRepository;
    private config;
    constructor(config: AuditLoggingConfig, auditLogRepository: AuditLogRepository);
    /**
     * Log conversation entry with encryption and archival
     */
    logConversationEntry(entry: Omit<ConversationAuditEntry, 'id' | 'timestamp'>): Promise<string>;
    /**
     * Retrieve conversation entries with decryption
     */
    searchConversationEntries(query: AuditSearchQuery): Promise<AuditSearchResult>;
    /**
     * Get conversation summary for a session
     */
    getSessionSummary(sessionId: string, merchantId: string): Promise<{
        sessionId: string;
        merchantId: string;
        userId: string;
        startTime: Date;
        endTime: Date;
        messageCount: number;
        userMessages: number;
        assistantMessages: number;
        systemEvents: number;
        avgResponseTime: number;
        toolsUsed: string[];
        intents: string[];
        errorCount: number;
    }>;
    /**
     * Clean up old audit entries based on retention policy
     */
    cleanupOldEntries(): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
    /**
     * Generate compliance report
     */
    generateComplianceReport(merchantId: string, startDate: Date, endDate: Date): Promise<{
        merchantId: string;
        reportPeriod: {
            start: Date;
            end: Date;
        };
        totalConversations: number;
        totalMessages: number;
        piiRedactionRate: number;
        encryptionRate: number;
        errorRate: number;
        avgResponseTime: number;
        dataRetentionCompliance: boolean;
        auditTrailIntegrity: boolean;
    }>;
    /**
     * Check if content contains sensitive data
     */
    private containsSensitiveData;
    /**
     * Encrypt content using KMS
     */
    private encryptContent;
    /**
     * Decrypt content using KMS
     */
    private decryptContent;
    /**
     * Log to CloudWatch for real-time monitoring
     */
    private logToCloudWatch;
    /**
     * Archive to S3 for long-term storage
     */
    private archiveToS3;
    /**
     * Retrieve from S3
     */
    private retrieveFromS3;
    /**
     * Delete from S3
     */
    private deleteFromS3;
}
export declare function createAuditLoggingService(auditLogRepository: AuditLogRepository): AuditLoggingService;
//# sourceMappingURL=AuditLoggingService.d.ts.map