"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollectionService = void 0;
exports.getMetricsCollectionService = getMetricsCollectionService;
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const LoggingService_1 = require("./LoggingService");
class MetricsCollectionService {
    constructor(region = 'us-east-1') {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsBuffer = [];
        this.bufferSize = 20; // CloudWatch limit
        this.flushIntervalMs = 60000; // 1 minute
        this.cloudWatch = new client_cloudwatch_1.CloudWatchClient({ region });
        // Set up periodic buffer flush
        this.bufferFlushInterval = setInterval(() => {
            this.flushMetricsBuffer();
        }, this.flushIntervalMs);
    }
    async collectMetrics(batch) {
        // Add to buffer
        this.metricsBuffer.push(batch);
        // Log metrics collection
        const context = {
            merchantId: batch.merchantId,
            sessionId: batch.sessionId,
            requestId: `metrics-${Date.now()}`,
            operation: 'metrics_collection'
        };
        await this.loggingService.logInfo('Metrics collected', context, {
            metricsCount: Object.keys(batch.metrics).length,
            timestamp: batch.timestamp
        });
        // Flush if buffer is full
        if (this.metricsBuffer.length >= this.bufferSize) {
            await this.flushMetricsBuffer();
        }
    }
    async flushMetricsBuffer() {
        if (this.metricsBuffer.length === 0)
            return;
        try {
            const batches = this.metricsBuffer.splice(0, this.bufferSize);
            const metricData = [];
            for (const batch of batches) {
                const baseDimensions = [
                    { Name: 'MerchantId', Value: batch.merchantId },
                    ...(batch.sessionId ? [{ Name: 'SessionId', Value: batch.sessionId }] : []),
                    ...Object.entries(batch.dimensions || {}).map(([name, value]) => ({
                        Name: name,
                        Value: value
                    }))
                ];
                // Convert metrics to CloudWatch format
                Object.entries(batch.metrics).forEach(([metricName, value]) => {
                    if (value !== undefined && value !== null) {
                        metricData.push({
                            MetricName: this.normalizeMetricName(metricName),
                            Value: value,
                            Unit: this.getMetricUnit(metricName),
                            Timestamp: batch.timestamp,
                            Dimensions: baseDimensions
                        });
                    }
                });
            }
            if (metricData.length > 0) {
                await this.cloudWatch.send(new client_cloudwatch_1.PutMetricDataCommand({
                    Namespace: 'MindsDB/RAG',
                    MetricData: metricData
                }));
            }
        }
        catch (error) {
            console.error('Failed to flush metrics buffer:', error);
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `metrics-flush-${Date.now()}`,
                operation: 'metrics_flush'
            });
        }
    }
    normalizeMetricName(metricName) {
        // Convert camelCase to dot notation for CloudWatch
        return metricName
            .replace(/([A-Z])/g, '.$1')
            .toLowerCase()
            .replace(/^\./, '');
    }
    getMetricUnit(metricName) {
        const unitMap = {
            'retrievalLatencyMs': 'Milliseconds',
            'predictLatencyMs': 'Milliseconds',
            'bedrockLatencyMs': 'Milliseconds',
            'retrievalRecallAtK': 'Percent',
            'retrievalSuccessRate': 'Percent',
            'predictConfidence': 'Percent',
            'groundingAccuracy': 'Percent',
            'hallucinationRate': 'Percent',
            'conversionRate': 'Percent',
            'cpuUtilization': 'Percent',
            'memoryUtilization': 'Percent',
            'bedrockTokensPerSession': 'Count',
            'agentStepsPerSession': 'Count',
            'connectionCount': 'Count',
            'avgOrderValue': 'Count',
            'costPerSession': 'Count',
            'unauthorizedAccessAttempts': 'Count',
            'suspiciousActivityAlerts': 'Count',
            'predictDriftScore': 'Count',
            'featureImportanceStability': 'Count'
        };
        return unitMap[metricName] || 'Count';
    }
    // Convenience methods for specific metric types
    async collectRetrievalMetrics(merchantId, sessionId, latencyMs, recallAtK, successRate, k = 5) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            sessionId,
            metrics: {
                retrievalLatencyMs: latencyMs,
                retrievalRecallAtK: recallAtK,
                retrievalSuccessRate: successRate
            },
            dimensions: { k: k.toString() }
        });
    }
    async collectPredictionMetrics(merchantId, sessionId, latencyMs, confidence, driftScore, modelId) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            sessionId,
            metrics: {
                predictLatencyMs: latencyMs,
                predictConfidence: confidence,
                predictDriftScore: driftScore
            },
            dimensions: { modelId }
        });
    }
    async collectGroundingMetrics(merchantId, sessionId, accuracy, hallucinationRate) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            sessionId,
            metrics: {
                groundingAccuracy: accuracy,
                hallucinationRate: hallucinationRate
            }
        });
    }
    async collectLLMMetrics(merchantId, sessionId, tokensPerSession, latencyMs, stepsPerSession) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            sessionId,
            metrics: {
                bedrockTokensPerSession: tokensPerSession,
                bedrockLatencyMs: latencyMs,
                agentStepsPerSession: stepsPerSession
            }
        });
    }
    async collectInfrastructureMetrics(merchantId, cpuUtilization, memoryUtilization, connectionCount, service) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            metrics: {
                cpuUtilization,
                memoryUtilization,
                connectionCount
            },
            dimensions: { service }
        });
    }
    async collectBusinessMetrics(merchantId, conversionRate, avgOrderValue, costPerSession) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            metrics: {
                conversionRate,
                avgOrderValue,
                costPerSession
            }
        });
    }
    async collectSecurityMetrics(merchantId, unauthorizedAccessAttempts, suspiciousActivityAlerts) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            metrics: {
                unauthorizedAccessAttempts,
                suspiciousActivityAlerts
            }
        });
    }
    // Method to create performance timers with automatic metric collection
    createPerformanceTimer(metricName, merchantId, sessionId, dimensions) {
        const startTime = Date.now();
        return {
            end: async () => {
                const duration = Date.now() - startTime;
                await this.collectMetrics({
                    timestamp: new Date(),
                    merchantId,
                    sessionId,
                    metrics: { [metricName]: duration },
                    dimensions
                });
                return duration;
            }
        };
    }
    // Method to increment counter metrics
    async incrementCounter(metricName, merchantId, value = 1, dimensions) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            metrics: { [metricName]: value },
            dimensions
        });
    }
    // Method to set gauge metrics
    async setGauge(metricName, merchantId, value, dimensions) {
        await this.collectMetrics({
            timestamp: new Date(),
            merchantId,
            metrics: { [metricName]: value },
            dimensions
        });
    }
    // Cleanup method
    destroy() {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
        }
        // Flush any remaining metrics
        this.flushMetricsBuffer();
    }
}
exports.MetricsCollectionService = MetricsCollectionService;
// Singleton instance
let metricsServiceInstance = null;
function getMetricsCollectionService() {
    if (!metricsServiceInstance) {
        metricsServiceInstance = new MetricsCollectionService(process.env.AWS_REGION || 'us-east-1');
    }
    return metricsServiceInstance;
}
//# sourceMappingURL=MetricsCollectionService.js.map