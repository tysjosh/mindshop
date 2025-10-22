export interface LogContext {
    merchantId: string;
    sessionId?: string;
    requestId?: string;
    userId?: string;
    operation?: string;
    timestamp?: Date;
    bucket?: string;
    fileName?: string;
    documentId?: string;
    key?: string;
    contentType?: string;
    contentLength?: number;
    executionId?: string;
    executionTime?: number;
}
export interface MetricData {
    name: string;
    value: number;
    unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Percent' | 'Bytes';
    dimensions?: Record<string, string>;
    timestamp?: Date;
}
export interface AuditLogEntry {
    timestamp: Date;
    merchant_id: string;
    user_id?: string;
    session_id?: string;
    operation: string;
    request_payload_hash: string;
    response_reference: string;
    outcome: 'success' | 'failure';
    reason?: string;
    actor: string;
}
export declare class LoggingService {
    private logger;
    private cloudWatchLogs;
    private cloudWatch;
    private kms;
    private logGroupName;
    private kmsKeyId?;
    private readonly piiPatterns;
    constructor(config: {
        logGroupName: string;
        kmsKeyId?: string;
        region?: string;
    });
    private initializeCloudWatchLogGroup;
    private redactPII;
    private generateRequestId;
    logInfo(message: string, context: LogContext, metadata?: any): Promise<void>;
    logError(error: Error, context: LogContext, metadata?: any): Promise<void>;
    logWarning(message: string, context: LogContext, metadata?: any): Promise<void>;
    logAudit(auditEntry: AuditLogEntry): Promise<void>;
    private sendToCloudWatch;
    putMetric(metric: MetricData, namespace?: string): Promise<void>;
    putMetrics(metrics: MetricData[], namespace?: string): Promise<void>;
    createTimer(metricName: string, dimensions?: Record<string, string>): {
        end: () => Promise<number>;
    };
    logRetrievalMetrics(latencyMs: number, recallAtK: number, successRate: number, merchantId: string, k?: number): Promise<void>;
    logPredictionMetrics(latencyMs: number, confidence: number, driftScore: number, merchantId: string, modelId: string): Promise<void>;
    logGroundingMetrics(accuracy: number, hallucination_rate: number, merchantId: string, sessionId: string): Promise<void>;
    logLLMMetrics(tokensPerSession: number, latencyMs: number, stepsPerSession: number, merchantId: string, sessionId: string): Promise<void>;
    logBusinessMetrics(conversionRate: number, avgOrderValue: number, costPerSession: number, merchantId: string): Promise<void>;
}
export declare function getLoggingService(): LoggingService;
//# sourceMappingURL=LoggingService.d.ts.map