import { Request, Response } from 'express';
import { getWebhookService } from '../../services/WebhookService';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class WebhookController {
  private webhookService = getWebhookService();

  /**
   * Create a new webhook
   * POST /api/merchants/:merchantId/webhooks
   */
  async createWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { url, events } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!url || !events) {
        const response: ApiResponse = {
          success: false,
          error: 'URL and events are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate events is an array
      if (!Array.isArray(events) || events.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Events must be a non-empty array',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate URL format
      if (!url.startsWith('https://')) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook URL must use HTTPS',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.webhookService.createWebhook({
        merchantId,
        url,
        events,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...result,
          warning: 'This is the only time the webhook secret will be shown. Please store it securely.',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create webhook error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to create webhook',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * List all webhooks for a merchant
   * GET /api/merchants/:merchantId/webhooks
   */
  async listWebhooks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const activeOnly = req.query.activeOnly === 'true';

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const webhooks = await this.webhookService.listWebhooks(merchantId, activeOnly);

      // Remove sensitive data (secret) from response
      const sanitizedWebhooks = webhooks.map(webhook => ({
        id: webhook.id,
        webhookId: webhook.webhookId,
        merchantId: webhook.merchantId,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        failureCount: webhook.failureCount,
        lastSuccessAt: webhook.lastSuccessAt,
        lastFailureAt: webhook.lastFailureAt,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      }));

      const response: ApiResponse = {
        success: true,
        data: {
          webhooks: sanitizedWebhooks,
          total: sanitizedWebhooks.length,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('List webhooks error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to list webhooks',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Update a webhook
   * PUT /api/merchants/:merchantId/webhooks/:id
   */
  async updateWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, id } = req.params;
      const { url, events, status } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate at least one field is provided
      if (!url && !events && !status) {
        const response: ApiResponse = {
          success: false,
          error: 'At least one field (url, events, or status) must be provided',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate URL format if provided
      if (url && !url.startsWith('https://')) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook URL must use HTTPS',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate events if provided
      if (events && (!Array.isArray(events) || events.length === 0)) {
        const response: ApiResponse = {
          success: false,
          error: 'Events must be a non-empty array',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate status if provided
      if (status && !['active', 'disabled', 'failed'].includes(status)) {
        const response: ApiResponse = {
          success: false,
          error: 'Status must be one of: active, disabled, failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Get webhook to verify ownership
      const webhook = await this.webhookService.getWebhook(id);
      if (!webhook) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Verify the webhook belongs to the merchant
      if (webhook.merchantId !== merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      const updatedWebhook = await this.webhookService.updateWebhook(id, {
        url,
        events,
        status,
      });

      // Remove sensitive data (secret) from response
      const sanitizedWebhook = {
        id: updatedWebhook.id,
        webhookId: updatedWebhook.webhookId,
        merchantId: updatedWebhook.merchantId,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        status: updatedWebhook.status,
        failureCount: updatedWebhook.failureCount,
        lastSuccessAt: updatedWebhook.lastSuccessAt,
        lastFailureAt: updatedWebhook.lastFailureAt,
        createdAt: updatedWebhook.createdAt,
        updatedAt: updatedWebhook.updatedAt,
      };

      const response: ApiResponse = {
        success: true,
        data: {
          webhook: sanitizedWebhook,
          message: 'Webhook updated successfully',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update webhook error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to update webhook',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Delete a webhook
   * DELETE /api/merchants/:merchantId/webhooks/:id
   */
  async deleteWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, id } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Get webhook to verify ownership
      const webhook = await this.webhookService.getWebhook(id);
      if (!webhook) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Verify the webhook belongs to the merchant
      if (webhook.merchantId !== merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      const deleted = await this.webhookService.deleteWebhook(id);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          error: 'Failed to delete webhook',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          webhookId: id,
          message: 'Webhook deleted successfully',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Delete webhook error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to delete webhook',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Test a webhook by sending a test event
   * POST /api/merchants/:merchantId/webhooks/:id/test
   */
  async testWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, id } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Get webhook to verify ownership
      const webhook = await this.webhookService.getWebhook(id);
      if (!webhook) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Verify the webhook belongs to the merchant
      if (webhook.merchantId !== merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      await this.webhookService.testWebhook(id);

      const response: ApiResponse = {
        success: true,
        data: {
          webhookId: id,
          message: 'Test webhook event queued for delivery',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Test webhook error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to test webhook',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get delivery history for a webhook
   * GET /api/merchants/:merchantId/webhooks/:id/deliveries
   */
  async getDeliveries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, id } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate limit and offset
      if (limit < 1 || limit > 1000) {
        const response: ApiResponse = {
          success: false,
          error: 'Limit must be between 1 and 1000',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      if (offset < 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Offset must be non-negative',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Get webhook to verify ownership
      const webhook = await this.webhookService.getWebhook(id);
      if (!webhook) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Verify the webhook belongs to the merchant
      if (webhook.merchantId !== merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Webhook not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      const deliveries = await this.webhookService.getDeliveryHistory(id, limit, offset);
      const stats = await this.webhookService.getDeliveryStats(id);

      const response: ApiResponse = {
        success: true,
        data: {
          deliveries,
          stats,
          pagination: {
            limit,
            offset,
            total: stats.totalDeliveries,
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get webhook deliveries error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get webhook deliveries',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }
}
