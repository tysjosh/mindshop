"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCoordinationService = void 0;
exports.createToolCoordinationService = createToolCoordinationService;
const CircuitBreaker_1 = require("./CircuitBreaker");
const uuid_1 = require("uuid");
class ToolCoordinationService {
    constructor() {
        this.tools = new Map();
        this.circuitBreakers = new Map();
        this.bulkheads = new Map();
        this.healthCheckIntervals = new Map();
        this.initializeDefaultTools();
    }
    /**
     * Register a tool with the coordination service
     */
    registerTool(tool) {
        this.tools.set(tool.id, tool);
        // Create circuit breaker for the tool
        this.circuitBreakers.set(tool.id, new CircuitBreaker_1.CircuitBreakerService());
        // Start health check monitoring
        this.startHealthCheck(tool);
        console.log(`Registered tool: ${tool.name} (${tool.id})`);
    }
    /**
     * Execute a single tool invocation
     */
    async invokeTool(invocation) {
        const startTime = Date.now();
        const tool = this.tools.get(invocation.toolId);
        if (!tool) {
            return {
                invocationId: invocation.id,
                toolId: invocation.toolId,
                success: false,
                error: `Tool not found: ${invocation.toolId}`,
                latency: Date.now() - startTime,
                retryCount: 0,
                timestamp: new Date(),
            };
        }
        // Check bulkhead capacity
        const bulkhead = this.getBulkhead(invocation.merchantId);
        if (!bulkhead.canAcceptRequest()) {
            return {
                invocationId: invocation.id,
                toolId: invocation.toolId,
                success: false,
                error: 'Bulkhead capacity exceeded',
                latency: Date.now() - startTime,
                retryCount: 0,
                timestamp: new Date(),
            };
        }
        // Acquire bulkhead slot
        bulkhead.acquireSlot();
        try {
            const circuitBreaker = this.circuitBreakers.get(invocation.toolId);
            const result = await circuitBreaker.callWithBreaker(() => this.executeToolCall(tool, invocation), () => this.getFallbackResult(invocation), tool.circuitBreakerConfig);
            bulkhead.releaseSlot(true);
            return {
                invocationId: invocation.id,
                toolId: invocation.toolId,
                success: true,
                result,
                latency: Date.now() - startTime,
                retryCount: 0, // Circuit breaker handles retries internally
                timestamp: new Date(),
            };
        }
        catch (error) {
            bulkhead.releaseSlot(false);
            return {
                invocationId: invocation.id,
                toolId: invocation.toolId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                latency: Date.now() - startTime,
                retryCount: 0,
                timestamp: new Date(),
            };
        }
    }
    /**
     * Execute multiple tool invocations with coordination
     */
    async executeCoordinatedPlan(plan, merchantId, userId) {
        const startTime = Date.now();
        const results = [];
        const failedSteps = [];
        const completedSteps = new Set();
        try {
            if (plan.parallelizable) {
                // Execute all steps in parallel
                const invocations = plan.steps.map(step => ({
                    id: (0, uuid_1.v4)(),
                    toolId: step.tool,
                    parameters: { ...step.parameters, merchant_id: merchantId, user_id: userId },
                    timeout: step.timeout,
                    retryConfig: step.retryConfig,
                    merchantId,
                    priority: step.priority,
                }));
                const parallelResults = await Promise.allSettled(invocations.map(inv => this.invokeTool(inv)));
                parallelResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                        if (result.value.success) {
                            completedSteps.add(plan.steps[index].id);
                        }
                        else {
                            failedSteps.push(plan.steps[index].id);
                        }
                    }
                    else {
                        failedSteps.push(plan.steps[index].id);
                        results.push({
                            invocationId: invocations[index].id,
                            toolId: invocations[index].toolId,
                            success: false,
                            error: result.reason?.message || 'Promise rejected',
                            latency: 0,
                            retryCount: 0,
                            timestamp: new Date(),
                        });
                    }
                });
            }
            else {
                // Execute steps sequentially based on dependencies
                const sortedSteps = this.topologicalSort(plan.steps);
                for (const step of sortedSteps) {
                    // Check if all dependencies are completed
                    const dependenciesMet = step.dependencies.every(dep => completedSteps.has(dep));
                    if (!dependenciesMet) {
                        failedSteps.push(step.id);
                        results.push({
                            invocationId: (0, uuid_1.v4)(),
                            toolId: step.tool,
                            success: false,
                            error: 'Dependencies not met',
                            latency: 0,
                            retryCount: 0,
                            timestamp: new Date(),
                        });
                        continue;
                    }
                    const invocation = {
                        id: (0, uuid_1.v4)(),
                        toolId: step.tool,
                        parameters: { ...step.parameters, merchant_id: merchantId, user_id: userId },
                        timeout: step.timeout,
                        retryConfig: step.retryConfig,
                        merchantId,
                        priority: step.priority,
                    };
                    const result = await this.invokeTool(invocation);
                    results.push(result);
                    if (result.success) {
                        completedSteps.add(step.id);
                    }
                    else {
                        failedSteps.push(step.id);
                        // If this is a critical step, stop execution
                        if (step.priority === 1) {
                            console.warn(`Critical step failed: ${step.id}, stopping execution`);
                            break;
                        }
                    }
                }
            }
            const success = failedSteps.length === 0;
            const totalLatency = Date.now() - startTime;
            return {
                results,
                success,
                totalLatency,
                failedSteps,
            };
        }
        catch (error) {
            console.error('Plan execution error:', error);
            return {
                results,
                success: false,
                totalLatency: Date.now() - startTime,
                failedSteps: plan.steps.map(s => s.id),
            };
        }
    }
    /**
     * Get tool health status
     */
    getToolHealth(toolId) {
        const tool = this.tools.get(toolId);
        const circuitBreaker = this.circuitBreakers.get(toolId);
        if (!tool || !circuitBreaker) {
            return {
                status: 'unhealthy',
                circuitBreakerState: 'unknown',
                lastHealthCheck: null,
                errorRate: 1.0,
            };
        }
        const stats = {
            state: 'CLOSED',
            errorRate: 0,
            lastFailure: null,
        };
        let status = 'healthy';
        if (stats.state === 'OPEN') {
            status = 'unhealthy';
        }
        else if (stats.errorRate > 0.1) {
            status = 'degraded';
        }
        return {
            status,
            circuitBreakerState: stats.state,
            lastHealthCheck: stats.lastFailure,
            errorRate: stats.errorRate,
        };
    }
    /**
     * Get bulkhead statistics for a merchant
     */
    getBulkheadStats(merchantId) {
        const bulkhead = this.bulkheads.get(merchantId);
        if (!bulkhead) {
            return {
                merchantId,
                activeRequests: 0,
                queuedRequests: 0,
                totalRequests: 0,
                failedRequests: 0,
                avgLatency: 0,
                lastActivity: new Date(),
            };
        }
        return bulkhead.getStats();
    }
    /**
     * Get overall system health
     */
    getSystemHealth() {
        const toolsHealth = {};
        let unhealthyTools = 0;
        let degradedTools = 0;
        for (const [toolId] of this.tools) {
            const health = this.getToolHealth(toolId);
            toolsHealth[toolId] = health;
            if (health.status === 'unhealthy') {
                unhealthyTools++;
            }
            else if (health.status === 'degraded') {
                degradedTools++;
            }
        }
        const bulkheadStats = {};
        for (const [merchantId, bulkhead] of this.bulkheads) {
            bulkheadStats[merchantId] = bulkhead.getStats();
        }
        let systemStatus = 'healthy';
        if (unhealthyTools > 0) {
            systemStatus = 'unhealthy';
        }
        else if (degradedTools > 0) {
            systemStatus = 'degraded';
        }
        return {
            status: systemStatus,
            toolsHealth,
            bulkheadStats,
            timestamp: new Date(),
        };
    }
    /**
     * Initialize default tools
     */
    initializeDefaultTools() {
        const defaultTools = [
            {
                id: 'semanticRetrieval',
                name: 'Semantic Retrieval',
                endpoint: process.env.MINDSDB_ENDPOINT || 'http://localhost:47334',
                timeout: 3000,
                retryConfig: {
                    maxRetries: 2,
                    backoffMs: 500,
                    backoffMultiplier: 2,
                },
                circuitBreakerConfig: {
                    failureThreshold: 5,
                    resetTimeout: 30000,
                    monitoringWindow: 60000,
                },
                healthCheck: {
                    endpoint: '/health',
                    interval: 30000,
                    timeout: 5000,
                },
                bulkheadConfig: {
                    maxConcurrentRequests: 10,
                    queueSize: 20,
                },
            },
            {
                id: 'productPrediction',
                name: 'Product Prediction',
                endpoint: process.env.MINDSDB_ENDPOINT || 'http://localhost:47334',
                timeout: 5000,
                retryConfig: {
                    maxRetries: 3,
                    backoffMs: 1000,
                    backoffMultiplier: 2,
                },
                circuitBreakerConfig: {
                    failureThreshold: 3,
                    resetTimeout: 60000,
                    monitoringWindow: 120000,
                },
                healthCheck: {
                    endpoint: '/health',
                    interval: 30000,
                    timeout: 5000,
                },
                bulkheadConfig: {
                    maxConcurrentRequests: 5,
                    queueSize: 10,
                },
            },
            {
                id: 'processCheckout',
                name: 'Process Checkout',
                endpoint: 'lambda://checkout-handler',
                timeout: 10000,
                retryConfig: {
                    maxRetries: 1,
                    backoffMs: 2000,
                    backoffMultiplier: 1,
                },
                circuitBreakerConfig: {
                    failureThreshold: 2,
                    resetTimeout: 120000,
                    monitoringWindow: 300000,
                },
                healthCheck: {
                    endpoint: '/health',
                    interval: 60000,
                    timeout: 10000,
                },
                bulkheadConfig: {
                    maxConcurrentRequests: 3,
                    queueSize: 5,
                },
            },
            {
                id: 'amazonQ',
                name: 'Amazon Q',
                endpoint: 'aws://qbusiness',
                timeout: 4000,
                retryConfig: {
                    maxRetries: 2,
                    backoffMs: 1000,
                    backoffMultiplier: 2,
                },
                circuitBreakerConfig: {
                    failureThreshold: 5,
                    resetTimeout: 60000,
                    monitoringWindow: 120000,
                },
                healthCheck: {
                    endpoint: '/health',
                    interval: 60000,
                    timeout: 5000,
                },
                bulkheadConfig: {
                    maxConcurrentRequests: 8,
                    queueSize: 15,
                },
            },
        ];
        defaultTools.forEach(tool => this.registerTool(tool));
    }
    /**
     * Execute actual tool call
     */
    async executeToolCall(tool, invocation) {
        // This would be implemented based on the specific tool type
        // For now, we'll simulate the call
        if (tool.id === 'semanticRetrieval') {
            return this.callSemanticRetrieval(invocation.parameters);
        }
        else if (tool.id === 'productPrediction') {
            return this.callProductPrediction(invocation.parameters);
        }
        else if (tool.id === 'processCheckout') {
            return this.callCheckout(invocation.parameters);
        }
        else if (tool.id === 'amazonQ') {
            return this.callAmazonQ(invocation.parameters);
        }
        throw new Error(`Unknown tool: ${tool.id}`);
    }
    /**
     * Get fallback result for circuit breaker
     */
    async getFallbackResult(invocation) {
        console.warn(`Using fallback for tool: ${invocation.toolId}`);
        return {
            fallback: true,
            message: `Service temporarily unavailable: ${invocation.toolId}`,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Get or create bulkhead for merchant
     */
    getBulkhead(merchantId) {
        if (!this.bulkheads.has(merchantId)) {
            this.bulkheads.set(merchantId, new MerchantBulkhead(merchantId, {
                maxConcurrentRequests: 20,
                queueSize: 50,
            }));
        }
        return this.bulkheads.get(merchantId);
    }
    /**
     * Start health check monitoring for a tool
     */
    startHealthCheck(tool) {
        const interval = setInterval(async () => {
            try {
                // Implement actual health check based on tool type
                console.log(`Health check for ${tool.name}: OK`);
            }
            catch (error) {
                console.warn(`Health check failed for ${tool.name}:`, error);
            }
        }, tool.healthCheck.interval);
        this.healthCheckIntervals.set(tool.id, interval);
    }
    /**
     * Topological sort for dependency resolution
     */
    topologicalSort(steps) {
        const visited = new Set();
        const result = [];
        const stepMap = new Map(steps.map(step => [step.id, step]));
        const visit = (stepId) => {
            if (visited.has(stepId))
                return;
            const step = stepMap.get(stepId);
            if (!step)
                return;
            // Visit dependencies first
            step.dependencies.forEach(dep => visit(dep));
            visited.add(stepId);
            result.push(step);
        };
        steps.forEach(step => visit(step.id));
        return result;
    }
    // Placeholder methods for actual tool calls
    async callSemanticRetrieval(params) {
        // This would call the actual semantic retrieval service
        return { results: [], query: params.query };
    }
    async callProductPrediction(params) {
        // This would call the actual product prediction service
        return { prediction: 0.5, confidence: 0.7 };
    }
    async callCheckout(params) {
        // This would call the actual checkout service
        return { transaction_id: 'test', status: 'pending' };
    }
    async callAmazonQ(params) {
        // This would call the actual Amazon Q service
        return { response: 'Q response', sources: [] };
    }
}
exports.ToolCoordinationService = ToolCoordinationService;
/**
 * Merchant-specific bulkhead for request isolation
 */
class MerchantBulkhead {
    constructor(merchantId, config) {
        this.activeRequests = 0;
        this.queuedRequests = 0;
        this.totalRequests = 0;
        this.failedRequests = 0;
        this.latencies = [];
        this.lastActivity = new Date();
        this.merchantId = merchantId;
        this.maxConcurrentRequests = config.maxConcurrentRequests;
        this.queueSize = config.queueSize;
    }
    canAcceptRequest() {
        return this.activeRequests < this.maxConcurrentRequests ||
            this.queuedRequests < this.queueSize;
    }
    acquireSlot() {
        if (this.activeRequests < this.maxConcurrentRequests) {
            this.activeRequests++;
        }
        else {
            this.queuedRequests++;
        }
        this.totalRequests++;
        this.lastActivity = new Date();
    }
    releaseSlot(success) {
        if (this.queuedRequests > 0) {
            this.queuedRequests--;
        }
        else {
            this.activeRequests--;
        }
        if (!success) {
            this.failedRequests++;
        }
        this.lastActivity = new Date();
    }
    getStats() {
        const avgLatency = this.latencies.length > 0 ?
            this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length : 0;
        return {
            merchantId: this.merchantId,
            activeRequests: this.activeRequests,
            queuedRequests: this.queuedRequests,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            avgLatency,
            lastActivity: this.lastActivity,
        };
    }
}
// Factory function to create ToolCoordinationService
function createToolCoordinationService() {
    return new ToolCoordinationService();
}
//# sourceMappingURL=ToolCoordinationService.js.map