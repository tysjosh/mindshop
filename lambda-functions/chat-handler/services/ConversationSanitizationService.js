"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationSanitizationService = void 0;
class ConversationSanitizationService {
    constructor(piiRedactor, auditLogRepository) {
        this.piiRedactor = piiRedactor;
        this.auditLogRepository = auditLogRepository;
    }
    /**
     * Sanitize conversation entry before persistence
     */
    async sanitizeConversationEntry(conversation) {
        console.log(`Sanitizing conversation entry for session ${conversation.session_id}`);
        try {
            // Create hash of original conversation for audit trail
            const originalHash = this.hashConversation(conversation);
            // Check if conversation contains transaction-related PII
            const hasTransactionRefs = conversation.transaction_references &&
                conversation.transaction_references.length > 0;
            // Sanitize the conversation data
            const sanitizationResult = await this.piiRedactor.sanitizeConversationLog({
                user_message: conversation.user_message,
                assistant_response: conversation.assistant_response,
                context: conversation.context,
                metadata: conversation.metadata,
            }, conversation.merchant_id);
            // Additional sanitization for transaction-related conversations
            let sanitizedResponse = sanitizationResult.sanitized_conversation.assistant_response;
            if (hasTransactionRefs) {
                sanitizedResponse = await this.sanitizeTransactionReferences(sanitizedResponse, conversation.transaction_references, conversation.merchant_id);
            }
            // Log sanitization activity
            if (sanitizationResult.redaction_summary.fields_redacted.length > 0) {
                await this.auditLogRepository.create({
                    merchantId: conversation.merchant_id,
                    userId: conversation.user_id,
                    sessionId: conversation.session_id,
                    operation: 'conversation_sanitization',
                    requestPayloadHash: originalHash,
                    responseReference: `sanitized:${conversation.session_id}:${conversation.timestamp.getTime()}`,
                    outcome: 'success',
                    actor: 'system',
                });
            }
            const sanitizedEntry = {
                session_id: conversation.session_id,
                merchant_id: conversation.merchant_id,
                user_id: conversation.user_id,
                timestamp: conversation.timestamp,
                user_message: sanitizationResult.sanitized_conversation.user_message,
                assistant_response: sanitizedResponse,
                context: sanitizationResult.sanitized_conversation.context,
                metadata: {
                    ...sanitizationResult.sanitized_conversation.metadata,
                    sanitization_timestamp: new Date().toISOString(),
                },
                sanitization_applied: sanitizationResult.redaction_summary.fields_redacted.length > 0,
                sanitization_summary: sanitizationResult.redaction_summary,
                original_hash: originalHash,
            };
            console.log(`Conversation sanitization completed for session ${conversation.session_id}:`, {
                fields_redacted: sanitizationResult.redaction_summary.fields_redacted.length,
                pii_patterns_found: sanitizationResult.redaction_summary.pii_patterns_found,
            });
            return sanitizedEntry;
        }
        catch (error) {
            console.error(`Failed to sanitize conversation for session ${conversation.session_id}:`, error);
            // Log sanitization failure
            await this.auditLogRepository.create({
                merchantId: conversation.merchant_id,
                userId: conversation.user_id,
                sessionId: conversation.session_id,
                operation: 'conversation_sanitization_failed',
                requestPayloadHash: this.hashConversation(conversation),
                responseReference: `error:sanitization:${conversation.session_id}`,
                outcome: 'failure',
                reason: error instanceof Error ? error.message : 'Unknown error',
                actor: 'system',
            });
            // Return heavily redacted version as fallback
            return this.createFallbackSanitizedEntry(conversation);
        }
    }
    /**
     * Sanitize transaction references in assistant responses
     */
    async sanitizeTransactionReferences(response, transactionRefs, merchantId) {
        let sanitizedResponse = response;
        for (const transactionRef of transactionRefs) {
            try {
                // Create secure token for transaction reference
                const token = await this.piiRedactor.createSecureToken(transactionRef, 'payment', merchantId, undefined, 72 // Transaction references expire in 72 hours
                );
                // Replace transaction reference with token in response
                const transactionPattern = new RegExp(transactionRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                sanitizedResponse = sanitizedResponse.replace(transactionPattern, `[TRANSACTION_REF:${token}]`);
            }
            catch (error) {
                console.error(`Failed to tokenize transaction reference ${transactionRef}:`, error);
                // Fallback to generic redaction
                const transactionPattern = new RegExp(transactionRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                sanitizedResponse = sanitizedResponse.replace(transactionPattern, '[TRANSACTION_REF:REDACTED]');
            }
        }
        return sanitizedResponse;
    }
    /**
     * Ensure payment tokens never appear in conversation logs
     */
    async validateNoPaymentTokens(conversationData) {
        const violations = [];
        const paymentTokenPatterns = [
            /\b(?:tok_|card_|pm_|pi_|src_)[a-zA-Z0-9]{10,}\b/g, // Stripe tokens
            /\b(?:adyen_)[a-zA-Z0-9]{10,}\b/g, // Adyen tokens
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
            /\b\d{3,4}\b/g, // CVV codes (when in payment context)
        ];
        const checkForTokens = (obj, path = '') => {
            if (typeof obj === 'string') {
                for (const pattern of paymentTokenPatterns) {
                    const matches = obj.match(pattern);
                    if (matches) {
                        violations.push(`Payment token found at ${path}: ${matches.length} matches`);
                    }
                }
            }
            else if (typeof obj === 'object' && obj !== null) {
                for (const [key, value] of Object.entries(obj)) {
                    checkForTokens(value, path ? `${path}.${key}` : key);
                }
            }
        };
        checkForTokens(conversationData);
        if (violations.length > 0) {
            console.warn('Payment tokens detected in conversation data:', violations);
            // Sanitize the data by removing payment tokens
            const sanitizedData = await this.removePaymentTokens(conversationData);
            return {
                is_clean: false,
                violations,
                sanitized_data: sanitizedData,
            };
        }
        return {
            is_clean: true,
            violations: [],
        };
    }
    /**
     * Remove payment tokens from conversation data
     */
    async removePaymentTokens(data) {
        const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
        const sanitizeValue = (obj) => {
            if (typeof obj === 'string') {
                // Replace payment tokens with redacted placeholders
                return obj
                    .replace(/\b(?:tok_|card_|pm_|pi_|src_)[a-zA-Z0-9]{10,}\b/g, '[PAYMENT_TOKEN_REDACTED]')
                    .replace(/\b(?:adyen_)[a-zA-Z0-9]{10,}\b/g, '[PAYMENT_TOKEN_REDACTED]')
                    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER_REDACTED]')
                    .replace(/\b\d{3,4}\b/g, '[CVV_REDACTED]');
            }
            else if (typeof obj === 'object' && obj !== null) {
                const result = Array.isArray(obj) ? [] : {};
                for (const [key, value] of Object.entries(obj)) {
                    result[key] = sanitizeValue(value);
                }
                return result;
            }
            return obj;
        };
        return sanitizeValue(sanitized);
    }
    /**
     * Create fallback sanitized entry when sanitization fails
     */
    createFallbackSanitizedEntry(conversation) {
        return {
            session_id: conversation.session_id,
            merchant_id: conversation.merchant_id,
            user_id: conversation.user_id,
            timestamp: conversation.timestamp,
            user_message: '[REDACTED - SANITIZATION_FAILED]',
            assistant_response: '[REDACTED - SANITIZATION_FAILED]',
            context: { redacted: true, reason: 'sanitization_failure' },
            metadata: {
                sanitization_failed: true,
                sanitization_timestamp: new Date().toISOString(),
            },
            sanitization_applied: true,
            sanitization_summary: {
                fields_redacted: ['user_message', 'assistant_response', 'context'],
                tokens_created: 0,
                pii_patterns_found: 0,
            },
            original_hash: this.hashConversation(conversation),
        };
    }
    /**
     * Hash conversation for audit trail
     */
    hashConversation(conversation) {
        const crypto = require('crypto');
        const hashData = {
            session_id: conversation.session_id,
            timestamp: conversation.timestamp.toISOString(),
            user_message_length: conversation.user_message.length,
            assistant_response_length: conversation.assistant_response.length,
        };
        return crypto.createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
    }
    /**
     * Batch sanitize multiple conversation entries
     */
    async batchSanitizeConversations(conversations) {
        console.log(`Batch sanitizing ${conversations.length} conversation entries`);
        const sanitized = [];
        const errors = [];
        for (let i = 0; i < conversations.length; i++) {
            try {
                const sanitizedEntry = await this.sanitizeConversationEntry(conversations[i]);
                sanitized.push(sanitizedEntry);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ index: i, error: errorMessage });
                // Add fallback sanitized entry
                sanitized.push(this.createFallbackSanitizedEntry(conversations[i]));
            }
        }
        console.log(`Batch sanitization completed: ${sanitized.length} processed, ${errors.length} errors`);
        return { sanitized, errors };
    }
}
exports.ConversationSanitizationService = ConversationSanitizationService;
//# sourceMappingURL=ConversationSanitizationService.js.map