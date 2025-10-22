export interface InvokeAgentCommandInput {
    agentId: string;
    agentAliasId: string;
    sessionId: string;
    inputText: string;
    sessionState?: any;
}
import { SessionManager } from './SessionManager';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { IntentParsingService, ParsedIntent, ExecutionPlan } from './IntentParsingService';
import { AmazonQService } from './AmazonQService';
import { ToolCoordinationService } from './ToolCoordinationService';
import { AuditLoggingService } from './AuditLoggingService';
import { Message } from '../types';
export interface BedrockAgentConfig {
    agentId: string;
    agentAliasId: string;
    region: string;
    sessionManager: SessionManager;
    auditLogRepository: AuditLogRepository;
    intentParsingService: IntentParsingService;
    amazonQService: AmazonQService;
    toolCoordinationService: ToolCoordinationService;
    auditLoggingService: AuditLoggingService;
}
export interface ChatRequest {
    query: string;
    merchantId: string;
    userId: string;
    sessionId?: string;
    userContext?: Record<string, any>;
    ragResults?: any;
}
export interface ChatResponse {
    response: string;
    answer: string;
    sessionId: string;
    sources: Array<{
        id: string;
        snippet: string;
        score: number;
        metadata: Record<string, any>;
    }>;
    predictions?: Array<{
        sku: string;
        demand_score: number;
        purchase_probability: number;
        explanation: string;
        feature_importance: Record<string, number>;
        confidence: number;
    }>;
    reasoning: string[];
    confidence: number;
}
export interface IntentPlan {
    intent: 'search' | 'recommend' | 'purchase' | 'question';
    actions: Array<{
        tool: string;
        parameters: Record<string, any>;
        priority: number;
    }>;
    context: Record<string, any>;
}
export declare class BedrockAgentService {
    private bedrockClient;
    private agentId;
    private agentAliasId;
    private sessionManager;
    private auditLogRepository;
    private intentParsingService;
    private amazonQService;
    private toolCoordinationService;
    private auditLoggingService;
    constructor(config: BedrockAgentConfig);
    /**
     * Process a chat request using Bedrock Agent orchestration
     */
    processChat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * Parse user intent and generate execution plan
     */
    parseIntentAndPlan(query: string, context: Record<string, any>): Promise<{
        intent: ParsedIntent;
        plan: ExecutionPlan;
    }>;
    /**
     * Parse user intent from query (legacy method for backward compatibility)
     */
    parseIntent(query: string, context: Record<string, any>): Promise<IntentPlan>;
    /**
     * Process results from coordinated tool execution
     */
    private processCoordinatedResults;
    /**
     * Generate response text from results
     */
    private generateResponseFromResults;
    /**
     * Calculate overall confidence from coordinated results
     */
    private calculateOverallConfidence;
    /**
     * Process streaming response from Bedrock Agent
     */
    private processAgentResponse;
    /**
     * Get session history
     */
    getSessionHistory(sessionId: string, merchantId: string): Promise<Message[]>;
    /**
     * Clear session history
     */
    clearSession(sessionId: string, merchantId: string): Promise<void>;
    /**
     * Get session statistics
     */
    getSessionStats(merchantId: string): Promise<{
        totalSessions: number;
        activeSessions: number;
        avgSessionDuration: number;
    }>;
    /**
     * Get detailed session summary with audit information
     */
    getDetailedSessionSummary(sessionId: string, merchantId: string): Promise<{
        sessionId: string;
        merchantId: string;
        userId: string;
        startTime: Date;
        endTime: Date;
        messageCount: number;
        userMessages: number;
        assistantMessages: number;
        systemEvents: number;
        avgResponseTime: number;
        toolsUsed: string[];
        intents: string[];
        errorCount: number;
    }>;
    /**
     * Search conversation audit entries
     */
    searchAuditEntries(query: {
        merchantId: string;
        userId?: string;
        sessionId?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<import("./AuditLoggingService").AuditSearchResult>;
    /**
     * Generate compliance report
     */
    generateComplianceReport(merchantId: string, startDate: Date, endDate: Date): Promise<{
        merchantId: string;
        reportPeriod: {
            start: Date;
            end: Date;
        };
        totalConversations: number;
        totalMessages: number;
        piiRedactionRate: number;
        encryptionRate: number;
        errorRate: number;
        avgResponseTime: number;
        dataRetentionCompliance: boolean;
        auditTrailIntegrity: boolean;
    }>;
    /**
     * Clean up old audit entries
     */
    cleanupOldAuditEntries(): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
    /**
     * Hash payload for audit logging
     */
    private hashPayload;
    /**
     * Health check for the service
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
}
export declare function createBedrockAgentService(sessionManager: SessionManager, auditLogRepository: AuditLogRepository): BedrockAgentService;
export declare const getBedrockAgentService: () => BedrockAgentService;
//# sourceMappingURL=BedrockAgentService.d.ts.map