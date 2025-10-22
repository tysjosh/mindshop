import { TransactionRepository, OrderConfirmation, TransactionState } from '../repositories/TransactionRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
export interface OrderReceiptData {
    order_id: string;
    order_reference: string;
    transaction_id: string;
    merchant_info: {
        name: string;
        logo_url?: string;
        address?: string;
        contact_info?: string;
        tax_id?: string;
    };
    customer_info: {
        name: string;
        email?: string;
        shipping_address: Record<string, any>;
        billing_address?: Record<string, any>;
    };
    items: Array<{
        sku: string;
        name: string;
        quantity: number;
        unit_price: number;
        subtotal: number;
    }>;
    pricing: {
        subtotal: number;
        tax_amount?: number;
        shipping_amount?: number;
        discount_amount?: number;
        total_amount: number;
        currency: string;
    };
    payment_info: {
        payment_method: string;
        payment_confirmation: string;
        payment_date: Date;
    };
    order_dates: {
        order_date: Date;
        estimated_delivery?: Date;
        shipped_date?: Date;
        delivered_date?: Date;
    };
    tracking_info?: {
        tracking_number?: string;
        carrier?: string;
        tracking_url?: string;
    };
}
export interface MerchantBranding {
    merchant_id: string;
    brand_name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    header_text?: string;
    footer_text?: string;
    contact_info?: {
        email?: string;
        phone?: string;
        address?: string;
        website?: string;
    };
    tax_info?: {
        tax_id?: string;
        tax_name?: string;
    };
}
export declare class OrderManagementService {
    private s3;
    private transactionRepository;
    private auditLogRepository;
    private merchantBrandings;
    constructor(transactionRepository: TransactionRepository, auditLogRepository: AuditLogRepository);
    /**
     * Create order confirmation from successful transaction
     */
    createOrderConfirmation(transaction: TransactionState, customerInfo: {
        name: string;
        email?: string;
    }): Promise<OrderConfirmation>;
    /**
     * Generate receipt PDF and upload to S3
     */
    generateReceipt(order: OrderConfirmation, customerInfo: {
        name: string;
        email?: string;
    }, branding?: MerchantBranding): Promise<{
        receipt_url: string;
        receipt_data: Record<string, any>;
    }>;
    /**
     * Generate receipt HTML with merchant branding
     */
    private generateReceiptHTML;
    /**
     * Update order status (e.g., shipped, delivered)
     */
    updateOrderStatus(orderId: string, merchantId: string, status: OrderConfirmation['status'], trackingInfo?: {
        tracking_number?: string;
        carrier?: string;
        shipped_date?: Date;
        delivered_date?: Date;
    }): Promise<OrderConfirmation | null>;
    /**
     * Get merchant branding configuration
     */
    private getMerchantBranding;
    /**
     * Calculate estimated delivery date
     */
    private calculateEstimatedDelivery;
    /**
     * Hash payload for audit logging
     */
    private hashPayload;
}
//# sourceMappingURL=OrderManagementService.d.ts.map