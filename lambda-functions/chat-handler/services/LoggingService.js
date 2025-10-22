"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingService = void 0;
exports.getLoggingService = getLoggingService;
const winston_1 = __importDefault(require("winston"));
const client_cloudwatch_logs_1 = require("@aws-sdk/client-cloudwatch-logs");
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const client_kms_1 = require("@aws-sdk/client-kms");
const crypto_1 = __importDefault(require("crypto"));
class LoggingService {
    constructor(config) {
        // PII patterns for redaction
        this.piiPatterns = [
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
        ];
        this.logGroupName = config.logGroupName;
        this.kmsKeyId = config.kmsKeyId;
        // Initialize AWS clients
        this.cloudWatchLogs = new client_cloudwatch_logs_1.CloudWatchLogsClient({ region: config.region || 'us-east-1' });
        this.cloudWatch = new client_cloudwatch_1.CloudWatchClient({ region: config.region || 'us-east-1' });
        this.kms = new client_kms_1.KMSClient({ region: config.region || 'us-east-1' });
        // Configure Winston logger with structured JSON format
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
                // Redact PII before logging
                const sanitized = this.redactPII(JSON.stringify(info));
                return sanitized;
            })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
                // File transports removed for Lambda compatibility
                // Lambda logs are automatically captured by CloudWatch
            ]
        });
        this.initializeCloudWatchLogGroup();
    }
    async initializeCloudWatchLogGroup() {
        try {
            await this.cloudWatchLogs.send(new client_cloudwatch_logs_1.CreateLogGroupCommand({
                logGroupName: this.logGroupName,
                kmsKeyId: this.kmsKeyId
            }));
        }
        catch (error) {
            if (error.name !== 'ResourceAlreadyExistsException') {
                console.error('Failed to create CloudWatch log group:', error);
            }
        }
    }
    redactPII(text) {
        let redacted = text;
        this.piiPatterns.forEach(pattern => {
            redacted = redacted.replace(pattern, '[REDACTED]');
        });
        // Additional custom redaction for sensitive fields
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'creditCard', 'ssn'];
        sensitiveFields.forEach(field => {
            const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
            redacted = redacted.replace(regex, `"${field}":"[REDACTED]"`);
        });
        return redacted;
    }
    generateRequestId() {
        return crypto_1.default.randomUUID();
    }
    async logInfo(message, context, metadata) {
        const logEntry = {
            level: 'info',
            message,
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            requestId: context.requestId || this.generateRequestId(),
            userId: context.userId,
            operation: context.operation,
            timestamp: context.timestamp || new Date(),
            metadata: metadata || {}
        };
        this.logger.info(logEntry);
        await this.sendToCloudWatch(logEntry);
    }
    async logError(error, context, metadata) {
        const logEntry = {
            level: 'error',
            message: error.message,
            stack: error.stack,
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            requestId: context.requestId || this.generateRequestId(),
            userId: context.userId,
            operation: context.operation,
            timestamp: context.timestamp || new Date(),
            metadata: metadata || {}
        };
        this.logger.error(logEntry);
        await this.sendToCloudWatch(logEntry);
    }
    async logWarning(message, context, metadata) {
        const logEntry = {
            level: 'warn',
            message,
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            requestId: context.requestId || this.generateRequestId(),
            userId: context.userId,
            operation: context.operation,
            timestamp: context.timestamp || new Date(),
            metadata: metadata || {}
        };
        this.logger.warn(logEntry);
        await this.sendToCloudWatch(logEntry);
    }
    async logAudit(auditEntry) {
        const logEntry = {
            level: 'audit',
            ...auditEntry,
            timestamp: auditEntry.timestamp || new Date()
        };
        // Encrypt sensitive audit data if KMS key is provided
        if (this.kmsKeyId && auditEntry.request_payload_hash) {
            try {
                const encryptCommand = new client_kms_1.EncryptCommand({
                    KeyId: this.kmsKeyId,
                    Plaintext: Buffer.from(auditEntry.request_payload_hash)
                });
                const encryptResult = await this.kms.send(encryptCommand);
                logEntry.request_payload_hash = Buffer.from(encryptResult.CiphertextBlob).toString('base64');
            }
            catch (error) {
                console.error('Failed to encrypt audit log payload hash:', error);
            }
        }
        this.logger.info(logEntry);
        await this.sendToCloudWatch(logEntry, `${this.logGroupName}/audit`);
    }
    async sendToCloudWatch(logEntry, logGroupName) {
        try {
            const targetLogGroup = logGroupName || this.logGroupName;
            const logStreamName = `${logEntry.merchantId}-${new Date().toISOString().split('T')[0]}`;
            // Create log stream if it doesn't exist
            try {
                await this.cloudWatchLogs.send(new client_cloudwatch_logs_1.CreateLogStreamCommand({
                    logGroupName: targetLogGroup,
                    logStreamName
                }));
            }
            catch (error) {
                if (error.name !== 'ResourceAlreadyExistsException') {
                    console.error('Failed to create log stream:', error);
                }
            }
            // Send log event
            await this.cloudWatchLogs.send(new client_cloudwatch_logs_1.PutLogEventsCommand({
                logGroupName: targetLogGroup,
                logStreamName,
                logEvents: [{
                        timestamp: logEntry.timestamp.getTime(),
                        message: JSON.stringify(logEntry)
                    }]
            }));
        }
        catch (error) {
            console.error('Failed to send log to CloudWatch:', error);
        }
    }
    async putMetric(metric, namespace = 'MindsDB/RAG') {
        try {
            const dimensions = Object.entries(metric.dimensions || {}).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
            await this.cloudWatch.send(new client_cloudwatch_1.PutMetricDataCommand({
                Namespace: namespace,
                MetricData: [{
                        MetricName: metric.name,
                        Value: metric.value,
                        Unit: metric.unit,
                        Timestamp: metric.timestamp || new Date(),
                        Dimensions: dimensions
                    }]
            }));
        }
        catch (error) {
            console.error('Failed to put metric to CloudWatch:', error);
        }
    }
    async putMetrics(metrics, namespace = 'MindsDB/RAG') {
        try {
            const metricData = metrics.map(metric => ({
                MetricName: metric.name,
                Value: metric.value,
                Unit: metric.unit,
                Timestamp: metric.timestamp || new Date(),
                Dimensions: Object.entries(metric.dimensions || {}).map(([name, value]) => ({
                    Name: name,
                    Value: value
                }))
            }));
            await this.cloudWatch.send(new client_cloudwatch_1.PutMetricDataCommand({
                Namespace: namespace,
                MetricData: metricData
            }));
        }
        catch (error) {
            console.error('Failed to put metrics to CloudWatch:', error);
        }
    }
    // Utility method to create performance timing metrics
    createTimer(metricName, dimensions) {
        const startTime = Date.now();
        return {
            end: async () => {
                const duration = Date.now() - startTime;
                await this.putMetric({
                    name: metricName,
                    value: duration,
                    unit: 'Milliseconds',
                    dimensions
                });
                return duration;
            }
        };
    }
    // Method to log retrieval metrics
    async logRetrievalMetrics(latencyMs, recallAtK, successRate, merchantId, k = 5) {
        const dimensions = { merchantId, k: k.toString() };
        await this.putMetrics([
            {
                name: 'retrieval.latency_ms',
                value: latencyMs,
                unit: 'Milliseconds',
                dimensions
            },
            {
                name: `retrieval.recall_at_${k}`,
                value: recallAtK,
                unit: 'Percent',
                dimensions
            },
            {
                name: 'retrieval.success_rate',
                value: successRate,
                unit: 'Percent',
                dimensions
            }
        ]);
    }
    // Method to log prediction metrics
    async logPredictionMetrics(latencyMs, confidence, driftScore, merchantId, modelId) {
        const dimensions = { merchantId, modelId };
        await this.putMetrics([
            {
                name: 'predict.latency_ms',
                value: latencyMs,
                unit: 'Milliseconds',
                dimensions
            },
            {
                name: 'predict.confidence',
                value: confidence,
                unit: 'Percent',
                dimensions
            },
            {
                name: 'predict.drift_score',
                value: driftScore,
                unit: 'Count',
                dimensions
            }
        ]);
    }
    // Method to log grounding and quality metrics
    async logGroundingMetrics(accuracy, hallucination_rate, merchantId, sessionId) {
        const dimensions = { merchantId, sessionId };
        await this.putMetrics([
            {
                name: 'grounding.accuracy',
                value: accuracy,
                unit: 'Percent',
                dimensions
            },
            {
                name: 'grounding.hallucination_rate',
                value: hallucination_rate,
                unit: 'Percent',
                dimensions
            }
        ]);
    }
    // Method to log LLM and orchestration metrics
    async logLLMMetrics(tokensPerSession, latencyMs, stepsPerSession, merchantId, sessionId) {
        const dimensions = { merchantId, sessionId };
        await this.putMetrics([
            {
                name: 'bedrock.tokens_per_session',
                value: tokensPerSession,
                unit: 'Count',
                dimensions
            },
            {
                name: 'bedrock.latency_ms',
                value: latencyMs,
                unit: 'Milliseconds',
                dimensions
            },
            {
                name: 'agent.steps_per_session',
                value: stepsPerSession,
                unit: 'Count',
                dimensions
            }
        ]);
    }
    // Method to log business metrics
    async logBusinessMetrics(conversionRate, avgOrderValue, costPerSession, merchantId) {
        const dimensions = { merchantId };
        await this.putMetrics([
            {
                name: 'business.conversion_rate',
                value: conversionRate,
                unit: 'Percent',
                dimensions
            },
            {
                name: 'business.avg_order_value',
                value: avgOrderValue,
                unit: 'Count',
                dimensions
            },
            {
                name: 'business.cost_per_session',
                value: costPerSession,
                unit: 'Count',
                dimensions
            }
        ]);
    }
}
exports.LoggingService = LoggingService;
// Singleton instance
let loggingServiceInstance = null;
function getLoggingService() {
    if (!loggingServiceInstance) {
        loggingServiceInstance = new LoggingService({
            logGroupName: process.env.CLOUDWATCH_LOG_GROUP || '/aws/mindsdb-rag/application',
            kmsKeyId: process.env.KMS_KEY_ID,
            region: process.env.AWS_REGION || 'us-east-1'
        });
    }
    return loggingServiceInstance;
}
//# sourceMappingURL=LoggingService.js.map