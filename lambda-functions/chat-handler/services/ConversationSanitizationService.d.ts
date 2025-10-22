import { PIIRedactorService } from './PIIRedactor';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
export interface ConversationEntry {
    session_id: string;
    merchant_id: string;
    user_id: string;
    timestamp: Date;
    user_message: string;
    assistant_response: string;
    context?: Record<string, any>;
    metadata?: Record<string, any>;
    transaction_references?: string[];
}
export interface SanitizedConversationEntry {
    session_id: string;
    merchant_id: string;
    user_id: string;
    timestamp: Date;
    user_message: string;
    assistant_response: string;
    context?: Record<string, any>;
    metadata?: Record<string, any>;
    sanitization_applied: boolean;
    sanitization_summary?: {
        fields_redacted: string[];
        tokens_created: number;
        pii_patterns_found: number;
    };
    original_hash?: string;
}
export declare class ConversationSanitizationService {
    private piiRedactor;
    private auditLogRepository;
    constructor(piiRedactor: PIIRedactorService, auditLogRepository: AuditLogRepository);
    /**
     * Sanitize conversation entry before persistence
     */
    sanitizeConversationEntry(conversation: ConversationEntry): Promise<SanitizedConversationEntry>;
    /**
     * Sanitize transaction references in assistant responses
     */
    private sanitizeTransactionReferences;
    /**
     * Ensure payment tokens never appear in conversation logs
     */
    validateNoPaymentTokens(conversationData: Record<string, any>): Promise<{
        is_clean: boolean;
        violations: string[];
        sanitized_data?: Record<string, any>;
    }>;
    /**
     * Remove payment tokens from conversation data
     */
    private removePaymentTokens;
    /**
     * Create fallback sanitized entry when sanitization fails
     */
    private createFallbackSanitizedEntry;
    /**
     * Hash conversation for audit trail
     */
    private hashConversation;
    /**
     * Batch sanitize multiple conversation entries
     */
    batchSanitizeConversations(conversations: ConversationEntry[]): Promise<{
        sanitized: SanitizedConversationEntry[];
        errors: Array<{
            index: number;
            error: string;
        }>;
    }>;
}
//# sourceMappingURL=ConversationSanitizationService.d.ts.map