export interface SystemMetrics {
    retrievalLatencyMs: number;
    retrievalRecallAtK: number;
    retrievalSuccessRate: number;
    predictLatencyMs: number;
    predictConfidence: number;
    predictDriftScore: number;
    featureImportanceStability: number;
    groundingAccuracy: number;
    hallucinationRate: number;
    bedrockTokensPerSession: number;
    bedrockLatencyMs: number;
    agentStepsPerSession: number;
    cpuUtilization: number;
    memoryUtilization: number;
    connectionCount: number;
    conversionRate: number;
    avgOrderValue: number;
    costPerSession: number;
    unauthorizedAccessAttempts: number;
    suspiciousActivityAlerts: number;
}
export interface MetricsBatch {
    timestamp: Date;
    merchantId: string;
    sessionId?: string;
    metrics: Partial<SystemMetrics>;
    dimensions?: Record<string, string>;
}
export declare class MetricsCollectionService {
    private cloudWatch;
    private loggingService;
    private metricsBuffer;
    private bufferFlushInterval;
    private readonly bufferSize;
    private readonly flushIntervalMs;
    constructor(region?: string);
    collectMetrics(batch: MetricsBatch): Promise<void>;
    private flushMetricsBuffer;
    private normalizeMetricName;
    private getMetricUnit;
    collectRetrievalMetrics(merchantId: string, sessionId: string, latencyMs: number, recallAtK: number, successRate: number, k?: number): Promise<void>;
    collectPredictionMetrics(merchantId: string, sessionId: string, latencyMs: number, confidence: number, driftScore: number, modelId: string): Promise<void>;
    collectGroundingMetrics(merchantId: string, sessionId: string, accuracy: number, hallucinationRate: number): Promise<void>;
    collectLLMMetrics(merchantId: string, sessionId: string, tokensPerSession: number, latencyMs: number, stepsPerSession: number): Promise<void>;
    collectInfrastructureMetrics(merchantId: string, cpuUtilization: number, memoryUtilization: number, connectionCount: number, service: string): Promise<void>;
    collectBusinessMetrics(merchantId: string, conversionRate: number, avgOrderValue: number, costPerSession: number): Promise<void>;
    collectSecurityMetrics(merchantId: string, unauthorizedAccessAttempts: number, suspiciousActivityAlerts: number): Promise<void>;
    createPerformanceTimer(metricName: keyof SystemMetrics, merchantId: string, sessionId?: string, dimensions?: Record<string, string>): {
        end: () => Promise<number>;
    };
    incrementCounter(metricName: keyof SystemMetrics, merchantId: string, value?: number, dimensions?: Record<string, string>): Promise<void>;
    setGauge(metricName: keyof SystemMetrics, merchantId: string, value: number, dimensions?: Record<string, string>): Promise<void>;
    destroy(): void;
}
export declare function getMetricsCollectionService(): MetricsCollectionService;
//# sourceMappingURL=MetricsCollectionService.d.ts.map