"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmbeddingService = exports.EmbeddingService = void 0;
const MindsDBService_1 = require("./MindsDBService");
const PIIRedactor_1 = require("./PIIRedactor");
const DocumentRepository_1 = require("../repositories/DocumentRepository");
const CacheService_1 = require("./CacheService");
const crypto_1 = require("crypto");
const config_1 = require("../config");
/**
 * EmbeddingService class using MindsDB embedding models for text-to-vector conversion
 * with PII protection and batch processing capabilities
 */
class EmbeddingService {
    constructor(mindsdbService, documentRepository) {
        this.mindsdbService = mindsdbService || new MindsDBService_1.MindsDBService();
        this.piiRedactor = new PIIRedactor_1.PIIRedactorService();
        this.documentRepository = documentRepository || new DocumentRepository_1.DocumentRepository();
        this.cacheService = (0, CacheService_1.getCacheService)();
        // Configuration from environment or defaults
        this.defaultModel = config_1.config.mindsdb?.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2';
        this.defaultBatchSize = config_1.config.mindsdb?.batchSize || 10;
        this.maxConcurrency = config_1.config.mindsdb?.maxConcurrency || 5;
    }
    /**
     * Generate embedding for a single text with PII protection
     */
    async generateEmbedding(request) {
        const startTime = Date.now();
        this.validateEmbeddingRequest(request);
        const model = request.model || this.defaultModel;
        // Check cache first
        const cacheKey = this.generateCacheKey(request.text, request.merchantId, model);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                processingTime: Date.now() - startTime, // Update processing time for cache hits
            };
        }
        let sanitizedText = request.text;
        let tokenMap;
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
            const result = {
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
        }
        catch (error) {
            throw new Error(`Embedding generation failed: ${error.message}`);
        }
    }
    /**
     * Generate embeddings for multiple texts with batch processing
     */
    async generateBatchEmbeddings(request) {
        const startTime = Date.now();
        this.validateBatchEmbeddingRequest(request);
        const batchSize = request.batchSize || this.defaultBatchSize;
        const model = request.model || this.defaultModel;
        const results = [];
        const errors = [];
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
                }
                catch (error) {
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
    async updateDocumentEmbedding(request) {
        this.validateMerchantId(request.merchantId);
        this.validateUUID(request.documentId);
        // Get the document
        const document = await this.documentRepository.findById(request.documentId, request.merchantId, false // Skip cache to get fresh data
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
        await this.documentRepository.updateEmbedding(request.documentId, request.merchantId, embeddingResult.embedding);
    }
    /**
     * Batch update document embeddings with controlled concurrency
     */
    async batchUpdateDocumentEmbeddings(request) {
        const batchSize = request.batchSize || this.defaultBatchSize;
        const concurrency = Math.min(request.concurrency || this.maxConcurrency, this.maxConcurrency);
        let successCount = 0;
        let failureCount = 0;
        const errors = [];
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
                }
                catch (error) {
                    errors.push({
                        documentId: updateRequest.documentId,
                        error: error.message,
                    });
                    failureCount++;
                }
                finally {
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
    async processDocumentsForMerchant(merchantId, options = {}) {
        this.validateMerchantId(merchantId);
        // Get all documents for the merchant
        const documents = await this.documentRepository.findByMerchant(merchantId, 1000, // Process up to 1000 documents at a time
        0);
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
        const updateRequests = documentsToUpdate.map(doc => ({
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
    async getEmbeddingStats(merchantId) {
        this.validateMerchantId(merchantId);
        const documents = await this.documentRepository.findByMerchant(merchantId, 10000);
        const totalDocuments = documents.length;
        const documentsWithEmbeddings = documents.filter(doc => doc.embedding && doc.embedding.length > 0).length;
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
    async healthCheck() {
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
        }
        catch (error) {
            console.error('MindsDB health check failed:', error);
        }
        try {
            // Test PII redactor
            const testRedaction = this.piiRedactor.redactQuery('test@example.com');
            health.piiRedactor = testRedaction.sanitizedText !== 'test@example.com';
        }
        catch (error) {
            console.error('PII redactor health check failed:', error);
        }
        try {
            // Test document repository
            const repoHealth = await this.documentRepository.healthCheck();
            health.documentRepository = repoHealth.database;
        }
        catch (error) {
            console.error('Document repository health check failed:', error);
        }
        try {
            // Test cache service
            health.cache = await this.cacheService.healthCheck();
        }
        catch (error) {
            console.error('Cache service health check failed:', error);
        }
        return health;
    }
    /**
     * Clear embedding cache for a merchant
     */
    async clearEmbeddingCache(merchantId) {
        this.validateMerchantId(merchantId);
        await this.cacheService.invalidateByPattern(`embedding:${merchantId}:*`);
    }
    /**
     * Get available embedding models
     */
    getAvailableModels() {
        return [
            'sentence-transformers/all-MiniLM-L6-v2',
            'sentence-transformers/all-mpnet-base-v2',
            'text-embedding-ada-002',
            'text-embedding-3-small',
            'text-embedding-3-large',
        ];
    }
    // Private helper methods
    validateEmbeddingRequest(request) {
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
    validateBatchEmbeddingRequest(request) {
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
    validateMerchantId(merchantId) {
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
    validateUUID(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw new Error('Invalid UUID format');
        }
    }
    generateCacheKey(text, merchantId, model) {
        const textHash = (0, crypto_1.createHash)('sha256')
            .update(text)
            .digest('hex')
            .substring(0, 16);
        return `embedding:${merchantId}:${model}:${textHash}`;
    }
}
exports.EmbeddingService = EmbeddingService;
// Export singleton instance
let embeddingServiceInstance = null;
const getEmbeddingService = () => {
    if (!embeddingServiceInstance) {
        embeddingServiceInstance = new EmbeddingService();
    }
    return embeddingServiceInstance;
};
exports.getEmbeddingService = getEmbeddingService;
//# sourceMappingURL=EmbeddingService.js.map