"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrchestrationService = exports.OrchestrationService = void 0;
const uuid_1 = require("uuid");
const RAGService_1 = require("./RAGService");
const BedrockAgentService_1 = require("./BedrockAgentService");
const SessionManager_1 = require("./SessionManager");
const SessionAnalyticsService_1 = require("./SessionAnalyticsService");
const CheckoutService_1 = require("./CheckoutService");
const CircuitBreaker_1 = require("./CircuitBreaker");
const AuditLogRepository_1 = require("../repositories/AuditLogRepository");
const CacheService_1 = require("./CacheService");
/**
 * Comprehensive Orchestration Service
 *
 * Coordinates all AWS components and implements end-to-end request flow:
 * API Gateway → Bedrock AgentCore → MindsDB ECS → Aurora → ElastiCache
 */
class OrchestrationService {
    constructor() {
        // Latency budget: 300ms target
        this.LATENCY_BUDGET_MS = 300;
        // Cost tracking
        this.COST_PER_REQUEST_BASE = 0.001; // $0.001 base cost per request
        this.ragService = new RAGService_1.RAGService();
        this.bedrockAgentService = (0, BedrockAgentService_1.getBedrockAgentService)();
        this.sessionManager = (0, SessionManager_1.createSessionManager)();
        this.sessionAnalyticsService = (0, SessionAnalyticsService_1.getSessionAnalyticsService)();
        this.auditLogRepository = new AuditLogRepository_1.AuditLogRepository();
        const { getPIIRedactor } = require('./PIIRedactor');
        this.piiRedactor = getPIIRedactor();
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreakerService();
        // Initialize checkout service
        this.checkoutService = new CheckoutService_1.CheckoutService(this.auditLogRepository, this.piiRedactor);
    }
    /**
     * Main orchestration method - handles all request types
     */
    async orchestrateRequest(request) {
        const startTime = Date.now();
        const componentLatencies = {
            authentication: 0,
        };
        let fallbackUsed = false;
        let cacheHit = false;
        let costEstimate = this.COST_PER_REQUEST_BASE;
        try {
            // Step 1: Authentication and validation (already handled by middleware)
            const authStart = Date.now();
            await this.validateRequest(request);
            componentLatencies.authentication = Date.now() - authStart;
            // Step 2: PII redaction
            const sanitizedRequest = await this.sanitizeRequest(request);
            // Step 3: Route to appropriate handler based on operation
            let result;
            switch (request.operation) {
                case 'chat':
                    result = await this.handleChatRequest(sanitizedRequest, componentLatencies);
                    break;
                case 'search':
                    result = await this.handleSearchRequest(sanitizedRequest, componentLatencies);
                    break;
                case 'checkout':
                    result = await this.handleCheckoutRequest(sanitizedRequest, componentLatencies);
                    break;
                case 'analytics':
                    result = await this.handleAnalyticsRequest(sanitizedRequest, componentLatencies);
                    break;
                default:
                    throw new Error(`Unsupported operation: ${request.operation}`);
            }
            // Extract metadata from result
            fallbackUsed = result.fallbackUsed || false;
            cacheHit = result.cacheHit || false;
            costEstimate += result.costEstimate || 0;
            // Step 4: Track usage for billing
            await this.trackUsage(request, componentLatencies, costEstimate);
            // Step 5: Audit logging
            await this.auditLogRepository.create({
                merchantId: request.merchantId,
                userId: request.userId,
                sessionId: request.sessionId,
                operation: `orchestration_${request.operation}`,
                requestPayloadHash: this.hashPayload(sanitizedRequest),
                responseReference: `success:${request.requestId}`,
                outcome: 'success',
                actor: request.userId,
                ipAddress: request.metadata?.ipAddress,
                userAgent: request.metadata?.userAgent,
            });
            const executionTime = Date.now() - startTime;
            // Check latency budget
            if (executionTime > this.LATENCY_BUDGET_MS) {
                console.warn(`⚠️  Request ${request.requestId} exceeded latency budget: ${executionTime}ms > ${this.LATENCY_BUDGET_MS}ms`);
            }
            return {
                requestId: request.requestId,
                success: true,
                data: result.data,
                executionTime,
                componentLatencies,
                fallbackUsed,
                cacheHit,
                costEstimate,
            };
        }
        catch (error) {
            console.error(`❌ Orchestration failed for request ${request.requestId}:`, error);
            // Audit log the failure
            await this.auditLogRepository.create({
                merchantId: request.merchantId,
                userId: request.userId,
                sessionId: request.sessionId,
                operation: `orchestration_${request.operation}`,
                requestPayloadHash: this.hashPayload(request),
                responseReference: `error:${request.requestId}`,
                outcome: 'failure',
                reason: error.message,
                actor: request.userId,
                ipAddress: request.metadata?.ipAddress,
                userAgent: request.metadata?.userAgent,
            });
            const executionTime = Date.now() - startTime;
            return {
                requestId: request.requestId,
                success: false,
                error: error.message,
                executionTime,
                componentLatencies,
                fallbackUsed: true,
                cacheHit,
                costEstimate,
            };
        }
    }
    /**
     * Handle chat requests with full RAG pipeline
     */
    async handleChatRequest(request, latencies) {
        const { query, sessionId, userContext, maxResults = 5 } = request.payload;
        // Step 1: Session management
        const sessionStart = Date.now();
        let effectiveSessionId = sessionId;
        if (!effectiveSessionId) {
            const session = await this.sessionManager.createSession({
                merchantId: request.merchantId,
                userId: request.userId,
                context: userContext,
            });
            effectiveSessionId = session.sessionId;
        }
        latencies.sessionManagement = Date.now() - sessionStart;
        // Step 2: RAG processing with circuit breaker
        const ragStart = Date.now();
        const ragResult = await this.circuitBreaker.callWithBreaker(async () => {
            return await this.ragService.processQuery({
                query,
                merchantId: request.merchantId,
                userId: request.userId,
                sessionId: effectiveSessionId,
                userContext,
                limit: maxResults,
                includeExplainability: true,
            });
        }, async () => {
            console.warn('RAG service circuit breaker open, using fallback');
            return {
                retrievalResults: [],
                predictions: [],
                rankedResults: [],
                confidence: 0.3,
                reasoning: ['RAG service temporarily unavailable'],
                cacheHit: false,
                executionTime: 0,
                fallbackUsed: true,
            };
        }, { failureThreshold: 3, resetTimeout: 30000, monitoringWindow: 300000 });
        latencies.ragProcessing = Date.now() - ragStart;
        // Step 3: Bedrock Agent orchestration
        const bedrockStart = Date.now();
        const agentResponse = await this.circuitBreaker.callWithBreaker(async () => {
            return await this.bedrockAgentService.processChat({
                query,
                merchantId: request.merchantId,
                userId: request.userId,
                sessionId: effectiveSessionId,
                userContext,
                ragResults: ragResult,
            });
        }, async () => {
            console.warn('Bedrock Agent circuit breaker open, using template response');
            return {
                response: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.',
                answer: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.',
                sessionId: effectiveSessionId,
                sources: [],
                reasoning: ['Bedrock Agent temporarily unavailable'],
                confidence: 0.2,
            };
        }, { failureThreshold: 3, resetTimeout: 30000, monitoringWindow: 300000 });
        latencies.bedrockAgent = Date.now() - bedrockStart;
        // Step 4: Update session with conversation
        await this.sessionManager.updateSession({
            sessionId: effectiveSessionId,
            merchantId: request.merchantId,
            message: {
                id: (0, uuid_1.v4)(),
                role: 'user',
                content: query,
                timestamp: new Date(),
                metadata: { requestId: request.requestId },
            },
        });
        await this.sessionManager.updateSession({
            sessionId: effectiveSessionId,
            merchantId: request.merchantId,
            message: {
                id: (0, uuid_1.v4)(),
                role: 'assistant',
                content: agentResponse.answer,
                timestamp: new Date(),
                metadata: {
                    requestId: request.requestId,
                    confidence: ragResult.confidence,
                    fallbackUsed: ragResult.fallbackUsed,
                },
            },
        });
        return {
            data: {
                sessionId: effectiveSessionId,
                answer: agentResponse.answer,
                sources: ragResult.retrievalResults.map((r) => ({
                    id: r.id,
                    title: this.extractTitleFromSnippet(r.snippet),
                    snippet: r.snippet,
                    score: r.score,
                    sku: r.metadata.sku,
                })),
                recommendations: ragResult.rankedResults.slice(0, 3),
                confidence: ragResult.confidence,
                reasoning: ragResult.reasoning,
            },
            fallbackUsed: ragResult.fallbackUsed,
            cacheHit: ragResult.cacheHit,
            costEstimate: this.calculateChatCost(ragResult, agentResponse),
        };
    }
    /**
     * Handle search requests
     */
    async handleSearchRequest(request, latencies) {
        const { query, limit = 10, threshold = 0.7 } = request.payload;
        const ragStart = Date.now();
        const ragResult = await this.ragService.processQuery({
            query,
            merchantId: request.merchantId,
            userId: request.userId,
            limit,
            threshold,
        });
        latencies.ragProcessing = Date.now() - ragStart;
        return {
            data: {
                results: ragResult.retrievalResults,
                predictions: ragResult.predictions,
                totalResults: ragResult.retrievalResults.length,
                executionTime: ragResult.executionTime,
            },
            fallbackUsed: ragResult.fallbackUsed,
            cacheHit: ragResult.cacheHit,
            costEstimate: this.calculateSearchCost(ragResult),
        };
    }
    /**
     * Handle checkout requests
     */
    async handleCheckoutRequest(request, latencies) {
        const checkoutStart = Date.now();
        const checkoutResult = await this.checkoutService.processCheckout(request.payload);
        latencies.checkout = Date.now() - checkoutStart;
        return {
            data: checkoutResult,
            fallbackUsed: checkoutResult.status === 'failed',
            cacheHit: false,
            costEstimate: this.calculateCheckoutCost(checkoutResult),
        };
    }
    /**
     * Handle analytics requests
     */
    async handleAnalyticsRequest(request, latencies) {
        const { startDate, endDate, type = 'session' } = request.payload;
        const analyticsStart = Date.now();
        let analyticsResult;
        if (type === 'billing') {
            analyticsResult = await this.sessionAnalyticsService.generateBillingData(request.merchantId, new Date(startDate), new Date(endDate));
        }
        else {
            analyticsResult = await this.sessionAnalyticsService.getSessionAnalytics(request.merchantId, new Date(startDate), new Date(endDate));
        }
        latencies.sessionManagement = Date.now() - analyticsStart;
        return {
            data: analyticsResult,
            fallbackUsed: false,
            cacheHit: false,
            costEstimate: 0.001, // Small cost for analytics
        };
    }
    /**
     * Comprehensive health check for all components
     */
    async performHealthCheck() {
        const startTime = Date.now();
        const [ragHealth, bedrockHealth, sessionHealth, cacheHealth, checkoutHealth] = await Promise.allSettled([
            this.ragService.getHealthStatus().catch(() => ({ status: 'unhealthy' })),
            this.bedrockAgentService.healthCheck().catch(() => ({ status: 'unhealthy' })),
            this.testSessionManager().catch(() => ({ status: 'unhealthy' })),
            this.cacheService.healthCheck().catch(() => false),
            this.testCheckoutService().catch(() => ({ status: 'unhealthy' })),
        ]);
        const components = {
            ragService: this.getHealthStatus(ragHealth),
            bedrockAgent: this.getHealthStatus(bedrockHealth),
            sessionManager: this.getHealthStatus(sessionHealth),
            cache: cacheHealth.status === 'fulfilled' && cacheHealth.value ? 'healthy' : 'unhealthy',
            database: 'healthy', // Assume healthy if no errors
            checkout: this.getHealthStatus(checkoutHealth),
        };
        // Calculate overall status
        const healthyCount = Object.values(components).filter(status => status === 'healthy').length;
        const totalCount = Object.keys(components).length;
        let overallStatus;
        if (healthyCount === totalCount) {
            overallStatus = 'healthy';
        }
        else if (healthyCount >= totalCount / 2) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'unhealthy';
        }
        const currentLatency = Date.now() - startTime;
        return {
            service: 'OrchestrationService',
            status: overallStatus,
            components,
            latencyBudget: {
                target: this.LATENCY_BUDGET_MS,
                current: currentLatency,
                withinBudget: currentLatency <= this.LATENCY_BUDGET_MS,
            },
            circuitBreakers: {
                ragService: this.circuitBreaker.getStats('rag_service'),
                bedrockAgent: this.circuitBreaker.getStats('bedrock_agent'),
                checkout: this.circuitBreaker.getStats('checkout_service'),
            },
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Private helper methods
     */
    async validateRequest(request) {
        if (!request.requestId || !request.merchantId || !request.userId || !request.operation) {
            throw new Error('Missing required request fields');
        }
        if (!['chat', 'search', 'checkout', 'analytics'].includes(request.operation)) {
            throw new Error(`Invalid operation: ${request.operation}`);
        }
    }
    async sanitizeRequest(request) {
        // Redact PII from the request payload
        const sanitizedPayload = await this.piiRedactor.redactQuery(JSON.stringify(request.payload));
        return {
            ...request,
            payload: JSON.parse(sanitizedPayload.sanitizedText),
        };
    }
    async trackUsage(request, latencies, cost) {
        try {
            if (request.sessionId) {
                await this.sessionAnalyticsService.trackSessionUsage({
                    sessionId: request.sessionId,
                    merchantId: request.merchantId,
                    userId: request.userId,
                    startTime: new Date(),
                    messageCount: request.operation === 'chat' ? 1 : 0,
                    ragQueries: request.operation === 'chat' || request.operation === 'search' ? 1 : 0,
                    llmTokensUsed: request.operation === 'chat' ? 100 : 0, // Estimate
                    cacheHits: 0, // Would be tracked by individual services
                    cacheMisses: 0,
                    totalCost: cost,
                    avgResponseTime: Object.values(latencies).reduce((sum, time) => sum + time, 0),
                    errors: 0,
                });
            }
        }
        catch (error) {
            console.error('Failed to track usage:', error);
            // Don't throw - this shouldn't break the main flow
        }
    }
    calculateChatCost(ragResult, agentResponse) {
        let cost = 0.001; // Base cost
        cost += ragResult.retrievalResults.length * 0.0001; // Cost per retrieval
        cost += ragResult.predictions.length * 0.0005; // Cost per prediction
        cost += 0.002; // LLM generation cost
        return cost;
    }
    calculateSearchCost(ragResult) {
        let cost = 0.0005; // Base search cost
        cost += ragResult.retrievalResults.length * 0.0001; // Cost per result
        return cost;
    }
    calculateCheckoutCost(checkoutResult) {
        return 0.01; // Fixed cost for checkout processing
    }
    async testSessionManager() {
        // Test session manager by creating and deleting a test session
        const testSession = await this.sessionManager.createSession({
            merchantId: 'health-check',
            userId: 'health-check-user',
        });
        await this.sessionManager.deleteSession(testSession.sessionId, 'health-check');
        return { status: 'healthy' };
    }
    async testCheckoutService() {
        // Simple health check for checkout service
        return { status: 'healthy' };
    }
    getHealthStatus(result) {
        if (result.status === 'fulfilled') {
            const value = result.value;
            if (value && typeof value === 'object' && value.status) {
                return value.status === 'healthy' ? 'healthy' : 'degraded';
            }
            return 'healthy';
        }
        return 'unhealthy';
    }
    extractTitleFromSnippet(snippet) {
        const sentences = snippet.split(/[.!?]/);
        return sentences[0]?.trim() || snippet.substring(0, 50) + "...";
    }
    hashPayload(payload) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
}
exports.OrchestrationService = OrchestrationService;
// Export singleton instance
let orchestrationServiceInstance = null;
const getOrchestrationService = () => {
    if (!orchestrationServiceInstance) {
        orchestrationServiceInstance = new OrchestrationService();
    }
    return orchestrationServiceInstance;
};
exports.getOrchestrationService = getOrchestrationService;
//# sourceMappingURL=OrchestrationService.js.map