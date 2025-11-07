import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { getWebhookRepository } from '../repositories/WebhookRepository';
import { getWebhookDeliveryRepository } from '../repositories/WebhookDeliveryRepository';
import type { Webhook, NewWebhook, WebhookDelivery, NewWebhookDelivery } from '../database/schema';

export interface CreateWebhookData {
  merchantId: string;
  url: string;
  events: string[];
}

export interface CreateWebhookResult {
  webhookId: string;
  url: string;
  events: string[];
  secret: string; // Shown only once
}

export interface TriggerEventData {
  merchantId: string;
  eventType: string;
  payload: any;
}

export interface WebhookDeliveryStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  avgAttemptCount: number;
}

/**
 * WebhookService handles webhook creation, event triggering, and delivery
 * with automatic retries and exponential backoff
 */
export class WebhookService {
  private webhookRepository = getWebhookRepository();
  private webhookDeliveryRepository = getWebhookDeliveryRepository();

  // Maximum number of delivery attempts before giving up
  private readonly MAX_ATTEMPTS = 3;
  
  // Maximum consecutive failures before disabling webhook
  private readonly MAX_FAILURE_COUNT = 10;
  
  // Timeout for webhook HTTP requests (10 seconds)
  private readonly REQUEST_TIMEOUT = 10000;

  /**
   * Create a new webhook endpoint for a merchant
   */
  async createWebhook(data: CreateWebhookData): Promise<CreateWebhookResult> {
    // Generate webhook ID and secret
    const webhookId = `whk_${this.generateRandomString(16)}`;
    const secret = `whsec_${this.generateRandomString(32)}`;

    // Validate URL format
    await this.validateWebhookUrl(data.url);

    // Create webhook record
    const webhookData: NewWebhook = {
      webhookId,
      merchantId: data.merchantId,
      url: data.url,
      events: data.events,
      secret,
      status: 'active',
      failureCount: 0,
    };

    await this.webhookRepository.create(webhookData);

    return {
      webhookId,
      url: data.url,
      events: data.events,
      secret, // Show secret only once during creation
    };
  }

  /**
   * Trigger an event that will be delivered to all subscribed webhooks
   */
  async triggerEvent(data: TriggerEventData): Promise<void> {
    // Find all active webhooks subscribed to this event type
    const webhooks = await this.webhookRepository.findByMerchantAndEvent(
      data.merchantId,
      data.eventType
    );

    // Queue delivery for each webhook
    const deliveryPromises = webhooks.map(webhook =>
      this.queueDelivery({
        webhookId: webhook.webhookId,
        eventType: data.eventType,
        payload: data.payload,
      })
    );

    await Promise.all(deliveryPromises);
  }

  /**
   * Deliver a webhook to its endpoint with retry logic
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.webhookDeliveryRepository.findById(deliveryId);
    if (!delivery) {
      throw new Error('Webhook delivery not found');
    }

    const webhook = await this.webhookRepository.findByWebhookId(delivery.webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Skip if webhook is disabled
    if (webhook.status !== 'active') {
      console.log(`Skipping delivery ${deliveryId} - webhook ${webhook.webhookId} is ${webhook.status}`);
      return;
    }

    try {
      // Generate HMAC signature for payload verification
      const signature = this.generateSignature(delivery.payload, webhook.secret);

      // Send HTTP POST request to webhook URL
      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Delivery-ID': deliveryId,
          'User-Agent': 'RAG-Assistant-Webhooks/1.0',
        },
        timeout: this.REQUEST_TIMEOUT,
        validateStatus: (status) => status >= 200 && status < 300, // Only accept 2xx as success
      });

      // Mark delivery as successful
      await this.webhookDeliveryRepository.markAsSuccess(
        deliveryId,
        response.status,
        this.truncateString(JSON.stringify(response.data), 1000)
      );

      // Reset webhook failure count on success
      await this.webhookRepository.resetFailureCount(webhook.webhookId);

      console.log(`Webhook delivery ${deliveryId} succeeded for webhook ${webhook.webhookId}`);

    } catch (error: any) {
      await this.handleDeliveryFailure(deliveryId, delivery, webhook, error);
    }
  }

  /**
   * Handle webhook delivery failure with retry logic
   */
  private async handleDeliveryFailure(
    deliveryId: string,
    delivery: WebhookDelivery,
    webhook: Webhook,
    error: any
  ): Promise<void> {
    const attemptCount = delivery.attemptCount + 1;
    const statusCode = error.response?.status || null;
    const errorMessage = error.message || 'Unknown error';
    const responseBody = error.response?.data
      ? this.truncateString(JSON.stringify(error.response.data), 1000)
      : errorMessage;

    console.error(
      `Webhook delivery ${deliveryId} failed (attempt ${attemptCount}/${this.MAX_ATTEMPTS}):`,
      errorMessage
    );

    // Calculate next retry time if we haven't exceeded max attempts
    const nextRetryAt = attemptCount < this.MAX_ATTEMPTS
      ? this.calculateNextRetry(attemptCount)
      : undefined;

    // Mark delivery as failed (or pending if retrying)
    await this.webhookDeliveryRepository.markAsFailed(
      deliveryId,
      statusCode,
      responseBody,
      nextRetryAt
    );

    // Increment webhook failure count
    await this.webhookRepository.incrementFailureCount(webhook.webhookId);

    // Check if we should disable the webhook due to too many failures
    const updatedWebhook = await this.webhookRepository.findByWebhookId(webhook.webhookId);
    if (updatedWebhook && updatedWebhook.failureCount >= this.MAX_FAILURE_COUNT) {
      await this.webhookRepository.updateStatus(webhook.webhookId, 'disabled');
      console.warn(
        `Webhook ${webhook.webhookId} disabled after ${updatedWebhook.failureCount} consecutive failures`
      );
    }

    // Schedule retry if applicable
    if (nextRetryAt && attemptCount < this.MAX_ATTEMPTS) {
      const delayMs = nextRetryAt.getTime() - Date.now();
      console.log(`Scheduling retry for delivery ${deliveryId} in ${Math.round(delayMs / 1000)}s`);
      
      // In production, this should use a proper job queue (e.g., Bull, AWS SQS)
      // For now, using setTimeout as a simple implementation
      setTimeout(() => {
        this.deliverWebhook(deliveryId).catch(err => {
          console.error(`Retry failed for delivery ${deliveryId}:`, err);
        });
      }, delayMs);
    }
  }

  /**
   * Queue a webhook delivery for processing
   */
  private async queueDelivery(data: {
    webhookId: string;
    eventType: string;
    payload: any;
  }): Promise<WebhookDelivery> {
    const deliveryData: NewWebhookDelivery = {
      webhookId: data.webhookId,
      eventType: data.eventType,
      payload: data.payload,
      status: 'pending',
      attemptCount: 0,
    };

    const delivery = await this.webhookDeliveryRepository.create(deliveryData);

    // Immediately attempt delivery (in production, use a job queue)
    setImmediate(() => {
      this.deliverWebhook(delivery.id).catch(err => {
        console.error(`Initial delivery failed for ${delivery.id}:`, err);
      });
    });

    return delivery;
  }

  /**
   * Generate HMAC signature for webhook payload verification
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature (for webhook receivers to validate authenticity)
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Calculate next retry time using exponential backoff
   * Attempt 1: 1 minute
   * Attempt 2: 5 minutes
   * Attempt 3: 15 minutes
   */
  private calculateNextRetry(attemptCount: number): Date {
    const delays = [60000, 300000, 900000]; // 1min, 5min, 15min in milliseconds
    const delay = delays[attemptCount - 1] || 900000;
    return new Date(Date.now() + delay);
  }

  /**
   * Validate webhook URL format and reachability
   */
  private async validateWebhookUrl(url: string): Promise<void> {
    // Check HTTPS requirement
    if (!url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }

    // Optional: Test connectivity (can be disabled for faster webhook creation)
    // In production, you might want to skip this or make it optional
    // to avoid delays during webhook creation
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string): Promise<Webhook | null> {
    return this.webhookRepository.findByWebhookId(webhookId);
  }

  /**
   * List all webhooks for a merchant
   */
  async listWebhooks(merchantId: string, activeOnly: boolean = false): Promise<Webhook[]> {
    if (activeOnly) {
      return this.webhookRepository.findActiveByMerchantId(merchantId);
    }
    return this.webhookRepository.findByMerchantId(merchantId);
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    webhookId: string,
    data: { url?: string; events?: string[]; status?: 'active' | 'disabled' | 'failed' }
  ): Promise<Webhook> {
    if (data.url) {
      await this.validateWebhookUrl(data.url);
    }

    return this.webhookRepository.update(webhookId, data);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    return this.webhookRepository.delete(webhookId);
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    return this.webhookDeliveryRepository.findByWebhookId(webhookId, limit, offset);
  }

  /**
   * Get delivery statistics for a webhook
   */
  async getDeliveryStats(webhookId: string): Promise<WebhookDeliveryStats> {
    return this.webhookDeliveryRepository.getDeliveryStats(webhookId);
  }

  /**
   * Process pending webhook deliveries (for background job)
   */
  async processPendingDeliveries(limit: number = 100): Promise<number> {
    const pendingDeliveries = await this.webhookDeliveryRepository.findPendingDeliveries(limit);
    
    let processedCount = 0;
    for (const delivery of pendingDeliveries) {
      try {
        await this.deliverWebhook(delivery.id);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process delivery ${delivery.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Test webhook by sending a test event
   */
  async testWebhook(webhookId: string): Promise<void> {
    const webhook = await this.webhookRepository.findByWebhookId(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.webhookId,
      },
    };

    await this.queueDelivery({
      webhookId: webhook.webhookId,
      eventType: 'webhook.test',
      payload: testPayload,
    });
  }

  /**
   * Clean up old webhook deliveries (for maintenance)
   */
  async cleanupOldDeliveries(daysToKeep: number = 30): Promise<number> {
    return this.webhookDeliveryRepository.deleteOlderThan(daysToKeep);
  }

  /**
   * Generate a random string for webhook ID and secret generation
   */
  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Truncate string to specified length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '...';
  }
}

// Export singleton instance
let webhookServiceInstance: WebhookService | null = null;

export const getWebhookService = (): WebhookService => {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService();
  }
  return webhookServiceInstance;
};
