import { Document } from '../models';
export interface BatchOperation {
    id: string;
    type: 'embedding_update' | 'vector_index_rebuild' | 'bulk_insert' | 'bulk_delete';
    merchantId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    startTime?: Date;
    endTime?: Date;
    error?: string;
    metadata?: Record<string, any>;
}
export interface BatchEmbeddingUpdate {
    documentId: string;
    merchantId: string;
    text: string;
    priority: 'high' | 'medium' | 'low';
}
export interface VectorIndexMaintenanceOptions {
    merchantId: string;
    rebuildThreshold: number;
    batchSize: number;
    maxConcurrency: number;
}
export interface BatchProcessingStats {
    totalOperations: number;
    runningOperations: number;
    completedOperations: number;
    failedOperations: number;
    averageProcessingTime: number;
    throughputPerMinute: number;
}
/**
 * Batch Processing Service
 * Handles bulk operations, embedding updates, and vector index maintenance
 */
export declare class BatchProcessingService {
    private documentRepository;
    private mindsdbService;
    private cacheService;
    private auditRepository;
    private activeOperations;
    private processingQueue;
    private readonly maxConcurrentOperations;
    /**
     * Queue batch embedding updates for multiple documents
     */
    queueBatchEmbeddingUpdates(updates: BatchEmbeddingUpdate[], options?: {
        batchSize?: number;
        priority?: 'high' | 'medium' | 'low';
    }): Promise<string>;
    /**
     * Perform vector index maintenance for a merchant
     */
    performVectorIndexMaintenance(options: VectorIndexMaintenanceOptions): Promise<string>;
    /**
     * Bulk insert documents with embeddings
     */
    bulkInsertDocuments(documents: Document[], generateEmbeddings?: boolean): Promise<string>;
    /**
     * Get status of a batch operation
     */
    getOperationStatus(operationId: string): Promise<BatchOperation | null>;
    /**
     * Get batch processing statistics
     */
    getBatchProcessingStats(): Promise<BatchProcessingStats>;
    /**
     * Cancel a batch operation
     */
    cancelOperation(operationId: string): Promise<boolean>;
    /**
     * Process the operation queue
     */
    private processQueue;
    /**
     * Process a single batch operation
     */
    private processOperation;
    /**
     * Process embedding update operation
     */
    private processEmbeddingUpdate;
    /**
     * Process vector index rebuild operation
     */
    private processVectorIndexRebuild;
    /**
     * Process bulk insert operation
     */
    private processBulkInsert;
    /**
     * Check if vector index maintenance is needed
     */
    private checkMaintenanceNeeded;
    /**
     * Group updates by merchant ID
     */
    private groupUpdatesByMerchant;
    /**
     * Split array into chunks
     */
    private chunkArray;
    /**
     * Generate operation ID
     */
    private generateOperationId;
    /**
     * Generate payload hash for audit logging
     */
    private generatePayloadHash;
    /**
     * Get document type distribution
     */
    private getDocumentTypeDistribution;
    /**
     * Health check for batch processing service
     */
    healthCheck(): Promise<{
        service: boolean;
        activeOperations: number;
        queueLength: number;
        lastProcessedOperation?: string;
    }>;
}
export declare const getBatchProcessingService: () => BatchProcessingService;
//# sourceMappingURL=BatchProcessingService.d.ts.map