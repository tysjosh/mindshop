export interface RAGQuery {
    query: string;
    merchantId: string;
    userId?: string;
    sessionId?: string;
    userContext?: any;
    filters?: Record<string, any>;
    useHybridSearch?: boolean;
    maxResults?: number;
    limit?: number;
    includeExplainability?: boolean;
    threshold?: number;
}
export interface RAGResult {
    retrievalResults: any[];
    predictions: any[];
    rankedResults: any[];
    confidence: number;
    reasoning: string[];
    cacheHit: boolean;
    executionTime: number;
    fallbackUsed: boolean;
}
/**
 * Enhanced RAG Service with MindsDB Integration
 * Provides intelligent document retrieval and response generation
 */
export declare class RAGService {
    private mindsdbService;
    private cacheService;
    private circuitBreaker;
    constructor();
    /**
     * Main RAG query method
     */
    query(query: RAGQuery): Promise<RAGResult>;
    /**
     * Ask a question using the RAG system
     */
    ask(merchantId: string, question: string, context?: any): Promise<string>;
    /**
     * Ingest a document into the RAG system
     */
    ingestDocument(merchantId: string, document: {
        id: string;
        content: string;
        title?: string;
        source: string;
        document_type: string;
    }): Promise<void>;
    /**
     * Search documents in the knowledge base
     */
    searchDocuments(merchantId: string, query: string, filters?: Record<string, any>, useHybridSearch?: boolean): Promise<any[]>;
    /**
     * Initialize RAG system for a merchant
     */
    initializeRAGSystem(merchantId: string, openaiApiKey: string): Promise<void>;
    /**
     * Get health status of the RAG system
     */
    getHealthStatus(): Promise<{
        status: "healthy" | "degraded" | "unhealthy";
        components: Record<string, any>;
    }>;
    /**
     * Generate cache key for a query
     */
    private generateCacheKey;
    /**
     * Reset circuit breakers
     */
    resetCircuitBreakers(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): Promise<any>;
    /**
     * Invalidate cache for a merchant
     */
    invalidateMerchantCache(merchantId: string): Promise<number>;
    /**
     * Process query (compatibility method for OrchestrationService)
     */
    processQuery(query: RAGQuery): Promise<RAGResult>;
    /**
     * Query using direct MindsDB-Bedrock integration
     */
    queryWithBedrockIntegration(query: RAGQuery): Promise<RAGResult>;
    /**
     * Ask question using Bedrock integration with intelligent routing
     */
    askWithBedrock(merchantId: string, question: string, options?: {
        useBedrockIntegration?: boolean;
        bedrockModelName?: string;
        includeContext?: boolean;
        maxDocuments?: number;
    }): Promise<{
        answer: string;
        confidence: number;
        sources: any[];
        reasoning: string[];
        method: 'bedrock_integration' | 'standard_rag' | 'fallback';
    }>;
    /**
     * Initialize Bedrock integration for a merchant
     */
    initializeBedrockIntegration(merchantId: string, awsCredentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        region: string;
    }, bedrockConfig?: {
        modelId?: string;
        mode?: 'default' | 'conversational';
        maxTokens?: number;
        temperature?: number;
    }): Promise<void>;
    /**
     * Get Bedrock integration status for a merchant
     */
    getBedrockIntegrationStatus(merchantId: string): Promise<{
        engineStatus: any;
        modelStatus: any;
        isReady: boolean;
    }>;
}
export declare const ragService: RAGService;
//# sourceMappingURL=RAGService.d.ts.map