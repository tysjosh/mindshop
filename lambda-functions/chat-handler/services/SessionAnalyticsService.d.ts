export interface SessionAnalytics {
    merchantId: string;
    period: {
        startDate: string;
        endDate: string;
    };
    metrics: {
        totalSessions: number;
        activeSessions: number;
        uniqueUsers: number;
        avgSessionDuration: number;
        avgMessagesPerSession: number;
        totalMessages: number;
        sessionsByHour: Record<string, number>;
        sessionsByDay: Record<string, number>;
        topUsers: Array<{
            userId: string;
            sessionCount: number;
            totalMessages: number;
            avgSessionDuration: number;
        }>;
    };
    costs: {
        totalCostEstimate: number;
        costPerSession: number;
        costPerMessage: number;
        costBreakdown: {
            ragProcessing: number;
            llmGeneration: number;
            storage: number;
            compute: number;
        };
    };
    performance: {
        avgResponseTime: number;
        cacheHitRate: number;
        errorRate: number;
        p95ResponseTime: number;
    };
}
export interface UsageMetrics {
    sessionId: string;
    merchantId: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    messageCount: number;
    ragQueries: number;
    llmTokensUsed: number;
    cacheHits: number;
    cacheMisses: number;
    totalCost: number;
    avgResponseTime: number;
    errors: number;
}
export interface BillingData {
    merchantId: string;
    period: {
        startDate: string;
        endDate: string;
    };
    usage: {
        totalSessions: number;
        totalMessages: number;
        totalRAGQueries: number;
        totalLLMTokens: number;
        totalStorageGB: number;
        totalComputeHours: number;
    };
    costs: {
        ragProcessingCost: number;
        llmGenerationCost: number;
        storageCost: number;
        computeCost: number;
        totalCost: number;
    };
    breakdown: Array<{
        date: string;
        sessions: number;
        messages: number;
        cost: number;
    }>;
}
export declare class SessionAnalyticsService {
    private dynamoClient;
    private cloudWatchClient;
    private sessionManager;
    private auditLogRepository;
    private tableName;
    private readonly COST_PER_RAG_QUERY;
    private readonly COST_PER_1K_LLM_TOKENS;
    private readonly COST_PER_GB_STORAGE_MONTH;
    private readonly COST_PER_COMPUTE_HOUR;
    constructor();
    /**
     * Get comprehensive session analytics for a merchant
     */
    getSessionAnalytics(merchantId: string, startDate: Date, endDate: Date): Promise<SessionAnalytics>;
    /**
     * Track session usage metrics for billing
     */
    trackSessionUsage(usageMetrics: UsageMetrics): Promise<void>;
    /**
     * Generate billing data for a merchant
     */
    generateBillingData(merchantId: string, startDate: Date, endDate: Date): Promise<BillingData>;
    /**
     * Get sessions within a date range for a merchant
     */
    private getSessionsInDateRange;
    /**
     * Calculate session metrics
     */
    private calculateSessionMetrics;
    /**
     * Calculate cost estimates
     */
    private calculateCostEstimates;
    /**
     * Get performance metrics from CloudWatch or audit logs
     */
    private getPerformanceMetrics;
    /**
     * Calculate session cost
     */
    private calculateSessionCost;
    /**
     * Emit CloudWatch metrics
     */
    private emitCloudWatchMetrics;
    /**
     * Store usage metrics (placeholder - would use separate table)
     */
    private storeUsageMetrics;
    /**
     * Calculate storage usage in GB
     */
    private calculateStorageUsage;
    /**
     * Calculate compute hours
     */
    private calculateComputeHours;
    /**
     * Generate daily breakdown
     */
    private generateDailyBreakdown;
    /**
     * Calculate daily cost estimate
     */
    private calculateDailyCost;
}
export declare const getSessionAnalyticsService: () => SessionAnalyticsService;
//# sourceMappingURL=SessionAnalyticsService.d.ts.map