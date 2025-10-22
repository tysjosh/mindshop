"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligentQueryRouter = exports.IntelligentQueryRouter = void 0;
const MindsDBService_1 = require("./MindsDBService");
const RAGService_1 = require("./RAGService");
const PredictionService_1 = require("./PredictionService");
const CacheService_1 = require("./CacheService");
/**
 * Intelligent Query Router
 * Automatically routes queries to the optimal AI system based on complexity, cost, and performance
 */
class IntelligentQueryRouter {
    constructor() {
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.mindsdbService = new MindsDBService_1.MindsDBService();
        this.ragService = new RAGService_1.RAGService();
        this.predictionService = new PredictionService_1.PredictionService(this.mindsdbService);
    }
    /**
     * Intelligently route query to optimal AI system
     */
    async routeQuery(options) {
        const startTime = Date.now();
        const { merchantId, query, userContext, forceMethod, costBudget = 0.05, latencyBudget = 3000 } = options;
        try {
            // Step 1: Make routing decision
            const routingDecision = await this.makeRoutingDecision(merchantId, query, userContext, { costBudget, latencyBudget });
            // Step 2: Override with forced method if specified
            let useBedrockIntegration = routingDecision.useBedrockIntegration;
            if (forceMethod) {
                useBedrockIntegration = forceMethod === 'bedrock' || forceMethod === 'hybrid';
                routingDecision.reasoning.push(`Forced method: ${forceMethod}`);
            }
            // Step 3: Execute query using selected method
            let result;
            if (useBedrockIntegration) {
                // Use direct MindsDB-Bedrock integration
                result = await this.executeBedrockIntegratedQuery(merchantId, query, userContext);
            }
            else {
                // Use standard MindsDB RAG
                result = await this.executeMindsDBQuery(merchantId, query, userContext);
            }
            // Step 4: Enhance result with routing information
            result.routingDecision = routingDecision;
            result.executionTime = Date.now() - startTime;
            result.estimatedCost = this.calculateActualCost(result.method, result.executionTime);
            return result;
        }
        catch (error) {
            console.error('Intelligent query routing failed:', error);
            // Ultimate fallback
            const fallbackAnswer = await this.ragService.ask(merchantId, query);
            return {
                answer: fallbackAnswer,
                confidence: 0.5,
                sources: [],
                reasoning: ['Emergency fallback due to routing error'],
                method: 'hybrid_fallback',
                executionTime: Date.now() - startTime,
                estimatedCost: 0.001,
                routingDecision: {
                    useBedrockIntegration: false,
                    reasoning: ['Error fallback'],
                    confidence: 0.1,
                    estimatedCost: 0.001,
                    estimatedLatency: 1000
                }
            };
        }
    }
    /**
     * Make intelligent routing decision based on query analysis
     */
    async makeRoutingDecision(merchantId, query, userContext, constraints = { costBudget: 0.05, latencyBudget: 3000 }) {
        try {
            // Use ML predictions to analyze query
            const queryAnalysis = await this.predictionService.predictQueryAnalysis(merchantId, query, userContext);
            const reasoning = [];
            let useBedrockIntegration = false;
            let estimatedCost = 0.002; // Base MindsDB cost
            let estimatedLatency = queryAnalysis.estimatedResponseTime;
            // Decision factors
            const isComplexQuery = queryAnalysis.complexity === 'high';
            const isCreativeIntent = ['creative', 'generation', 'writing'].includes(queryAnalysis.intent);
            const requiresReasoning = query.toLowerCase().includes('why') ||
                query.toLowerCase().includes('explain') ||
                query.toLowerCase().includes('analyze');
            const isLongQuery = query.length > 100;
            // Routing logic
            if (isComplexQuery) {
                useBedrockIntegration = true;
                estimatedCost = 0.015;
                estimatedLatency = 4000;
                reasoning.push('Complex query detected - using Bedrock for advanced reasoning');
            }
            if (isCreativeIntent) {
                useBedrockIntegration = true;
                estimatedCost = 0.020;
                estimatedLatency = 5000;
                reasoning.push('Creative intent detected - using Bedrock for content generation');
            }
            if (requiresReasoning) {
                useBedrockIntegration = true;
                estimatedCost = 0.012;
                estimatedLatency = 3500;
                reasoning.push('Reasoning required - using Bedrock for explanation');
            }
            if (isLongQuery) {
                useBedrockIntegration = true;
                estimatedCost = 0.018;
                estimatedLatency = 4500;
                reasoning.push('Long query detected - using Bedrock for comprehensive processing');
            }
            // Budget constraints
            if (estimatedCost > constraints.costBudget) {
                useBedrockIntegration = false;
                estimatedCost = 0.002;
                estimatedLatency = 2000;
                reasoning.push(`Cost budget exceeded (${estimatedCost} > ${constraints.costBudget}) - using MindsDB`);
            }
            if (estimatedLatency > constraints.latencyBudget) {
                useBedrockIntegration = false;
                estimatedCost = 0.002;
                estimatedLatency = 2000;
                reasoning.push(`Latency budget exceeded (${estimatedLatency} > ${constraints.latencyBudget}) - using MindsDB`);
            }
            // Default to MindsDB for simple queries
            if (!useBedrockIntegration && reasoning.length === 0) {
                reasoning.push('Simple query - using efficient MindsDB RAG');
            }
            return {
                useBedrockIntegration,
                reasoning,
                confidence: queryAnalysis.confidence,
                estimatedCost,
                estimatedLatency
            };
        }
        catch (error) {
            console.warn('Query analysis failed, using default routing:', error);
            // Fallback routing decision
            return {
                useBedrockIntegration: false,
                reasoning: ['Query analysis failed - defaulting to MindsDB'],
                confidence: 0.5,
                estimatedCost: 0.002,
                estimatedLatency: 2000
            };
        }
    }
    /**
     * Execute query using Bedrock integration
     */
    async executeBedrockIntegratedQuery(merchantId, query, userContext) {
        const result = await this.ragService.askWithBedrock(merchantId, query, {
            useBedrockIntegration: true,
            includeContext: true,
            maxDocuments: 5
        });
        return {
            answer: result.answer,
            confidence: result.confidence,
            sources: result.sources,
            reasoning: result.reasoning,
            method: 'bedrock_integration',
            executionTime: 0, // Will be set by caller
            estimatedCost: 0, // Will be calculated by caller
            routingDecision: {
                useBedrockIntegration: true,
                reasoning: [],
                confidence: 0,
                estimatedCost: 0,
                estimatedLatency: 0
            }
        };
    }
    /**
     * Execute query using standard MindsDB
     */
    async executeMindsDBQuery(merchantId, query, userContext) {
        const answer = await this.ragService.ask(merchantId, query);
        const sources = await this.ragService.searchDocuments(merchantId, query);
        return {
            answer,
            confidence: 0.8,
            sources,
            reasoning: ['Standard MindsDB RAG processing'],
            method: 'mindsdb_only',
            executionTime: 0, // Will be set by caller
            estimatedCost: 0, // Will be calculated by caller
            routingDecision: {
                useBedrockIntegration: false,
                reasoning: [],
                confidence: 0,
                estimatedCost: 0,
                estimatedLatency: 0
            }
        };
    }
    /**
     * Calculate actual cost based on method and execution time
     */
    calculateActualCost(method, executionTime) {
        const baseCosts = {
            'mindsdb_only': 0.002,
            'bedrock_integration': 0.015,
            'hybrid_fallback': 0.001
        };
        const baseCost = baseCosts[method] || 0.002;
        // Add latency-based cost adjustment
        const latencyMultiplier = executionTime > 3000 ? 1.2 : 1.0;
        return baseCost * latencyMultiplier;
    }
    /**
     * Get routing statistics for a merchant
     */
    async getRoutingStats(merchantId) {
        try {
            // This would typically come from analytics/metrics service
            // For now, return mock data
            return {
                totalQueries: 100,
                bedrockQueries: 25,
                mindsdbQueries: 75,
                averageCost: 0.008,
                averageLatency: 2500,
                successRate: 0.98
            };
        }
        catch (error) {
            console.error('Failed to get routing stats:', error);
            return {
                totalQueries: 0,
                bedrockQueries: 0,
                mindsdbQueries: 0,
                averageCost: 0,
                averageLatency: 0,
                successRate: 0
            };
        }
    }
    /**
     * Health check for intelligent routing system
     */
    async healthCheck() {
        try {
            const [mindsdbHealth, ragHealth] = await Promise.all([
                this.mindsdbService.healthCheck(),
                this.ragService.getHealthStatus()
            ]);
            // Test prediction service
            let predictionServiceAvailable = false;
            try {
                await this.predictionService.predictQueryAnalysis('test', 'test query');
                predictionServiceAvailable = true;
            }
            catch (error) {
                console.warn('Prediction service not available');
            }
            // Test Bedrock integration
            let bedrockIntegrationAvailable = false;
            try {
                await this.mindsdbService.listBedrockModels();
                bedrockIntegrationAvailable = true;
            }
            catch (error) {
                console.warn('Bedrock integration not available');
            }
            const components = {
                mindsdb: mindsdbHealth,
                rag: ragHealth,
                predictions: { status: predictionServiceAvailable ? 'healthy' : 'unavailable' },
                bedrock: { status: bedrockIntegrationAvailable ? 'healthy' : 'unavailable' }
            };
            const healthyComponents = Object.values(components).filter(c => c.status === 'healthy' || c.status === 'complete').length;
            const totalComponents = Object.keys(components).length;
            let status = 'healthy';
            if (healthyComponents < totalComponents) {
                status = healthyComponents > totalComponents / 2 ? 'degraded' : 'unhealthy';
            }
            return {
                status,
                components,
                routing: {
                    available: status !== 'unhealthy',
                    bedrockIntegration: bedrockIntegrationAvailable,
                    predictionService: predictionServiceAvailable
                }
            };
        }
        catch (error) {
            console.error('Intelligent router health check failed:', error);
            return {
                status: 'unhealthy',
                components: { error: error instanceof Error ? error.message : 'Unknown error' },
                routing: {
                    available: false,
                    bedrockIntegration: false,
                    predictionService: false
                }
            };
        }
    }
}
exports.IntelligentQueryRouter = IntelligentQueryRouter;
exports.intelligentQueryRouter = new IntelligentQueryRouter();
//# sourceMappingURL=IntelligentQueryRouter.js.map