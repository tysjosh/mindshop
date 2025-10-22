export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    handler: (input: any, context: ToolExecutionContext) => Promise<any>;
    requiresAuth: boolean;
    rateLimitPerMinute?: number;
    costEstimate?: number;
}
export interface ToolExecutionContext {
    merchantId: string;
    userId?: string;
    sessionId?: string;
    requestId: string;
    timestamp: Date;
}
export interface ToolExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    cost: number;
    metadata: {
        toolName: string;
        context: ToolExecutionContext;
        inputHash: string;
        outputSize: number;
    };
}
/**
 * Registry and orchestrator for Bedrock Agent tools
 * Provides validation, execution, monitoring, and cost tracking
 */
export declare class BedrockAgentToolRegistry {
    private tools;
    private executionStats;
    private costTrackingService;
    private loggingService;
    constructor();
    /**
     * Register all default tools
     */
    private registerDefaultTools;
    /**
     * Register a new tool
     */
    registerTool(tool: ToolDefinition): void;
    /**
     * Get all registered tools
     */
    getTools(): ToolDefinition[];
    /**
     * Get a specific tool by name
     */
    getTool(name: string): ToolDefinition | undefined;
    /**
     * Execute a tool with validation and monitoring
     */
    executeTool(toolName: string, input: any, context: ToolExecutionContext): Promise<ToolExecutionResult>;
    /**
     * Handle semantic retrieval tool
     */
    private handleSemanticRetrieval;
    /**
     * Handle product prediction tool
     */
    private handleProductPrediction;
    /**
     * Handle secure checkout tool
     */
    private handleSecureCheckout;
    /**
     * Handle health check tool
     */
    private handleHealthCheck;
    /**
     * Validate input against tool schema
     */
    private validateInput;
    /**
     * Validate output against tool schema
     */
    private validateOutput;
    /**
     * Check rate limits for tool execution
     */
    private checkRateLimit;
    /**
     * Update execution statistics
     */
    private updateExecutionStats;
    /**
     * Hash input for tracking
     */
    private hashInput;
    /**
     * Get execution statistics
     */
    getExecutionStats(): Map<string, {
        count: number;
        lastExecution: Date;
    }>;
    /**
     * Generate OpenAPI specification for all tools
     */
    generateOpenAPISpec(): any;
}
export declare function getBedrockAgentToolRegistry(): BedrockAgentToolRegistry;
export { BedrockAgentToolRegistry as BedrockAgentToolRegistryClass };
//# sourceMappingURL=BedrockAgentToolRegistry.d.ts.map