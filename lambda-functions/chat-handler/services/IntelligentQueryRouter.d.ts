export interface QueryRoutingDecision {
    useBedrockIntegration: boolean;
    reasoning: string[];
    confidence: number;
    estimatedCost: number;
    estimatedLatency: number;
}
export interface IntelligentQueryOptions {
    merchantId: string;
    query: string;
    userContext?: any;
    forceMethod?: 'mindsdb' | 'bedrock' | 'hybrid';
    costBudget?: number;
    latencyBudget?: number;
}
export interface IntelligentQueryResult {
    answer: string;
    confidence: number;
    sources: any[];
    reasoning: string[];
    method: 'mindsdb_only' | 'bedrock_integration' | 'hybrid_fallback';
    executionTime: number;
    estimatedCost: number;
    routingDecision: QueryRoutingDecision;
}
/**
 * Intelligent Query Router
 * Automatically routes queries to the optimal AI system based on complexity, cost, and performance
 */
export declare class IntelligentQueryRouter {
    private mindsdbService;
    private ragService;
    private predictionService;
    private cacheService;
    constructor();
    /**
     * Intelligently route query to optimal AI system
     */
    routeQuery(options: IntelligentQueryOptions): Promise<IntelligentQueryResult>;
    /**
     * Make intelligent routing decision based on query analysis
     */
    private makeRoutingDecision;
    /**
     * Execute query using Bedrock integration
     */
    private executeBedrockIntegratedQuery;
    /**
     * Execute query using standard MindsDB
     */
    private executeMindsDBQuery;
    /**
     * Calculate actual cost based on method and execution time
     */
    private calculateActualCost;
    /**
     * Get routing statistics for a merchant
     */
    getRoutingStats(merchantId: string): Promise<{
        totalQueries: number;
        bedrockQueries: number;
        mindsdbQueries: number;
        averageCost: number;
        averageLatency: number;
        successRate: number;
    }>;
    /**
     * Health check for intelligent routing system
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        components: Record<string, any>;
        routing: {
            available: boolean;
            bedrockIntegration: boolean;
            predictionService: boolean;
        };
    }>;
}
export declare const intelligentQueryRouter: IntelligentQueryRouter;
//# sourceMappingURL=IntelligentQueryRouter.d.ts.map