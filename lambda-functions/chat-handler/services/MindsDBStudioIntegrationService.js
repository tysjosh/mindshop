"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MindsDBStudioIntegrationService = void 0;
exports.getMindsDBStudioIntegration = getMindsDBStudioIntegration;
const LoggingService_1 = require("./LoggingService");
const MetricsCollectionService_1 = require("./MetricsCollectionService");
class MindsDBStudioIntegrationService {
    constructor(config) {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsService = (0, MetricsCollectionService_1.getMetricsCollectionService)();
        this.config = config;
        if (config.enableMetricsForwarding) {
            this.startMetricsPolling();
        }
    }
    startMetricsPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                await this.fetchAndForwardStudioMetrics();
            }
            catch (error) {
                await this.loggingService.logError(error, {
                    merchantId: 'system',
                    requestId: `studio-metrics-${Date.now()}`,
                    operation: 'studio_metrics_polling'
                });
            }
        }, this.config.pollIntervalMs);
    }
    async fetchAndForwardStudioMetrics() {
        const context = {
            merchantId: 'system',
            requestId: `studio-fetch-${Date.now()}`,
            operation: 'fetch_studio_metrics'
        };
        try {
            // Fetch metrics from MindsDB Studio API
            const response = await fetch(`${this.config.studioApiUrl}/api/v1/metrics`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Studio API returned ${response.status}: ${response.statusText}`);
            }
            const studioMetrics = await response.json();
            await this.loggingService.logInfo('Fetched metrics from MindsDB Studio', context, { metricsCount: studioMetrics.length });
            // Forward metrics to our monitoring system
            for (const metric of studioMetrics) {
                await this.forwardStudioMetric(metric);
            }
        }
        catch (error) {
            await this.loggingService.logError(error, context, { studioApiUrl: this.config.studioApiUrl });
        }
    }
    async forwardStudioMetric(metric) {
        const dimensions = {
            modelId: metric.modelId,
            modelVersion: metric.modelVersion,
            source: 'mindsdb-studio'
        };
        // Forward model performance metrics
        await this.metricsService.collectMetrics({
            timestamp: new Date(),
            merchantId: metric.merchantId,
            metrics: {
                predictConfidence: metric.accuracy * 100, // Convert to percentage
                predictLatencyMs: metric.predictionLatency,
                featureImportanceStability: this.calculateFeatureImportanceStability(metric.featureImportance)
            },
            dimensions
        });
        // Log model quality metrics
        await this.loggingService.logInfo('Model metrics forwarded from Studio', {
            merchantId: metric.merchantId,
            requestId: `studio-forward-${Date.now()}`,
            operation: 'forward_studio_metrics'
        }, {
            modelId: metric.modelId,
            accuracy: metric.accuracy,
            precision: metric.precision,
            recall: metric.recall,
            f1Score: metric.f1Score,
            dataQualityScore: metric.dataQualityScore,
            lastTrainingDate: metric.lastTrainingDate
        });
    }
    calculateFeatureImportanceStability(featureImportance) {
        // Calculate coefficient of variation as a stability measure
        const values = Object.values(featureImportance);
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        // Return inverse of coefficient of variation (higher = more stable)
        return mean === 0 ? 0 : Math.max(0, 1 - (stdDev / mean));
    }
    async getModelMetrics(modelId, merchantId) {
        const context = {
            merchantId,
            requestId: `get-model-metrics-${Date.now()}`,
            operation: 'get_model_metrics'
        };
        try {
            const response = await fetch(`${this.config.studioApiUrl}/api/v1/models/${modelId}/metrics`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Studio API returned ${response.status}: ${response.statusText}`);
            }
            const metrics = await response.json();
            await this.loggingService.logInfo('Retrieved model metrics from Studio', context, { modelId, accuracy: metrics.accuracy });
            return metrics;
        }
        catch (error) {
            await this.loggingService.logError(error, context, { modelId });
            return null;
        }
    }
    async triggerModelRetrain(modelId, merchantId) {
        const context = {
            merchantId,
            requestId: `trigger-retrain-${Date.now()}`,
            operation: 'trigger_model_retrain'
        };
        try {
            const response = await fetch(`${this.config.studioApiUrl}/api/v1/models/${modelId}/retrain`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    merchantId,
                    trigger: 'performance_degradation',
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) {
                throw new Error(`Studio API returned ${response.status}: ${response.statusText}`);
            }
            await this.loggingService.logInfo('Model retrain triggered via Studio', context, { modelId });
            return true;
        }
        catch (error) {
            await this.loggingService.logError(error, context, { modelId });
            return false;
        }
    }
    async createCustomDashboard(merchantId, dashboardConfig) {
        const context = {
            merchantId,
            requestId: `create-dashboard-${Date.now()}`,
            operation: 'create_custom_dashboard'
        };
        try {
            const response = await fetch(`${this.config.studioApiUrl}/api/v1/dashboards`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...dashboardConfig,
                    merchantId,
                    createdAt: new Date().toISOString()
                })
            });
            if (!response.ok) {
                throw new Error(`Studio API returned ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            const dashboardId = result.dashboardId;
            await this.loggingService.logInfo('Custom dashboard created in Studio', context, { dashboardId, dashboardName: dashboardConfig.name });
            return dashboardId;
        }
        catch (error) {
            await this.loggingService.logError(error, context, dashboardConfig);
            return null;
        }
    }
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}
exports.MindsDBStudioIntegrationService = MindsDBStudioIntegrationService;
// Singleton instance
let studioIntegrationInstance = null;
function getMindsDBStudioIntegration() {
    if (!studioIntegrationInstance) {
        const config = {
            studioApiUrl: process.env.MINDSDB_STUDIO_API_URL || 'https://studio.mindsdb.com',
            apiKey: process.env.MINDSDB_STUDIO_API_KEY || '',
            pollIntervalMs: parseInt(process.env.STUDIO_METRICS_POLL_INTERVAL_MS || '300000'), // 5 minutes
            enableMetricsForwarding: process.env.ENABLE_STUDIO_METRICS_FORWARDING !== 'false'
        };
        studioIntegrationInstance = new MindsDBStudioIntegrationService(config);
    }
    return studioIntegrationInstance;
}
//# sourceMappingURL=MindsDBStudioIntegrationService.js.map