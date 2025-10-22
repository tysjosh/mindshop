"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLoggingService = void 0;
exports.createAuditLoggingService = createAuditLoggingService;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_kms_1 = require("@aws-sdk/client-kms");
// Use stub types for development
let CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand;
try {
    const cloudwatch = require('@aws-sdk/client-cloudwatch-logs');
    CloudWatchLogsClient = cloudwatch.CloudWatchLogsClient;
    PutLogEventsCommand = cloudwatch.PutLogEventsCommand;
    CreateLogStreamCommand = cloudwatch.CreateLogStreamCommand;
}
catch {
    CloudWatchLogsClient = class {
        async send() { return {}; }
    };
    PutLogEventsCommand = class {
        constructor() { }
    };
    CreateLogStreamCommand = class {
        constructor() { }
    };
}
const uuid_1 = require("uuid");
const config_1 = require("../config");
class AuditLoggingService {
    constructor(config, auditLogRepository) {
        this.s3Client = new client_s3_1.S3Client({ region: config.region });
        this.kmsClient = new client_kms_1.KMSClient({ region: config.region });
        this.cloudWatchClient = new CloudWatchLogsClient({ region: config.region });
        this.auditLogRepository = auditLogRepository;
        this.config = config;
    }
    /**
     * Log conversation entry with encryption and archival
     */
    async logConversationEntry(entry) {
        const auditEntry = {
            ...entry,
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
        };
        try {
            // Encrypt sensitive content if needed
            let encryptedContent = entry.content;
            let encryptionKeyId;
            if (this.containsSensitiveData(entry.content)) {
                const encrypted = await this.encryptContent(entry.content);
                encryptedContent = encrypted.ciphertext;
                encryptionKeyId = encrypted.keyId;
                auditEntry.encryptionKeyId = encryptionKeyId;
            }
            // Store in CloudWatch Logs for real-time monitoring
            await this.logToCloudWatch(auditEntry, encryptedContent);
            // Store detailed entry in S3 for long-term archival
            const s3Reference = await this.archiveToS3(auditEntry, encryptedContent);
            // Store metadata in database for fast querying
            const dbAuditLog = {
                id: auditEntry.id,
                timestamp: auditEntry.timestamp,
                merchantId: auditEntry.merchantId,
                userId: auditEntry.userId,
                sessionId: auditEntry.sessionId,
                operation: `conversation_${auditEntry.messageType}`,
                requestPayloadHash: auditEntry.metadata.requestPayloadHash,
                responseReference: s3Reference,
                outcome: auditEntry.metadata.errorDetails ? 'failure' : 'success',
                reason: auditEntry.metadata.errorDetails,
                actor: auditEntry.messageType === 'user_input' ? 'user' : 'system',
            };
            await this.auditLogRepository.create(dbAuditLog);
            return auditEntry.id;
        }
        catch (error) {
            console.error('Failed to log conversation entry:', error);
            throw new Error(`Audit logging failed: ${error}`);
        }
    }
    /**
     * Retrieve conversation entries with decryption
     */
    async searchConversationEntries(query) {
        try {
            // Query database for metadata
            const dbResults = await this.auditLogRepository.findByMerchant(query.merchantId, query.limit || 50);
            // Filter results based on query parameters
            const filteredResults = dbResults.filter(log => {
                if (query.userId && log.userId !== query.userId)
                    return false;
                if (query.sessionId && log.sessionId !== query.sessionId)
                    return false;
                if (query.startDate && log.timestamp < query.startDate)
                    return false;
                if (query.endDate && log.timestamp > query.endDate)
                    return false;
                if (query.messageType && !log.operation.includes(query.messageType))
                    return false;
                return true;
            });
            // Retrieve detailed entries from S3
            const entries = [];
            for (const dbLog of filteredResults.slice(0, query.limit || 50)) {
                try {
                    const entry = await this.retrieveFromS3(dbLog.responseReference);
                    if (entry) {
                        entries.push(entry);
                    }
                }
                catch (error) {
                    console.warn(`Failed to retrieve entry ${dbLog.id} from S3:`, error);
                }
            }
            return {
                entries,
                totalCount: filteredResults.length,
                hasMore: filteredResults.length > (query.limit || 50),
                nextToken: filteredResults.length > (query.limit || 50) ?
                    filteredResults[query.limit || 50].id : undefined,
            };
        }
        catch (error) {
            console.error('Failed to search conversation entries:', error);
            throw new Error(`Audit search failed: ${error}`);
        }
    }
    /**
     * Get conversation summary for a session
     */
    async getSessionSummary(sessionId, merchantId) {
        try {
            const entries = await this.searchConversationEntries({
                merchantId,
                sessionId,
                limit: 1000, // Get all entries for the session
            });
            if (entries.entries.length === 0) {
                throw new Error('Session not found');
            }
            const sessionEntries = entries.entries;
            const userMessages = sessionEntries.filter(e => e.messageType === 'user_input').length;
            const assistantMessages = sessionEntries.filter(e => e.messageType === 'assistant_response').length;
            const systemEvents = sessionEntries.filter(e => e.messageType === 'system_event').length;
            const responseTimes = sessionEntries
                .filter(e => e.metadata.latency)
                .map(e => e.metadata.latency);
            const avgResponseTime = responseTimes.length > 0 ?
                responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
            const toolsUsed = Array.from(new Set(sessionEntries
                .flatMap(e => e.metadata.toolsUsed || [])));
            const intents = Array.from(new Set(sessionEntries
                .map(e => e.metadata.intent)
                .filter(Boolean)));
            const errorCount = sessionEntries.filter(e => e.metadata.errorDetails).length;
            return {
                sessionId,
                merchantId,
                userId: sessionEntries[0].userId,
                startTime: sessionEntries[sessionEntries.length - 1].timestamp,
                endTime: sessionEntries[0].timestamp,
                messageCount: sessionEntries.length,
                userMessages,
                assistantMessages,
                systemEvents,
                avgResponseTime,
                toolsUsed,
                intents,
                errorCount,
            };
        }
        catch (error) {
            console.error('Failed to get session summary:', error);
            throw new Error(`Session summary failed: ${error}`);
        }
    }
    /**
     * Clean up old audit entries based on retention policy
     */
    async cleanupOldEntries() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        let deletedCount = 0;
        const errors = [];
        try {
            // Get old entries from database
            const oldEntries = await this.auditLogRepository.findOlderThan(cutoffDate);
            for (const entry of oldEntries) {
                try {
                    // Delete from S3
                    if (entry.responseReference.startsWith('s3://')) {
                        await this.deleteFromS3(entry.responseReference);
                    }
                    // Delete from database
                    await this.auditLogRepository.delete(entry.id);
                    deletedCount++;
                }
                catch (error) {
                    errors.push(`Failed to delete entry ${entry.id}: ${error}`);
                }
            }
            console.log(`Cleaned up ${deletedCount} old audit entries`);
            return { deletedCount, errors };
        }
        catch (error) {
            console.error('Failed to cleanup old entries:', error);
            return { deletedCount, errors: [error instanceof Error ? error.message : 'Unknown error'] };
        }
    }
    /**
     * Generate compliance report
     */
    async generateComplianceReport(merchantId, startDate, endDate) {
        try {
            const entries = await this.searchConversationEntries({
                merchantId,
                startDate,
                endDate,
                limit: 10000, // Large limit for comprehensive report
            });
            const sessionIds = new Set(entries.entries.map(e => e.sessionId));
            const totalConversations = sessionIds.size;
            const totalMessages = entries.entries.length;
            const piiRedactedCount = entries.entries.filter(e => e.piiRedacted).length;
            const piiRedactionRate = totalMessages > 0 ? piiRedactedCount / totalMessages : 0;
            const encryptedCount = entries.entries.filter(e => e.encryptionKeyId).length;
            const encryptionRate = totalMessages > 0 ? encryptedCount / totalMessages : 0;
            const errorCount = entries.entries.filter(e => e.metadata.errorDetails).length;
            const errorRate = totalMessages > 0 ? errorCount / totalMessages : 0;
            const responseTimes = entries.entries
                .filter(e => e.metadata.latency)
                .map(e => e.metadata.latency);
            const avgResponseTime = responseTimes.length > 0 ?
                responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
            // Check data retention compliance
            const oldestEntry = entries.entries[entries.entries.length - 1];
            const dataAge = oldestEntry ?
                (Date.now() - oldestEntry.timestamp.getTime()) / (1000 * 60 * 60 * 24) : 0;
            const dataRetentionCompliance = dataAge <= this.config.retentionDays;
            // Simple audit trail integrity check
            const auditTrailIntegrity = entries.entries.every(e => e.id && e.timestamp && e.metadata.requestPayloadHash);
            return {
                merchantId,
                reportPeriod: { start: startDate, end: endDate },
                totalConversations,
                totalMessages,
                piiRedactionRate,
                encryptionRate,
                errorRate,
                avgResponseTime,
                dataRetentionCompliance,
                auditTrailIntegrity,
            };
        }
        catch (error) {
            console.error('Failed to generate compliance report:', error);
            throw new Error(`Compliance report generation failed: ${error}`);
        }
    }
    /**
     * Check if content contains sensitive data
     */
    containsSensitiveData(content) {
        // Simple PII detection patterns
        const piiPatterns = [
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone number
        ];
        return piiPatterns.some(pattern => pattern.test(content));
    }
    /**
     * Encrypt content using KMS
     */
    async encryptContent(content) {
        const command = new client_kms_1.EncryptCommand({
            KeyId: this.config.kmsKeyId,
            Plaintext: Buffer.from(content, 'utf-8'),
        });
        const result = await this.kmsClient.send(command);
        return {
            ciphertext: Buffer.from(result.CiphertextBlob).toString('base64'),
            keyId: this.config.kmsKeyId,
        };
    }
    /**
     * Decrypt content using KMS
     */
    async decryptContent(ciphertext) {
        const command = new client_kms_1.DecryptCommand({
            CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        });
        const result = await this.kmsClient.send(command);
        return Buffer.from(result.Plaintext).toString('utf-8');
    }
    /**
     * Log to CloudWatch for real-time monitoring
     */
    async logToCloudWatch(entry, content) {
        const logStreamName = `${entry.merchantId}-${entry.sessionId}`;
        // Create log stream if it doesn't exist (will fail silently if it exists)
        try {
            await this.cloudWatchClient.send(new CreateLogStreamCommand({
                logGroupName: this.config.cloudWatchLogGroup,
                logStreamName,
            }));
        }
        catch (error) {
            // Ignore error if stream already exists
        }
        const logEvent = {
            timestamp: entry.timestamp.getTime(),
            message: JSON.stringify({
                id: entry.id,
                sessionId: entry.sessionId,
                merchantId: entry.merchantId,
                userId: entry.userId,
                messageType: entry.messageType,
                content: entry.piiRedacted ? '[REDACTED]' : content.substring(0, 1000), // Truncate for CloudWatch
                metadata: {
                    ...entry.metadata,
                    toolsUsed: entry.metadata.toolsUsed?.join(','),
                },
                piiRedacted: entry.piiRedacted,
                encrypted: !!entry.encryptionKeyId,
            }),
        };
        await this.cloudWatchClient.send(new PutLogEventsCommand({
            logGroupName: this.config.cloudWatchLogGroup,
            logStreamName,
            logEvents: [logEvent],
        }));
    }
    /**
     * Archive to S3 for long-term storage
     */
    async archiveToS3(entry, content) {
        const key = `conversations/${entry.merchantId}/${entry.sessionId}/${entry.id}.json`;
        const s3Object = {
            ...entry,
            content,
        };
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.config.s3BucketName,
            Key: key,
            Body: JSON.stringify(s3Object),
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: this.config.kmsKeyId,
            ContentType: 'application/json',
            Metadata: {
                merchantId: entry.merchantId,
                sessionId: entry.sessionId,
                messageType: entry.messageType,
                timestamp: entry.timestamp.toISOString(),
            },
        }));
        return `s3://${this.config.s3BucketName}/${key}`;
    }
    /**
     * Retrieve from S3
     */
    async retrieveFromS3(s3Reference) {
        try {
            const url = new URL(s3Reference);
            const bucket = url.hostname;
            const key = url.pathname.substring(1);
            const result = await this.s3Client.send(new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: key,
            }));
            if (!result.Body) {
                return null;
            }
            const content = await result.Body.transformToString();
            const entry = JSON.parse(content);
            // Decrypt content if encrypted
            if (entry.encryptionKeyId && entry.content) {
                entry.content = await this.decryptContent(entry.content);
            }
            return entry;
        }
        catch (error) {
            console.error('Failed to retrieve from S3:', error);
            return null;
        }
    }
    /**
     * Delete from S3
     */
    async deleteFromS3(s3Reference) {
        const url = new URL(s3Reference);
        const bucket = url.hostname;
        const key = url.pathname.substring(1);
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: '', // Empty body to delete
        }));
    }
}
exports.AuditLoggingService = AuditLoggingService;
// Factory function to create AuditLoggingService with default config
function createAuditLoggingService(auditLogRepository) {
    return new AuditLoggingService({
        s3BucketName: process.env.AUDIT_LOGS_BUCKET || `mindsdb-rag-audit-${process.env.AWS_ACCOUNT_ID}-${config_1.config.aws.region}`,
        kmsKeyId: process.env.AUDIT_LOGS_KMS_KEY || '',
        cloudWatchLogGroup: process.env.AUDIT_LOG_GROUP || '/aws/mindsdb-rag/conversations',
        region: config_1.config.aws.region,
        retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555', 10), // 7 years default
    }, auditLogRepository);
}
//# sourceMappingURL=AuditLoggingService.js.map