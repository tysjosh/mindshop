import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MindsDBService } from '../MindsDBService';
import { RetrievalResult, PredictionResult } from '../../types';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the cache service
vi.mock('../CacheService', () => ({
  getCacheService: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('MindsDBService', () => {
  let service: MindsDBService;
  const mockConnection = {
    endpoint: 'http://localhost:47334',
    apiKey: 'test-api-key',
    timeout: 30000,
  };

  beforeEach(() => {
    service = new MindsDBService(mockConnection);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor and validation', () => {
    it('should create service with valid connection', () => {
      expect(service).toBeInstanceOf(MindsDBService);
      expect(service.getConnectionInfo()).toEqual({
        endpoint: mockConnection.endpoint,
        timeout: mockConnection.timeout,
        hasApiKey: true,
      });
    });

    it('should throw error for missing endpoint', () => {
      expect(() => {
        new MindsDBService({ ...mockConnection, endpoint: '' });
      }).toThrow('MindsDB endpoint is required');
    });

    it('should throw error for missing API key', () => {
      expect(() => {
        new MindsDBService({ ...mockConnection, apiKey: '' });
      }).toThrow('MindsDB API key is required');
    });

    it('should throw error for invalid endpoint URL', () => {
      expect(() => {
        new MindsDBService({ ...mockConnection, endpoint: 'invalid-url' });
      }).toThrow('MindsDB endpoint must be a valid HTTP/HTTPS URL');
    });
  });

  describe('merchant ID validation', () => {
    it('should validate merchant ID format', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await expect(
        service.retrieveDocuments({
          query: 'test query',
          merchantId: 'invalid-merchant-id!',
        })
      ).rejects.toThrow('merchantId contains invalid characters');
    });

    it('should reject empty merchant ID', async () => {
      await expect(
        service.retrieveDocuments({
          query: 'test query',
          merchantId: '',
        })
      ).rejects.toThrow('Valid merchantId is required for tenant isolation');
    });

    it('should reject merchant ID that is too short', async () => {
      await expect(
        service.retrieveDocuments({
          query: 'test query',
          merchantId: 'ab',
        })
      ).rejects.toThrow('merchantId must be between 3 and 100 characters');
    });
  });

  describe('retrieveDocuments', () => {
    const validParams = {
      query: 'test product query',
      merchantId: 'merchant-123',
      limit: 5,
    };

    it('should retrieve documents successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 'doc-1',
            snippet: 'Test product description',
            score: 0.85,
            metadata: {
              sku: 'PROD-123',
              document_type: 'product',
              source_uri: 'https://example.com/product/123',
            },
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const results = await service.retrieveDocuments(validParams);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'doc-1',
        snippet: 'Test product description',
        score: 0.85,
        metadata: {
          sku: 'PROD-123',
          merchantId: 'merchant-123',
          documentType: 'product',
          sourceUri: 'https://example.com/product/123',
        },
        groundingPass: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:47334/api/sql/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('semantic_retriever'),
        })
      );
    });

    it('should handle empty query', async () => {
      await expect(
        service.retrieveDocuments({
          ...validParams,
          query: '',
        })
      ).rejects.toThrow('Query text is required for document retrieval');
    });

    it('should handle API errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      } as Response);

      await expect(
        service.retrieveDocuments(validParams)
      ).rejects.toThrow('Semantic retrieval failed');
    });

    it('should handle network timeouts', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(
        service.retrieveDocuments(validParams)
      ).rejects.toThrow('MindsDB query timeout after 30000ms');
    });
  });

  describe('predictProductSignals', () => {
    const validParams = {
      sku: 'PROD-123',
      merchantId: 'merchant-123',
      userContext: {
        userId: 'user-456',
        preferences: { category: 'electronics' },
      },
    };

    it('should predict product signals successfully', async () => {
      const mockResponse = {
        data: [
          {
            sku: 'PROD-123',
            demand_score: 0.75,
            purchase_probability: 0.65,
            explanation: 'High demand based on user preferences',
            feature_importance: JSON.stringify({
              price: 0.3,
              category_match: 0.4,
              user_history: 0.3,
            }),
            confidence: 0.85,
            model_id: 'product-signals-v1',
            model_version: '1.2.0',
            training_date: '2024-01-15',
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.predictProductSignals(validParams);

      expect(result).toEqual({
        sku: 'PROD-123',
        demandScore: 0.75,
        purchaseProbability: 0.65,
        explanation: 'High demand based on user preferences',
        featureImportance: {
          price: 0.3,
          category_match: 0.4,
          user_history: 0.3,
        },
        provenance: {
          modelId: 'product-signals-v1',
          modelVersion: '1.2.0',
          trainingDate: '2024-01-15',
        },
        confidence: 0.85,
        merchantId: 'merchant-123',
        timestamp: expect.any(String),
        // Enhanced fields
        featureGroups: {
          demographic: {},
          behavioral: {},
          product: {},
          contextual: {},
        },
        explainability: {
          shapValues: undefined,
          limeExplanation: undefined,
          topFeatures: [],
        },
      });
    });

    it('should handle empty SKU', async () => {
      await expect(
        service.predictProductSignals({
          ...validParams,
          sku: '',
        })
      ).rejects.toThrow('SKU is required for product prediction');
    });

    it('should handle no prediction available', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await expect(
        service.predictProductSignals(validParams)
      ).rejects.toThrow('No prediction available for SKU: PROD-123');
    });
  });

  describe('generateEmbedding', () => {
    const validParams = {
      text: 'Test product description',
      merchantId: 'merchant-123',
    };

    it('should generate embedding successfully', async () => {
      const mockResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.generateEmbedding(validParams);

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should handle empty text', async () => {
      await expect(
        service.generateEmbedding({
          ...validParams,
          text: '',
        })
      ).rejects.toThrow('Text is required for embedding generation');
    });

    it('should handle JSON string embedding', async () => {
      const mockResponse = {
        data: [
          {
            embedding: '[0.1, 0.2, 0.3]',
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.generateEmbedding(validParams);

      expect(result).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate batch embeddings successfully', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const merchantId = 'merchant-123';

      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ embedding: [0.1, 0.2] }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ embedding: [0.3, 0.4] }] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ embedding: [0.5, 0.6] }] }),
        } as Response);

      const results = await service.generateBatchEmbeddings(texts, merchantId);

      expect(results).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle empty texts array', async () => {
      await expect(
        service.generateBatchEmbeddings([], 'merchant-123')
      ).rejects.toThrow('At least one text is required for batch embedding generation');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unhealthy status on error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.errors).toContain('Connection failed');
    });
  });

  describe('getPredictorStatus', () => {
    it('should get predictor status successfully', async () => {
      const mockResponse = {
        data: [
          {
            name: 'semantic_retriever',
            status: 'complete',
            accuracy: 0.85,
            update_status: 'up_to_date',
            mindsdb_version: '23.10.1.0',
            error: null,
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.getPredictorStatus('semantic_retriever', 'merchant-123');

      expect(result).toEqual(mockResponse.data[0]);
    });
  });

  describe('listPredictors', () => {
    it('should list predictors successfully', async () => {
      const mockResponse = {
        data: [
          {
            name: 'semantic_retriever',
            status: 'complete',
            accuracy: 0.85,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-15T00:00:00Z',
          },
          {
            name: 'product_signals',
            status: 'complete',
            accuracy: 0.78,
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-16T00:00:00Z',
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.listPredictors('merchant-123');

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('circuit breaker functionality', () => {
    it('should track circuit breaker stats', () => {
      const stats = service.getCircuitBreakerStats();

      expect(stats).toHaveProperty('semantic_retrieval');
      expect(stats).toHaveProperty('product_prediction');
      expect(stats).toHaveProperty('embedding_generation');
      expect(stats).toHaveProperty('health_check');
    });

    it('should reset circuit breaker', () => {
      expect(() => {
        service.resetCircuitBreaker('semantic_retrieval');
      }).not.toThrow();
    });
  });

  describe('connection management', () => {
    it('should update connection configuration', () => {
      const newConfig = {
        endpoint: 'http://new-endpoint:47334',
        timeout: 60000,
      };

      service.updateConnection(newConfig);

      const connectionInfo = service.getConnectionInfo();
      expect(connectionInfo.endpoint).toBe(newConfig.endpoint);
      expect(connectionInfo.timeout).toBe(newConfig.timeout);
    });

    it('should update API key in headers', () => {
      const newApiKey = 'new-api-key';

      service.updateConnection({ apiKey: newApiKey });

      const connectionInfo = service.getConnectionInfo();
      expect(connectionInfo.hasApiKey).toBe(true);
    });
  });
});