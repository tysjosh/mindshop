import { AmazonQService } from './AmazonQService';
export interface IntentParsingConfig {
    bedrockRegion: string;
    modelId: string;
    amazonQService: AmazonQService;
}
export interface ParsedIntent {
    intent: 'search' | 'recommend' | 'purchase' | 'question' | 'compare' | 'support';
    confidence: number;
    entities: {
        products?: string[];
        categories?: string[];
        priceRange?: {
            min?: number;
            max?: number;
        };
        brands?: string[];
        features?: string[];
        quantity?: number;
    };
    context: {
        urgency: 'low' | 'medium' | 'high';
        complexity: 'simple' | 'moderate' | 'complex';
        userType: 'new' | 'returning' | 'vip';
    };
    reasoning: string;
}
export interface ExecutionPlan {
    steps: Array<{
        id: string;
        type: 'retrieval' | 'prediction' | 'grounding' | 'checkout' | 'validation';
        tool: string;
        parameters: Record<string, any>;
        priority: number;
        dependencies: string[];
        timeout: number;
        retryConfig: {
            maxRetries: number;
            backoffMs: number;
        };
    }>;
    parallelizable: boolean;
    estimatedLatency: number;
    fallbackPlan?: ExecutionPlan;
}
export interface PlanningContext {
    merchantId: string;
    userId: string;
    sessionHistory: Array<{
        role: string;
        content: string;
    }>;
    userContext: Record<string, any>;
    availableTools: string[];
    constraints: {
        maxLatency: number;
        maxCost: number;
        requireGrounding: boolean;
    };
}
export declare class IntentParsingService {
    private bedrockClient;
    private modelId;
    private amazonQService;
    constructor(config: IntentParsingConfig);
    /**
     * Parse user intent from query with context
     */
    parseIntent(query: string, context: PlanningContext): Promise<ParsedIntent>;
    /**
     * Generate execution plan based on parsed intent
     */
    generateExecutionPlan(intent: ParsedIntent, context: PlanningContext): Promise<ExecutionPlan>;
    /**
     * Validate execution plan against constraints
     */
    validatePlan(plan: ExecutionPlan, constraints: PlanningContext['constraints']): {
        valid: boolean;
        violations: string[];
        suggestions: string[];
    };
    /**
     * Build intent parsing prompt
     */
    private buildIntentPrompt;
    /**
     * Build enhanced intent prompt with Amazon Q context
     */
    private buildEnhancedIntentPrompt;
    /**
     * Invoke Bedrock model for intent parsing
     */
    private invokeBedrockModel;
    /**
     * Parse intent response from Bedrock
     */
    private parseIntentResponse;
    /**
     * Generate search steps
     */
    private generateSearchSteps;
    /**
     * Generate recommendation steps
     */
    private generateRecommendationSteps;
    /**
     * Generate purchase steps
     */
    private generatePurchaseSteps;
    /**
     * Generate question steps
     */
    private generateQuestionSteps;
    /**
     * Generate comparison steps
     */
    private generateComparisonSteps;
    /**
     * Generate support steps
     */
    private generateSupportSteps;
    /**
     * Check if steps can be parallelized
     */
    private canParallelizeSteps;
    /**
     * Generate fallback plan
     */
    private generateFallbackPlan;
    /**
     * Get minimal plan for errors
     */
    private getMinimalPlan;
    /**
     * Get fallback intent
     */
    private getFallbackIntent;
    /**
     * Estimate plan cost (simplified)
     */
    private estimatePlanCost;
}
export declare function createIntentParsingService(amazonQService: AmazonQService): IntentParsingService;
//# sourceMappingURL=IntentParsingService.d.ts.map