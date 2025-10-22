import { RedactedQuery, TokenizedContext, UserContext } from '../types';
export interface PIIRedactor {
    redactQuery(query: string): RedactedQuery;
    tokenizeUserData(userData: UserContext): TokenizedContext;
    sanitizeResponse(response: string): string;
}
export interface SecureToken {
    token_id: string;
    encrypted_value: string;
    data_type: 'payment' | 'personal' | 'address' | 'contact';
    created_at: Date;
    expires_at?: Date;
    merchant_id: string;
    user_id?: string;
}
export interface TokenMapping {
    token_id: string;
    original_field: string;
    token_value: string;
    data_classification: 'sensitive' | 'pii' | 'payment' | 'confidential';
}
export declare class PIIRedactorService implements PIIRedactor {
    private kms;
    private dynamodb;
    private kmsKeyId;
    private tokenTableName;
    private encryptionService;
    private readonly piiPatterns;
    private readonly sensitiveFields;
    private readonly paymentFields;
    constructor();
    redactQuery(query: string): RedactedQuery;
    tokenizeUserData(userData: UserContext): TokenizedContext;
    sanitizeResponse(response: string): string;
    redactText(text: string): Promise<RedactedQuery>;
    detokenize(tokenizedText: string, tokenMap: Map<string, string>): string;
    /**
     * Tokenize address information for secure processing
     */
    tokenizeAddress(address: {
        name: string;
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    }): Promise<{
        name: string;
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    }>;
    /**
     * Create secure token using KMS encryption
     */
    createSecureToken(value: string, dataType: SecureToken['data_type'], merchantId: string, userId?: string, expiresInHours?: number): Promise<string>;
    /**
     * Retrieve original value from secure token
     */
    retrieveFromToken(tokenId: string, merchantId: string): Promise<string | null>;
    /**
     * Tokenize payment information securely
     */
    tokenizePaymentData(paymentData: {
        card_number?: string;
        cvv?: string;
        expiry_date?: string;
        payment_method_id?: string;
        billing_address?: Record<string, any>;
    }, merchantId: string, userId?: string): Promise<{
        tokenized_data: Record<string, string>;
        token_mappings: TokenMapping[];
    }>;
    /**
     * Sanitize conversation logs before persistence
     */
    sanitizeConversationLog(conversationData: {
        user_message: string;
        assistant_response: string;
        context?: Record<string, any>;
        metadata?: Record<string, any>;
    }, merchantId: string): Promise<{
        sanitized_conversation: Record<string, any>;
        redaction_summary: {
            fields_redacted: string[];
            tokens_created: number;
            pii_patterns_found: number;
        };
    }>;
    /**
     * Sanitize arbitrary object by removing/tokenizing sensitive fields
     */
    private sanitizeObject;
    /**
     * Store token mapping in DynamoDB
     */
    private storeTokenMapping;
    /**
     * Get token mapping from DynamoDB
     */
    private getTokenMapping;
    /**
     * Delete expired token mapping
     */
    private deleteTokenMapping;
    /**
     * Clean up expired tokens (should be run periodically)
     */
    cleanupExpiredTokens(merchantId?: string): Promise<number>;
}
export declare const getPIIRedactor: () => PIIRedactorService;
export declare const PIIRedactorClass: typeof PIIRedactorService;
//# sourceMappingURL=PIIRedactor.d.ts.map