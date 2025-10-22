"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBedrockAgentService = exports.BedrockAgentService = void 0;
exports.createBedrockAgentService = createBedrockAgentService;
// Use stub types for development
let BedrockAgentRuntimeClient, InvokeAgentCommand;
try {
    const bedrock = require('@aws-sdk/client-bedrock-agent-runtime');
    BedrockAgentRuntimeClient = bedrock.BedrockAgentRuntimeClient;
    InvokeAgentCommand = bedrock.InvokeAgentCommand;
}
catch {
    BedrockAgentRuntimeClient = class {
        async send() { return {}; }
    };
    InvokeAgentCommand = class {
        constructor() { }
    };
}
const uuid_1 = require("uuid");
const config_1 = require("../config");
const IntentParsingService_1 = require("./IntentParsingService");
const AmazonQService_1 = require("./AmazonQService");
const ToolCoordinationService_1 = require("./ToolCoordinationService");
const AuditLoggingService_1 = require("./AuditLoggingService");
class BedrockAgentService {
    constructor(config) {
        this.bedrockClient = new BedrockAgentRuntimeClient({ region: config.region });
        this.agentId = config.agentId;
        this.agentAliasId = config.agentAliasId;
        this.sessionManager = config.sessionManager;
        this.auditLogRepository = config.auditLogRepository;
        this.intentParsingService = config.intentParsingService;
        this.amazonQService = config.amazonQService;
        this.toolCoordinationService = config.toolCoordinationService;
        this.auditLoggingService = config.auditLoggingService;
    }
    /**
     * Process a chat request using Bedrock Agent orchestration
     */
    async processChat(request) {
        const startTime = Date.now();
        let session = null;
        try {
            // Get or create session
            if (request.sessionId) {
                session = await this.sessionManager.getSession(request.sessionId, request.merchantId) ||
                    await this.sessionManager.createSession({
                        merchantId: request.merchantId,
                        userId: request.userId,
                        context: request.userContext,
                    });
            }
            else {
                session = await this.sessionManager.createSession({
                    merchantId: request.merchantId,
                    userId: request.userId,
                    context: request.userContext,
                });
            }
            if (!session) {
                throw new Error('Failed to create or retrieve session');
            }
            // Log user input with enhanced audit logging
            await this.auditLoggingService.logConversationEntry({
                sessionId: session.sessionId,
                merchantId: request.merchantId,
                userId: request.userId,
                messageType: 'user_input',
                content: request.query,
                metadata: {
                    requestPayloadHash: this.hashPayload(request),
                    responseReference: '', // Will be updated after response
                },
                piiRedacted: false, // PII redaction will be handled by the service
            });
            // Parse intent and generate execution plan
            const { intent, plan } = await this.parseIntentAndPlan(request.query, {
                merchantId: request.merchantId,
                userId: request.userId,
                sessionHistory: session.conversationHistory.slice(-5),
                userContext: session.context,
            });
            // Prepare agent invocation with enhanced context
            const agentInput = {
                agentId: this.agentId,
                agentAliasId: this.agentAliasId,
                sessionId: session.sessionId,
                inputText: request.query,
                sessionState: {
                    sessionAttributes: {
                        merchant_id: request.merchantId,
                        user_id: request.userId,
                        user_context: JSON.stringify(session.context),
                        conversation_history: JSON.stringify(session.conversationHistory.slice(-5)),
                        parsed_intent: JSON.stringify(intent),
                        execution_plan: JSON.stringify(plan),
                    },
                },
            };
            // Execute coordinated plan using tool coordination service
            const coordinatedResult = await this.toolCoordinationService.executeCoordinatedPlan(plan, request.merchantId, request.userId);
            // If coordinated execution fails, fall back to Bedrock Agent
            let agentResponse;
            if (coordinatedResult.success) {
                agentResponse = this.processCoordinatedResults(coordinatedResult, intent);
            }
            else {
                console.warn('Coordinated execution failed, falling back to Bedrock Agent');
                // Invoke Bedrock Agent as fallback
                const command = new InvokeAgentCommand(agentInput);
                const response = await this.bedrockClient.send(command);
                agentResponse = await this.processAgentResponse(response);
            }
            // Update session with new message
            const userMessage = {
                id: (0, uuid_1.v4)(),
                role: 'user',
                content: request.query,
                timestamp: new Date(),
                metadata: {
                    merchantId: request.merchantId,
                    userId: request.userId,
                },
            };
            const assistantMessage = {
                id: (0, uuid_1.v4)(),
                role: 'assistant',
                content: agentResponse.response,
                timestamp: new Date(),
                metadata: {
                    sources: agentResponse.sources,
                    predictions: agentResponse.predictions,
                    reasoning: agentResponse.reasoning,
                    confidence: agentResponse.confidence,
                    latency: Date.now() - startTime,
                },
            };
            await this.sessionManager.updateSession({
                sessionId: session.sessionId,
                merchantId: request.merchantId,
                message: userMessage,
            });
            await this.sessionManager.updateSession({
                sessionId: session.sessionId,
                merchantId: request.merchantId,
                message: assistantMessage,
            });
            // Log assistant response with enhanced audit logging
            await this.auditLoggingService.logConversationEntry({
                sessionId: session.sessionId,
                merchantId: request.merchantId,
                userId: request.userId,
                messageType: 'assistant_response',
                content: agentResponse.response,
                metadata: {
                    requestPayloadHash: this.hashPayload(agentResponse),
                    responseReference: `response:${assistantMessage.id}`,
                    latency: Date.now() - startTime,
                    toolsUsed: coordinatedResult?.results?.map((r) => r.toolId) || [],
                    confidence: agentResponse.confidence,
                    intent: intent.intent,
                    sources: agentResponse.sources.map(s => ({ id: s.id, score: s.score })),
                    predictions: agentResponse.predictions?.map(p => ({ sku: p.sku, confidence: p.confidence })),
                },
                piiRedacted: false,
            });
            return {
                ...agentResponse,
                sessionId: session.sessionId,
            };
        }
        catch (error) {
            // Log error with enhanced audit logging
            await this.auditLoggingService.logConversationEntry({
                sessionId: session?.sessionId || 'unknown',
                merchantId: request.merchantId,
                userId: request.userId,
                messageType: 'system_event',
                content: `Error processing chat: ${error instanceof Error ? error.message : 'Unknown error'}`,
                metadata: {
                    requestPayloadHash: this.hashPayload(request),
                    responseReference: '',
                    errorDetails: error instanceof Error ? error.message : 'Unknown error',
                },
                piiRedacted: false,
            });
            throw new Error(`Chat processing failed: ${error}`);
        }
    }
    /**
     * Parse user intent and generate execution plan
     */
    async parseIntentAndPlan(query, context) {
        const planningContext = {
            merchantId: context.merchantId,
            userId: context.userId,
            sessionHistory: context.sessionHistory || [],
            userContext: context.userContext || {},
            availableTools: ['semanticRetrieval', 'productPrediction', 'processCheckout', 'amazonQ'],
            constraints: {
                maxLatency: 5000,
                maxCost: 0.05,
                requireGrounding: true,
            },
        };
        const intent = await this.intentParsingService.parseIntent(query, planningContext);
        const plan = await this.intentParsingService.generateExecutionPlan(intent, planningContext);
        // Validate the plan
        const validation = this.intentParsingService.validatePlan(plan, planningContext.constraints);
        if (!validation.valid) {
            console.warn('Generated plan has violations:', validation.violations);
            console.info('Suggestions:', validation.suggestions);
        }
        return { intent, plan };
    }
    /**
     * Parse user intent from query (legacy method for backward compatibility)
     */
    async parseIntent(query, context) {
        const { intent, plan } = await this.parseIntentAndPlan(query, context);
        // Convert to legacy format
        return {
            intent: intent.intent,
            actions: plan.steps.map(step => ({
                tool: step.tool,
                parameters: step.parameters,
                priority: step.priority,
            })),
            context,
        };
    }
    /**
     * Process results from coordinated tool execution
     */
    processCoordinatedResults(coordinatedResult, intent) {
        const sources = [];
        const predictions = [];
        const reasoning = [intent.reasoning];
        let responseText = '';
        // Process results from each tool
        coordinatedResult.results.forEach((result) => {
            if (!result.success) {
                reasoning.push(`Tool ${result.toolId} failed: ${result.error}`);
                return;
            }
            // Process semantic retrieval results
            if (result.toolId === 'semanticRetrieval' && result.result?.results) {
                sources.push(...result.result.results);
                reasoning.push(`Retrieved ${result.result.results.length} relevant documents`);
            }
            // Process prediction results
            if (result.toolId === 'productPrediction' && result.result) {
                predictions.push(result.result);
                reasoning.push(`Generated prediction with confidence ${result.result.confidence}`);
            }
            // Process Amazon Q results
            if (result.toolId === 'amazonQ' && result.result?.response) {
                responseText += result.result.response + ' ';
                if (result.result.sources) {
                    sources.push(...result.result.sources);
                }
                reasoning.push('Enhanced with Amazon Q knowledge');
            }
            // Process checkout results
            if (result.toolId === 'processCheckout' && result.result) {
                responseText += `Transaction processed: ${result.result.transaction_id} `;
                reasoning.push(`Checkout completed: ${result.result.status}`);
            }
        });
        // Generate response based on intent and results
        if (!responseText) {
            responseText = this.generateResponseFromResults(intent, sources, predictions);
        }
        // Calculate overall confidence
        const confidence = this.calculateOverallConfidence(coordinatedResult, intent);
        return {
            response: responseText.trim(),
            answer: responseText.trim(),
            sources,
            predictions,
            reasoning,
            confidence,
        };
    }
    /**
     * Generate response text from results
     */
    generateResponseFromResults(intent, sources, predictions) {
        let response = '';
        switch (intent.intent) {
            case 'search':
                if (sources.length > 0) {
                    response = `I found ${sources.length} relevant items for your search. `;
                    response += sources.slice(0, 3).map((source, index) => `${index + 1}. ${source.snippet}`).join(' ');
                }
                else {
                    response = "I couldn't find any items matching your search criteria.";
                }
                break;
            case 'recommend':
                if (predictions && predictions.length > 0) {
                    response = 'Based on your preferences, I recommend: ';
                    response += predictions.slice(0, 3).map((pred, index) => `${index + 1}. ${pred.sku} (${Math.round(pred.purchase_probability * 100)}% match)`).join(' ');
                }
                else if (sources.length > 0) {
                    response = 'Here are some popular items you might like: ';
                    response += sources.slice(0, 3).map((source, index) => `${index + 1}. ${source.snippet}`).join(' ');
                }
                else {
                    response = "I don't have enough information to make personalized recommendations right now.";
                }
                break;
            case 'question':
                if (sources.length > 0) {
                    response = 'Based on the available information: ';
                    response += sources[0].snippet;
                }
                else {
                    response = "I don't have specific information about that topic in our knowledge base.";
                }
                break;
            case 'purchase':
                response = "I can help you complete your purchase. Please confirm the items in your cart.";
                break;
            default:
                response = "I'm here to help! Could you please provide more details about what you're looking for?";
        }
        return response;
    }
    /**
     * Calculate overall confidence from coordinated results
     */
    calculateOverallConfidence(coordinatedResult, intent) {
        let confidence = intent.confidence;
        // Adjust based on execution success
        if (coordinatedResult.success) {
            confidence += 0.1;
        }
        else {
            confidence -= 0.2;
        }
        // Adjust based on failed steps
        if (coordinatedResult.failedSteps.length > 0) {
            confidence -= coordinatedResult.failedSteps.length * 0.1;
        }
        // Adjust based on latency (penalize slow responses)
        if (coordinatedResult.totalLatency > 3000) {
            confidence -= 0.1;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    /**
     * Process streaming response from Bedrock Agent
     */
    async processAgentResponse(response) {
        let responseText = '';
        const sources = [];
        const predictions = [];
        const reasoning = [];
        let confidence = 0.8; // Default confidence
        if (response.completion) {
            for await (const chunk of response.completion) {
                if (chunk.chunk?.bytes) {
                    const text = new TextDecoder().decode(chunk.chunk.bytes);
                    responseText += text;
                }
                // Process trace information for sources and reasoning
                if (chunk.trace) {
                    if (chunk.trace.orchestrationTrace) {
                        const trace = chunk.trace.orchestrationTrace;
                        // Extract reasoning from trace
                        if (trace.rationale?.text) {
                            reasoning.push(trace.rationale.text);
                        }
                        // Extract tool invocation results
                        if (trace.invocationInput) {
                            const toolName = trace.invocationInput.actionGroupInvocationInput?.actionGroupName;
                            const apiPath = trace.invocationInput.actionGroupInvocationInput?.apiPath;
                            if (toolName === 'MindsDBTools' && apiPath === '/semantic-retrieval') {
                                // This would be populated from actual tool response
                                // For now, we'll add placeholder logic
                            }
                        }
                        if (trace.observation?.actionGroupInvocationOutput) {
                            const output = trace.observation.actionGroupInvocationOutput.text;
                            try {
                                const parsedOutput = JSON.parse(output || '{}');
                                // Process semantic retrieval results
                                if (parsedOutput.results) {
                                    sources.push(...parsedOutput.results);
                                }
                                // Process prediction results
                                if (parsedOutput.sku) {
                                    predictions.push(parsedOutput);
                                }
                            }
                            catch (error) {
                                console.warn('Failed to parse tool output:', error);
                            }
                        }
                    }
                }
            }
        }
        return {
            response: responseText,
            answer: responseText,
            sources,
            predictions,
            reasoning,
            confidence,
        };
    }
    /**
     * Get session history
     */
    async getSessionHistory(sessionId, merchantId) {
        const session = await this.sessionManager.getSession(sessionId, merchantId);
        return session?.conversationHistory || [];
    }
    /**
     * Clear session history
     */
    async clearSession(sessionId, merchantId) {
        await this.sessionManager.deleteSession(sessionId, merchantId);
    }
    /**
     * Get session statistics
     */
    async getSessionStats(merchantId) {
        return this.sessionManager.getSessionStats(merchantId);
    }
    /**
     * Get detailed session summary with audit information
     */
    async getDetailedSessionSummary(sessionId, merchantId) {
        return this.auditLoggingService.getSessionSummary(sessionId, merchantId);
    }
    /**
     * Search conversation audit entries
     */
    async searchAuditEntries(query) {
        return this.auditLoggingService.searchConversationEntries(query);
    }
    /**
     * Generate compliance report
     */
    async generateComplianceReport(merchantId, startDate, endDate) {
        return this.auditLoggingService.generateComplianceReport(merchantId, startDate, endDate);
    }
    /**
     * Clean up old audit entries
     */
    async cleanupOldAuditEntries() {
        return this.auditLoggingService.cleanupOldEntries();
    }
    /**
     * Hash payload for audit logging
     */
    hashPayload(payload) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    /**
     * Health check for the service
     */
    async healthCheck() {
        try {
            // Test DynamoDB connection
            const testSession = await this.sessionManager.getSessionStats('health-check');
            // Test tool coordination service
            const systemHealth = this.toolCoordinationService.getSystemHealth();
            // Test Amazon Q service
            const qHealth = await this.amazonQService.healthCheck();
            const overallStatus = systemHealth.status === 'healthy' && qHealth.status === 'healthy' ?
                'healthy' : 'unhealthy';
            return {
                status: overallStatus,
                details: {
                    bedrockAgent: 'connected',
                    dynamodb: 'connected',
                    toolCoordination: systemHealth.status,
                    amazonQ: qHealth.status,
                    agentId: this.agentId,
                    toolsHealth: systemHealth.toolsHealth,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                },
            };
        }
    }
}
exports.BedrockAgentService = BedrockAgentService;
// Factory function to create BedrockAgentService with default config
function createBedrockAgentService(sessionManager, auditLogRepository) {
    const amazonQService = new AmazonQService_1.AmazonQService({
        applicationId: process.env.AMAZON_Q_APPLICATION_ID || '',
        region: config_1.config.aws.region,
        indexId: process.env.AMAZON_Q_INDEX_ID,
    });
    const intentParsingService = new IntentParsingService_1.IntentParsingService({
        bedrockRegion: config_1.config.bedrock.region,
        modelId: config_1.config.bedrock.modelId,
        amazonQService,
    });
    const toolCoordinationService = new ToolCoordinationService_1.ToolCoordinationService();
    const auditLoggingService = new AuditLoggingService_1.AuditLoggingService({
        s3BucketName: process.env.AUDIT_LOGS_BUCKET || `mindsdb-rag-audit-${process.env.AWS_ACCOUNT_ID}-${config_1.config.aws.region}`,
        kmsKeyId: process.env.AUDIT_LOGS_KMS_KEY || '',
        cloudWatchLogGroup: process.env.AUDIT_LOG_GROUP || '/aws/mindsdb-rag/conversations',
        region: config_1.config.aws.region,
        retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555', 10),
    }, auditLogRepository);
    return new BedrockAgentService({
        agentId: process.env.BEDROCK_AGENT_ID || '',
        agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID',
        region: config_1.config.bedrock.region,
        sessionManager,
        auditLogRepository,
        intentParsingService,
        amazonQService,
        toolCoordinationService,
        auditLoggingService,
    });
}
// Export singleton instance
let bedrockAgentServiceInstance = null;
const getBedrockAgentService = () => {
    if (!bedrockAgentServiceInstance) {
        const { createSessionManager } = require('./SessionManager');
        const { AuditLogRepository } = require('../repositories/AuditLogRepository');
        bedrockAgentServiceInstance = createBedrockAgentService(createSessionManager(), new AuditLogRepository());
    }
    return bedrockAgentServiceInstance;
};
exports.getBedrockAgentService = getBedrockAgentService;
//# sourceMappingURL=BedrockAgentService.js.map