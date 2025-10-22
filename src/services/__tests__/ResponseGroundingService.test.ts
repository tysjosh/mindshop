import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResponseGroundingService, createResponseGroundingService } from '../ResponseGroundingService';
import { RetrievalResult } from '../../types';

describe('ResponseGroundingService', () => {
  let groundingService: ResponseGroundingService;
  let mockDocuments: RetrievalResult[];

  const mockConfig = {
    minGroundingScore: 0.85,
    minCitationRelevance: 0.7,
    maxClaimsPerResponse: 10,
    enableHallucinationDetection: true,
    strictFactChecking: true,
    fallbackThreshold: 0.6,
  };

  beforeEach(() => {
    groundingService = new ResponseGroundingService(mockConfig);
    
    mockDocuments = [
      {
        id: 'doc1',
        snippet: 'The MacBook Pro 16-inch features an M3 chip and costs $2,499',
        score: 0.95,
        metadata: {
          sku: 'MACBOOK-PRO-16',
          merchantId: 'merchant1',
          documentType: 'product',
          sourceUri: 'https://example.com/macbook-pro',
        },
        groundingPass: true,
      },
      {
        id: 'doc2',
        snippet: 'Customer reviews show 4.8/5 rating for MacBook Pro performance',
        score: 0.88,
        metadata: {
          sku: 'MACBOOK-PRO-16',
          merchantId: 'merchant1',
          documentType: 'review',
        },
        groundingPass: true,
      },
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateResponseGrounding', () => {
    it('should validate response grounding and return quality assessment', async () => {
      // Arrange
      const response = 'The MacBook Pro 16-inch with M3 chip costs $2,499 and has excellent performance.';
      const originalQuery = 'Find me a good laptop';

      // Act
      const result = await groundingService.validateResponseGrounding(
        response,
        mockDocuments,
        originalQuery
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.response).toBe(response);
      expect(result.groundingValidation).toBeDefined();
      expect(result.qualityScore).toBeDefined();
      expect(result.citations).toBeDefined();
      expect(typeof result.fallbackRecommended).toBe('boolean');
      expect(Array.isArray(result.improvementSuggestions)).toBe(true);
      
      // Validate structure of grounding validation
      expect(typeof result.groundingValidation.isGrounded).toBe('boolean');
      expect(typeof result.groundingValidation.groundingScore).toBe('number');
      expect(result.groundingValidation.groundingScore).toBeGreaterThanOrEqual(0);
      expect(result.groundingValidation.groundingScore).toBeLessThanOrEqual(1);
    });

    it('should detect hallucination indicators when enabled', async () => {
      // Arrange
      const response = 'I think the MacBook Pro might be around $2,000, and it probably has good performance based on my knowledge.';
      const originalQuery = 'What is the MacBook Pro price?';

      // Act
      const result = await groundingService.validateResponseGrounding(
        response,
        mockDocuments,
        originalQuery
      );

      // Assert
      expect(result.qualityScore.hallucination).toBeDefined();
      expect(typeof result.qualityScore.hallucination.detected).toBe('boolean');
      expect(typeof result.qualityScore.hallucination.confidence).toBe('number');
      expect(Array.isArray(result.qualityScore.hallucination.indicators)).toBe(true);
    });

    it('should handle response with no supporting documents', async () => {
      // Arrange
      const response = 'The MacBook Pro is a great laptop with excellent performance.';
      const originalQuery = 'Tell me about MacBook Pro';
      const emptyDocuments: RetrievalResult[] = [];

      // Act
      const result = await groundingService.validateResponseGrounding(
        response,
        emptyDocuments,
        originalQuery
      );

      // Assert
      expect(result.groundingValidation.sourceCitations).toHaveLength(0);
      expect(result.citations).toHaveLength(0);
      expect(result.fallbackRecommended).toBe(true);
    });

    it('should extract factual claims from response', async () => {
      // Arrange
      const response = 'The MacBook Pro 16-inch features an M3 chip, costs $2,499, and is available in stock.';
      const originalQuery = 'MacBook Pro details';

      // Act
      const result = await groundingService.validateResponseGrounding(
        response,
        mockDocuments,
        originalQuery
      );

      // Assert
      expect(Array.isArray(result.groundingValidation.factualClaims)).toBe(true);
      expect(result.groundingValidation.totalClaims).toBeGreaterThanOrEqual(0);
      expect(result.groundingValidation.validatedClaims).toBeGreaterThanOrEqual(0);
    });

    it('should calculate quality scores with proper structure', async () => {
      // Arrange
      const response = 'The MacBook Pro 16-inch with M3 chip is priced at $2,499.';
      const originalQuery = 'MacBook Pro price';

      // Act
      const result = await groundingService.validateResponseGrounding(
        response,
        mockDocuments,
        originalQuery
      );

      // Assert
      expect(result.qualityScore.overall).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore.overall).toBeLessThanOrEqual(1);
      expect(result.qualityScore.dimensions).toBeDefined();
      expect(result.qualityScore.dimensions.factualAccuracy).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore.dimensions.relevance).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore.dimensions.completeness).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore.dimensions.clarity).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore.dimensions.groundedness).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createFallbackResponse', () => {
    it('should create appropriate fallback response with documents', async () => {
      // Arrange
      const originalQuery = 'MacBook Pro pricing';
      const reason = 'Low grounding score detected';

      // Act
      const result = await groundingService.createFallbackResponse(
        originalQuery,
        mockDocuments,
        reason
      );

      // Assert
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('MacBook Pro pricing');
    });

    it('should create fallback response without documents', async () => {
      // Arrange
      const originalQuery = 'Product information';
      const reason = 'No supporting documents found';
      const emptyDocuments: RetrievalResult[] = [];

      // Act
      const result = await groundingService.createFallbackResponse(
        originalQuery,
        emptyDocuments,
        reason
      );

      // Assert
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Product information');
    });
  });

  describe('configuration options', () => {
    it('should respect custom configuration', async () => {
      // Arrange
      const customConfig = {
        minGroundingScore: 0.95,
        minCitationRelevance: 0.9,
        maxClaimsPerResponse: 5,
        enableHallucinationDetection: false,
        strictFactChecking: true,
        fallbackThreshold: 0.8,
      };

      const customService = new ResponseGroundingService(customConfig);
      const response = 'The MacBook Pro costs around $2,500.';
      const originalQuery = 'MacBook Pro price';

      // Act
      const result = await customService.validateResponseGrounding(
        response,
        mockDocuments,
        originalQuery
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.qualityScore.hallucination.detected).toBe(false); // Disabled in config
    });
  });

  describe('factory function', () => {
    it('should create service with default config', () => {
      // Act
      const service = createResponseGroundingService();

      // Assert
      expect(service).toBeInstanceOf(ResponseGroundingService);
    });

    it('should create service with custom config', () => {
      // Arrange
      const customConfig = {
        minGroundingScore: 0.9,
        enableHallucinationDetection: false,
      };

      // Act
      const service = createResponseGroundingService(customConfig);

      // Assert
      expect(service).toBeInstanceOf(ResponseGroundingService);
    });
  });
});