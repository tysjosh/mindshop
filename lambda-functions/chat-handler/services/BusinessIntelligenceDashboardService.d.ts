export interface UsageAnalytics {
    merchantId: string;
    period: {
        start: Date;
        end: Date;
    };
    totalSessions: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    topQueries: Array<{
        query: string;
        count: number;
        avgLatency: number;
    }>;
    userEngagement: {
        bounceRate: number;
        avgQueriesPerSession: number;
        returnUserRate: number;
    };
    performanceMetrics: {
        avgLatency: number;
        p95Latency: number;
        successRate: number;
        errorRate: number;
    };
}
export interface ConversionTracking {
    merchantId: string;
    period: {
        start: Date;
        end: Date;
    };
    totalConversions: number;
    conversionRate: number;
    avgOrderValue: number;
    revenueAttribution: {
        directFromChat: number;
        assistedByChat: number;
        totalRevenue: number;
    };
    conversionFunnel: Array<{
        stage: string;
        users: number;
        conversionRate: number;
    }>;
    topConvertingQueries: Array<{
        query: string;
        conversions: number;
        conversionRate: number;
        revenue: number;
    }>;
}
export interface QualityMetrics {
    merchantId: string;
    period: {
        start: Date;
        end: Date;
    };
    overallAccuracy: number;
    groundingAccuracy: number;
    hallucinationRate: number;
    userSatisfaction: {
        avgRating: number;
        totalRatings: number;
        positiveRatings: number;
        negativeRatings: number;
    };
    qualityTrends: Array<{
        date: Date;
        accuracy: number;
        satisfaction: number;
    }>;
}
export interface DashboardData {
    merchantId: string;
    generatedAt: Date;
    usageAnalytics: UsageAnalytics;
    conversionTracking: ConversionTracking;
    qualityMetrics: QualityMetrics;
    costAnalysis: {
        totalCost: number;
        costPerSession: number;
        costPerConversion: number;
        roi: number;
    };
    alerts: Array<{
        type: string;
        severity: string;
        message: string;
        timestamp: Date;
    }>;
}
export interface HumanEvaluationTask {
    id: string;
    merchantId: string;
    query: string;
    response: string;
    context: any;
    evaluationCriteria: {
        relevance: boolean;
        accuracy: boolean;
        helpfulness: boolean;
        safety: boolean;
    };
    evaluatorId?: string;
    evaluatedAt?: Date;
    score?: number;
    feedback?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}
export declare class BusinessIntelligenceDashboardService {
    private loggingService;
    private metricsService;
    private costTrackingService;
    private dashboardCache;
    private humanEvaluationTasks;
    constructor();
    private initializeHumanEvaluationPipeline;
    generateDashboard(merchantId: string, period: {
        start: Date;
        end: Date;
    }): Promise<DashboardData>;
    private generateUsageAnalytics;
    private generateConversionTracking;
    private generateQualityMetrics;
    private generateCostAnalysis;
    private getRecentAlerts;
    private generateHumanEvaluationTasks;
    submitHumanEvaluation(taskId: string, evaluatorId: string, score: number, feedback: string): Promise<void>;
    getPendingEvaluationTasks(limit?: number): HumanEvaluationTask[];
    getEvaluationResults(merchantId: string): Promise<any>;
    clearDashboardCache(merchantId?: string): void;
}
export declare function getBusinessIntelligenceDashboardService(): BusinessIntelligenceDashboardService;
//# sourceMappingURL=BusinessIntelligenceDashboardService.d.ts.map