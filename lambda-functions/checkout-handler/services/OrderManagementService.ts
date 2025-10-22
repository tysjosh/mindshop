import { S3 } from 'aws-sdk';
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

export class OrderManagementService {
  private s3: S3;
  private transactionRepository: TransactionRepository;
  private auditLogRepository: AuditLogRepository;
  private merchantBrandings: Map<string, MerchantBranding> = new Map();

  constructor(
    transactionRepository: TransactionRepository,
    auditLogRepository: AuditLogRepository
  ) {
    this.s3 = new S3({ region: process.env.AWS_REGION || 'us-east-1' });
    this.transactionRepository = transactionRepository;
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Create order confirmation from successful transaction
   */
  async createOrderConfirmation(
    transaction: TransactionState,
    customerInfo: {
      name: string;
      email?: string;
    }
  ): Promise<OrderConfirmation> {
    console.log(`Creating order confirmation for transaction ${transaction.transaction_id}`);

    try {
      // Get merchant branding
      const branding = await this.getMerchantBranding(transaction.merchant_id);

      // Extract items from transaction metadata
      const items = transaction.metadata.items || [];

      // Create order confirmation
      const orderConfirmation = await this.transactionRepository.createOrderConfirmation({
        transaction_id: transaction.transaction_id,
        merchant_id: transaction.merchant_id,
        user_id: transaction.user_id,
        order_reference: transaction.order_reference || `ORD-${transaction.merchant_id}-${Date.now()}`,
        status: 'confirmed',
        items: items.map((item: any) => ({
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        })),
        total_amount: transaction.total_amount,
        currency: transaction.currency,
        shipping_address: transaction.metadata.shipping_address,
        billing_address: transaction.metadata.billing_address,
        payment_confirmation: transaction.payment_confirmation || '',
        estimated_delivery: this.calculateEstimatedDelivery(),
        merchant_branding: {
          logo_url: branding?.logo_url,
          brand_name: branding?.brand_name || transaction.merchant_id,
          brand_colors: {
            primary: branding?.primary_color || '#007bff',
            secondary: branding?.secondary_color || '#6c757d',
          },
        },
      });

      // Generate receipt
      const receipt = await this.generateReceipt(orderConfirmation, customerInfo, branding || undefined);
      
      // Update order with receipt URL
      await this.transactionRepository.updateOrderStatus(
        orderConfirmation.order_id,
        transaction.merchant_id,
        'confirmed',
        {
          receipt_url: receipt.receipt_url,
          receipt_generated_at: new Date().toISOString(),
        }
      );

      // Log order creation
      await this.auditLogRepository.create({
        merchantId: transaction.merchant_id,
        userId: transaction.user_id,
        sessionId: transaction.session_id,
        operation: 'order_created',
        requestPayloadHash: this.hashPayload({
          transaction_id: transaction.transaction_id,
          order_reference: orderConfirmation.order_reference,
        }),
        responseReference: `order:${orderConfirmation.order_id}`,
        outcome: 'success',
        actor: 'system',
      });

      console.log(`Order confirmation created: ${orderConfirmation.order_reference}`);
      return orderConfirmation;

    } catch (error) {
      console.error(`Failed to create order confirmation for transaction ${transaction.transaction_id}:`, error);

      // Log failure
      await this.auditLogRepository.create({
        merchantId: transaction.merchant_id,
        userId: transaction.user_id,
        sessionId: transaction.session_id,
        operation: 'order_creation_failed',
        requestPayloadHash: this.hashPayload({ transaction_id: transaction.transaction_id }),
        responseReference: `error:order_creation:${transaction.transaction_id}`,
        outcome: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
        actor: 'system',
      });

      throw error;
    }
  }

  /**
   * Generate receipt PDF and upload to S3
   */
  async generateReceipt(
    order: OrderConfirmation,
    customerInfo: { name: string; email?: string },
    branding?: MerchantBranding
  ): Promise<{ receipt_url: string; receipt_data: Record<string, any> }> {
    console.log(`Generating receipt for order ${order.order_reference}`);

    try {
      // Prepare receipt data
      const receiptData: OrderReceiptData = {
        order_id: order.order_id,
        order_reference: order.order_reference,
        transaction_id: order.transaction_id,
        merchant_info: {
          name: branding?.brand_name || order.merchant_id,
          logo_url: branding?.logo_url,
          address: branding?.contact_info?.address,
          contact_info: branding?.contact_info?.email || branding?.contact_info?.phone,
          tax_id: branding?.tax_info?.tax_id,
        },
        customer_info: {
          name: customerInfo.name,
          email: customerInfo.email,
          shipping_address: order.shipping_address,
          billing_address: order.billing_address,
        },
        items: order.items.map(item => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.quantity * item.price,
        })),
        pricing: {
          subtotal: order.total_amount,
          tax_amount: 0, // Would be calculated based on merchant tax settings
          shipping_amount: 0, // Would be calculated based on shipping method
          discount_amount: 0, // Would be calculated based on applied discounts
          total_amount: order.total_amount,
          currency: order.currency,
        },
        payment_info: {
          payment_method: 'Card', // Would be extracted from transaction
          payment_confirmation: order.payment_confirmation,
          payment_date: order.created_at,
        },
        order_dates: {
          order_date: order.created_at,
          estimated_delivery: order.estimated_delivery,
        },
      };

      // Generate receipt HTML/PDF (in a real implementation, this would use a PDF library)
      const receiptHtml = this.generateReceiptHTML(receiptData, branding);
      
      // Upload to S3
      const receiptKey = `receipts/${order.merchant_id}/${order.order_id}/${order.order_reference}.html`;
      
      await this.s3.putObject({
        Bucket: process.env.RECEIPTS_BUCKET || 'mindsdb-rag-receipts',
        Key: receiptKey,
        Body: receiptHtml,
        ContentType: 'text/html',
        Metadata: {
          order_id: order.order_id,
          merchant_id: order.merchant_id,
          transaction_id: order.transaction_id,
          generated_at: new Date().toISOString(),
        },
      }).promise();

      const receiptUrl = `https://${process.env.RECEIPTS_BUCKET || 'mindsdb-rag-receipts'}.s3.amazonaws.com/${receiptKey}`;

      console.log(`Receipt generated and uploaded: ${receiptUrl}`);

      return {
        receipt_url: receiptUrl,
        receipt_data: {
          order_id: order.order_id,
          merchant_id: order.merchant_id,
          receipt_key: receiptKey,
          generated_at: new Date().toISOString(),
          format: 'html',
        },
      };

    } catch (error) {
      console.error(`Failed to generate receipt for order ${order.order_reference}:`, error);
      throw new Error(`Receipt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate receipt HTML with merchant branding
   */
  private generateReceiptHTML(receiptData: OrderReceiptData, branding?: MerchantBranding): string {
    const primaryColor = branding?.primary_color || '#007bff';
    const secondaryColor = branding?.secondary_color || '#6c757d';
    const brandName = branding?.brand_name || receiptData.merchant_info.name;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${receiptData.order_reference}</title>
    <style>
        body {
            font-family: ${branding?.font_family || 'Arial, sans-serif'};
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid ${primaryColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 10px;
        }
        .brand-name {
            font-size: 24px;
            font-weight: bold;
            color: ${primaryColor};
            margin: 10px 0;
        }
        .order-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .order-info h3 {
            color: ${primaryColor};
            margin-top: 0;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .items-table th {
            background-color: ${primaryColor};
            color: white;
            padding: 10px;
            text-align: left;
        }
        .items-table td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        .total-section {
            text-align: right;
            margin-top: 20px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .total-final {
            font-weight: bold;
            font-size: 18px;
            color: ${primaryColor};
            border-top: 2px solid ${primaryColor};
            padding-top: 10px;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: ${secondaryColor};
            font-size: 12px;
        }
        .address-section {
            margin: 20px 0;
        }
        .address-section h4 {
            color: ${primaryColor};
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        ${receiptData.merchant_info.logo_url ? `<img src="${receiptData.merchant_info.logo_url}" alt="${brandName}" class="logo">` : ''}
        <div class="brand-name">${brandName}</div>
        ${branding?.header_text ? `<p>${branding.header_text}</p>` : ''}
    </div>

    <div class="order-info">
        <h3>Order Confirmation</h3>
        <p><strong>Order Number:</strong> ${receiptData.order_reference}</p>
        <p><strong>Order Date:</strong> ${receiptData.order_dates.order_date.toLocaleDateString()}</p>
        <p><strong>Payment Confirmation:</strong> ${receiptData.payment_info.payment_confirmation}</p>
        ${receiptData.order_dates.estimated_delivery ? `<p><strong>Estimated Delivery:</strong> ${receiptData.order_dates.estimated_delivery.toLocaleDateString()}</p>` : ''}
    </div>

    <div class="address-section">
        <h4>Shipping Address</h4>
        <p>
            ${receiptData.customer_info.name}<br>
            ${receiptData.customer_info.shipping_address.address_line_1}<br>
            ${receiptData.customer_info.shipping_address.address_line_2 ? receiptData.customer_info.shipping_address.address_line_2 + '<br>' : ''}
            ${receiptData.customer_info.shipping_address.city}, ${receiptData.customer_info.shipping_address.state} ${receiptData.customer_info.shipping_address.postal_code}<br>
            ${receiptData.customer_info.shipping_address.country}
        </p>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${receiptData.items.map(item => `
                <tr>
                    <td>
                        <strong>${item.name}</strong><br>
                        <small>SKU: ${item.sku}</small>
                    </td>
                    <td>${item.quantity}</td>
                    <td>$${item.unit_price.toFixed(2)}</td>
                    <td>$${item.subtotal.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total-section">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>$${receiptData.pricing.subtotal.toFixed(2)}</span>
        </div>
        ${receiptData.pricing.tax_amount ? `
        <div class="total-row">
            <span>Tax:</span>
            <span>$${receiptData.pricing.tax_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${receiptData.pricing.shipping_amount ? `
        <div class="total-row">
            <span>Shipping:</span>
            <span>$${receiptData.pricing.shipping_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${receiptData.pricing.discount_amount ? `
        <div class="total-row">
            <span>Discount:</span>
            <span>-$${receiptData.pricing.discount_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row total-final">
            <span>Total:</span>
            <span>$${receiptData.pricing.total_amount.toFixed(2)} ${receiptData.pricing.currency}</span>
        </div>
    </div>

    <div class="footer">
        ${branding?.footer_text || 'Thank you for your business!'}
        ${receiptData.merchant_info.contact_info ? `<br>Contact: ${receiptData.merchant_info.contact_info}` : ''}
        ${receiptData.merchant_info.tax_id ? `<br>Tax ID: ${receiptData.merchant_info.tax_id}` : ''}
    </div>
</body>
</html>`;
  }

  /**
   * Update order status (e.g., shipped, delivered)
   */
  async updateOrderStatus(
    orderId: string,
    merchantId: string,
    status: OrderConfirmation['status'],
    trackingInfo?: {
      tracking_number?: string;
      carrier?: string;
      shipped_date?: Date;
      delivered_date?: Date;
    }
  ): Promise<OrderConfirmation | null> {
    console.log(`Updating order ${orderId} status to ${status}`);

    const metadata: Record<string, any> = {
      status_updated_at: new Date().toISOString(),
      previous_status: 'confirmed', // Would get from current order
    };

    if (trackingInfo) {
      metadata.tracking_info = trackingInfo;
    }

    return await this.transactionRepository.updateOrderStatus(orderId, merchantId, status, metadata);
  }

  /**
   * Get merchant branding configuration
   */
  private async getMerchantBranding(merchantId: string): Promise<MerchantBranding | null> {
    if (this.merchantBrandings.has(merchantId)) {
      return this.merchantBrandings.get(merchantId)!;
    }

    try {
      // In a real implementation, this would fetch from database or configuration service
      // For now, return default branding
      const defaultBranding: MerchantBranding = {
        merchant_id: merchantId,
        brand_name: merchantId.charAt(0).toUpperCase() + merchantId.slice(1),
        primary_color: '#007bff',
        secondary_color: '#6c757d',
        font_family: 'Arial, sans-serif',
        header_text: 'Thank you for your order!',
        footer_text: 'We appreciate your business.',
      };

      this.merchantBrandings.set(merchantId, defaultBranding);
      return defaultBranding;

    } catch (error) {
      console.error(`Failed to get branding for merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Calculate estimated delivery date
   */
  private calculateEstimatedDelivery(): Date {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 3); // 3 business days
    return deliveryDate;
  }

  /**
   * Hash payload for audit logging
   */
  private hashPayload(payload: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}