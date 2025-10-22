export interface AmazonQConfig {
    applicationId: string;
    region: string;
    indexId?: string;
}
export interface QChatRequest {
    query: string;
    conversationId?: string;
    userId: string;
    merchantId: string;
    context?: Record<string, any>;
}
export interface QChatResponse {
    response: string;
    conversationId: string;
    sources: Array<{
        id: string;
        title: string;
        snippet: string;
        uri?: string;
        score: number;
    }>;
    confidence: number;
    systemMessage?: string;
}
export interface QGroundingResult {
    isGrounded: boolean;
    confidence: number;
    sources: Array<{
        id: string;
        title: string;
        snippet: string;
        relevanceScore: number;
    }>;
    explanation: string;
}
export declare class AmazonQService {
    private qClient;
    private applicationId;
    private indexId?;
    constructor(config: AmazonQConfig);
    /**
     * Chat with Amazon Q for additional retrieval and grounding
     */
    chat(request: QChatRequest): Promise<QChatResponse>;
    /**
     * Use Amazon Q for grounding validation
     */
    validateGrounding(claim: string, sources: Array<{
        content: string;
        metadata?: Record<string, any>;
    }>, merchantId: string): Promise<QGroundingResult>;
    /**
     * Get additional context from Amazon Q
     */
    getAdditionalContext(query: string, merchantId: string, contextType: "product_info" | "policy" | "faq" | "general"): Promise<{
        context: string;
        sources: Array<{
            id: string;
            title: string;
            snippet: string;
        }>;
        relevance: number;
    }>;
    /**
     * Check Amazon Q application health
     */
    healthCheck(): Promise<{
        status: "healthy" | "unhealthy";
        details: Record<string, any>;
    }>;
    /**
     * Extract sources from Amazon Q response
     */
    private extractSources;
    /**
     * Calculate confidence based on response quality
     */
    private calculateConfidence;
    /**
     * Enhance query based on context type
     */
    private enhanceQueryForContext;
    /**
     * Generate client token for request tracking
     */
    private generateClientToken;
    /**
     * Generate conversation ID
     */
    private generateConversationId;
}
export declare function createAmazonQService(): AmazonQService;
//# sourceMappingURL=AmazonQService.d.ts.map