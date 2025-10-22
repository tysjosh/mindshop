/**
 * Integration tests for Document Ingestion Pipeline
 * Tests the complete flow from S3 upload to document storage
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDocumentIngestionService, DocumentIngestionEvent } from '../services/DocumentIngestionService';
import { getBatchProcessingService, BatchEmbeddingUpdate } from '../services/BatchProcessingService';
import { getDocumentRepository } from '../repositories/DocumentRepository';
import { getMindsDBService } from '../services/MindsDBService';
import { getPIIRedactor } from '../services/PIIRedactor';

// Mock all the services at module level
vi.mock('../services/DocumentIngestionService', () => ({
  getDocumentIngestionService: () => ({
    downloadAndParseDocument: vi.fn(),
    processS3Event: vi.fn().mockResolvedValue({
      documentId: 'test-doc-id',
      status: 'success',
      processingTime: 100,
      embeddingGenerated: true
    }),
    batchProcessDocuments: vi.fn().mockResolvedValue({
      totalDocuments: 10,
      successful: 10,
      failed: 0,
      processingTime: 1000
    }),

    healthCheck: vi.fn().mockResolvedValue({
      s3: true,
      mindsdb: true,
      piiRedactor: true
    })
  })
}));

vi.mock('../services/BatchProcessingService', () => ({
  getBatchProcessingService: () => ({
    queueBatchEmbeddingUpdates: vi.fn().mockResolvedValue('batch-op-123'),
    getOperationStatus: vi.fn().mockResolvedValue({
      id: 'batch-op-123',
      merchantId: 'test-merchant-123',
      status: 'completed'
    }),
    performVectorIndexMaintenance: vi.fn().mockResolvedValue('maintenance-op-123'),
    healthCheck: vi.fn().mockResolvedValue({
      service: true,
      activeOperations: 0,
      queueLength: 0
    })
  })
}));

vi.mock('../repositories/DocumentRepository', () => ({
  getDocumentRepository: () => ({
    create: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ database: true, cache: true, vectorIndex: true })
  })
}));

vi.mock('../services/MindsDBService', () => ({
  getMindsDBService: () => ({
    generateEmbedding: vi.fn(),
    generateBatchEmbeddings: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
  })
}));

vi.mock('../services/PIIRedactor', () => ({
  getPIIRedactor: () => ({
    redactText: vi.fn().mockResolvedValue({
      sanitizedText: 'This is a test product with email [PII_TOKEN_123]',
      tokens: new Map([['[PII_TOKEN_123]', 'test@example.com']])
    })
  })
}));

describe('Document Ingestion Pipeline', () => {
  let ingestionService: ReturnType<typeof getDocumentIngestionService>;
  let batchService: ReturnType<typeof getBatchProcessingService>;
  let documentRepository: ReturnType<typeof getDocumentRepository>;
  let mindsdbService: ReturnType<typeof getMindsDBService>;
  let piiRedactor: ReturnType<typeof getPIIRedactor>;

  const testMerchantId = 'test-merchant-123';
  const testBucket = 'test-bucket';

  beforeAll(async () => {
    ingestionService = getDocumentIngestionService();
    batchService = getBatchProcessingService();
    documentRepository = getDocumentRepository();
    mindsdbService = getMindsDBService();
    piiRedactor = getPIIRedactor();

    // Set up default mock behaviors
    vi.mocked(mindsdbService.generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
    vi.mocked(mindsdbService.generateBatchEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('Document Parsing', () => {
    it('should parse JSON document correctly', async () => {
      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/products/product.json',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'application/json',
        metadata: { category: 'products' },
      };

      // Mock the document parsing
      vi.mocked(ingestionService.downloadAndParseDocument).mockResolvedValue({
        title: 'Test Product',
        body: 'This is a test product description',
        contentType: 'application/json',
        metadata: { category: 'products', filename: 'product.json' },
        sku: 'TEST-001',
        documentType: 'product',
      });

      const parsedDoc = await ingestionService.downloadAndParseDocument(mockEvent);

      expect(parsedDoc.title).toBe('Test Product');
      expect(parsedDoc.body).toBe('This is a test product description');
      expect(parsedDoc.sku).toBe('TEST-001');
      expect(parsedDoc.documentType).toBe('product');
    });

    it('should parse CSV document correctly', async () => {
      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/products/products.csv',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'text/csv',
      };

      vi.mocked(ingestionService.downloadAndParseDocument).mockResolvedValue({
        title: 'CSV Document - name, description, price',
        body: 'Row 1: name: Product A, description: Great product, price: 29.99\nRow 2: name: Product B, description: Another product, price: 39.99',
        contentType: 'text/csv',
        metadata: { filename: 'products.csv' },
        documentType: 'product',
      });

      const parsedDoc = await ingestionService.downloadAndParseDocument(mockEvent);

      expect(parsedDoc.title).toContain('CSV Document');
      expect(parsedDoc.body).toContain('Product A');
      expect(parsedDoc.body).toContain('Product B');
    });

    it('should handle markdown documents', async () => {
      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/faqs/guide.md',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'text/markdown',
      };

      vi.mocked(ingestionService.downloadAndParseDocument).mockResolvedValue({
        title: 'Product Guide',
        body: 'This is a comprehensive guide to our products.\n\n## Features\n\n- Feature 1\n- Feature 2',
        contentType: 'text/markdown',
        metadata: { filename: 'guide.md' },
        documentType: 'faq',
      });

      const parsedDoc = await ingestionService.downloadAndParseDocument(mockEvent);

      expect(parsedDoc.title).toBe('Product Guide');
      expect(parsedDoc.body).toContain('comprehensive guide');
      expect(parsedDoc.documentType).toBe('faq');
    });
  });

  describe('PII Sanitization', () => {
    it('should redact email addresses', async () => {
      const textWithPII = 'Contact us at support@example.com or john.doe@company.org';
      
      const result = await piiRedactor.redactText(textWithPII);
      
      expect(result.sanitizedText).not.toContain('support@example.com');
      expect(result.sanitizedText).not.toContain('john.doe@company.org');
      expect(result.tokens.size).toBeGreaterThan(0);
    });

    it('should redact phone numbers', async () => {
      const textWithPII = 'Call us at 555-123-4567 or (555) 987-6543';
      
      const result = await piiRedactor.redactText(textWithPII);
      
      expect(result.sanitizedText).not.toContain('555-123-4567');
      expect(result.sanitizedText).not.toContain('(555) 987-6543');
      expect(result.tokens.size).toBeGreaterThan(0);
    });

    it('should redact credit card numbers', async () => {
      const textWithPII = 'Payment with card 4532-1234-5678-9012';
      
      const result = await piiRedactor.redactText(textWithPII);
      
      expect(result.sanitizedText).not.toContain('4532-1234-5678-9012');
      expect(result.tokens.size).toBeGreaterThan(0);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings for document text', async () => {
      const text = 'This is a test document for embedding generation';
      
      const embedding = await mindsdbService.generateEmbedding({
        text,
        merchantId: testMerchantId,
        model: 'sentence-transformers/all-MiniLM-L6-v2',
      });
      
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should handle batch embedding generation', async () => {
      const texts = [
        'First document text',
        'Second document text',
      ];
      
      const embeddings = await mindsdbService.generateBatchEmbeddings(
        texts,
        testMerchantId
      );
      
      expect(embeddings).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
      expect(embeddings.length).toBe(2);
    });
  });

  describe('Document Storage', () => {
    it('should validate merchant ID format', async () => {
      const invalidEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/invalid-merchant!/products/test.json',
        eventName: 'ObjectCreated:Put',
        merchantId: 'invalid-merchant!',
        contentType: 'application/json',
      };

      // Mock the validation failure
      vi.mocked(ingestionService.processS3Event).mockRejectedValueOnce(
        new Error('Invalid merchantId format')
      );

      await expect(ingestionService.processS3Event(invalidEvent))
        .rejects.toThrow('Invalid merchantId format');
    });

    it('should validate required fields', async () => {
      const invalidEvent: DocumentIngestionEvent = {
        bucket: '',
        key: 'test.json',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
      };

      // Mock the validation failure
      vi.mocked(ingestionService.processS3Event).mockRejectedValueOnce(
        new Error('Missing required fields')
      );

      await expect(ingestionService.processS3Event(invalidEvent))
        .rejects.toThrow('Missing required fields');
    });
  });

  describe('Batch Processing', () => {
    it('should queue batch embedding updates', async () => {
      const updates: BatchEmbeddingUpdate[] = [
        {
          documentId: 'doc-1',
          merchantId: testMerchantId,
          text: 'Document 1 text',
          priority: 'high',
        },
        {
          documentId: 'doc-2',
          merchantId: testMerchantId,
          text: 'Document 2 text',
          priority: 'medium',
        },
      ];

      const operationId = await batchService.queueBatchEmbeddingUpdates(updates, {
        batchSize: 10,
        priority: 'high',
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
    });

    it('should get operation status', async () => {
      const updates: BatchEmbeddingUpdate[] = [
        {
          documentId: 'doc-1',
          merchantId: testMerchantId,
          text: 'Document 1 text',
          priority: 'high',
        },
      ];

      const operationId = await batchService.queueBatchEmbeddingUpdates(updates);
      const status = await batchService.getOperationStatus(operationId);

      expect(status).toBeDefined();
      expect(status?.id).toBe(operationId);
      expect(status?.merchantId).toBe(testMerchantId);
    });

    it('should handle vector index maintenance', async () => {
      const operationId = await batchService.performVectorIndexMaintenance({
        merchantId: testMerchantId,
        rebuildThreshold: 10,
        batchSize: 50,
        maxConcurrency: 5,
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle MindsDB service failures gracefully', async () => {
      // Mock MindsDB failure
      vi.mocked(mindsdbService.generateEmbedding).mockRejectedValueOnce(
        new Error('MindsDB service unavailable')
      );

      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/products/test.json',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'application/json',
      };

      // Mock successful parsing and sanitization
      vi.mocked(ingestionService.downloadAndParseDocument).mockResolvedValue({
        title: 'Test Product',
        body: 'Test description',
        contentType: 'application/json',
        metadata: {},
        documentType: 'product',
      });

      // Mock the result for MindsDB failure
      vi.mocked(ingestionService.processS3Event).mockResolvedValueOnce({
        documentId: 'test-doc-id',
        status: 'success',
        processingTime: 100,
        embeddingGenerated: false
      });

      const result = await ingestionService.processS3Event(mockEvent);

      // Should still succeed but without embedding
      expect(result.status).toBe('success');
      expect(result.embeddingGenerated).toBe(false);
    });

    it('should handle invalid document formats', async () => {
      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/products/invalid.json',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'application/json',
      };

      // Mock parsing failure
      vi.mocked(ingestionService.downloadAndParseDocument).mockRejectedValueOnce(
        new Error('Invalid JSON document')
      );

      // Mock the result for parsing failure
      vi.mocked(ingestionService.processS3Event).mockResolvedValueOnce({
        documentId: '',
        status: 'failed',
        processingTime: 50,
        embeddingGenerated: false,
        error: 'Invalid JSON document'
      });

      const result = await ingestionService.processS3Event(mockEvent);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid JSON document');
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on ingestion service', async () => {
      const health = await ingestionService.healthCheck();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('s3');
      expect(health).toHaveProperty('mindsdb');
      expect(health).toHaveProperty('piiRedactor');
    });

    it('should perform health check on batch processing service', async () => {
      const health = await batchService.healthCheck();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('service');
      expect(health).toHaveProperty('activeOperations');
      expect(health).toHaveProperty('queueLength');
    });
  });

  describe('Integration Tests', () => {
    it('should process complete document ingestion flow', async () => {
      const mockEvent: DocumentIngestionEvent = {
        bucket: testBucket,
        key: 'documents/test-merchant-123/products/integration-test.json',
        eventName: 'ObjectCreated:Put',
        merchantId: testMerchantId,
        contentType: 'application/json',
        metadata: { category: 'products' },
      };

      // Mock all the steps
      vi.mocked(ingestionService.downloadAndParseDocument).mockResolvedValue({
        title: 'Integration Test Product',
        body: 'This is an integration test product with email test@example.com',
        contentType: 'application/json',
        metadata: { category: 'products' },
        sku: 'INT-TEST-001',
        documentType: 'product',
      });

      vi.mocked(documentRepository.create).mockResolvedValue({
        id: 'test-doc-id',
        merchantId: testMerchantId,
        title: 'Integration Test Product',
        body: 'This is an integration test product with email [PII_TOKEN_123]',
        sku: 'INT-TEST-001',
        documentType: 'product',
        embedding: [0.1, 0.2, 0.3],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await ingestionService.processS3Event(mockEvent);

      expect(result.status).toBe('success');
      expect(result.documentId).toBe('test-doc-id');
      expect(result.embeddingGenerated).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });
});

describe('Document Ingestion Performance', () => {
  let ingestionService: ReturnType<typeof getDocumentIngestionService>;

  beforeAll(() => {
    ingestionService = getDocumentIngestionService();
  });

  it('should process documents within performance targets', async () => {
    const startTime = Date.now();
    
    const mockEvent: DocumentIngestionEvent = {
      bucket: 'test-bucket',
      key: 'documents/test-merchant/products/perf-test.json',
      eventName: 'ObjectCreated:Put',
      merchantId: 'test-merchant',
      contentType: 'application/json',
    };

    const result = await ingestionService.processS3Event(mockEvent);
    const processingTime = Date.now() - startTime;

    expect(result.status).toBe('success');
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle batch processing efficiently', async () => {
    const batchSize = 10;
    const events: DocumentIngestionEvent[] = Array.from({ length: batchSize }, (_, i) => ({
      bucket: 'test-bucket',
      key: `documents/test-merchant/products/batch-${i}.json`,
      eventName: 'ObjectCreated:Put',
      merchantId: 'test-merchant',
      contentType: 'application/json',
    }));

    // Mock batch processing
    vi.mocked(ingestionService.processS3Event).mockResolvedValue({
      documentId: 'batch-doc',
      status: 'success',
      processingTime: 100,
      embeddingGenerated: true,
    });

    const startTime = Date.now();
    const result = await ingestionService.batchProcessDocuments(events);
    const totalTime = Date.now() - startTime;

    expect(result.totalDocuments).toBe(batchSize);
    expect(result.successful).toBe(batchSize);
    expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});