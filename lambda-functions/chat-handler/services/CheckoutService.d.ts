import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { PIIRedactor } from './PIIRedactor';
export interface CheckoutItem {
    sku: string;
    quantity: number;
    price: number;
    name: string;
    description?: string;
}
export interface CheckoutRequest {
    merchant_id: string;
    user_id: string;
    session_id: string;
    items: CheckoutItem[];
    payment_method: 'stripe' | 'adyen' | 'default';
    shipping_address: {
        name: string;
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    };
    billing_address?: {
        name: string;
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    };
    user_consent: {
        terms_accepted: boolean;
        privacy_accepted: boolean;
        marketing_consent?: boolean;
        consent_timestamp: string;
    };
}
export interface CheckoutResponse {
    transaction_id: string;
    status: 'pending' | 'confirmed' | 'failed' | 'requires_action';
    total_amount: number;
    currency: string;
    items: Array<{
        sku: string;
        quantity: number;
        price: number;
        subtotal: number;
        name: string;
    }>;
    payment_confirmation?: string;
    payment_intent_id?: string;
    client_secret?: string;
    estimated_delivery?: string;
    order_reference?: string;
    error_message?: string;
    created_at?: string;
}
export interface PaymentGatewayConfig {
    stripe?: {
        secret_key: string;
        webhook_secret: string;
    };
    adyen?: {
        api_key: string;
        merchant_account: string;
        environment: 'test' | 'live';
    };
}
export interface TransactionRecord {
    transaction_id: string;
    merchant_id: string;
    user_id: string;
    session_id: string;
    status: string;
    total_amount: number;
    currency: string;
    payment_method: string;
    payment_intent_id?: string;
    order_reference?: string;
    created_at: Date;
    updated_at: Date;
    metadata: Record<string, any>;
}
export declare class CheckoutService {
    private sns;
    private sqs;
    private secretsManager;
    private auditLogRepository;
    private transactionRepository;
    private piiRedactor;
    private compensationService;
    private orderManagementService;
    private paymentConfigs;
    constructor(auditLogRepository: AuditLogRepository, piiRedactor: PIIRedactor, transactionRepository?: TransactionRepository);
    /**
     * Process checkout request with payment gateway integration
     */
    processCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
    /**
     * Validate user consent requirements
     */
    private validateUserConsent;
    /**
     * Sanitize checkout request to remove PII before processing
     */
    private sanitizeCheckoutRequest;
    /**
     * Calculate order totals and validate items
     */
    private calculateTotals;
    /**
     * Get payment gateway configuration from AWS Secrets Manager
     */
    private getPaymentGatewayConfig;
    /**
     * Process payment through appropriate gateway
     */
    private processPaymentGateway;
    /**
     * Process Stripe payment
     */
    private processStripePayment;
    /**
     * Process Adyen payment
     */
    private processAdyenPayment;
    /**
     * Process default payment method
     */
    private processDefaultPayment;
    /**
     * Publish order processing events to SNS/SQS
     */
    private publishOrderEvents;
    /**
     * Calculate estimated delivery date
     */
    private calculateEstimatedDelivery;
    /**
     * Hash payload for audit logging
     */
    private hashPayload;
    /**
     * Get transaction status
     */
    getTransactionStatus(transactionId: string, merchantId: string): Promise<{
        transaction_id: string;
        status: string;
        order_reference?: string;
        payment_confirmation?: string;
        created_at?: string;
        updated_at?: string;
    }>;
    /**
     * Cancel transaction with compensation
     */
    cancelTransaction(transactionId: string, merchantId: string, reason: string): Promise<{
        transaction_id: string;
        status: string;
        refund_status: string;
        cancellation_reason: string;
    }>;
    /**
     * Publish cancellation events for compensation workflows
     */
    private publishCancellationEvents;
}
//# sourceMappingURL=CheckoutService.d.ts.map