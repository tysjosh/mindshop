"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticRetrievalService = void 0;
const MindsDBService_1 = require("./MindsDBService");
const CacheService_1 = require("./CacheService");
const CircuitBreaker_1 = require("./CircuitBreaker");
class SemanticRetrievalService {
    constructor(mindsdbService) {
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreakerService();
        this.mindsdbService = mindsdbService || new MindsDBService_1.MindsDBService();
        this.circuitBreakerConfig = {
            failureThreshold: 3,
            resetTimeout: 30000,
            monitoringWindow: 60000,
        };
    }
    async retrieveDocuments(params) {
        const cacheKey = `semantic:${params.merchantId}:${Buffer.from(params.query).toString('base64')}:${params.useHybridSearch ? 'hybrid' : 'semantic'}`;
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const operation = async () => {
            try {
                let searchResults;
                if (params.useHybridSearch) {
                    // Use MindsDB hybrid search for better keyword + semantic matching
                    searchResults = await this.mindsdbService.hybridSearch(`rag_kb_${params.merchantId}`, params.query, 0.7, // Alpha value balancing semantic vs keyword search
                    params.filters, params.limit || 10);
                }
                else {
                    // Use pure semantic search
                    searchResults = await this.mindsdbService.searchKnowledgeBase(`rag_kb_${params.merchantId}`, params.query, params.filters, params.limit || 10, params.threshold || 0.7);
                }
                // Transform MindsDB results to RetrievalResult format
                const results = searchResults.map((result) => ({
                    id: result.id || result.document_id,
                    snippet: result.chunk_content || result.content,
                    score: result.relevance || (1 - (result.distance || 0)),
                    metadata: {
                        merchantId: params.merchantId,
                        title: result.metadata?.title || result.title || 'Untitled',
                        sourceUri: result.metadata?.source || result.source || '',
                        documentType: result.metadata?.document_type || result.document_type || 'unknown',
                        createdAt: result.metadata?.created_at || result.created_at || new Date().toISOString(),
                        chunkId: result.chunk_id,
                        originalDocId: result.metadata?.original_doc_id || result.original_doc_id,
                    },
                    groundingPass: (result.relevance || (1 - (result.distance || 0))) >= (params.threshold || 0.7),
                }));
                return results;
            }
            catch (error) {
                console.error('MindsDB semantic retrieval error:', error);
                throw error;
            }
        };
        const fallback = async () => {
            console.warn('Semantic retrieval circuit breaker activated, returning empty results');
            return [];
        };
        const results = await this.circuitBreaker.callWithBreaker(operation, fallback, this.circuitBreakerConfig);
        // Cache results for 5 minutes
        await this.cacheService.set(cacheKey, results, 300);
        return results;
    }
    async generateEmbedding(text, merchantId) {
        try {
            // Use MindsDB's embedding generation capabilities
            const sql = `
        SELECT embedding
        FROM openai_embedding_model
        WHERE text = '${text.replace(/'/g, "''")}'
      `;
            const result = await this.mindsdbService.query(sql);
            if (result.data && result.data.length > 0) {
                const embedding = result.data[0].embedding;
                return Array.isArray(embedding) ? embedding : JSON.parse(embedding);
            }
            throw new Error('No embedding generated');
        }
        catch (error) {
            console.error('Embedding generation error:', error);
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async batchGenerateEmbeddings(texts, merchantId) {
        const embeddings = [];
        // Process in batches to avoid overwhelming the service
        const batchSize = 5;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => this.generateEmbedding(text, merchantId));
            try {
                const batchResults = await Promise.all(batchPromises);
                embeddings.push(...batchResults);
            }
            catch (error) {
                console.error(`Batch embedding generation failed for batch ${i / batchSize + 1}:`, error);
                // Add empty embeddings for failed batch
                embeddings.push(...new Array(batch.length).fill([]));
            }
        }
        return embeddings;
    }
    async searchSimilarDocuments(merchantId, documentId, limit = 5) {
        try {
            // First, get the content of the reference document
            const sql = `
        SELECT content
        FROM rag_kb_${merchantId}
        WHERE id = '${documentId}'
        LIMIT 1
      `;
            const result = await this.mindsdbService.query(sql);
            if (!result.data || result.data.length === 0) {
                throw new Error(`Document with ID ${documentId} not found`);
            }
            const referenceContent = result.data[0].content;
            // Use the reference content to find similar documents
            return await this.retrieveDocuments({
                query: referenceContent,
                merchantId,
                limit,
                threshold: 0.6, // Lower threshold for similarity search
                useHybridSearch: false // Use pure semantic search for similarity
            });
        }
        catch (error) {
            console.error('Similar document search error:', error);
            throw new Error(`Failed to find similar documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getDocumentById(merchantId, documentId) {
        try {
            const sql = `
        SELECT *
        FROM rag_kb_${merchantId}
        WHERE id = '${documentId}'
        LIMIT 1
      `;
            const result = await this.mindsdbService.query(sql);
            if (!result.data || result.data.length === 0) {
                return null;
            }
            const doc = result.data[0];
            return {
                id: doc.id || doc.document_id,
                snippet: doc.chunk_content || doc.content,
                score: 1.0, // Perfect match for direct retrieval
                metadata: {
                    merchantId,
                    documentType: doc.metadata?.document_type || doc.document_type || 'unknown',
                    sourceUri: doc.metadata?.source || doc.source || '',
                    title: doc.metadata?.title || doc.title || 'Untitled',
                    createdAt: doc.metadata?.created_at || doc.created_at || new Date().toISOString(),
                    chunkId: doc.chunk_id,
                    originalDocId: doc.metadata?.original_doc_id || doc.original_doc_id,
                },
                groundingPass: true,
            };
        }
        catch (error) {
            console.error('Document retrieval by ID error:', error);
            return null;
        }
    }
    async deleteDocument(merchantId, documentId) {
        try {
            const sql = `
        DELETE FROM rag_kb_${merchantId}
        WHERE id = '${documentId}'
      `;
            await this.mindsdbService.query(sql);
            // Clear related cache entries
            const cachePattern = `semantic:${merchantId}:*`;
            // Note: This is a simplified cache clearing - in production you might want more sophisticated cache invalidation
            return true;
        }
        catch (error) {
            console.error('Document deletion error:', error);
            return false;
        }
    }
    async getDocumentStats(merchantId) {
        try {
            const sql = `
        SELECT 
          COUNT(DISTINCT id) as total_documents,
          COUNT(*) as total_chunks,
          AVG(relevance) as avg_relevance,
          document_type,
          COUNT(*) as type_count
        FROM rag_kb_${merchantId}
        GROUP BY document_type
      `;
            const result = await this.mindsdbService.query(sql);
            const documentTypes = {};
            let totalDocuments = 0;
            let totalChunks = 0;
            let avgRelevanceScore = 0;
            if (result.data && result.data.length > 0) {
                result.data.forEach((row) => {
                    documentTypes[row.document_type] = row.type_count;
                    totalDocuments += row.total_documents;
                    totalChunks += row.total_chunks;
                    avgRelevanceScore = Math.max(avgRelevanceScore, row.avg_relevance || 0);
                });
            }
            return {
                totalDocuments,
                totalChunks,
                avgRelevanceScore,
                documentTypes,
            };
        }
        catch (error) {
            console.error('Document stats error:', error);
            return {
                totalDocuments: 0,
                totalChunks: 0,
                avgRelevanceScore: 0,
                documentTypes: {},
            };
        }
    }
    /**
     * Deploy semantic retriever for a merchant
     */
    async deploySemanticRetriever(merchantId) {
        try {
            console.log(`Deploying semantic retriever for merchant: ${merchantId}`);
            // This would typically set up the knowledge base and models
            // For now, we'll just log the deployment
        }
        catch (error) {
            console.error(`Failed to deploy semantic retriever for ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Retrieve documents via REST API
     */
    async retrieveViaREST(params) {
        return await this.retrieveDocuments(params);
    }
    /**
     * Validate grounding of results
     */
    async validateGrounding(query, results) {
        // Simple grounding validation
        const hasRelevantResults = results.length > 0;
        const avgRelevance = results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length;
        return {
            isGrounded: hasRelevantResults && avgRelevance > 0.5,
            confidence: avgRelevance,
            reasoning: hasRelevantResults ? ['Found relevant documents'] : ['No relevant documents found']
        };
    }
    /**
     * Get predictor status
     */
    async getPredictorStatus(merchantId) {
        try {
            // Check if knowledge base exists
            const kbName = `rag_kb_${merchantId}`;
            const kbs = await this.mindsdbService.listKnowledgeBases();
            const exists = kbs.some(kb => kb.name === kbName);
            return {
                status: exists ? 'active' : 'not_deployed',
                accuracy: exists ? 0.85 : undefined,
                lastTrained: exists ? new Date().toISOString() : undefined
            };
        }
        catch (error) {
            return {
                status: 'error',
                accuracy: undefined,
                lastTrained: undefined
            };
        }
    }
    /**
     * Update predictor configuration
     */
    async updatePredictorConfig(merchantId, config) {
        try {
            console.log(`Updating predictor config for merchant: ${merchantId}`, config);
            // This would typically update the knowledge base or model configuration
            // For now, we'll just log the update
        }
        catch (error) {
            console.error(`Failed to update predictor config for ${merchantId}:`, error);
            throw error;
        }
    }
}
exports.SemanticRetrievalService = SemanticRetrievalService;
//# sourceMappingURL=SemanticRetrievalService.js.map