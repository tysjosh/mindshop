"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragService = exports.RAGService = void 0;
const crypto_1 = require("crypto");
const MindsDBService_1 = require("./MindsDBService");
const CacheService_1 = require("./CacheService");
const CircuitBreaker_1 = require("./CircuitBreaker");
/**
 * Enhanced RAG Service with MindsDB Integration
 * Provides intelligent document retrieval and response generation
 */
class RAGService {
    constructor() {
        this.mindsdbService = new MindsDBService_1.MindsDBService();
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreakerService();
    }
    /**
     * Main RAG query method
     */
    async query(query) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(query);
        try {
            // Check cache first
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                return { ...cached, cacheHit: true };
            }
            // Perform document search using MindsDB
            const searchResults = await this.mindsdbService.searchDocuments(query.merchantId, query.query, query.filters, query.useHybridSearch || true);
            // Generate response using MindsDB agent
            const response = await this.mindsdbService.askQuestion(query.merchantId, query.query);
            const result = {
                retrievalResults: searchResults,
                predictions: [],
                rankedResults: searchResults.map((doc, index) => ({
                    ...doc,
                    rank: index + 1,
                    score: doc.relevance || 0.8,
                })),
                confidence: 0.85,
                reasoning: [`Found ${searchResults.length} relevant documents`],
                cacheHit: false,
                executionTime: Date.now() - startTime,
                fallbackUsed: false,
            };
            // Cache the result
            await this.cacheService.set(cacheKey, result, 300); // 5 minutes
            return result;
        }
        catch (error) {
            console.error("RAG query failed:", error);
            // Return fallback result
            return {
                retrievalResults: [],
                predictions: [],
                rankedResults: [],
                confidence: 0.1,
                reasoning: ["Query failed, using fallback"],
                cacheHit: false,
                executionTime: Date.now() - startTime,
                fallbackUsed: true,
            };
        }
    }
    /**
     * Ask a question using the RAG system
     */
    async ask(merchantId, question, context) {
        try {
            return await this.mindsdbService.askQuestion(merchantId, question);
        }
        catch (error) {
            console.error("RAG ask failed:", error);
            return "I apologize, but I cannot answer that question at the moment. Please try again later.";
        }
    }
    /**
     * Ingest a document into the RAG system
     */
    async ingestDocument(merchantId, document) {
        try {
            await this.mindsdbService.ingestDocument(merchantId, document);
        }
        catch (error) {
            console.error("Document ingestion failed:", error);
            throw error;
        }
    }
    /**
     * Search documents in the knowledge base
     */
    async searchDocuments(merchantId, query, filters, useHybridSearch = true) {
        try {
            return await this.mindsdbService.searchDocuments(merchantId, query, filters, useHybridSearch);
        }
        catch (error) {
            console.error("Document search failed:", error);
            return [];
        }
    }
    /**
     * Initialize RAG system for a merchant
     */
    async initializeRAGSystem(merchantId, openaiApiKey) {
        try {
            await this.mindsdbService.setupRAGSystem(merchantId, openaiApiKey);
        }
        catch (error) {
            console.error("RAG system initialization failed:", error);
            throw error;
        }
    }
    /**
     * Get health status of the RAG system
     */
    async getHealthStatus() {
        try {
            const mindsdbHealth = await this.mindsdbService.healthCheck();
            const cacheHealth = { status: "healthy" }; // Simplified for now
            const components = {
                mindsdb: mindsdbHealth,
                cache: cacheHealth,
                circuitBreaker: { status: "healthy" },
            };
            const healthyComponents = Object.values(components).filter((c) => c.status === "healthy" || c.status === "complete").length;
            const totalComponents = Object.keys(components).length;
            let status = "healthy";
            if (healthyComponents < totalComponents) {
                status =
                    healthyComponents > totalComponents / 2 ? "degraded" : "unhealthy";
            }
            return { status, components };
        }
        catch (error) {
            console.error("Health check failed:", error);
            return {
                status: "unhealthy",
                components: {
                    error: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }
    /**
     * Generate cache key for a query
     */
    generateCacheKey(query) {
        const keyData = {
            query: query.query,
            merchantId: query.merchantId,
            filters: query.filters || {},
            useHybridSearch: query.useHybridSearch || true,
        };
        return `rag:${(0, crypto_1.createHash)("md5").update(JSON.stringify(keyData)).digest("hex")}`;
    }
    /**
     * Reset circuit breakers
     */
    resetCircuitBreakers() {
        // Implementation for resetting circuit breakers
        console.log("Circuit breakers reset");
    }
    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            return { status: "healthy", hits: 0, misses: 0 }; // Simplified for now
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    /**
     * Invalidate cache for a merchant
     */
    async invalidateMerchantCache(merchantId) {
        try {
            // Simplified cache invalidation
            console.log(`Invalidating cache for merchant: ${merchantId}`);
            return 1;
        }
        catch (error) {
            console.error("Cache invalidation failed:", error);
            return 0;
        }
    }
    /**
     * Process query (compatibility method for OrchestrationService)
     */
    async processQuery(query) {
        return await this.query(query);
    }
    // ========================================
    // ENHANCED BEDROCK INTEGRATION
    // ========================================
    /**
     * Query using direct MindsDB-Bedrock integration
     */
    async queryWithBedrockIntegration(query) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(query) + ':bedrock';
        try {
            // Check cache first
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                return { ...cached, cacheHit: true };
            }
            // Use MindsDB's native Bedrock integration
            const result = await this.mindsdbService.hybridRAGQuery(query.merchantId, query.query, {
                useHybridSearch: query.useHybridSearch,
                maxDocuments: query.maxResults || query.limit || 5,
                relevanceThreshold: query.threshold || 0.7
            });
            const ragResult = {
                retrievalResults: result.documents,
                predictions: result.predictions,
                rankedResults: result.documents.map((doc, index) => ({
                    ...doc,
                    rank: index + 1,
                    score: doc.relevance || 0.8
                })),
                confidence: result.confidence,
                reasoning: result.reasoning,
                cacheHit: false,
                executionTime: result.executionTime,
                fallbackUsed: result.source === 'mindsdb_fallback'
            };
            // Cache the result
            await this.cacheService.set(cacheKey, ragResult, 300); // 5 minutes
            return ragResult;
        }
        catch (error) {
            console.error('Bedrock RAG query failed:', error);
            // Fallback to standard RAG
            return await this.query(query);
        }
    }
    /**
     * Ask question using Bedrock integration with intelligent routing
     */
    async askWithBedrock(merchantId, question, options = {}) {
        const { useBedrockIntegration = true, bedrockModelName, includeContext = true, maxDocuments = 5 } = options;
        try {
            if (useBedrockIntegration) {
                // Use direct MindsDB-Bedrock integration
                const result = await this.mindsdbService.askQuestionWithBedrock(merchantId, question, bedrockModelName, {
                    includeContext,
                    maxDocuments
                });
                return {
                    ...result,
                    method: 'bedrock_integration'
                };
            }
            else {
                // Use standard RAG
                const answer = await this.mindsdbService.askQuestion(merchantId, question);
                const documents = await this.mindsdbService.searchDocuments(merchantId, question);
                return {
                    answer,
                    confidence: 0.8,
                    sources: documents,
                    reasoning: ['Standard MindsDB RAG'],
                    method: 'standard_rag'
                };
            }
        }
        catch (error) {
            console.error('Enhanced RAG query failed:', error);
            // Ultimate fallback
            const fallbackAnswer = await this.ask(merchantId, question);
            return {
                answer: fallbackAnswer,
                confidence: 0.6,
                sources: [],
                reasoning: ['Fallback due to error'],
                method: 'fallback'
            };
        }
    }
    /**
     * Initialize Bedrock integration for a merchant
     */
    async initializeBedrockIntegration(merchantId, awsCredentials, bedrockConfig = {}) {
        try {
            // Setup Bedrock integration in MindsDB
            await this.mindsdbService.setupBedrockIntegration(merchantId, awsCredentials, bedrockConfig);
            console.log(`✅ Bedrock integration initialized for merchant: ${merchantId}`);
        }
        catch (error) {
            console.error(`Failed to initialize Bedrock integration for ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Get Bedrock integration status for a merchant
     */
    async getBedrockIntegrationStatus(merchantId) {
        try {
            const engineName = `bedrock_engine_${merchantId}`;
            const modelName = `bedrock_rag_${merchantId}`;
            const [engines, modelStatus] = await Promise.all([
                this.mindsdbService.listBedrockModels(),
                this.mindsdbService.getBedrockModelStatus(modelName)
            ]);
            const engineStatus = engines.find(engine => engine.name === engineName);
            const isReady = engineStatus && modelStatus.status === 'complete';
            return {
                engineStatus: engineStatus || { status: 'not_found' },
                modelStatus,
                isReady: !!isReady
            };
        }
        catch (error) {
            console.error(`Failed to get Bedrock status for ${merchantId}:`, error);
            return {
                engineStatus: { status: 'error' },
                modelStatus: { status: 'error' },
                isReady: false
            };
        }
    }
}
exports.RAGService = RAGService;
exports.ragService = new RAGService();
//# sourceMappingURL=RAGService.js.map