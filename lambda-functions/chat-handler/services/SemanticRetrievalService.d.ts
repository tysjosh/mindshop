import { MindsDBService } from "./MindsDBService";
import { RetrievalResult } from "../types";
export interface SemanticRetrievalParams {
    query: string;
    merchantId: string;
    limit?: number;
    threshold?: number;
    useHybridSearch?: boolean;
    filters?: Record<string, any>;
}
export declare class SemanticRetrievalService {
    private mindsdbService;
    private cacheService;
    private circuitBreaker;
    private readonly circuitBreakerConfig;
    constructor(mindsdbService?: MindsDBService);
    retrieveDocuments(params: SemanticRetrievalParams): Promise<RetrievalResult[]>;
    generateEmbedding(text: string, merchantId: string): Promise<number[]>;
    batchGenerateEmbeddings(texts: string[], merchantId: string): Promise<number[][]>;
    searchSimilarDocuments(merchantId: string, documentId: string, limit?: number): Promise<RetrievalResult[]>;
    getDocumentById(merchantId: string, documentId: string): Promise<RetrievalResult | null>;
    deleteDocument(merchantId: string, documentId: string): Promise<boolean>;
    getDocumentStats(merchantId: string): Promise<{
        totalDocuments: number;
        totalChunks: number;
        avgRelevanceScore: number;
        documentTypes: Record<string, number>;
    }>;
    /**
     * Deploy semantic retriever for a merchant
     */
    deploySemanticRetriever(merchantId: string): Promise<void>;
    /**
     * Retrieve documents via REST API
     */
    retrieveViaREST(params: SemanticRetrievalParams): Promise<RetrievalResult[]>;
    /**
     * Validate grounding of results
     */
    validateGrounding(query: string, results: RetrievalResult[]): Promise<{
        isGrounded: boolean;
        confidence: number;
        reasoning: string[];
    }>;
    /**
     * Get predictor status
     */
    getPredictorStatus(merchantId: string): Promise<{
        status: string;
        accuracy?: number;
        lastTrained?: string;
    }>;
    /**
     * Update predictor configuration
     */
    updatePredictorConfig(merchantId: string, config: any): Promise<void>;
}
//# sourceMappingURL=SemanticRetrievalService.d.ts.map