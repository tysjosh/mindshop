import { ExecutionPlan } from './IntentParsingService';
export interface ToolDefinition {
    id: string;
    name: string;
    endpoint: string;
    timeout: number;
    retryConfig: {
        maxRetries: number;
        backoffMs: number;
        backoffMultiplier: number;
    };
    circuitBreakerConfig: {
        failureThreshold: number;
        resetTimeout: number;
        monitoringWindow: number;
    };
    healthCheck: {
        endpoint: string;
        interval: number;
        timeout: number;
    };
    bulkheadConfig: {
        maxConcurrentRequests: number;
        queueSize: number;
    };
}
export interface ToolInvocation {
    id: string;
    toolId: string;
    parameters: Record<string, any>;
    timeout: number;
    retryConfig: ExecutionPlan['steps'][0]['retryConfig'];
    merchantId: string;
    priority: number;
}
export interface ToolResult {
    invocationId: string;
    toolId: string;
    success: boolean;
    result?: any;
    error?: string;
    latency: number;
    retryCount: number;
    timestamp: Date;
}
export interface BulkheadStats {
    merchantId: string;
    activeRequests: number;
    queuedRequests: number;
    totalRequests: number;
    failedRequests: number;
    avgLatency: number;
    lastActivity: Date;
}
export declare class ToolCoordinationService {
    private tools;
    private circuitBreakers;
    private bulkheads;
    private healthCheckIntervals;
    constructor();
    /**
     * Register a tool with the coordination service
     */
    registerTool(tool: ToolDefinition): void;
    /**
     * Execute a single tool invocation
     */
    invokeTool(invocation: ToolInvocation): Promise<ToolResult>;
    /**
     * Execute multiple tool invocations with coordination
     */
    executeCoordinatedPlan(plan: ExecutionPlan, merchantId: string, userId: string): Promise<{
        results: ToolResult[];
        success: boolean;
        totalLatency: number;
        failedSteps: string[];
    }>;
    /**
     * Get tool health status
     */
    getToolHealth(toolId: string): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        circuitBreakerState: string;
        lastHealthCheck: Date | null;
        errorRate: number;
    };
    /**
     * Get bulkhead statistics for a merchant
     */
    getBulkheadStats(merchantId: string): BulkheadStats;
    /**
     * Get overall system health
     */
    getSystemHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        toolsHealth: Record<string, any>;
        bulkheadStats: Record<string, BulkheadStats>;
        timestamp: Date;
    };
    /**
     * Initialize default tools
     */
    private initializeDefaultTools;
    /**
     * Execute actual tool call
     */
    private executeToolCall;
    /**
     * Get fallback result for circuit breaker
     */
    private getFallbackResult;
    /**
     * Get or create bulkhead for merchant
     */
    private getBulkhead;
    /**
     * Start health check monitoring for a tool
     */
    private startHealthCheck;
    /**
     * Topological sort for dependency resolution
     */
    private topologicalSort;
    private callSemanticRetrieval;
    private callProductPrediction;
    private callCheckout;
    private callAmazonQ;
}
export declare function createToolCoordinationService(): ToolCoordinationService;
//# sourceMappingURL=ToolCoordinationService.d.ts.map