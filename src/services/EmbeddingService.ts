import { MindsDBService } from './MindsDBService';
import { PIIRedactorService } from './PIIRedactor';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { getCacheService, CacheService } from './CacheService';
import { Document } from '../models/Document';
import { createHash } from 'crypto';
import { config } from '../config';

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
  errors: Array<{ index: number; error: string }>;
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
export class EmbeddingService {
  private mindsdbService: MindsDBService;
  private piiRedactor: PIIRedactorService;
  private documentRepository: DocumentRepository;
  private cacheService: CacheService;
  private readonly defaultModel: string;
  private readonly defaultBatchSize: number;
  private readonly maxConcurrency: number;

  constructor(
    mindsdbService?: MindsDBService,
    documentRepository?: DocumentRepository
  ) {
    this.mindsdbService = mindsdbService || new MindsDBService();
    this.piiRedactor = new PIIRedactorService();
    this.documentRepository = documentRepository || new DocumentRepository();
    this.cacheService = getCacheService();
    
    // Configuration from environment or defaults
    this.defaultModel = config.mindsdb?.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2';
    this.defaultBatchSize = config.mindsdb?.batchSize || 10;
    this.maxConcurrency = config.mindsdb?.maxConcurrency || 5;
  }

  /**
   * Generate embedding for a single text with PII protection
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    this.validateEmbeddingRequest(request);
    
    const model = request.model || this.defaultModel;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request.text, request.merchantId, model);
    const cached = await this.cacheService.get<EmbeddingResult>(cacheKey);
    if (cached) {
      return {
        ...cached,
        processingTime: Date.now() - startTime, // Update processing time for cache hits
      };
    }

    let sanitizedText = request.text;
    let tokenMap: Map<string, string> | undefined;

    // Apply PII redaction unless explicitly skipped
    if (!request.skipPIIRedaction) {
      const redactionResult = this.piiRedactor.redactQuery(request.text);
      sanitizedText = redactionResult.sanitizedText;
      tokenMap = redactionResult.tokens;
    }

    try {
      // Generate embedding using MindsDB
      const embedding = await this.mindsdbService.generateEmbedding({
        text: sanitizedText,
        merchantId: request.merchantId
      });

      const result: EmbeddingResult = {
        embedding,
        originalText: request.text,
        sanitizedText,
        tokenMap,
        processingTime: Date.now() - startTime,
        model,
      };

      // Cache the result for 1 hour
      await this.cacheService.set(cacheKey, result, 3600);

      return result;
    } catch (error: any) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts with batch processing
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    
    this.validateBatchEmbeddingRequest(request);
    
    const batchSize = request.batchSize || this.defaultBatchSize;
    const model = request.model || this.defaultModel;
    
    const results: EmbeddingResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    // Process texts in batches to avoid overwhelming the service
    for (let i = 0; i < request.texts.length; i += batchSize) {
      const batch = request.texts.slice(i, i + batchSize);
      const batchDocumentIds = request.documentIds?.slice(i, i + batchSize);
      
      // Process batch with controlled concurrency
      const batchPromises = batch.map(async (text, batchIndex) => {
        const globalIndex = i + batchIndex;
        const documentId = batchDocumentIds?.[batchIndex];
        
        try {
          const embeddingResult = await this.generateEmbedding({
            text,
            merchantId: request.merchantId,
            documentId,
            model,
            skipPIIRedaction: request.skipPIIRedaction,
          });
          
          results[globalIndex] = embeddingResult;
          successCount++;
        } catch (error: any) {
          errors.push({
            index: globalIndex,
            error: error.message,
          });
          failureCount++;
        }
      });

      // Wait for current batch to complete before processing next batch
      await Promise.all(batchPromises);
    }

    return {
      results: results.filter(Boolean), // Remove undefined entries
      totalProcessingTime: Date.now() - startTime,
      successCount,
      failureCount,
      errors,
    };
  }

  /**
   * Update document embedding in the repository
   */
  async updateDocumentEmbedding(request: EmbeddingUpdateRequest): Promise<void> {
    this.validateMerchantId(request.merchantId);
    this.validateUUID(request.documentId);

    // Get the document
    const document = await this.documentRepository.findById(
      request.documentId,
      request.merchantId,
      false // Skip cache to get fresh data
    );

    if (!document) {
      throw new Error(`Document not found: ${request.documentId}`);
    }

    // Check if embedding already exists and force regeneration is not requested
    if (document.embedding && document.embedding.length > 0 && !request.forceRegenerate) {
      return; // Embedding already exists, skip update
    }

    // Combine title and body for embedding generation
    const textToEmbed = `${document.title}\n\n${document.body}`;
    
    // Generate new embedding
    const embeddingResult = await this.generateEmbedding({
      text: textToEmbed,
      merchantId: request.merchantId,
      documentId: request.documentId,
      model: request.model,
    });

    // Update the document with new embedding
    await this.documentRepository.updateEmbedding(
      request.documentId,
      request.merchantId,
      embeddingResult.embedding
    );
  }

  /**
   * Batch update document embeddings with controlled concurrency
   */
  async batchUpdateDocumentEmbeddings(request: BatchEmbeddingUpdateRequest): Promise<{
    successCount: number;
    failureCount: number;
    errors: Array<{ documentId: string; error: string }>;
  }> {
    const batchSize = request.batchSize || this.defaultBatchSize;
    const concurrency = Math.min(request.concurrency || this.maxConcurrency, this.maxConcurrency);
    
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    // Process updates in batches with controlled concurrency
    for (let i = 0; i < request.updates.length; i += batchSize) {
      const batch = request.updates.slice(i, i + batchSize);
      
      // Create semaphore for concurrency control
      const semaphore = new Array(concurrency).fill(null);
      let semaphoreIndex = 0;

      const batchPromises = batch.map(async (updateRequest) => {
        // Wait for available slot in semaphore
        await semaphore[semaphoreIndex % concurrency];
        const currentSlot = semaphoreIndex % concurrency;
        semaphoreIndex++;

        try {
          await this.updateDocumentEmbedding(updateRequest);
          successCount++;
        } catch (error: any) {
          errors.push({
            documentId: updateRequest.documentId,
            error: error.message,
          });
          failureCount++;
        } finally {
          // Release semaphore slot
          semaphore[currentSlot] = Promise.resolve();
        }
      });

      // Wait for current batch to complete
      await Promise.all(batchPromises);
    }

    return {
      successCount,
      failureCount,
      errors,
    };
  }

  /**
   * Process documents for a merchant and update their embeddings
   */
  async processDocumentsForMerchant(
    merchantId: string,
    options: {
      forceRegenerate?: boolean;
      model?: string;
      batchSize?: number;
      concurrency?: number;
      documentType?: 'product' | 'faq' | 'policy' | 'review';
    } = {}
  ): Promise<{
    processedCount: number;
    successCount: number;
    failureCount: number;
    errors: Array<{ documentId: string; error: string }>;
  }> {
    this.validateMerchantId(merchantId);

    // Get all documents for the merchant
    const documents = await this.documentRepository.findByMerchant(
      merchantId,
      1000, // Process up to 1000 documents at a time
      0
    );

    // Filter by document type if specified
    const filteredDocuments = options.documentType
      ? documents.filter(doc => doc.documentType === options.documentType)
      : documents;

    // Filter documents that need embedding updates
    const documentsToUpdate = options.forceRegenerate
      ? filteredDocuments
      : filteredDocuments.filter(doc => !doc.embedding || doc.embedding.length === 0);

    if (documentsToUpdate.length === 0) {
      return {
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
      };
    }

    // Create batch update requests
    const updateRequests: EmbeddingUpdateRequest[] = documentsToUpdate.map(doc => ({
      documentId: doc.id,
      merchantId: doc.merchantId,
      forceRegenerate: options.forceRegenerate,
      model: options.model,
    }));

    // Execute batch updates
    const result = await this.batchUpdateDocumentEmbeddings({
      updates: updateRequests,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
    });

    return {
      processedCount: documentsToUpdate.length,
      ...result,
    };
  }

  /**
   * Get embedding statistics for a merchant
   */
  async getEmbeddingStats(merchantId: string): Promise<{
    totalDocuments: number;
    documentsWithEmbeddings: number;
    documentsWithoutEmbeddings: number;
    embeddingCoverage: number;
    averageEmbeddingDimensions: number;
  }> {
    this.validateMerchantId(merchantId);

    const documents = await this.documentRepository.findByMerchant(merchantId, 10000);
    
    const totalDocuments = documents.length;
    const documentsWithEmbeddings = documents.filter(
      doc => doc.embedding && doc.embedding.length > 0
    ).length;
    const documentsWithoutEmbeddings = totalDocuments - documentsWithEmbeddings;
    const embeddingCoverage = totalDocuments > 0 ? (documentsWithEmbeddings / totalDocuments) * 100 : 0;
    
    // Calculate average embedding dimensions
    const embeddingsWithDimensions = documents
      .filter(doc => doc.embedding && doc.embedding.length > 0)
      .map(doc => doc.embedding.length);
    
    const averageEmbeddingDimensions = embeddingsWithDimensions.length > 0
      ? embeddingsWithDimensions.reduce((sum, dim) => sum + dim, 0) / embeddingsWithDimensions.length
      : 0;

    return {
      totalDocuments,
      documentsWithEmbeddings,
      documentsWithoutEmbeddings,
      embeddingCoverage,
      averageEmbeddingDimensions,
    };
  }

  /**
   * Health check for the embedding service
   */
  async healthCheck(): Promise<{
    mindsdb: boolean;
    piiRedactor: boolean;
    documentRepository: boolean;
    cache: boolean;
  }> {
    const health = {
      mindsdb: false,
      piiRedactor: false,
      documentRepository: false,
      cache: false,
    };

    try {
      // Test MindsDB connection
      const mindsdbHealth = await this.mindsdbService.healthCheck();
      health.mindsdb = mindsdbHealth.status === 'healthy';
    } catch (error) {
      console.error('MindsDB health check failed:', error);
    }

    try {
      // Test PII redactor
      const testRedaction = this.piiRedactor.redactQuery('test@example.com');
      health.piiRedactor = testRedaction.sanitizedText !== 'test@example.com';
    } catch (error) {
      console.error('PII redactor health check failed:', error);
    }

    try {
      // Test document repository
      const repoHealth = await this.documentRepository.healthCheck();
      health.documentRepository = repoHealth.database;
    } catch (error) {
      console.error('Document repository health check failed:', error);
    }

    try {
      // Test cache service
      health.cache = await this.cacheService.healthCheck();
    } catch (error) {
      console.error('Cache service health check failed:', error);
    }

    return health;
  }

  /**
   * Clear embedding cache for a merchant
   */
  async clearEmbeddingCache(merchantId: string): Promise<void> {
    this.validateMerchantId(merchantId);
    await this.cacheService.invalidateByPattern(`embedding:${merchantId}:*`);
  }

  /**
   * Get available embedding models
   */
  getAvailableModels(): string[] {
    return [
      'sentence-transformers/all-MiniLM-L6-v2',
      'sentence-transformers/all-mpnet-base-v2',
      'text-embedding-ada-002',
      'text-embedding-3-small',
      'text-embedding-3-large',
    ];
  }

  // Private helper methods

  private validateEmbeddingRequest(request: EmbeddingRequest): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }
    
    if (request.text.length > 8192) {
      throw new Error('Text length exceeds maximum limit of 8192 characters');
    }
    
    this.validateMerchantId(request.merchantId);
    
    if (request.documentId) {
      this.validateUUID(request.documentId);
    }
  }

  private validateBatchEmbeddingRequest(request: BatchEmbeddingRequest): void {
    if (!request.texts || request.texts.length === 0) {
      throw new Error('At least one text is required for batch embedding generation');
    }
    
    if (request.texts.length > 1000) {
      throw new Error('Batch size exceeds maximum limit of 1000 texts');
    }
    
    this.validateMerchantId(request.merchantId);
    
    // Validate each text
    request.texts.forEach((text, index) => {
      if (!text || text.trim().length === 0) {
        throw new Error(`Text at index ${index} is empty`);
      }
      if (text.length > 8192) {
        throw new Error(`Text at index ${index} exceeds maximum length of 8192 characters`);
      }
    });
    
    // Validate document IDs if provided
    if (request.documentIds) {
      if (request.documentIds.length !== request.texts.length) {
        throw new Error('Number of document IDs must match number of texts');
      }
      request.documentIds.forEach((id, index) => {
        if (id) {
          this.validateUUID(id);
        }
      });
    }
  }

  private validateMerchantId(merchantId: string): void {
    if (!merchantId || typeof merchantId !== 'string') {
      throw new Error('Valid merchantId is required for tenant isolation');
    }
    if (merchantId.length < 3 || merchantId.length > 100) {
      throw new Error('merchantId must be between 3 and 100 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(merchantId)) {
      throw new Error('merchantId contains invalid characters');
    }
  }

  private validateUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new Error('Invalid UUID format');
    }
  }

  private generateCacheKey(text: string, merchantId: string, model: string): string {
    const textHash = createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16);
    
    return `embedding:${merchantId}:${model}:${textHash}`;
  }
}

// Export singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export const getEmbeddingService = (): EmbeddingService => {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
};