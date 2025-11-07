/**
 * Permission Enforcement Integration Tests
 * 
 * Tests that permission enforcement works correctly across different API endpoints
 * Verifies that API keys with specific permissions can only access authorized endpoints
 * 
 * Requirements: Task 2.4 - Implement API Key Permissions
 * 
 * Note: This test focuses on routes that use API key authentication (chat routes).
 * Document and session routes use JWT authentication and are tested separately.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import chatRoutes from '../api/routes/chat';

// Mock services and repositories
const apiKeyStore = new Map<string, any>();

vi.mock('../services/ApiKeyService', () => ({
  getApiKeyService: vi.fn(() => ({
    validateKey: vi.fn().mockImplementation(async (key: string) => {
      // Parse key to determine permissions
      // Format: pk_test_<permissions>_<merchantId>
      const parts = key.split('_');
      
      if (key === 'pk_test_invalid') {
        return { valid: false };
      }
      
      if (key === 'pk_test_wildcard') {
        return {
          valid: true,
          keyId: 'key_wildcard',
          merchantId: 'test_merchant_123',
          permissions: ['*'],
        };
      }
      
      if (key === 'pk_test_chat_read') {
        return {
          valid: true,
          keyId: 'key_chat_read',
          merchantId: 'test_merchant_123',
          permissions: ['chat:read'],
        };
      }
      
      if (key === 'pk_test_chat_write') {
        return {
          valid: true,
          keyId: 'key_chat_write',
          merchantId: 'test_merchant_123',
          permissions: ['chat:write', 'sessions:write'],
        };
      }
      
      if (key === 'pk_test_documents_read') {
        return {
          valid: true,
          keyId: 'key_documents_read',
          merchantId: 'test_merchant_123',
          permissions: ['documents:read'],
        };
      }
      
      if (key === 'pk_test_documents_write') {
        return {
          valid: true,
          keyId: 'key_documents_write',
          merchantId: 'test_merchant_123',
          permissions: ['documents:write'],
        };
      }
      
      if (key === 'pk_test_documents_delete') {
        return {
          valid: true,
          keyId: 'key_documents_delete',
          merchantId: 'test_merchant_123',
          permissions: ['documents:delete'],
        };
      }
      
      if (key === 'pk_test_analytics_read') {
        return {
          valid: true,
          keyId: 'key_analytics_read',
          merchantId: 'test_merchant_123',
          permissions: ['analytics:read'],
        };
      }
      
      if (key === 'pk_test_webhooks_read') {
        return {
          valid: true,
          keyId: 'key_webhooks_read',
          merchantId: 'test_merchant_123',
          permissions: ['webhooks:read'],
        };
      }
      
      if (key === 'pk_test_webhooks_write') {
        return {
          valid: true,
          keyId: 'key_webhooks_write',
          merchantId: 'test_merchant_123',
          permissions: ['webhooks:write'],
        };
      }
      
      if (key === 'pk_test_sync_read') {
        return {
          valid: true,
          keyId: 'key_sync_read',
          merchantId: 'test_merchant_123',
          permissions: ['sync:read'],
        };
      }
      
      if (key === 'pk_test_sync_write') {
        return {
          valid: true,
          keyId: 'key_sync_write',
          merchantId: 'test_merchant_123',
          permissions: ['sync:write'],
        };
      }
      
      if (key === 'pk_test_no_permissions') {
        return {
          valid: true,
          keyId: 'key_no_permissions',
          merchantId: 'test_merchant_123',
          permissions: [],
        };
      }
      
      return { valid: false };
    }),
  })),
}));

vi.mock('../repositories/ApiKeyUsageRepository', () => ({
  getApiKeyUsageRepository: vi.fn(() => ({
    create: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock other services
vi.mock('../services/SessionManager', () => ({
  createSessionManager: vi.fn(() => ({
    createSession: vi.fn().mockResolvedValue({ sessionId: 'test_session' }),
    getSession: vi.fn().mockResolvedValue({ sessionId: 'test_session' }),
  })),
}));

vi.mock('../services/OrchestrationService', () => ({
  getOrchestrationService: vi.fn(() => ({
    processQuery: vi.fn().mockResolvedValue({
      response: 'Test response',
      sources: [],
      predictions: [],
    }),
  })),
}));

vi.mock('../repositories/DocumentRepository', () => ({
  getDocumentRepository: vi.fn(() => ({
    search: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'doc_123' }),
    findById: vi.fn().mockResolvedValue({ id: 'doc_123' }),
    update: vi.fn().mockResolvedValue({ id: 'doc_123' }),
    delete: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../repositories/UserSessionRepository', () => ({
  getUserSessionRepository: vi.fn(() => ({
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ sessionId: 'test_session' }),
    findBySessionId: vi.fn().mockResolvedValue({ sessionId: 'test_session' }),
    update: vi.fn().mockResolvedValue({ sessionId: 'test_session' }),
    delete: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../services/AnalyticsService', () => ({
  AnalyticsService: vi.fn(() => ({
    getOverview: vi.fn().mockResolvedValue({}),
    getTopQueries: vi.fn().mockResolvedValue([]),
    getPerformance: vi.fn().mockResolvedValue({}),
    getQueries: vi.fn().mockResolvedValue([]),
    getIntents: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../services/WebhookService', () => ({
  WebhookService: vi.fn(() => ({
    createWebhook: vi.fn().mockResolvedValue({ webhookId: 'webhook_123', url: 'https://example.com', events: [], secret: 'secret' }),
    listWebhooks: vi.fn().mockResolvedValue([]),
    updateWebhook: vi.fn().mockResolvedValue({ id: 'webhook_123' }),
    deleteWebhook: vi.fn().mockResolvedValue(true),
    testWebhook: vi.fn().mockResolvedValue({ success: true }),
    getDeliveries: vi.fn().mockResolvedValue([]),
  })),
  getWebhookService: vi.fn(() => ({
    createWebhook: vi.fn().mockResolvedValue({ webhookId: 'webhook_123', url: 'https://example.com', events: [], secret: 'secret' }),
    listWebhooks: vi.fn().mockResolvedValue([]),
    updateWebhook: vi.fn().mockResolvedValue({ id: 'webhook_123' }),
    deleteWebhook: vi.fn().mockResolvedValue(true),
    testWebhook: vi.fn().mockResolvedValue({ success: true }),
    getDeliveries: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../services/ProductSyncService', () => ({
  ProductSyncService: vi.fn(() => ({
    getSyncConfig: vi.fn().mockResolvedValue({}),
    configureSync: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    createSyncConfig: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    updateSyncConfig: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    triggerSync: vi.fn().mockResolvedValue({ jobId: 'job_123' }),
    getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    getSyncHistory: vi.fn().mockResolvedValue([]),
  })),
  getProductSyncService: vi.fn(() => ({
    getSyncConfig: vi.fn().mockResolvedValue({}),
    configureSync: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    createSyncConfig: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    updateSyncConfig: vi.fn().mockResolvedValue({ id: 'sync_123' }),
    triggerSync: vi.fn().mockResolvedValue({ jobId: 'job_123' }),
    getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    getSyncHistory: vi.fn().mockResolvedValue([]),
  })),
}));

// Import additional routes for testing
import documentRoutes from '../api/routes/documents';
import webhookRoutes from '../api/routes/webhooks';
import productSyncRoutes from '../api/routes/productSync';
import analyticsRoutes from '../api/routes/analytics';
import sessionRoutes from '../api/routes/sessions';

describe('Permission Enforcement Integration Tests', () => {
  let app: Application;
  const testMerchantId = 'test_merchant_123';

  beforeAll(() => {
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || 'test-request-id';
      next();
    });
    
    // Mount routes (only API key authenticated routes)
    app.use('/api/chat', chatRoutes);
    app.use('/api/documents', documentRoutes);
    app.use('/api/merchants', webhookRoutes);
    app.use('/api/merchants', productSyncRoutes);
    app.use('/api/merchants', analyticsRoutes);
    app.use('/api/sessions', sessionRoutes);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat Permissions', () => {
    describe('chat:write permission', () => {
      it('should deny chat message without chat:write permission', async () => {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', 'Bearer pk_test_chat_read')
          .send({
            query: 'Test query',
            merchantId: testMerchantId,
            userId: 'test_user',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('chat:write');
      });

      it('should allow chat message with chat:write permission', async () => {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', 'Bearer pk_test_chat_write')
          .send({
            query: 'Test query',
            merchantId: testMerchantId,
            userId: 'test_user',
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });
    });

    describe('chat:read permission', () => {
      it('should deny reading chat history without chat:read permission', async () => {
        const response = await request(app)
          .get('/api/chat/sessions/test_session/history')
          .set('Authorization', 'Bearer pk_test_documents_read')
          .query({ merchantId: testMerchantId });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });

      it('should allow reading chat history with chat:read permission', async () => {
        const response = await request(app)
          .get('/api/chat/sessions/test_session/history')
          .set('Authorization', 'Bearer pk_test_chat_read')
          .query({ merchantId: testMerchantId });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe('Document Permissions', () => {
    describe('documents:read permission', () => {
      it('should deny document search without documents:read permission', async () => {
        const response = await request(app)
          .post('/api/documents/search')
          .set('Authorization', 'Bearer pk_test_chat_write')
          .send({
            merchantId: testMerchantId,
            query: 'test query',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('documents:read');
      });

      it('should allow document search with documents:read permission', async () => {
        const response = await request(app)
          .post('/api/documents/search')
          .set('Authorization', 'Bearer pk_test_documents_read')
          .send({
            merchantId: testMerchantId,
            query: 'test query',
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny getting document stats without documents:read permission', async () => {
        const response = await request(app)
          .get('/api/documents/stats')
          .set('Authorization', 'Bearer pk_test_chat_write')
          .query({ merchantId: testMerchantId });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });

    describe('documents:write permission', () => {
      it('should deny document creation without documents:write permission', async () => {
        const response = await request(app)
          .post('/api/documents')
          .set('Authorization', 'Bearer pk_test_documents_read')
          .send({
            merchantId: testMerchantId,
            content: 'Test content',
            title: 'Test document',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('documents:write');
      });

      it('should allow document creation with documents:write permission', async () => {
        const response = await request(app)
          .post('/api/documents')
          .set('Authorization', 'Bearer pk_test_documents_write')
          .send({
            merchantId: testMerchantId,
            content: 'Test content',
            title: 'Test document',
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny bulk upload without documents:write permission', async () => {
        const response = await request(app)
          .post('/api/documents/bulk')
          .set('Authorization', 'Bearer pk_test_documents_read')
          .send({
            merchantId: testMerchantId,
            documents: [
              {
                title: 'Test',
                body: 'Content',
                documentType: 'product',
              },
            ],
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });

    describe('documents:delete permission', () => {
      it('should deny document deletion without documents:delete permission', async () => {
        const response = await request(app)
          .delete('/api/documents/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', 'Bearer pk_test_documents_write')
          .send({ merchantId: testMerchantId });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('documents:delete');
      });

      it('should allow document deletion with documents:delete permission', async () => {
        const response = await request(app)
          .delete('/api/documents/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', 'Bearer pk_test_documents_delete')
          .send({ merchantId: testMerchantId });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe('Webhook Permissions', () => {
    describe('webhooks:read permission', () => {
      it('should deny listing webhooks without webhooks:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/webhooks`)
          .set('Authorization', 'Bearer pk_test_chat_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('webhooks:read');
      });

      it('should allow listing webhooks with webhooks:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/webhooks`)
          .set('Authorization', 'Bearer pk_test_webhooks_read');

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny getting webhook deliveries without webhooks:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/webhooks/webhook_123/deliveries`)
          .set('Authorization', 'Bearer pk_test_webhooks_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });

    describe('webhooks:write permission', () => {
      it('should deny creating webhook without webhooks:write permission', async () => {
        const response = await request(app)
          .post(`/api/merchants/${testMerchantId}/webhooks`)
          .set('Authorization', 'Bearer pk_test_webhooks_read')
          .send({
            url: 'https://example.com/webhook',
            events: ['chat.completed'],
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('webhooks:write');
      });

      it('should allow creating webhook with webhooks:write permission', async () => {
        const response = await request(app)
          .post(`/api/merchants/${testMerchantId}/webhooks`)
          .set('Authorization', 'Bearer pk_test_webhooks_write')
          .send({
            url: 'https://example.com/webhook',
            events: ['chat.completed'],
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny updating webhook without webhooks:write permission', async () => {
        const response = await request(app)
          .put(`/api/merchants/${testMerchantId}/webhooks/webhook_123`)
          .set('Authorization', 'Bearer pk_test_webhooks_read')
          .send({
            url: 'https://example.com/webhook-updated',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });

      it('should deny deleting webhook without webhooks:write permission', async () => {
        const response = await request(app)
          .delete(`/api/merchants/${testMerchantId}/webhooks/webhook_123`)
          .set('Authorization', 'Bearer pk_test_webhooks_read');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });
  });

  describe('Product Sync Permissions', () => {
    describe('sync:read permission', () => {
      it('should deny getting sync config without sync:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/sync/configure`)
          .set('Authorization', 'Bearer pk_test_sync_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('sync:read');
      });

      it('should allow getting sync config with sync:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/sync/configure`)
          .set('Authorization', 'Bearer pk_test_sync_read');

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny getting sync status without sync:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/sync/status`)
          .set('Authorization', 'Bearer pk_test_chat_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });

      it('should deny getting sync history without sync:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/sync/history`)
          .set('Authorization', 'Bearer pk_test_sync_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });

    describe('sync:write permission', () => {
      it('should deny configuring sync without sync:write permission', async () => {
        const response = await request(app)
          .post(`/api/merchants/${testMerchantId}/sync/configure`)
          .set('Authorization', 'Bearer pk_test_sync_read')
          .send({
            syncType: 'manual',
            sourceType: 'csv',
            fieldMapping: {
              sku: 'sku',
              title: 'name',
              description: 'desc',
            },
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('sync:write');
      });

      it('should allow configuring sync with sync:write permission', async () => {
        const response = await request(app)
          .post(`/api/merchants/${testMerchantId}/sync/configure`)
          .set('Authorization', 'Bearer pk_test_sync_write')
          .send({
            syncType: 'manual',
            sourceType: 'csv',
            fieldMapping: {
              sku: 'sku',
              title: 'name',
              description: 'desc',
            },
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny triggering sync without sync:write permission', async () => {
        const response = await request(app)
          .post(`/api/merchants/${testMerchantId}/sync/trigger`)
          .set('Authorization', 'Bearer pk_test_sync_read');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });
  });

  describe('Analytics Permissions', () => {
    describe('analytics:read permission', () => {
      it('should deny getting analytics overview without analytics:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/analytics/overview`)
          .set('Authorization', 'Bearer pk_test_chat_write');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('analytics:read');
      });

      it('should allow getting analytics overview with analytics:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/analytics/overview`)
          .set('Authorization', 'Bearer pk_test_analytics_read');

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny getting top queries without analytics:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/analytics/top-queries`)
          .set('Authorization', 'Bearer pk_test_documents_read');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });

      it('should deny getting performance metrics without analytics:read permission', async () => {
        const response = await request(app)
          .get(`/api/merchants/${testMerchantId}/analytics/performance`)
          .set('Authorization', 'Bearer pk_test_webhooks_read');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });
  });

  describe('Session Permissions', () => {
    describe('sessions:write permission', () => {
      it('should deny creating session without sessions:write permission', async () => {
        const response = await request(app)
          .post('/api/sessions')
          .set('Authorization', 'Bearer pk_test_chat_read')
          .send({
            merchantId: testMerchantId,
            userId: 'test_user',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('sessions:write');
      });

      it('should allow creating session with sessions:write permission', async () => {
        const response = await request(app)
          .post('/api/sessions')
          .set('Authorization', 'Bearer pk_test_chat_write')
          .send({
            merchantId: testMerchantId,
            userId: 'test_user',
          });

        // Should pass permission check (not 403)
        expect(response.status).not.toBe(403);
      });

      it('should deny updating session context without sessions:write permission', async () => {
        const response = await request(app)
          .put('/api/sessions/test_session/context')
          .set('Authorization', 'Bearer pk_test_chat_read')
          .send({
            merchantId: testMerchantId,
            context: { key: 'value' },
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
      });
    });

    describe('sessions:read permission', () => {
      it('should deny getting session without sessions:read permission', async () => {
        const response = await request(app)
          .get('/api/sessions/test_session')
          .set('Authorization', 'Bearer pk_test_documents_read')
          .query({ merchantId: testMerchantId });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
        expect(response.body.message).toContain('sessions:read');
      });
    });
  });





  describe('No Permissions', () => {
    it('should deny chat endpoint with no permissions', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', 'Bearer pk_test_no_permissions')
        .send({
          query: 'test',
          merchantId: testMerchantId,
          userId: 'test',
        });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('Wildcard Permission', () => {
    it('should not deny access with wildcard permission', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', 'Bearer pk_test_wildcard')
        .send({
          query: 'test',
          merchantId: testMerchantId,
          userId: 'test',
        });
      
      // Wildcard permission should pass permission check (not 403)
      // May fail with other errors (500, 400) due to missing mocks, but should not be 403
      expect(response.status).not.toBe(403);
    });
  });

  describe('Invalid API Key', () => {
    it('should deny access with invalid API key', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', 'Bearer pk_test_invalid')
        .send({
          query: 'test',
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired API key');
    });

    it('should deny access without API key', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          query: 'test',
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing or invalid API key');
    });
  });
});
