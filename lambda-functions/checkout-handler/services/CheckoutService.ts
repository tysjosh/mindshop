import { v4 as uuidv4 } from 'uuid';
import { SNS } from 'aws-sdk';
import { SQS } from 'aws-sdk';
import { SecretsManager } from 'aws-sdk';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { TransactionRepository, TransactionState } from '../repositories/TransactionRepository';
import { PIIRedactor } from './PIIRedactor';
import { CompensationService } from './CompensationService';
import { OrderManagementService } from './OrderManagementService';

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

export class CheckoutService {
  private sns: SNS;
  private sqs: SQS;
  private secretsManager: SecretsManager;
  private auditLogRepository: AuditLogRepository;
  private transactionRepository: TransactionRepository;
  private piiRedactor: PIIRedactor;
  private compensationService: CompensationService;
  private orderManagementService: OrderManagementService;
  private paymentConfigs: Map<string, PaymentGatewayConfig> = new Map();

  constructor(
    auditLogRepository: AuditLogRepository,
    piiRedactor: PIIRedactor,
    transactionRepository?: TransactionRepository
  ) {
    this.sns = new SNS({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
    this.secretsManager = new SecretsManager({ region: process.env.AWS_REGION || 'us-east-1' });
    this.auditLogRepository = auditLogRepository;
    this.transactionRepository = transactionRepository || new TransactionRepository();
    this.piiRedactor = piiRedactor;
    this.compensationService = new CompensationService(this.transactionRepository, auditLogRepository);
    this.orderManagementService = new OrderManagementService(this.transactionRepository, auditLogRepository);
  }

  /**
   * Process checkout request with payment gateway integration
   */
  async processCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const transactionId = uuidv4();
    const startTime = Date.now();

    try {
      // Validate user consent
      this.validateUserConsent(request.user_consent);

      // Validate and sanitize request
      const sanitizedRequest = await this.sanitizeCheckoutRequest(request);

      // Calculate totals
      const { totalAmount, processedItems } = this.calculateTotals(sanitizedRequest.items);

      // Validate minimum order amount
      if (totalAmount <= 0) {
        throw new Error('Invalid order total');
      }

      // Log checkout attempt (with PII redacted)
      await this.auditLogRepository.create({
        merchantId: request.merchant_id,
        userId: request.user_id,
        sessionId: request.session_id,
        operation: 'checkout_attempt',
        requestPayloadHash: this.hashPayload(sanitizedRequest),
        responseReference: `transaction:${transactionId}`,
        outcome: 'success',
        actor: 'user',
      });

      // Get payment gateway configuration
      const paymentConfig = await this.getPaymentGatewayConfig(
        request.merchant_id,
        request.payment_method
      );

      // Process payment through appropriate gateway
      const paymentResult = await this.processPaymentGateway({
        transactionId,
        merchantId: request.merchant_id,
        userId: request.user_id,
        amount: totalAmount,
        currency: 'USD', // Default currency, should be configurable per merchant
        paymentMethod: request.payment_method,
        paymentConfig,
        items: processedItems,
        shippingAddress: sanitizedRequest.shipping_address,
        billingAddress: sanitizedRequest.billing_address,
      });

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

      // Create order reference
      const orderReference = `ORD-${request.merchant_id}-${Date.now()}`;

      // Store transaction record
      const transactionRecord = await this.transactionRepository.createTransaction({
        transaction_id: transactionId,
        merchant_id: request.merchant_id,
        user_id: request.user_id,
        session_id: request.session_id,
        status: paymentResult.status as any,
        total_amount: totalAmount,
        currency: 'USD',
        payment_method: request.payment_method,
        payment_intent_id: paymentResult.paymentIntentId,
        payment_confirmation: paymentResult.confirmationId,
        order_reference: orderReference,
        inventory_reserved: true,
        inventory_reservation_id: `inv_${transactionId}`,
        compensation_actions: [],
        metadata: {
          items: processedItems,
          shipping_address: sanitizedRequest.shipping_address,
          billing_address: sanitizedRequest.billing_address,
          processing_time_ms: Date.now() - startTime,
          user_consent: request.user_consent,
        },
      });

      // Create order confirmation and receipt
      if (paymentResult.status === 'confirmed') {
        try {
          await this.orderManagementService.createOrderConfirmation(
            transactionRecord,
            {
              name: sanitizedRequest.shipping_address.name,
              email: request.user_id, // In real implementation, would get actual email
            }
          );
        } catch (error) {
          console.error('Failed to create order confirmation:', error);
          // Don't fail the entire checkout for order confirmation issues
        }
      }

      // Publish order processing events
      await this.publishOrderEvents({
        transactionId,
        merchantId: request.merchant_id,
        userId: request.user_id,
        orderReference,
        items: processedItems,
        totalAmount,
        status: paymentResult.status,
      });

      // Log successful checkout
      await this.auditLogRepository.create({
        merchantId: request.merchant_id,
        userId: request.user_id,
        sessionId: request.session_id,
        operation: 'checkout_success',
        requestPayloadHash: this.hashPayload({ transactionId, totalAmount, orderReference }),
        responseReference: `order:${orderReference}`,
        outcome: 'success',
        actor: 'system',
      });

      const response: CheckoutResponse = {
        transaction_id: transactionId,
        status: paymentResult.status as any,
        total_amount: totalAmount,
        currency: 'USD',
        items: processedItems,
        payment_confirmation: paymentResult.confirmationId,
        payment_intent_id: paymentResult.paymentIntentId,
        client_secret: paymentResult.clientSecret,
        estimated_delivery: this.calculateEstimatedDelivery(),
        order_reference: orderReference,
      };

      console.log(`Checkout completed for transaction ${transactionId}: $${totalAmount}`);
      return response;

    } catch (error) {
      console.error(`Checkout failed for transaction ${transactionId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Execute compensation workflow for failed transaction
      try {
        await this.compensationService.executeCompensation(
          transactionId,
          request.merchant_id,
          errorMessage
        );
      } catch (compensationError) {
        console.error('Compensation workflow also failed:', compensationError);
      }

      // Log failed checkout
      await this.auditLogRepository.create({
        merchantId: request.merchant_id,
        userId: request.user_id,
        sessionId: request.session_id,
        operation: 'checkout_failure',
        requestPayloadHash: this.hashPayload(request),
        responseReference: `error:${transactionId}`,
        outcome: 'failure',
        reason: errorMessage,
        actor: 'system',
      });

      return {
        transaction_id: transactionId,
        status: 'failed',
        total_amount: 0,
        currency: 'USD',
        items: [],
        error_message: errorMessage,
      };
    }
  }

  /**
   * Validate user consent requirements
   */
  private validateUserConsent(consent: CheckoutRequest['user_consent']): void {
    if (!consent.terms_accepted) {
      throw new Error('Terms and conditions must be accepted');
    }

    if (!consent.privacy_accepted) {
      throw new Error('Privacy policy must be accepted');
    }

    // Validate consent timestamp is recent (within last 24 hours)
    const consentTime = new Date(consent.consent_timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - consentTime.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      throw new Error('Consent timestamp is too old, please re-confirm');
    }
  }

  /**
   * Sanitize checkout request to remove PII before processing
   */
  private async sanitizeCheckoutRequest(request: CheckoutRequest): Promise<CheckoutRequest> {
    // For payment processing, we need to maintain address structure
    // but ensure no PII leaks into logs or external systems
    
    // Tokenize any payment-related PII that might be in the request
    const paymentData: any = {};
    if (request.payment_method && request.payment_method !== 'default') {
      // In a real implementation, payment details would be tokenized
      paymentData.payment_method_type = request.payment_method;
    }

    // Sanitize user consent data to remove any embedded PII
    const sanitizedConsent = {
      ...request.user_consent,
      // Ensure no PII in consent metadata
      consent_timestamp: request.user_consent.consent_timestamp,
    };

    return {
      ...request,
      shipping_address: request.shipping_address, // Keep for payment processing
      billing_address: request.billing_address,   // Keep for payment processing
      user_consent: sanitizedConsent,
    };
  }

  /**
   * Calculate order totals and validate items
   */
  private calculateTotals(items: CheckoutItem[]): {
    totalAmount: number;
    processedItems: Array<{
      sku: string;
      quantity: number;
      price: number;
      subtotal: number;
      name: string;
    }>;
  } {
    const processedItems = items.map(item => {
      if (!item.sku || !item.quantity || !item.price || !item.name) {
        throw new Error(`Invalid item: ${JSON.stringify(item)}`);
      }

      if (item.quantity <= 0 || item.price < 0) {
        throw new Error(`Invalid item quantities or pricing: ${item.sku}`);
      }

      const subtotal = item.quantity * item.price;
      return {
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        subtotal,
        name: item.name,
      };
    });

    const totalAmount = processedItems.reduce((sum, item) => sum + item.subtotal, 0);

    return { totalAmount, processedItems };
  }

  /**
   * Get payment gateway configuration from AWS Secrets Manager
   */
  private async getPaymentGatewayConfig(
    merchantId: string,
    paymentMethod: string
  ): Promise<PaymentGatewayConfig> {
    const cacheKey = `${merchantId}:${paymentMethod}`;
    
    if (this.paymentConfigs.has(cacheKey)) {
      return this.paymentConfigs.get(cacheKey)!;
    }

    try {
      const secretName = `checkout/payment-gateway/${merchantId}/${paymentMethod}`;
      const result = await this.secretsManager.getSecretValue({ SecretId: secretName }).promise();
      
      if (!result.SecretString) {
        throw new Error('Payment gateway configuration not found');
      }

      const config = JSON.parse(result.SecretString) as PaymentGatewayConfig;
      this.paymentConfigs.set(cacheKey, config);
      
      return config;
    } catch (error) {
      console.error(`Failed to get payment config for ${merchantId}:${paymentMethod}:`, error);
      throw new Error('Payment gateway configuration unavailable');
    }
  }

  /**
   * Process payment through appropriate gateway
   */
  private async processPaymentGateway(params: {
    transactionId: string;
    merchantId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    paymentConfig: PaymentGatewayConfig;
    items: any[];
    shippingAddress: any;
    billingAddress?: any;
  }): Promise<{
    success: boolean;
    status: string;
    confirmationId?: string;
    paymentIntentId?: string;
    clientSecret?: string;
    error?: string;
  }> {
    const { transactionId, merchantId, amount, currency, paymentMethod, paymentConfig } = params;

    try {
      switch (paymentMethod) {
        case 'stripe':
          return await this.processStripePayment(params);
        case 'adyen':
          return await this.processAdyenPayment(params);
        default:
          return await this.processDefaultPayment(params);
      }
    } catch (error) {
      console.error(`Payment processing failed for ${transactionId}:`, error);
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Process Stripe payment
   */
  private async processStripePayment(params: any): Promise<any> {
    // This would integrate with actual Stripe SDK
    // For now, simulate Stripe payment processing
    
    const { transactionId, amount, currency } = params;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate payment validation
    if (amount > 100000) { // $1000 limit
      return {
        success: false,
        status: 'failed',
        error: 'Amount exceeds Stripe transaction limit',
      };
    }

    // Simulate random failures (2% failure rate)
    if (Math.random() < 0.02) {
      return {
        success: false,
        status: 'failed',
        error: 'Stripe payment processor temporarily unavailable',
      };
    }

    return {
      success: true,
      status: 'confirmed',
      confirmationId: `stripe_${transactionId.slice(0, 8)}`,
      paymentIntentId: `pi_${transactionId}`,
      clientSecret: `pi_${transactionId}_secret_${Math.random().toString(36).slice(2)}`,
    };
  }

  /**
   * Process Adyen payment
   */
  private async processAdyenPayment(params: any): Promise<any> {
    // This would integrate with actual Adyen SDK
    // For now, simulate Adyen payment processing
    
    const { transactionId, amount } = params;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Simulate payment validation
    if (amount > 50000) { // $500 limit for demo
      return {
        success: false,
        status: 'failed',
        error: 'Amount exceeds Adyen transaction limit',
      };
    }

    return {
      success: true,
      status: 'confirmed',
      confirmationId: `adyen_${transactionId.slice(0, 8)}`,
      paymentIntentId: `adyen_${transactionId}`,
    };
  }

  /**
   * Process default payment method
   */
  private async processDefaultPayment(params: any): Promise<any> {
    const { transactionId, amount } = params;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Basic validation
    if (amount > 10000) { // $100 limit for default
      return {
        success: false,
        status: 'failed',
        error: 'Amount exceeds default payment limit',
      };
    }

    return {
      success: true,
      status: 'confirmed',
      confirmationId: `default_${transactionId.slice(0, 8)}`,
    };
  }



  /**
   * Publish order processing events to SNS/SQS
   */
  private async publishOrderEvents(params: {
    transactionId: string;
    merchantId: string;
    userId: string;
    orderReference: string;
    items: any[];
    totalAmount: number;
    status: string;
  }): Promise<void> {
    const { transactionId, merchantId, orderReference, totalAmount, status } = params;

    try {
      // Publish to SNS topic for order processing
      const snsMessage = {
        event_type: 'order_created',
        transaction_id: transactionId,
        merchant_id: merchantId,
        order_reference: orderReference,
        total_amount: totalAmount,
        status: status,
        timestamp: new Date().toISOString(),
      };

      const snsParams = {
        TopicArn: process.env.ORDER_PROCESSING_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:order-processing',
        Message: JSON.stringify(snsMessage),
        Subject: `Order Created: ${orderReference}`,
        MessageAttributes: {
          merchant_id: {
            DataType: 'String',
            StringValue: merchantId,
          },
          event_type: {
            DataType: 'String',
            StringValue: 'order_created',
          },
        },
      };

      await this.sns.publish(snsParams).promise();

      // Send to SQS for inventory management
      const sqsMessage = {
        action: 'reserve_inventory',
        transaction_id: transactionId,
        merchant_id: merchantId,
        items: params.items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      };

      const sqsParams = {
        QueueUrl: process.env.INVENTORY_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/inventory-management',
        MessageBody: JSON.stringify(sqsMessage),
        MessageAttributes: {
          merchant_id: {
            DataType: 'String',
            StringValue: merchantId,
          },
        },
      };

      await this.sqs.sendMessage(sqsParams).promise();

      console.log(`Published order events for transaction ${transactionId}`);

    } catch (error) {
      console.error(`Failed to publish order events for ${transactionId}:`, error);
      // Don't throw error here as the main transaction succeeded
    }
  }

  /**
   * Calculate estimated delivery date
   */
  private calculateEstimatedDelivery(): string {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 3); // 3 business days
    return deliveryDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  /**
   * Hash payload for audit logging
   */
  private hashPayload(payload: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string, merchantId: string): Promise<{
    transaction_id: string;
    status: string;
    order_reference?: string;
    payment_confirmation?: string;
    created_at?: string;
    updated_at?: string;
  }> {
    const transaction = await this.transactionRepository.getTransaction(transactionId, merchantId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    return {
      transaction_id: transaction.transaction_id,
      status: transaction.status,
      order_reference: transaction.order_reference,
      payment_confirmation: transaction.payment_confirmation,
      created_at: transaction.created_at.toISOString(),
      updated_at: transaction.updated_at.toISOString(),
    };
  }

  /**
   * Cancel transaction with compensation
   */
  async cancelTransaction(
    transactionId: string,
    merchantId: string,
    reason: string
  ): Promise<{
    transaction_id: string;
    status: string;
    refund_status: string;
    cancellation_reason: string;
  }> {
    console.log(`Cancelling transaction ${transactionId} for merchant ${merchantId}: ${reason}`);

    // Execute compensation workflow
    const compensationResult = await this.compensationService.executeCompensation(
      transactionId,
      merchantId,
      reason
    );

    // Log cancellation
    await this.auditLogRepository.create({
      merchantId: merchantId,
      userId: 'system',
      sessionId: transactionId,
      operation: 'transaction_cancel',
      requestPayloadHash: this.hashPayload({ transactionId, reason }),
      responseReference: `cancel:${transactionId}`,
      outcome: compensationResult.success ? 'success' : 'failure',
      reason: compensationResult.success ? reason : compensationResult.errors.join('; '),
      actor: 'user',
    });

    return {
      transaction_id: transactionId,
      status: 'cancelled',
      refund_status: compensationResult.success ? 'processing' : 'failed',
      cancellation_reason: reason,
    };
  }

  /**
   * Publish cancellation events for compensation workflows
   */
  private async publishCancellationEvents(
    transactionId: string,
    merchantId: string,
    reason: string
  ): Promise<void> {
    try {
      // Publish to SNS for refund processing
      const snsMessage = {
        event_type: 'order_cancelled',
        transaction_id: transactionId,
        merchant_id: merchantId,
        reason: reason,
        timestamp: new Date().toISOString(),
      };

      await this.sns.publish({
        TopicArn: process.env.ORDER_PROCESSING_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:order-processing',
        Message: JSON.stringify(snsMessage),
        Subject: `Order Cancelled: ${transactionId}`,
      }).promise();

      // Send to SQS for inventory release
      const sqsMessage = {
        action: 'release_inventory',
        transaction_id: transactionId,
        merchant_id: merchantId,
      };

      await this.sqs.sendMessage({
        QueueUrl: process.env.INVENTORY_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/inventory-management',
        MessageBody: JSON.stringify(sqsMessage),
      }).promise();

    } catch (error) {
      console.error(`Failed to publish cancellation events for ${transactionId}:`, error);
    }
  }
}