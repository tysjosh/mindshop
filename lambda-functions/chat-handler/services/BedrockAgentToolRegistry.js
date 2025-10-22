"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockAgentToolRegistryClass = exports.BedrockAgentToolRegistry = void 0;
exports.getBedrockAgentToolRegistry = getBedrockAgentToolRegistry;
const MindsDBService_1 = require("./MindsDBService");
const SemanticRetrievalService_1 = require("./SemanticRetrievalService");
const CheckoutService_1 = require("./CheckoutService");
const CostTrackingService_1 = require("./CostTrackingService");
const LoggingService_1 = require("./LoggingService");
const PIIRedactor_1 = require("./PIIRedactor");
const AuditLogRepository_1 = require("../repositories/AuditLogRepository");
/**
 * Registry and orchestrator for Bedrock Agent tools
 * Provides validation, execution, monitoring, and cost tracking
 */
class BedrockAgentToolRegistry {
    constructor() {
        this.tools = new Map();
        this.executionStats = new Map();
        this.costTrackingService = (0, CostTrackingService_1.getCostTrackingService)();
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.registerDefaultTools();
    }
    /**
     * Register all default tools
     */
    registerDefaultTools() {
        // Semantic Retrieval Tool
        this.registerTool({
            name: 'semantic_retrieval',
            description: 'Retrieve semantically similar documents from merchant knowledge base',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', minLength: 1, maxLength: 1000 },
                    merchant_id: { type: 'string', minLength: 3, maxLength: 100 },
                    limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
                    threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
                    document_types: {
                        type: 'array',
                        items: { type: 'string', enum: ['product', 'faq', 'policy', 'review'] },
                        default: []
                    }
                },
                required: ['query', 'merchant_id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    results: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                snippet: { type: 'string' },
                                score: { type: 'number' },
                                metadata: { type: 'object' },
                                grounding_pass: { type: 'boolean' }
                            }
                        }
                    },
                    total_results: { type: 'integer' },
                    query: { type: 'string' },
                    merchant_id: { type: 'string' }
                }
            },
            handler: this.handleSemanticRetrieval.bind(this),
            requiresAuth: true,
            rateLimitPerMinute: 60,
            costEstimate: 0.001
        });
        // Product Prediction Tool
        this.registerTool({
            name: 'product_prediction',
            description: 'Generate product demand and purchase probability predictions with explainability',
            inputSchema: {
                type: 'object',
                properties: {
                    sku: { type: 'string', minLength: 1, maxLength: 100 },
                    merchant_id: { type: 'string', minLength: 3, maxLength: 100 },
                    user_context: {
                        type: 'object',
                        properties: {
                            user_id: { type: 'string' },
                            session_id: { type: 'string' },
                            preferences: { type: 'object' },
                            purchase_history: { type: 'array', items: { type: 'string' } },
                            demographics: { type: 'object' }
                        },
                        default: {}
                    }
                },
                required: ['sku', 'merchant_id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    sku: { type: 'string' },
                    demand_score: { type: 'number' },
                    purchase_probability: { type: 'number' },
                    explanation: { type: 'string' },
                    feature_importance: { type: 'object' },
                    confidence: { type: 'number' },
                    provenance: { type: 'object' }
                }
            },
            handler: this.handleProductPrediction.bind(this),
            requiresAuth: true,
            rateLimitPerMinute: 30,
            costEstimate: 0.002
        });
        // Secure Checkout Tool
        this.registerTool({
            name: 'secure_checkout',
            description: 'Process secure checkout with payment gateway integration',
            inputSchema: {
                type: 'object',
                properties: {
                    merchant_id: { type: 'string', minLength: 3, maxLength: 100 },
                    user_id: { type: 'string', minLength: 1, maxLength: 100 },
                    session_id: { type: 'string', minLength: 1, maxLength: 100 },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 50,
                        items: {
                            type: 'object',
                            properties: {
                                sku: { type: 'string', minLength: 1 },
                                quantity: { type: 'integer', minimum: 1, maximum: 100 },
                                price: { type: 'number', minimum: 0 },
                                name: { type: 'string' }
                            },
                            required: ['sku', 'quantity', 'price']
                        }
                    },
                    payment_method: {
                        type: 'string',
                        enum: ['stripe', 'adyen', 'default'],
                        default: 'default'
                    },
                    shipping_address: {
                        type: 'object',
                        properties: {
                            address_line_1: { type: 'string', minLength: 1 },
                            city: { type: 'string', minLength: 1 },
                            postal_code: { type: 'string', minLength: 1 },
                            country: { type: 'string', minLength: 2, maxLength: 2 }
                        },
                        required: ['address_line_1', 'city', 'postal_code', 'country']
                    },
                    user_consent: {
                        type: 'object',
                        properties: {
                            terms_accepted: { type: 'boolean' },
                            privacy_accepted: { type: 'boolean' },
                            consent_timestamp: { type: 'string', format: 'date-time' }
                        },
                        required: ['terms_accepted']
                    }
                },
                required: ['merchant_id', 'user_id', 'session_id', 'items', 'shipping_address', 'user_consent']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    transaction_id: { type: 'string' },
                    status: { type: 'string' },
                    total_amount: { type: 'number' },
                    order_reference: { type: 'string' },
                    payment_status: { type: 'string' }
                }
            },
            handler: this.handleSecureCheckout.bind(this),
            requiresAuth: true,
            rateLimitPerMinute: 10,
            costEstimate: 0.005
        });
        // Tool Status and Health Check
        this.registerTool({
            name: 'tool_health_check',
            description: 'Check the health and availability of all registered tools',
            inputSchema: {
                type: 'object',
                properties: {
                    merchant_id: { type: 'string', minLength: 3, maxLength: 100 }
                },
                required: ['merchant_id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    tools: { type: 'object' },
                    timestamp: { type: 'string' }
                }
            },
            handler: this.handleHealthCheck.bind(this),
            requiresAuth: false,
            rateLimitPerMinute: 20,
            costEstimate: 0.0001
        });
    }
    /**
     * Register a new tool
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }
    /**
     * Get all registered tools
     */
    getTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Get a specific tool by name
     */
    getTool(name) {
        return this.tools.get(name);
    }
    /**
     * Execute a tool with validation and monitoring
     */
    async executeTool(toolName, input, context) {
        const startTime = Date.now();
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }
        try {
            // Validate input schema
            this.validateInput(tool, input);
            // Check rate limits
            await this.checkRateLimit(toolName, context);
            // Execute the tool
            const result = await tool.handler(input, context);
            // Validate output schema
            this.validateOutput(tool, result);
            const executionTime = Date.now() - startTime;
            const cost = tool.costEstimate || 0;
            // Track cost (non-blocking)
            try {
                await this.costTrackingService.trackOperationCost({
                    merchantId: context.merchantId,
                    sessionId: context.sessionId,
                    userId: context.userId,
                    operation: `bedrock_tool_${toolName}`,
                    costUsd: cost,
                    computeMs: executionTime,
                    metadata: {
                        toolName,
                        inputSize: JSON.stringify(input).length,
                        outputSize: JSON.stringify(result).length,
                    }
                });
            }
            catch (costError) {
                // Don't fail tool execution due to cost tracking issues
                console.warn(`Cost tracking failed for tool ${toolName}:`, costError);
            }
            // Update execution stats
            this.updateExecutionStats(toolName);
            // Log successful execution
            await this.loggingService.logInfo(`Tool executed successfully: ${toolName}`, {
                merchantId: context.merchantId,
                sessionId: context.sessionId || '',
                userId: context.userId || '',
                requestId: context.requestId,
                operation: `tool_execution_${toolName}`,
            }, {
                executionTime,
                cost,
                inputSize: JSON.stringify(input).length,
                outputSize: JSON.stringify(result).length,
            });
            return {
                success: true,
                data: result,
                executionTime,
                cost,
                metadata: {
                    toolName,
                    context,
                    inputHash: this.hashInput(input),
                    outputSize: JSON.stringify(result).length,
                }
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            // Log error
            await this.loggingService.logError(error, {
                merchantId: context.merchantId,
                sessionId: context.sessionId || '',
                userId: context.userId || '',
                requestId: context.requestId,
                operation: `tool_execution_error_${toolName}`,
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime,
                cost: 0,
                metadata: {
                    toolName,
                    context,
                    inputHash: this.hashInput(input),
                    outputSize: 0,
                }
            };
        }
    }
    /**
     * Handle semantic retrieval tool
     */
    async handleSemanticRetrieval(input, context) {
        const semanticRetrievalService = new SemanticRetrievalService_1.SemanticRetrievalService();
        const response = await semanticRetrievalService.retrieveDocuments({
            query: input.query,
            merchantId: input.merchant_id,
            limit: input.limit || 5,
            threshold: input.threshold || 0.7,
            useHybridSearch: true,
            filters: { document_types: input.document_types || [] },
        });
        // Transform results to match expected format
        const transformedResults = response.map((result) => ({
            id: result.id,
            snippet: result.snippet || result.title,
            score: result.score,
            metadata: {
                ...result.metadata,
                sku: result.sku,
                merchant_id: result.merchantId,
                document_type: result.documentType,
                source_uri: result.metadata?.source_uri,
            },
            grounding_pass: result.score >= (input.threshold || 0.7),
        }));
        return {
            results: transformedResults,
            total_results: transformedResults.length,
            query: input.query,
            merchant_id: input.merchant_id,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Handle product prediction tool
     */
    async handleProductPrediction(input, context) {
        const mindsdbService = new MindsDBService_1.MindsDBService();
        try {
            const prediction = await mindsdbService.predictProductSignals({
                sku: input.sku,
                merchantId: input.merchant_id,
                userContext: input.user_context || {},
            });
            return {
                sku: prediction.sku,
                demand_score: prediction.demandScore,
                purchase_probability: prediction.purchaseProbability,
                explanation: prediction.explanation,
                feature_importance: prediction.featureImportance,
                confidence: prediction.confidence,
                provenance: {
                    model_id: prediction.modelId || 'product_signals_v1',
                    model_version: prediction.modelVersion || '1.0.0',
                    training_date: prediction.trainingDate || new Date().toISOString(),
                },
                merchant_id: input.merchant_id,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            // Return fallback prediction on error
            return {
                sku: input.sku,
                demand_score: 0.4,
                purchase_probability: 0.2,
                explanation: `Prediction service temporarily unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
                feature_importance: {
                    'service_availability': 0.0,
                },
                confidence: 0.1,
                provenance: {
                    model_id: 'fallback',
                    model_version: '1.0.0',
                    training_date: new Date().toISOString(),
                },
                merchant_id: input.merchant_id,
                timestamp: new Date().toISOString(),
                error: true,
            };
        }
    }
    /**
     * Handle secure checkout tool
     */
    async handleSecureCheckout(input, context) {
        const auditLogRepository = new AuditLogRepository_1.AuditLogRepository();
        const piiRedactor = new PIIRedactor_1.PIIRedactorService();
        const checkoutService = new CheckoutService_1.CheckoutService(auditLogRepository, piiRedactor);
        const checkoutRequest = {
            merchant_id: input.merchant_id,
            user_id: input.user_id,
            session_id: input.session_id,
            items: input.items,
            payment_method: input.payment_method,
            shipping_address: input.shipping_address,
            billing_address: input.billing_address || input.shipping_address,
            user_consent: {
                terms_accepted: input.user_consent.terms_accepted,
                privacy_accepted: input.user_consent.privacy_accepted || true,
                marketing_consent: input.user_consent.marketing_consent || false,
                consent_timestamp: input.user_consent.consent_timestamp || new Date().toISOString(),
            },
        };
        return await checkoutService.processCheckout(checkoutRequest);
    }
    /**
     * Handle health check tool
     */
    async handleHealthCheck(input, context) {
        const toolStatuses = {};
        for (const [toolName, tool] of this.tools.entries()) {
            if (toolName === 'tool_health_check')
                continue; // Skip self
            const stats = this.executionStats.get(toolName);
            toolStatuses[toolName] = {
                available: true,
                description: tool.description,
                rate_limit: tool.rateLimitPerMinute,
                cost_estimate: tool.costEstimate,
                execution_count: stats?.count || 0,
                last_execution: stats?.lastExecution?.toISOString() || null,
            };
        }
        // Test core services
        try {
            const mindsdbService = new MindsDBService_1.MindsDBService();
            const healthCheck = await mindsdbService.healthCheck();
            toolStatuses['mindsdb_service'] = {
                status: healthCheck.status,
                details: healthCheck.details || {},
            };
        }
        catch (error) {
            toolStatuses['mindsdb_service'] = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
        return {
            status: 'healthy',
            tools: toolStatuses,
            timestamp: new Date().toISOString(),
            merchant_id: input.merchant_id,
        };
    }
    /**
     * Validate input against tool schema
     */
    validateInput(tool, input) {
        // Basic validation - in production, use a proper JSON schema validator
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid input: must be an object');
        }
        const required = tool.inputSchema.required || [];
        for (const field of required) {
            if (!(field in input)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    }
    /**
     * Validate output against tool schema
     */
    validateOutput(tool, output) {
        // Basic validation - in production, use a proper JSON schema validator
        if (!output || typeof output !== 'object') {
            throw new Error('Invalid output: must be an object');
        }
    }
    /**
     * Check rate limits for tool execution
     */
    async checkRateLimit(toolName, context) {
        const tool = this.tools.get(toolName);
        if (!tool?.rateLimitPerMinute)
            return;
        // Simple in-memory rate limiting - in production, use Redis
        const key = `${toolName}:${context.merchantId}`;
        const stats = this.executionStats.get(key);
        if (stats && stats.lastExecution) {
            const timeSinceLastExecution = Date.now() - stats.lastExecution.getTime();
            const minInterval = (60 * 1000) / tool.rateLimitPerMinute; // ms between requests
            if (timeSinceLastExecution < minInterval) {
                throw new Error(`Rate limit exceeded for tool ${toolName}. Try again in ${Math.ceil((minInterval - timeSinceLastExecution) / 1000)} seconds.`);
            }
        }
    }
    /**
     * Update execution statistics
     */
    updateExecutionStats(toolName) {
        const current = this.executionStats.get(toolName) || { count: 0, lastExecution: new Date() };
        this.executionStats.set(toolName, {
            count: current.count + 1,
            lastExecution: new Date(),
        });
    }
    /**
     * Hash input for tracking
     */
    hashInput(input) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex').substring(0, 16);
    }
    /**
     * Get execution statistics
     */
    getExecutionStats() {
        return new Map(this.executionStats);
    }
    /**
     * Generate OpenAPI specification for all tools
     */
    generateOpenAPISpec() {
        const paths = {};
        for (const [toolName, tool] of this.tools.entries()) {
            paths[`/${toolName}`] = {
                post: {
                    summary: tool.description,
                    operationId: toolName,
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: tool.inputSchema,
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Successful operation',
                            content: {
                                'application/json': {
                                    schema: tool.outputSchema,
                                },
                            },
                        },
                        '400': {
                            description: 'Invalid input',
                        },
                        '429': {
                            description: 'Rate limit exceeded',
                        },
                        '500': {
                            description: 'Internal server error',
                        },
                    },
                },
            };
        }
        return {
            openapi: '3.0.0',
            info: {
                title: 'MindsDB RAG Tools API',
                version: '1.0.0',
                description: 'API for MindsDB semantic retrieval, product predictions, and secure checkout',
            },
            paths,
        };
    }
}
exports.BedrockAgentToolRegistry = BedrockAgentToolRegistry;
exports.BedrockAgentToolRegistryClass = BedrockAgentToolRegistry;
// Singleton instance
let toolRegistryInstance = null;
function getBedrockAgentToolRegistry() {
    if (!toolRegistryInstance) {
        toolRegistryInstance = new BedrockAgentToolRegistry();
    }
    return toolRegistryInstance;
}
//# sourceMappingURL=BedrockAgentToolRegistry.js.map