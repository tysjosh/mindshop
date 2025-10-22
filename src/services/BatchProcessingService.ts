import { getDocumentRepository } from '../repositories/DocumentRepository';
import { MindsDBService } from './MindsDBService';
import { getCacheService } from './CacheService';
import { getAuditLogRepository } from '../repositories/AuditLogRepository';
import { Document } from '../models';
import { createHash } from 'crypto';

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
  rebuildThreshold: number; // Percentage of documents that need updates before rebuild
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
export class BatchProcessingService {
  private documentRepository = getDocumentRepository();
  private mindsdbService = new MindsDBService();
  private cacheService = getCacheService();
  private auditRepository = getAuditLogRepository();
  
  private activeOperations = new Map<string, BatchOperation>();
  private processingQueue: BatchOperation[] = [];
  private readonly maxConcurrentOperations = 5;

  /**
   * Queue batch embedding updates for multiple documents
   */
  async queueBatchEmbeddingUpdates(
    updates: BatchEmbeddingUpdate[],
    options: { batchSize?: number; priority?: 'high' | 'medium' | 'low' } = {}
  ): Promise<string> {
    const batchSize = options.batchSize || 50;
    const priority = options.priority || 'medium';
    
    // Group by merchant ID for tenant isolation
    const updatesByMerchant = this.groupUpdatesByMerchant(updates);
    
    const operationIds: string[] = [];
    
    for (const [merchantId, merchantUpdates] of updatesByMerchant) {
      // Split into batches
      const batches = this.chunkArray(merchantUpdates, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const operationId = this.generateOperationId('embedding_update', merchantId);
        
        const operation: BatchOperation = {
          id: operationId,
          type: 'embedding_update',
          merchantId,
          status: 'pending',
          progress: 0,
          totalItems: batch.length,
          processedItems: 0,
          failedItems: 0,
          metadata: {
            batchIndex: i,
            totalBatches: batches.length,
            priority,
            documents: batch.map(u => ({ id: u.documentId, text: u.text })),
          },
        };
        
        this.processingQueue.push(operation);
        operationIds.push(operationId);
        
        // Log operation creation
        await this.auditRepository.create({
          merchantId,
          operation: 'batch_embedding_update_queued',
          requestPayloadHash: this.generatePayloadHash(operation),
          responseReference: operationId,
          outcome: 'success',
          actor: 'batch_processing_service',
        });
      }
    }
    
    // Start processing if not at capacity
    this.processQueue();
    
    return operationIds.join(',');
  }

  /**
   * Perform vector index maintenance for a merchant
   */
  async performVectorIndexMaintenance(
    options: VectorIndexMaintenanceOptions
  ): Promise<string> {
    const operationId = this.generateOperationId('vector_index_rebuild', options.merchantId);
    
    // Check if maintenance is needed
    const maintenanceNeeded = await this.checkMaintenanceNeeded(options);
    
    if (!maintenanceNeeded) {
      console.log(`Vector index maintenance not needed for merchant ${options.merchantId}`);
      return operationId;
    }
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'vector_index_rebuild',
      merchantId: options.merchantId,
      status: 'pending',
      progress: 0,
      totalItems: 0, // Will be set when we count documents
      processedItems: 0,
      failedItems: 0,
      metadata: {
        rebuildThreshold: options.rebuildThreshold,
        batchSize: options.batchSize,
        maxConcurrency: options.maxConcurrency,
      },
    };
    
    this.processingQueue.push(operation);
    
    // Log operation creation
    await this.auditRepository.create({
      merchantId: options.merchantId,
      operation: 'vector_index_maintenance_queued',
      requestPayloadHash: this.generatePayloadHash(operation),
      responseReference: operationId,
      outcome: 'success',
      actor: 'batch_processing_service',
    });
    
    this.processQueue();
    
    return operationId;
  }

  /**
   * Bulk insert documents with embeddings
   */
  async bulkInsertDocuments(
    documents: Document[],
    generateEmbeddings: boolean = true
  ): Promise<string> {
    if (documents.length === 0) {
      throw new Error('No documents provided for bulk insert');
    }
    
    const merchantId = documents[0].merchantId;
    
    // Validate all documents belong to same merchant
    const invalidDocs = documents.filter(doc => doc.merchantId !== merchantId);
    if (invalidDocs.length > 0) {
      throw new Error('All documents must belong to the same merchant for bulk insert');
    }
    
    const operationId = this.generateOperationId('bulk_insert', merchantId);
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'bulk_insert',
      merchantId,
      status: 'pending',
      progress: 0,
      totalItems: documents.length,
      processedItems: 0,
      failedItems: 0,
      metadata: {
        generateEmbeddings,
        documentTypes: this.getDocumentTypeDistribution(documents),
      },
    };
    
    this.processingQueue.push(operation);
    
    // Store documents in cache temporarily for processing
    const cacheKey = `bulk_insert:${operationId}`;
    await this.cacheService.set(cacheKey, documents, 3600); // 1 hour TTL
    
    // Log operation creation
    await this.auditRepository.create({
      merchantId,
      operation: 'bulk_insert_queued',
      requestPayloadHash: this.generatePayloadHash(operation),
      responseReference: operationId,
      outcome: 'success',
      actor: 'batch_processing_service',
    });
    
    this.processQueue();
    
    return operationId;
  }

  /**
   * Get status of a batch operation
   */
  async getOperationStatus(operationId: string): Promise<BatchOperation | null> {
    // Check active operations first
    const activeOp = this.activeOperations.get(operationId);
    if (activeOp) {
      return activeOp;
    }
    
    // Check queue
    const queuedOp = this.processingQueue.find(op => op.id === operationId);
    if (queuedOp) {
      return queuedOp;
    }
    
    // Check cache for completed operations
    const cacheKey = `batch_operation:${operationId}`;
    const cachedOp = await this.cacheService.get<BatchOperation>(cacheKey);
    
    return cachedOp || null;
  }

  /**
   * Get batch processing statistics
   */
  async getBatchProcessingStats(): Promise<BatchProcessingStats> {
    const totalOperations = this.activeOperations.size + this.processingQueue.length;
    const runningOperations = this.activeOperations.size;
    
    // Get completed/failed operations from cache (simplified)
    const completedOperations = 0; // Would query from persistent storage
    const failedOperations = 0; // Would query from persistent storage
    
    return {
      totalOperations,
      runningOperations,
      completedOperations,
      failedOperations,
      averageProcessingTime: 0, // Would calculate from historical data
      throughputPerMinute: 0, // Would calculate from recent operations
    };
  }

  /**
   * Cancel a batch operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    // Remove from queue if pending
    const queueIndex = this.processingQueue.findIndex(op => op.id === operationId);
    if (queueIndex >= 0) {
      this.processingQueue.splice(queueIndex, 1);
      return true;
    }
    
    // Mark active operation for cancellation
    const activeOp = this.activeOperations.get(operationId);
    if (activeOp) {
      activeOp.status = 'failed';
      activeOp.error = 'Operation cancelled by user';
      activeOp.endTime = new Date();
      return true;
    }
    
    return false;
  }

  /**
   * Process the operation queue
   */
  private async processQueue(): Promise<void> {
    while (
      this.processingQueue.length > 0 && 
      this.activeOperations.size < this.maxConcurrentOperations
    ) {
      const operation = this.processingQueue.shift()!;
      this.activeOperations.set(operation.id, operation);
      
      // Process operation asynchronously
      this.processOperation(operation).catch(error => {
        console.error(`Error processing operation ${operation.id}:`, error);
        operation.status = 'failed';
        operation.error = error.message;
        operation.endTime = new Date();
      });
    }
  }

  /**
   * Process a single batch operation
   */
  private async processOperation(operation: BatchOperation): Promise<void> {
    operation.status = 'running';
    operation.startTime = new Date();
    
    try {
      switch (operation.type) {
        case 'embedding_update':
          await this.processEmbeddingUpdate(operation);
          break;
        case 'vector_index_rebuild':
          await this.processVectorIndexRebuild(operation);
          break;
        case 'bulk_insert':
          await this.processBulkInsert(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      
      operation.status = 'completed';
      operation.progress = 100;
      
    } catch (error: any) {
      operation.status = 'failed';
      operation.error = error.message;
      
      // Log failure
      await this.auditRepository.create({
        merchantId: operation.merchantId,
        operation: `${operation.type}_failed`,
        requestPayloadHash: this.generatePayloadHash(operation),
        responseReference: operation.id,
        outcome: 'failure',
        reason: error.message,
        actor: 'batch_processing_service',
      });
    } finally {
      operation.endTime = new Date();
      
      // Move to cache and remove from active operations
      const cacheKey = `batch_operation:${operation.id}`;
      await this.cacheService.set(cacheKey, operation, 86400); // 24 hours
      
      this.activeOperations.delete(operation.id);
      
      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Process embedding update operation
   */
  private async processEmbeddingUpdate(operation: BatchOperation): Promise<void> {
    const documents = operation.metadata?.documents || [];
    const batchSize = 10; // Process in smaller batches
    
    operation.totalItems = documents.length;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        // Generate embeddings for batch
        const texts = batch.map((doc: any) => doc.text);
        const embeddings = await this.mindsdbService.generateBatchEmbeddings({
          documents: texts.map((text: string, index: number) => ({ id: batch[index].id, text }))
        });
        
        // Update documents with new embeddings
        const updates = batch.map((doc: any, index: number) => ({
          id: doc.id,
          merchantId: operation.merchantId,
          embedding: embeddings[index],
        }));
        
        await this.documentRepository.batchUpdateEmbeddings(updates);
        
        operation.processedItems += batch.length;
        operation.progress = Math.round((operation.processedItems / operation.totalItems) * 100);
        
      } catch (error: any) {
        console.error(`Error processing embedding batch:`, error);
        operation.failedItems += batch.length;
      }
    }
  }

  /**
   * Process vector index rebuild operation
   */
  private async processVectorIndexRebuild(operation: BatchOperation): Promise<void> {
    // This would typically involve database-specific operations
    // For PostgreSQL with pgvector, this might involve:
    // 1. REINDEX on vector indexes
    // 2. VACUUM ANALYZE on documents table
    // 3. Update index statistics
    
    console.log(`Starting vector index rebuild for merchant ${operation.merchantId}`);
    
    // Simulate index rebuild process
    operation.totalItems = 100; // Placeholder
    
    for (let i = 0; i < 100; i += 10) {
      // Simulate index rebuild progress
      await new Promise(resolve => setTimeout(resolve, 100));
      
      operation.processedItems = Math.min(i + 10, 100);
      operation.progress = operation.processedItems;
    }
    
    // Invalidate related caches
    await this.cacheService.invalidateByPattern(`vector_search:${operation.merchantId}:*`);
    
    console.log(`Vector index rebuild completed for merchant ${operation.merchantId}`);
  }

  /**
   * Process bulk insert operation
   */
  private async processBulkInsert(operation: BatchOperation): Promise<void> {
    const cacheKey = `bulk_insert:${operation.id}`;
    const documents = await this.cacheService.get<Document[]>(cacheKey);
    
    if (!documents) {
      throw new Error('Documents not found in cache for bulk insert');
    }
    
    const batchSize = 50;
    const generateEmbeddings = operation.metadata?.generateEmbeddings || false;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        // Generate embeddings if requested
        if (generateEmbeddings) {
          const texts = batch.map(doc => `${doc.title}\n\n${doc.body}`);
          const embeddings = await this.mindsdbService.generateBatchEmbeddings({
            documents: texts.map((text, index) => ({ id: batch[index].id, text }))
          });
          
          // Update documents with embeddings
          batch.forEach((doc, index) => {
            doc.embedding = embeddings[index].embedding;
          });
        }
        
        // Insert batch
        await this.documentRepository.batchCreate(batch);
        
        operation.processedItems += batch.length;
        operation.progress = Math.round((operation.processedItems / operation.totalItems) * 100);
        
      } catch (error: any) {
        console.error(`Error processing bulk insert batch:`, error);
        operation.failedItems += batch.length;
      }
    }
    
    // Clean up cache
    await this.cacheService.delete(cacheKey);
  }

  /**
   * Check if vector index maintenance is needed
   */
  private async checkMaintenanceNeeded(options: VectorIndexMaintenanceOptions): Promise<boolean> {
    // This would check various metrics to determine if maintenance is needed:
    // - Number of documents without embeddings
    // - Index fragmentation
    // - Query performance degradation
    // - Time since last maintenance
    
    // Simplified check for demo
    const stats = await this.documentRepository.getDocumentStats(options.merchantId);
    const documentsWithoutEmbeddings = stats.totalDocuments * 0.1; // Assume 10% need updates
    
    const updatePercentage = (documentsWithoutEmbeddings / stats.totalDocuments) * 100;
    
    return updatePercentage >= options.rebuildThreshold;
  }

  /**
   * Group updates by merchant ID
   */
  private groupUpdatesByMerchant(updates: BatchEmbeddingUpdate[]): Map<string, BatchEmbeddingUpdate[]> {
    const grouped = new Map<string, BatchEmbeddingUpdate[]>();
    
    for (const update of updates) {
      const existing = grouped.get(update.merchantId) || [];
      existing.push(update);
      grouped.set(update.merchantId, existing);
    }
    
    return grouped;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(type: string, merchantId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${merchantId}_${timestamp}_${random}`;
  }

  /**
   * Generate payload hash for audit logging
   */
  private generatePayloadHash(payload: any): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Get document type distribution
   */
  private getDocumentTypeDistribution(documents: Document[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const doc of documents) {
      distribution[doc.documentType] = (distribution[doc.documentType] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Health check for batch processing service
   */
  async healthCheck(): Promise<{
    service: boolean;
    activeOperations: number;
    queueLength: number;
    lastProcessedOperation?: string;
  }> {
    return {
      service: true,
      activeOperations: this.activeOperations.size,
      queueLength: this.processingQueue.length,
      lastProcessedOperation: Array.from(this.activeOperations.keys())[0],
    };
  }
}

// Export singleton instance
let batchProcessingServiceInstance: BatchProcessingService | null = null;

export const getBatchProcessingService = (): BatchProcessingService => {
  if (!batchProcessingServiceInstance) {
    batchProcessingServiceInstance = new BatchProcessingService();
  }
  return batchProcessingServiceInstance;
};