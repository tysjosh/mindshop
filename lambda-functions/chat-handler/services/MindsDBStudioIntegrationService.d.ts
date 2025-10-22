export interface MindsDBStudioMetrics {
    modelId: string;
    merchantId: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    trainingTime: number;
    predictionLatency: number;
    featureImportance: Record<string, number>;
    dataQualityScore: number;
    modelVersion: string;
    lastTrainingDate: Date;
}
export interface StudioIntegrationConfig {
    studioApiUrl: string;
    apiKey: string;
    pollIntervalMs: number;
    enableMetricsForwarding: boolean;
}
export declare class MindsDBStudioIntegrationService {
    private loggingService;
    private metricsService;
    private config;
    private pollInterval?;
    constructor(config: StudioIntegrationConfig);
    private startMetricsPolling;
    private fetchAndForwardStudioMetrics;
    private forwardStudioMetric;
    private calculateFeatureImportanceStability;
    getModelMetrics(modelId: string, merchantId: string): Promise<MindsDBStudioMetrics | null>;
    triggerModelRetrain(modelId: string, merchantId: string): Promise<boolean>;
    createCustomDashboard(merchantId: string, dashboardConfig: {
        name: string;
        modelIds: string[];
        metrics: string[];
        timeRange: string;
    }): Promise<string | null>;
    destroy(): void;
}
export declare function getMindsDBStudioIntegration(): MindsDBStudioIntegrationService;
//# sourceMappingURL=MindsDBStudioIntegrationService.d.ts.map