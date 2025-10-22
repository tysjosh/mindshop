export interface BedrockLLMConfig {
    region: string;
    modelId: string;
    maxTokens: number;
    temperature: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    timeout: number;
    retryAttempts: number;
    costTracking: {
        enabled: boolean;
        cloudWatchNamespace: string;
        inputTokenCost: number;
        outputTokenCost: number;
    };
}
export interface LLMRequest {
    prompt: string;
    sessionId: string;
    merchantId: string;
    userId?: string;
    modelSize: 'small' | 'medium' | 'large';
    streaming?: boolean;
    maxTokens?: number;
    temperature?: number;
}
export interface LLMResponse {
    response: string;
    tokenUsage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    cost: {
        inputCost: number;
        outputCost: number;
        totalCost: number;
    };
    modelId: string;
    responseTime: number;
    requestId: string;
}
export interface LLMStreamResponse {
    stream: AsyncIterable<string>;
    metadata: {
        requestId: string;
        modelId: string;
        startTime: number;
    };
}
export interface CostMetrics {
    sessionId: string;
    merchantId: string;
    userId?: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    responseTime: number;
    timestamp: Date;
}
export interface BedrockSessionCostSummary {
    sessionId: string;
    merchantId: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    averageResponseTime: number;
    modelBreakdown: Record<string, {
        requests: number;
        tokens: number;
        cost: number;
    }>;
}
export declare class BedrockLLMService {
    private readonly bedrockClient;
    private readonly cloudWatchClient;
    private readonly config;
    private readonly sessionCosts;
    private readonly modelConfigs;
    constructor(config: BedrockLLMConfig);
    invokeModel(request: LLMRequest): Promise<LLMResponse>;
    invokeModelStream(request: LLMRequest): Promise<LLMStreamResponse>;
    private buildModelPayload;
    private parseModelResponse;
    private createStreamProcessor;
    private retryWithFallback;
    private simplifyPrompt;
    private shouldRetryWithFallback;
    private trackCosts;
    private emitMetrics;
    private emitErrorMetrics;
    private emitFallbackMetrics;
    getSessionCostSummary(sessionId: string): BedrockSessionCostSummary | null;
    getMerchantCostSummary(merchantId: string, timeRange?: {
        start: Date;
        end: Date;
    }): {
        totalCost: number;
        totalRequests: number;
        totalTokens: number;
        averageCostPerRequest: number;
        modelBreakdown: Record<string, {
            requests: number;
            tokens: number;
            cost: number;
        }>;
    };
    private generateRequestId;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export declare const createBedrockLLMService: (config: BedrockLLMConfig) => BedrockLLMService;
//# sourceMappingURL=BedrockLLMService.d.ts.map