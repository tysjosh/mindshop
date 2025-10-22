import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingService } from '../EmbeddingService';
import { MindsDBService } from '../MindsDBService';
import { PIIRedactorService } from '../PIIRedactor';
import { DocumentRepository } from '../../repositories/DocumentRepository';
import { Document } from '../../models/Document';

// Mock dependencies
vi.mock('../MindsDBService');
vi.mock('../PIIRedactor');
vi.mock('../../repositories/DocumentRepository');
vi.mock('../CacheService', () => ({
  getCacheService: () => ({
    get: vi.fn(),
    set: vi.fn(),
    invalidateByPattern: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  }),
}));

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockMindsDBService: any;
  let mockPIIRedactor: any;
  let mockDocumentRepository: any;

  beforeEach(() => {
    // Create mocks
    mockMindsDBService = {
      generateEmbedding: vi.fn(),
      healthCheck: vi.fn(),
    } as any;

    mockPIIRedactor = {
      redactQuery: vi.fn(),
    } as any;

    mockDocumentRepository = {
      findById: vi.fn(),
      updateEmbedding: vi.fn(),
      findByMerchant: vi.fn(),
      healthCheck: vi.fn(),
    } as any;

    // Create service instance with mocks
    embeddingService = new EmbeddingService(mockMindsDBService, mockDocumentRepository);
    
    // Replace the PII redactor with mock
    (embeddingService as any).piiRedactor = mockPIIRedactor;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding with PII redaction', async () => {
      // Arrange
      const request = {
        text: 'Contact us at john@example.com for more info',
        merchantId: 'merchant123',
      };

      const mockRedactionResult = {
        sanitizedText: 'Contact us at [PII_TOKEN_0_12345678] for more info',
        tokens: new Map([['[PII_TOKEN_0_12345678]', 'john@example.com']]),
      };

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      mockPIIRedactor.redactQuery.mockReturnValue(mockRedactionResult);
      mockMindsDBService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await embeddingService.generateEmbedding(request);

      // Assert
      expect(mockPIIRedactor.redactQuery).toHaveBeenCalledWith(request.text);
      expect(mockMindsDBService.generateEmbedding).toHaveBeenCalledWith({
        text: mockRedactionResult.sanitizedText,
        merchantId: request.merchantId,
        model: 'sentence-transformers/all-MiniLM-L6-v2',
      });
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.originalText).toBe(request.text);
      expect(result.sanitizedText).toBe(mockRedactionResult.sanitizedText);
      expect(result.tokenMap).toEqual(mockRedactionResult.tokens);
    });

    it('should skip PII redaction when requested', async () => {
      // Arrange
      const request = {
        text: 'Contact us at john@example.com for more info',
        merchantId: 'merchant123',
        skipPIIRedaction: true,
      };

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockMindsDBService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await embeddingService.generateEmbedding(request);

      // Assert
      expect(mockPIIRedactor.redactQuery).not.toHaveBeenCalled();
      expect(mockMindsDBService.generateEmbedding).toHaveBeenCalledWith({
        text: request.text,
        merchantId: request.merchantId,
        model: 'sentence-transformers/all-MiniLM-L6-v2',
      });
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.originalText).toBe(request.text);
      expect(result.sanitizedText).toBe(request.text);
      expect(result.tokenMap).toBeUndefined();
    });

    it('should throw error for invalid merchant ID', async () => {
      // Arrange
      const request = {
        text: 'Test text',
        merchantId: 'ab', // Too short
      };

      // Act & Assert
      await expect(embeddingService.generateEmbedding(request)).rejects.toThrow(
        'merchantId must be between 3 and 100 characters'
      );
    });

    it('should throw error for empty text', async () => {
      // Arrange
      const request = {
        text: '',
        merchantId: 'merchant123',
      };

      // Act & Assert
      await expect(embeddingService.generateEmbedding(request)).rejects.toThrow(
        'Text is required for embedding generation'
      );
    });

    it('should throw error for text exceeding maximum length', async () => {
      // Arrange
      const request = {
        text: 'a'.repeat(8193), // Exceeds 8192 character limit
        merchantId: 'merchant123',
      };

      // Act & Assert
      await expect(embeddingService.generateEmbedding(request)).rejects.toThrow(
        'Text length exceeds maximum limit of 8192 characters'
      );
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should process multiple texts in batches', async () => {
      // Arrange
      const request = {
        texts: ['Text 1', 'Text 2', 'Text 3'],
        merchantId: 'merchant123',
        batchSize: 2,
      };

      const mockRedactionResult = {
        sanitizedText: 'Sanitized text',
        tokens: new Map(),
      };

      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPIIRedactor.redactQuery.mockReturnValue(mockRedactionResult);
      mockMindsDBService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await embeddingService.generateBatchEmbeddings(request);

      // Assert
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(mockMindsDBService.generateEmbedding).toHaveBeenCalledTimes(3);
    });

    it('should handle batch processing errors gracefully', async () => {
      // Arrange
      const request = {
        texts: ['Text 1', 'Text 2', 'Text 3'],
        merchantId: 'merchant123',
      };

      const mockRedactionResult = {
        sanitizedText: 'Sanitized text',
        tokens: new Map(),
      };

      mockPIIRedactor.redactQuery.mockReturnValue(mockRedactionResult);
      mockMindsDBService.generateEmbedding
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockRejectedValueOnce(new Error('MindsDB error'))
        .mockResolvedValueOnce([0.4, 0.5, 0.6]);

      // Act
      const result = await embeddingService.generateBatchEmbeddings(request);

      // Assert
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].error).toBe('Embedding generation failed: MindsDB error');
    });
  });

  describe('updateDocumentEmbedding', () => {
    it('should update document embedding', async () => {
      // Arrange
      const request = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        merchantId: 'merchant123',
      };

      const mockDocument = new Document({
        id: request.documentId,
        merchantId: request.merchantId,
        title: 'Test Document',
        body: 'This is a test document',
        embedding: [], // No existing embedding
      });

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockRedactionResult = {
        sanitizedText: 'Test Document\n\nThis is a test document',
        tokens: new Map(),
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockPIIRedactor.redactQuery.mockReturnValue(mockRedactionResult);
      mockMindsDBService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDocumentRepository.updateEmbedding.mockResolvedValue(undefined);

      // Act
      await embeddingService.updateDocumentEmbedding(request);

      // Assert
      expect(mockDocumentRepository.findById).toHaveBeenCalledWith(
        request.documentId,
        request.merchantId,
        false
      );
      expect(mockMindsDBService.generateEmbedding).toHaveBeenCalledWith({
        text: 'Test Document\n\nThis is a test document',
        merchantId: request.merchantId,
        model: 'sentence-transformers/all-MiniLM-L6-v2',
      });
      expect(mockDocumentRepository.updateEmbedding).toHaveBeenCalledWith(
        request.documentId,
        request.merchantId,
        mockEmbedding
      );
    });

    it('should skip update if embedding exists and force regeneration is not requested', async () => {
      // Arrange
      const request = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        merchantId: 'merchant123',
      };

      const mockDocument = new Document({
        id: request.documentId,
        merchantId: request.merchantId,
        title: 'Test Document',
        body: 'This is a test document',
        embedding: [0.1, 0.2, 0.3], // Existing embedding
      });

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);

      // Act
      await embeddingService.updateDocumentEmbedding(request);

      // Assert
      expect(mockDocumentRepository.findById).toHaveBeenCalledWith(
        request.documentId,
        request.merchantId,
        false
      );
      expect(mockMindsDBService.generateEmbedding).not.toHaveBeenCalled();
      expect(mockDocumentRepository.updateEmbedding).not.toHaveBeenCalled();
    });

    it('should throw error if document not found', async () => {
      // Arrange
      const request = {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        merchantId: 'merchant123',
      };

      mockDocumentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(embeddingService.updateDocumentEmbedding(request)).rejects.toThrow(
        `Document not found: ${request.documentId}`
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status for all components', async () => {
      // Arrange
      mockMindsDBService.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 100,
        lastCheck: new Date(),
      });

      mockDocumentRepository.healthCheck.mockResolvedValue({
        database: true,
        cache: true,
        vectorIndex: true,
      });

      mockPIIRedactor.redactQuery.mockReturnValue({
        sanitizedText: '[PII_TOKEN_0_12345678]',
        tokens: new Map([['[PII_TOKEN_0_12345678]', 'test@example.com']]),
      });

      // Act
      const result = await embeddingService.healthCheck();

      // Assert
      expect(result.mindsdb).toBe(true);
      expect(result.piiRedactor).toBe(true);
      expect(result.documentRepository).toBe(true);
      expect(result.cache).toBe(true);
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available embedding models', () => {
      // Act
      const models = embeddingService.getAvailableModels();

      // Assert
      expect(models).toContain('sentence-transformers/all-MiniLM-L6-v2');
      expect(models).toContain('sentence-transformers/all-mpnet-base-v2');
      expect(models).toContain('text-embedding-ada-002');
      expect(models.length).toBeGreaterThan(0);
    });
  });
});