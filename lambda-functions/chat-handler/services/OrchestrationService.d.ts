export interface OrchestrationRequest {
    requestId: string;
    merchantId: string;
    userId: string;
    sessionId?: string;
    operation: 'chat' | 'search' | 'checkout' | 'analytics';
    payload: any;
    userContext?: {
        preferences?: Record<string, any>;
        purchaseHistory?: string[];
        currentCart?: Array<{
            sku: string;
            quantity: number;
            price: number;
        }>;
        demographics?: Record<string, any>;
    };
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    };
}
export interface OrchestrationResponse {
    requestId: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    componentLatencies: {
        authentication: number;
        ragProcessing?: number;
        bedrockAgent?: number;
        sessionManagement?: number;
        checkout?: number;
        caching?: number;
    };
    fallbackUsed: boolean;
    cacheHit: boolean;
    costEstimate: number;
}
export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
        ragService: 'healthy' | 'degraded' | 'unhealthy';
        bedrockAgent: 'healthy' | 'degraded' | 'unhealthy';
        sessionManager: 'healthy' | 'degraded' | 'unhealthy';
        cache: 'healthy' | 'degraded' | 'unhealthy';
        database: 'healthy' | 'degraded' | 'unhealthy';
        checkout: 'healthy' | 'degraded' | 'unhealthy';
    };
    latencyBudget: {
        target: number;
        current: number;
        withinBudget: boolean;
    };
    circuitBreakers: Record<string, any>;
    timestamp: string;
}
/**
 * Comprehensive Orchestration Service
 *
 * Coordinates all AWS components and implements end-to-end request flow:
 * API Gateway → Bedrock AgentCore → MindsDB ECS → Aurora → ElastiCache
 */
export declare class OrchestrationService {
    private ragService;
    private bedrockAgentService;
    private sessionManager;
    private sessionAnalyticsService;
    private checkoutService;
    private circuitBreaker;
    private auditLogRepository;
    private piiRedactor;
    private cacheService;
    private readonly LATENCY_BUDGET_MS;
    private readonly COST_PER_REQUEST_BASE;
    constructor();
    /**
     * Main orchestration method - handles all request types
     */
    orchestrateRequest(request: OrchestrationRequest): Promise<OrchestrationResponse>;
    /**
     * Handle chat requests with full RAG pipeline
     */
    private handleChatRequest;
    /**
     * Handle search requests
     */
    private handleSearchRequest;
    /**
     * Handle checkout requests
     */
    private handleCheckoutRequest;
    /**
     * Handle analytics requests
     */
    private handleAnalyticsRequest;
    /**
     * Comprehensive health check for all components
     */
    performHealthCheck(): Promise<HealthCheckResult>;
    /**
     * Private helper methods
     */
    private validateRequest;
    private sanitizeRequest;
    private trackUsage;
    private calculateChatCost;
    private calculateSearchCost;
    private calculateCheckoutCost;
    private testSessionManager;
    private testCheckoutService;
    private getHealthStatus;
    private extractTitleFromSnippet;
    private hashPayload;
}
export declare const getOrchestrationService: () => OrchestrationService;
//# sourceMappingURL=OrchestrationService.d.ts.map