import request from 'supertest';
import { createAPIGatewayApp } from '../api/app';
import { getWebhookService } from '../services/WebhookService';

describe('Webhook Integration Tests', () => {
  let app: any;
  let authToken: string;
  let merchantId: string;

  beforeAll(() => {
    // Create app instance with test configuration
    const appInstance = createAPIGatewayApp({
      port: 3001,
      environment: 'test',
      corsOrigins: ['http://localhost:3001'],
      enableMetrics: false,
      enableCognito: false,
      enableMockAuth: true,
      awsRegion: 'us-east-1',
    });
    app = appInstance.getApp();

    // Mock authentication for tests
    merchantId = 'test_merchant_123';
    authToken = 'mock-jwt-token';
  });

  describe('POST /api/merchants/:merchantId/webhooks', () => {
    it('should create a new webhook', async () => {
      const response = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: ['chat.completed', 'document.created'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('webhookId');
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data.url).toBe('https://example.com/webhook');
      expect(response.body.data.events).toEqual(['chat.completed', 'document.created']);
    });

    it('should reject webhook with non-HTTPS URL', async () => {
      const response = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'http://example.com/webhook',
          events: ['chat.completed'],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('HTTPS');
    });

    it('should reject webhook without events', async () => {
      const response = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/merchants/:merchantId/webhooks', () => {
    it('should list webhooks for a merchant', async () => {
      const response = await request(app)
        .get(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('webhooks');
      expect(Array.isArray(response.body.data.webhooks)).toBe(true);
    });
  });

  describe('PUT /api/merchants/:merchantId/webhooks/:id', () => {
    it('should update a webhook', async () => {
      // First create a webhook
      const createResponse = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: ['chat.completed'],
        });

      const webhookId = createResponse.body.data.webhookId;

      // Then update it
      const response = await request(app)
        .put(`/api/merchants/${merchantId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          events: ['chat.completed', 'document.created'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.webhook.events).toContain('document.created');
    });
  });

  describe('DELETE /api/merchants/:merchantId/webhooks/:id', () => {
    it('should delete a webhook', async () => {
      // First create a webhook
      const createResponse = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: ['chat.completed'],
        });

      const webhookId = createResponse.body.data.webhookId;

      // Then delete it
      const response = await request(app)
        .delete(`/api/merchants/${merchantId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/merchants/:merchantId/webhooks/:id/test', () => {
    it('should send a test webhook event', async () => {
      // First create a webhook
      const createResponse = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: ['chat.completed'],
        });

      const webhookId = createResponse.body.data.webhookId;

      // Then test it
      const response = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks/${webhookId}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('queued');
    });
  });

  describe('GET /api/merchants/:merchantId/webhooks/:id/deliveries', () => {
    it('should get webhook delivery history', async () => {
      // First create a webhook
      const createResponse = await request(app)
        .post(`/api/merchants/${merchantId}/webhooks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/webhook',
          events: ['chat.completed'],
        });

      const webhookId = createResponse.body.data.webhookId;

      // Get deliveries
      const response = await request(app)
        .get(`/api/merchants/${merchantId}/webhooks/${webhookId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveries');
      expect(response.body.data).toHaveProperty('stats');
      expect(Array.isArray(response.body.data.deliveries)).toBe(true);
    });
  });
});
