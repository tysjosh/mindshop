"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmazonQService = void 0;
exports.createAmazonQService = createAmazonQService;
// Use stub types for development - replace with actual imports when AWS SDK is available
let QBusinessClient, ChatSyncCommand, GetApplicationCommand;
try {
    const qbusiness = require("@aws-sdk/client-qbusiness");
    QBusinessClient = qbusiness.QBusinessClient;
    ChatSyncCommand = qbusiness.ChatSyncCommand;
    GetApplicationCommand = qbusiness.GetApplicationCommand;
}
catch {
    // Use stubs for type checking
    QBusinessClient = class {
        async send() {
            return {};
        }
    };
    ChatSyncCommand = class {
        constructor() { }
    };
    GetApplicationCommand = class {
        constructor() { }
    };
}
const config_1 = require("../config");
class AmazonQService {
    constructor(config) {
        this.qClient = new QBusinessClient({ region: config.region });
        this.applicationId = config.applicationId;
        this.indexId = config.indexId;
    }
    /**
     * Chat with Amazon Q for additional retrieval and grounding
     */
    async chat(request) {
        try {
            const command = new ChatSyncCommand({
                applicationId: this.applicationId,
                userMessage: request.query,
                conversationId: request.conversationId,
                userId: request.userId,
                userGroups: [request.merchantId], // Use merchant ID for access control
                clientToken: this.generateClientToken(),
                chatMode: "RETRIEVAL_MODE", // Focus on retrieval rather than generation
                chatModeConfiguration: {
                    pluginConfiguration: {
                        pluginId: this.indexId,
                    },
                },
            });
            const response = await this.qClient.send(command);
            // Process response
            const sources = this.extractSources(response.sourceAttributions || []);
            return {
                response: response.systemMessage || "",
                conversationId: response.conversationId ||
                    request.conversationId ||
                    this.generateConversationId(),
                sources,
                confidence: this.calculateConfidence(response, sources),
                systemMessage: response.systemMessage,
            };
        }
        catch (error) {
            console.error("Amazon Q chat error:", error);
            throw new Error(`Amazon Q chat failed: ${error}`);
        }
    }
    /**
     * Use Amazon Q for grounding validation
     */
    async validateGrounding(claim, sources, merchantId) {
        try {
            // Create a grounding validation query
            const groundingQuery = `
        Based on the following sources, validate if this claim is accurate: "${claim}"
        
        Sources:
        ${sources.map((source, index) => `${index + 1}. ${source.content}`).join("\n")}
        
        Respond with: GROUNDED or NOT_GROUNDED followed by explanation.
      `;
            const response = await this.chat({
                query: groundingQuery,
                userId: "system",
                merchantId,
                context: { type: "grounding_validation" },
            });
            const isGrounded = response.response.toLowerCase().includes("grounded") &&
                !response.response.toLowerCase().includes("not_grounded");
            return {
                isGrounded,
                confidence: response.confidence,
                sources: response.sources.map((s) => ({
                    id: s.id,
                    title: s.title,
                    snippet: s.snippet,
                    relevanceScore: s.score,
                })),
                explanation: response.response,
            };
        }
        catch (error) {
            console.error("Grounding validation error:", error);
            // Return conservative result on error
            return {
                isGrounded: false,
                confidence: 0.1,
                sources: [],
                explanation: `Grounding validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }
    /**
     * Get additional context from Amazon Q
     */
    async getAdditionalContext(query, merchantId, contextType) {
        try {
            // Enhance query based on context type
            const enhancedQuery = this.enhanceQueryForContext(query, contextType);
            const response = await this.chat({
                query: enhancedQuery,
                userId: "system",
                merchantId,
                context: { type: contextType },
            });
            return {
                context: response.response,
                sources: response.sources,
                relevance: response.confidence,
            };
        }
        catch (error) {
            console.error("Additional context retrieval error:", error);
            return {
                context: "",
                sources: [],
                relevance: 0,
            };
        }
    }
    /**
     * Check Amazon Q application health
     */
    async healthCheck() {
        try {
            const command = new GetApplicationCommand({
                applicationId: this.applicationId,
            });
            const response = await this.qClient.send(command);
            return {
                status: "healthy",
                details: {
                    applicationId: this.applicationId,
                    applicationStatus: response.status,
                    displayName: response.displayName,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            return {
                status: "unhealthy",
                details: {
                    error: error instanceof Error ? error.message : "Unknown error",
                    applicationId: this.applicationId,
                    timestamp: new Date().toISOString(),
                },
            };
        }
    }
    /**
     * Extract sources from Amazon Q response
     */
    extractSources(sourceAttributions) {
        return sourceAttributions.map((attribution, index) => ({
            id: attribution.citationNumber?.toString() || index.toString(),
            title: attribution.title || "Untitled",
            snippet: attribution.snippet || "",
            uri: attribution.url,
            score: attribution.score || 0.5,
        }));
    }
    /**
     * Calculate confidence based on response quality
     */
    calculateConfidence(response, sources) {
        let confidence = 0.5; // Base confidence
        // Increase confidence based on number of sources
        if (sources.length > 0) {
            confidence += Math.min(sources.length * 0.1, 0.3);
        }
        // Increase confidence based on source scores
        if (sources.length > 0) {
            const avgSourceScore = sources.reduce((sum, source) => sum + source.score, 0) / sources.length;
            confidence += avgSourceScore * 0.2;
        }
        // Decrease confidence if response is very short
        if (response.systemMessage && response.systemMessage.length < 50) {
            confidence -= 0.2;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    /**
     * Enhance query based on context type
     */
    enhanceQueryForContext(query, contextType) {
        const contextPrefixes = {
            product_info: "Find detailed product information about: ",
            policy: "What are the policies regarding: ",
            faq: "Find frequently asked questions about: ",
            general: "Provide comprehensive information about: ",
        };
        return contextPrefixes[contextType] + query;
    }
    /**
     * Generate client token for request tracking
     */
    generateClientToken() {
        return `qt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate conversation ID
     */
    generateConversationId() {
        return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AmazonQService = AmazonQService;
// Factory function to create AmazonQService with default config
function createAmazonQService() {
    return new AmazonQService({
        applicationId: process.env.AMAZON_Q_APPLICATION_ID || "",
        region: config_1.config.aws.region,
        indexId: process.env.AMAZON_Q_INDEX_ID,
    });
}
//# sourceMappingURL=AmazonQService.js.map