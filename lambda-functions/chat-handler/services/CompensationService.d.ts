import { TransactionRepository } from '../repositories/TransactionRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
export interface CompensationConfig {
    max_retries: number;
    retry_delay_ms: number;
    timeout_ms: number;
}
export interface InventoryReservation {
    reservation_id: string;
    merchant_id: string;
    items: Array<{
        sku: string;
        quantity: number;
        reserved_until: Date;
    }>;
    status: 'active' | 'released' | 'expired';
}
export interface PaymentRefund {
    refund_id: string;
    transaction_id: string;
    payment_intent_id: string;
    amount: number;
    currency: string;
    reason: string;
    status: 'pending' | 'completed' | 'failed';
}
export declare class CompensationService {
    private sns;
    private sqs;
    private transactionRepository;
    private auditLogRepository;
    private config;
    constructor(transactionRepository: TransactionRepository, auditLogRepository: AuditLogRepository, config?: CompensationConfig);
    /**
     * Execute compensation workflow for failed transaction
     */
    executeCompensation(transactionId: string, merchantId: string, failureReason: string): Promise<{
        success: boolean;
        actions_executed: string[];
        errors: string[];
    }>;
    /**
     * Execute individual compensation action
     */
    private executeCompensationAction;
    /**
     * Release inventory reservations
     */
    private releaseInventory;
    /**
     * Process payment refund
     */
    private processRefund;
    /**
     * Cancel order and update order management system
     */
    private cancelOrder;
    /**
     * Send notifications to customer and merchant
     */
    private sendNotifications;
    /**
     * Retry failed compensation actions
     */
    retryFailedCompensations(merchantId?: string): Promise<{
        retried: number;
        succeeded: number;
        failed: number;
    }>;
    /**
     * Hash payload for audit logging
     */
    private hashPayload;
}
//# sourceMappingURL=CompensationService.d.ts.map