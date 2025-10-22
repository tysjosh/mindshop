import { MindsDBService } from './MindsDBService';
import { DocumentRepository } from '../repositories/DocumentRepository';
export interface EmbeddingRequest {
    text: string;
    merchantId: string;
    documentId?: string;
    model?: string;
    skipPIIRedaction?: boolean;
}
export interface BatchEmbeddingRequest {
    texts: string[];
    merchantId: string;
    documentIds?: string[];
    model?: string;
    skipPIIRedaction?: boolean;
    batchSize?: number;
}
export interface EmbeddingResult {
    embedding: number[];
    originalText: string;
    sanitizedText: string;
    tokenMap?: Map<string, string>;
    processingTime: number;
    model: string;
}
export interface BatchEmbeddingResult {
    results: EmbeddingResult[];
    totalProcessingTime: number;
    successCount: number;
    failureCount: number;
    errors: Array<{
        index: number;
        error: string;
    }>;
}
export interface EmbeddingUpdateRequest {
    documentId: string;
    merchantId: string;
    forceRegenerate?: boolean;
    model?: string;
}
export interface BatchEmbeddingUpdateRequest {
    updates: EmbeddingUpdateRequest[];
    batchSize?: number;
    concurrency?: number;
}
/**
 * EmbeddingService class using MindsDB embedding models for text-to-vector conversion
 * with PII protection and batch processing capabilities
 */
export declare class EmbeddingService {
    private mindsdbService;
    private piiRedactor;
    private documentRepository;
    private cacheService;
    private readonly defaultModel;
    private readonly defaultBatchSize;
    private readonly maxConcurrency;
    constructor(mindsdbService?: MindsDBService, documentRepository?: DocumentRepository);
    /**
     * Generate embedding for a single text with PII protection
     */
    generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResult>;
    /**
     * Generate embeddings for multiple texts with batch processing
     */
    generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResult>;
    /**
     * Update document embedding in the repository
     */
    updateDocumentEmbedding(request: EmbeddingUpdateRequest): Promise<void>;
    /**
     * Batch update document embeddings with controlled concurrency
     */
    batchUpdateDocumentEmbeddings(request: BatchEmbeddingUpdateRequest): Promise<{
        successCount: number;
        failureCount: number;
        errors: Array<{
            documentId: string;
            error: string;
        }>;
    }>;
    /**
     * Process documents for a merchant and update their embeddings
     */
    processDocumentsForMerchant(merchantId: string, options?: {
        forceRegenerate?: boolean;
        model?: string;
        batchSize?: number;
        concurrency?: number;
        documentType?: 'product' | 'faq' | 'policy' | 'review';
    }): Promise<{
        processedCount: number;
        successCount: number;
        failureCount: number;
        errors: Array<{
            documentId: string;
            error: string;
        }>;
    }>;
    /**
     * Get embedding statistics for a merchant
     */
    getEmbeddingStats(merchantId: string): Promise<{
        totalDocuments: number;
        documentsWithEmbeddings: number;
        documentsWithoutEmbeddings: number;
        embeddingCoverage: number;
        averageEmbeddingDimensions: number;
    }>;
    /**
     * Health check for the embedding service
     */
    healthCheck(): Promise<{
        mindsdb: boolean;
        piiRedactor: boolean;
        documentRepository: boolean;
        cache: boolean;
    }>;
    /**
     * Clear embedding cache for a merchant
     */
    clearEmbeddingCache(merchantId: string): Promise<void>;
    /**
     * Get available embedding models
     */
    getAvailableModels(): string[];
    private validateEmbeddingRequest;
    private validateBatchEmbeddingRequest;
    private validateMerchantId;
    private validateUUID;
    private generateCacheKey;
}
export declare const getEmbeddingService: () => EmbeddingService;
//# sourceMappingURL=EmbeddingService.d.ts.map