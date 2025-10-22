import { BaseRepository } from "../repositories/BaseRepository";
export interface CostBreakdown {
    retrieval: number;
    prediction: number;
    generation: number;
    checkout: number;
    total: number;
}
export interface SessionCostSummary {
    sessionId: string;
    totalCost: number;
    operationBreakdown: Record<string, number>;
    tokenUsage: {
        totalInput: number;
        totalOutput: number;
    };
    durationMinutes: number;
    requestCount: number;
}
export interface MerchantCostAnalytics {
    merchantId: string;
    period: {
        startDate: Date;
        endDate: Date;
    };
    totalCost: number;
    avgCostPerSession: number;
    totalSessions: number;
    costByOperation: Record<string, number>;
    dailyTrend: Array<{
        date: string;
        cost: number;
        sessions: number;
    }>;
    topExpensiveSessions: SessionCostSummary[];
}
export interface CostEstimate {
    operation: string;
    estimatedCost: number;
    tokens?: {
        input: number;
        output: number;
    };
    computeMs?: number;
    confidence: number;
}
/**
 * Service for tracking and analyzing costs across the RAG system
 * Implements the $0.05/session target monitoring from requirements
 */
export declare class CostTrackingService extends BaseRepository {
    private loggingService;
    private metricsService;
    private readonly COST_RATES;
    private readonly SESSION_COST_TARGET;
    /**
     * Track cost for a specific operation
     */
    trackOperationCost(params: {
        merchantId: string;
        sessionId?: string;
        userId?: string;
        operation: string;
        costUsd: number;
        tokens?: {
            input: number;
            output: number;
        };
        computeMs?: number;
        metadata?: Record<string, any>;
    }): Promise<void>;
    /**
     * Estimate cost for Bedrock LLM operations
     */
    estimateBedrockCost(params: {
        inputTokens: number;
        outputTokens: number;
        modelId?: string;
    }): CostEstimate;
    /**
     * Estimate cost for MindsDB operations
     */
    estimateMindsDBCost(params: {
        operation: 'retrieval' | 'prediction';
        complexity?: 'simple' | 'complex';
        documentCount?: number;
    }): CostEstimate;
    /**
     * Get session cost summary
     */
    getSessionCostSummary(sessionId: string): Promise<SessionCostSummary | null>;
    /**
     * Get merchant cost analytics for a time period
     */
    getMerchantCostAnalytics(params: {
        merchantId: string;
        startDate: Date;
        endDate: Date;
        includeTopSessions?: boolean;
    }): Promise<MerchantCostAnalytics>;
    /**
     * Check if session exceeds cost target and trigger alerts
     */
    checkSessionCostTarget(sessionId: string): Promise<{
        exceedsTarget: boolean;
        currentCost: number;
        targetCost: number;
        percentageOfTarget: number;
    }>;
    /**
     * Get cost breakdown for a specific time period
     */
    getCostBreakdown(params: {
        merchantId: string;
        startDate: Date;
        endDate: Date;
    }): Promise<CostBreakdown>;
    /**
     * Clean up old cost tracking data
     */
    cleanupOldCostData(retentionDays?: number): Promise<number>;
    /**
     * Health check for cost tracking service
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
}
export declare function getCostTrackingService(): CostTrackingService;
export { CostTrackingService as CostTrackingServiceClass };
//# sourceMappingURL=CostTrackingService.d.ts.map