import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResponseGenerationService, createResponseGenerationService } from '../ResponseGenerationService';
import { getPromptTemplateService } from '../PromptTemplateService';
import { createBedrockLLMService } from '../BedrockLLMService';
import { createResponseGroundingService } from '../ResponseGroundingService';
import { RetrievalResult, PredictionResult, UserSession } from '../../types';

// Mock dependencies
vi.mock('../PromptTemplateService');
vi.mock('../BedrockLLMService');
vi.mock('../ResponseGroundingService');

describe('ResponseGenerationService', () => {
  let responseService: ResponseGenerationService;
  let mockPromptService: any;
  let mockLLMService: any;
  let mockGroundingService: any;

  const mockConfig = {
    bedrock: {
      region: 'us-east-1',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
    },
    grounding: {
      minGroundingScore: 0.85,
      minCitationRelevance: 0.7,
      maxClaimsPerResponse: 10,
      enableHallucinationDetection: true,
      strictFactChecking: true,
      fallbackThreshold: 0.6,
    },
    promptOptimization: {
      maxTokens: 4000,
      targetCostPerPrompt: 0.01,
      preferredModelSize: 'medium' as const,
      enableFallback: true,
    },
    qualityThresholds: {
      minGroundingScore: 0.85,
      minQualityScore: 0.7,
      maxRetries: 2,
    },
  };

  beforeEach(() => {
    // Mock PromptTemplateService
    mockPromptService = {
      renderTemplate: vi.fn(),
      detokenizeResponse: vi.fn(),
      getTemplateTypes: vi.fn(),
      estimateCost: vi.fn(),
    };
    (getPromptTemplateService as any).mockReturnValue(mockPromptService);

    // Mock BedrockLLMService
    mockLLMService = {
      invokeModel: vi.fn(),
      invokeModelStream: vi.fn(),
      healthCheck: vi.fn(),
    };
    (createBedrockLLMService as any).mockReturnValue(mockLLMService);

    // Mock ResponseGroundingService
    mockGroundingService = {
      validateResponseGrounding: vi.fn(),
      createFallbackResponse: vi.fn(),
    };
    (createResponseGroundingService as any).mockReturnValue(mockGroundingService);

    responseService = new ResponseGenerationService(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateResponse', () => {
    const mockRequest = {
      query: 'Find me a good laptop',
      sessionId: 'session123',
      merchantId: 'merchant456',
      userId: 'user789',
      templateType: 'product_recommendation',
      context: {
        documents: [
          {
            id: 'doc1',
            snippet: 'MacBook Pro 16-inch with M3 chip',
            score: 0.95,
            metadata: { sku: 'MACBOOK-PRO-16', merchantId: 'merchant456', documentType: 'product' },
            groundingPass: true,
          } as RetrievalResult,
        ],
        predictions: [
          {
            sku: 'MACBOOK-PRO-16',
            demandScore: 0.9,
            purchaseProbability: 0.8,
            explanation: 'High-performance laptop with excellent reviews',
            featureImportance: { performance: 0.6, price: 0.3, brand: 0.1 },
            provenance: {
              modelId: 'product-predictor-v1',
              modelVersion: '1.2.0',
              trainingDate: '2024-01-15',
            },
            confidence: 0.88,
            merchantId: 'merchant456',
            timestamp: '2024-01-20T10:00:00Z',
          } as PredictionResult,
        ],
        sessionState: {
          sessionId: 'session123',
          userId: 'user789',
          merchantId: 'merchant456',
          conversationHistory: [],
          context: {
            preferences: { category: 'electronics' },
            purchaseHistory: [],
            currentCart: [],
            demographics: {},
          },
          createdAt: new Date(),
          lastActivity: new Date(),
        } as UserSession,
      },
    };

    it('should generate response successfully with high quality', async () => {
      // Arrange
      const mockPromptResult = {
        renderedPrompt: 'System: You are an assistant...\nUser: Find me a good laptop',
        tokenCount: 150,
        costEstimate: 0.045,
        modelSize: 'medium' as const,
        piiTokens: new Map(),
        templateUsed: 'product_recommendation',
        fallbackUsed: false,
      };

      const mockLLMResponse = {
        response: 'I recommend the MacBook Pro 16-inch with M3 chip. [Source: doc1]',
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        tokenUsage: {
          inputTokens: 150,
          outputTokens: 50,
          totalTokens: 200,
        },
        cost: {
          inputCost: 0.045,
          outputCost: 0.015,
          totalCost: 0.06,
        },
        finishReason: 'stop',
        metadata: {},
      };

      const mockQualityAssessment = {
        response: 'I recommend the MacBook Pro 16-inch with M3 chip. [Source: doc1]',
        groundingValidation: {
          isGrounded: true,
          groundingScore: 0.92,
          sourceCitations: [
            {
              documentId: 'doc1',
              documentTitle: 'MACBOOK-PRO-16',
              snippet: 'MacBook Pro 16-inch with M3 chip',
              relevanceScore: 0.95,
              citationText: '[Source: doc1]',
              groundingPass: true,
            },
          ],
          factualClaims: [],
          validatedClaims: 1,
          totalClaims: 1,
          groundingAccuracy: 100,
          confidence: 0.92,
          validationDetails: [],
        },
        qualityScore: {
          overall: 0.88,
          dimensions: {
            factualAccuracy: 0.92,
            relevance: 0.90,
            completeness: 0.85,
            clarity: 0.88,
            groundedness: 0.92,
          },
          hallucination: {
            detected: false,
            confidence: 0,
            indicators: [],
          },
          recommendations: [],
        },
        citations: [
          {
            documentId: 'doc1',
            documentTitle: 'MACBOOK-PRO-16',
            snippet: 'MacBook Pro 16-inch with M3 chip',
            relevanceScore: 0.95,
            citationText: '[Source: doc1]',
            groundingPass: true,
          },
        ],
        fallbackRecommended: false,
        improvementSuggestions: [],
      };

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockPromptService.detokenizeResponse.mockReturnValue(mockLLMResponse.response);
      mockLLMService.invokeModel.mockResolvedValue(mockLLMResponse);
      mockGroundingService.validateResponseGrounding.mockResolvedValue(mockQualityAssessment);

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(mockPromptService.renderTemplate).toHaveBeenCalledWith(
        'product_recommendation',
        'Find me a good laptop',
        mockRequest.context
      );
      expect(mockLLMService.invokeModel).toHaveBeenCalledWith({
        prompt: mockPromptResult.renderedPrompt,
        sessionId: 'session123',
        merchantId: 'merchant456',
        userId: 'user789',
        modelSize: 'medium',
        streaming: false,
      });
      expect(mockGroundingService.validateResponseGrounding).toHaveBeenCalledWith(
        mockLLMResponse.response,
        mockRequest.context.documents,
        'Find me a good laptop'
      );

      expect(result.response).toBe(mockLLMResponse.response);
      expect(result.qualityAssessment).toEqual(mockQualityAssessment);
      expect(result.metadata.templateUsed).toBe('product_recommendation');
      expect(result.metadata.modelUsed).toBe(mockLLMResponse.modelId);
      expect(result.metadata.tokenUsage).toEqual(mockLLMResponse.tokenUsage);
      expect(result.metadata.cost.totalCost).toBe(0.105); // 0.045 + 0.06
      expect(result.metadata.retryCount).toBe(0);
      expect(result.citations).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should retry with simplified template when quality is low', async () => {
      // Arrange
      const mockPromptResult = {
        renderedPrompt: 'System prompt...',
        tokenCount: 150,
        costEstimate: 0.045,
        modelSize: 'medium' as const,
        piiTokens: new Map(),
        templateUsed: 'product_recommendation',
        fallbackUsed: false,
      };

      const mockLLMResponse = {
        response: 'Here is a laptop recommendation without proper grounding.',
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        tokenUsage: { inputTokens: 150, outputTokens: 50, totalTokens: 200 },
        cost: { inputCost: 0.045, outputCost: 0.015, totalCost: 0.06 },
        finishReason: 'stop',
        metadata: {},
      };

      // First attempt - low quality
      const lowQualityAssessment = {
        response: mockLLMResponse.response,
        groundingValidation: {
          isGrounded: false,
          groundingScore: 0.3, // Below threshold
          sourceCitations: [],
          factualClaims: [],
          validatedClaims: 0,
          totalClaims: 1,
          groundingAccuracy: 0,
          confidence: 0.3,
          validationDetails: [],
        },
        qualityScore: {
          overall: 0.4, // Below threshold
          dimensions: {
            factualAccuracy: 0.3,
            relevance: 0.6,
            completeness: 0.4,
            clarity: 0.7,
            groundedness: 0.3,
          },
          hallucination: { detected: false, confidence: 0, indicators: [] },
          recommendations: ['Improve grounding'],
        },
        citations: [],
        fallbackRecommended: false,
        improvementSuggestions: ['Add source citations'],
      };

      // Second attempt - better quality
      const betterQualityAssessment = {
        ...lowQualityAssessment,
        groundingValidation: {
          ...lowQualityAssessment.groundingValidation,
          groundingScore: 0.88,
          isGrounded: true,
        },
        qualityScore: {
          ...lowQualityAssessment.qualityScore,
          overall: 0.85,
        },
      };

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockPromptService.detokenizeResponse.mockReturnValue(mockLLMResponse.response);
      mockLLMService.invokeModel.mockResolvedValue(mockLLMResponse);
      mockGroundingService.validateResponseGrounding
        .mockResolvedValueOnce(lowQualityAssessment)
        .mockResolvedValueOnce(betterQualityAssessment);

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(mockPromptService.renderTemplate).toHaveBeenCalledTimes(2);
      expect(mockLLMService.invokeModel).toHaveBeenCalledTimes(2);
      expect(result.metadata.retryCount).toBe(1);
      expect(result.warnings).toContain('Retry 1: Quality score 0.400 below threshold');
    });

    it('should use fallback response after max retries', async () => {
      // Arrange
      const mockPromptResult = {
        renderedPrompt: 'System prompt...',
        tokenCount: 150,
        costEstimate: 0.045,
        modelSize: 'medium' as const,
        piiTokens: new Map(),
        templateUsed: 'product_recommendation',
        fallbackUsed: false,
      };

      const mockLLMResponse = {
        response: 'Poor quality response',
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        tokenUsage: { inputTokens: 150, outputTokens: 50, totalTokens: 200 },
        cost: { inputCost: 0.045, outputCost: 0.015, totalCost: 0.06 },
        finishReason: 'stop',
        metadata: {},
      };

      const lowQualityAssessment = {
        response: mockLLMResponse.response,
        groundingValidation: {
          isGrounded: false,
          groundingScore: 0.2,
          sourceCitations: [],
          factualClaims: [],
          validatedClaims: 0,
          totalClaims: 1,
          groundingAccuracy: 0,
          confidence: 0.2,
          validationDetails: [],
        },
        qualityScore: {
          overall: 0.3,
          dimensions: {
            factualAccuracy: 0.2,
            relevance: 0.4,
            completeness: 0.3,
            clarity: 0.5,
            groundedness: 0.2,
          },
          hallucination: { detected: true, confidence: 0.8, indicators: ['Ungrounded claims'] },
          recommendations: ['Use fallback'],
        },
        citations: [],
        fallbackRecommended: true,
        improvementSuggestions: ['Improve document quality'],
      };

      const fallbackResponse = 'I found some relevant information but recommend reviewing the source materials directly. [Source: doc1]';

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockPromptService.detokenizeResponse.mockReturnValue(mockLLMResponse.response);
      mockLLMService.invokeModel.mockResolvedValue(mockLLMResponse);
      mockGroundingService.validateResponseGrounding.mockResolvedValue(lowQualityAssessment);
      mockGroundingService.createFallbackResponse.mockResolvedValue(fallbackResponse);

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(result.response).toBe(fallbackResponse);
      expect(result.metadata.retryCount).toBe(2); // Max retries reached
      expect(result.warnings).toContain('Response quality below threshold after maximum retries');
      expect(mockGroundingService.createFallbackResponse).toHaveBeenCalledWith(
        'Find me a good laptop',
        mockRequest.context.documents,
        'Quality validation failed'
      );
    });

    it('should handle LLM service errors gracefully', async () => {
      // Arrange
      const mockPromptResult = {
        renderedPrompt: 'System prompt...',
        tokenCount: 150,
        costEstimate: 0.045,
        modelSize: 'medium' as const,
        piiTokens: new Map(),
        templateUsed: 'product_recommendation',
        fallbackUsed: false,
      };

      const fallbackResponse = 'I apologize, but I encountered an error. Please try again.';

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockLLMService.invokeModel.mockRejectedValue(new Error('LLM service unavailable'));
      mockGroundingService.createFallbackResponse.mockResolvedValue(fallbackResponse);

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(result.response).toBe(fallbackResponse);
      expect(result.metadata.templateUsed).toBe('fallback');
      expect(result.metadata.modelUsed).toBe('none');
      expect(result.metadata.retryCount).toBe(3); // Max retries + 1
      expect(result.warnings).toContain('Retry 3: Error occurred - LLM service unavailable');
    });
  });

  describe('generateStreamingResponse', () => {
    it('should generate streaming response', async () => {
      // Arrange
      const mockRequest = {
        query: 'Tell me about laptops',
        sessionId: 'session123',
        merchantId: 'merchant456',
        templateType: 'general_query',
        context: {
          documents: [],
          predictions: [],
          sessionState: {} as UserSession,
        },
      };

      const mockPromptResult = {
        renderedPrompt: 'System prompt...',
        tokenCount: 100,
        costEstimate: 0.03,
        modelSize: 'medium' as const,
        piiTokens: new Map(),
        templateUsed: 'general_query',
        fallbackUsed: false,
      };

      const mockStreamResponse = {
        stream: (async function* () {
          yield 'Laptops ';
          yield 'are ';
          yield 'portable ';
          yield 'computers.';
        })(),
        metadata: {
          modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        },
      };

      const mockQualityAssessment = {
        response: 'Laptops are portable computers.',
        groundingValidation: {
          isGrounded: true,
          groundingScore: 0.9,
          sourceCitations: [],
          factualClaims: [],
          validatedClaims: 1,
          totalClaims: 1,
          groundingAccuracy: 100,
          confidence: 0.9,
          validationDetails: [],
        },
        qualityScore: {
          overall: 0.85,
          dimensions: {
            factualAccuracy: 0.9,
            relevance: 0.85,
            completeness: 0.8,
            clarity: 0.9,
            groundedness: 0.9,
          },
          hallucination: { detected: false, confidence: 0, indicators: [] },
          recommendations: [],
        },
        citations: [],
        fallbackRecommended: false,
        improvementSuggestions: [],
      };

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockPromptService.detokenizeResponse.mockImplementation((chunk) => chunk);
      mockLLMService.invokeModelStream.mockResolvedValue(mockStreamResponse);
      mockGroundingService.validateResponseGrounding.mockResolvedValue(mockQualityAssessment);

      // Act
      const result = await responseService.generateStreamingResponse(mockRequest);

      // Assert
      expect(result.stream).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.qualityAssessment).toBeDefined();

      // Collect streamed chunks
      const chunks: string[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Laptops ', 'are ', 'portable ', 'computers.']);

      // Wait for metadata and quality assessment
      const metadata = await result.metadata;
      const qualityAssessment = await result.qualityAssessment;

      expect(metadata.templateUsed).toBe('general_query');
      expect(qualityAssessment.qualityScore.overall).toBe(0.85);
    });
  });

  describe('estimateGenerationCost', () => {
    it('should estimate generation cost accurately', async () => {
      // Arrange
      const mockRequest = {
        query: 'Find products',
        sessionId: 'session123',
        merchantId: 'merchant456',
        templateType: 'product_recommendation',
        context: {
          documents: [],
          predictions: [],
          sessionState: {} as UserSession,
        },
      };

      const mockCostEstimate = {
        tokenCount: 200,
        costEstimate: 0.06,
        modelSize: 'medium' as const,
      };

      mockPromptService.estimateCost.mockResolvedValue(mockCostEstimate);

      // Act
      const result = await responseService.estimateGenerationCost(mockRequest);

      // Assert
      expect(mockPromptService.estimateCost).toHaveBeenCalledWith(
        'product_recommendation',
        'Find products',
        mockRequest.context
      );
      expect(result.promptCost).toBe(0.06);
      expect(result.estimatedLLMCost).toBe(0.06);
      expect(result.totalEstimatedCost).toBe(0.12);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all components are healthy', async () => {
      // Arrange
      mockPromptService.getTemplateTypes.mockReturnValue(['template1', 'template2']);
      mockLLMService.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { responseTime: 100 },
      });

      // Act
      const result = await responseService.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.components.promptService).toBe('healthy');
      expect(result.components.llmService).toBe('healthy');
      expect(result.components.groundingService).toBe('healthy');
    });

    it('should return degraded status when LLM service is unhealthy', async () => {
      // Arrange
      mockPromptService.getTemplateTypes.mockReturnValue(['template1']);
      mockLLMService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        details: { error: 'Connection timeout' },
      });

      // Act
      const result = await responseService.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.components.promptService).toBe('healthy');
      expect(result.components.llmService).toBe('unhealthy');
      expect(result.components.groundingService).toBe('healthy');
    });

    it('should return unhealthy status when health check throws error', async () => {
      // Arrange
      mockPromptService.getTemplateTypes.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      // Act
      const result = await responseService.healthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBe('Service unavailable');
    });
  });

  describe('factory function', () => {
    it('should create service instance with config', () => {
      // Act
      const service = createResponseGenerationService(mockConfig);

      // Assert
      expect(service).toBeInstanceOf(ResponseGenerationService);
    });
  });

  describe('cost tracking and token usage monitoring', () => {
    it('should track detailed cost breakdown', async () => {
      // Arrange
      const mockRequest = {
        query: 'Expensive query with lots of context',
        sessionId: 'session123',
        merchantId: 'merchant456',
        templateType: 'product_recommendation',
        context: {
          documents: Array.from({ length: 10 }, (_, i) => ({
            id: `doc${i}`,
            snippet: `Document ${i} with substantial content`,
            score: 0.8,
            metadata: { sku: `PROD-${i}`, merchantId: 'merchant456', documentType: 'product' },
            groundingPass: true,
          })) as RetrievalResult[],
          predictions: [],
          sessionState: {} as UserSession,
        },
      };

      const mockPromptResult = {
        renderedPrompt: 'Very long prompt...',
        tokenCount: 1000,
        costEstimate: 0.3, // High prompt cost
        modelSize: 'large' as const,
        piiTokens: new Map(),
        templateUsed: 'product_recommendation',
        fallbackUsed: false,
      };

      const mockLLMResponse = {
        response: 'Detailed response with multiple recommendations...',
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
        cost: {
          inputCost: 0.3,
          outputCost: 0.15,
          totalCost: 0.45,
        },
        finishReason: 'stop',
        metadata: {},
      };

      const mockQualityAssessment = {
        response: mockLLMResponse.response,
        groundingValidation: {
          isGrounded: true,
          groundingScore: 0.9,
          sourceCitations: [],
          factualClaims: [],
          validatedClaims: 5,
          totalClaims: 5,
          groundingAccuracy: 100,
          confidence: 0.9,
          validationDetails: [],
        },
        qualityScore: {
          overall: 0.88,
          dimensions: {
            factualAccuracy: 0.9,
            relevance: 0.85,
            completeness: 0.9,
            clarity: 0.85,
            groundedness: 0.9,
          },
          hallucination: { detected: false, confidence: 0, indicators: [] },
          recommendations: [],
        },
        citations: [],
        fallbackRecommended: false,
        improvementSuggestions: [],
      };

      mockPromptService.renderTemplate.mockResolvedValue(mockPromptResult);
      mockPromptService.detokenizeResponse.mockReturnValue(mockLLMResponse.response);
      mockLLMService.invokeModel.mockResolvedValue(mockLLMResponse);
      mockGroundingService.validateResponseGrounding.mockResolvedValue(mockQualityAssessment);

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(result.metadata.tokenUsage.inputTokens).toBe(1000);
      expect(result.metadata.tokenUsage.outputTokens).toBe(500);
      expect(result.metadata.tokenUsage.totalTokens).toBe(1500);
      
      expect(result.metadata.cost.promptCost).toBe(0.3);
      expect(result.metadata.cost.llmCost).toBe(0.45);
      expect(result.metadata.cost.totalCost).toBe(0.75); // 0.3 + 0.45
      
      expect(result.metadata.timing.promptGeneration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timing.llmInvocation).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timing.groundingValidation).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timing.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should track timing metrics accurately', async () => {
      // Arrange
      const mockRequest = {
        query: 'Test query',
        sessionId: 'session123',
        merchantId: 'merchant456',
        templateType: 'general_query',
        context: {
          documents: [],
          predictions: [],
          sessionState: {} as UserSession,
        },
      };

      // Add delays to simulate processing time
      mockPromptService.renderTemplate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          renderedPrompt: 'Test prompt',
          tokenCount: 50,
          costEstimate: 0.015,
          modelSize: 'small' as const,
          piiTokens: new Map(),
          templateUsed: 'general_query',
          fallbackUsed: false,
        };
      });

      mockLLMService.invokeModel.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          response: 'Test response',
          modelId: 'test-model',
          tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
          cost: { inputCost: 0.015, outputCost: 0.0075, totalCost: 0.0225 },
          finishReason: 'stop',
          metadata: {},
        };
      });

      mockGroundingService.validateResponseGrounding.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return {
          response: 'Test response',
          groundingValidation: {
            isGrounded: true,
            groundingScore: 0.9,
            sourceCitations: [],
            factualClaims: [],
            validatedClaims: 1,
            totalClaims: 1,
            groundingAccuracy: 100,
            confidence: 0.9,
            validationDetails: [],
          },
          qualityScore: {
            overall: 0.85,
            dimensions: {
              factualAccuracy: 0.9,
              relevance: 0.8,
              completeness: 0.8,
              clarity: 0.9,
              groundedness: 0.9,
            },
            hallucination: { detected: false, confidence: 0, indicators: [] },
            recommendations: [],
          },
          citations: [],
          fallbackRecommended: false,
          improvementSuggestions: [],
        };
      });

      mockPromptService.detokenizeResponse.mockReturnValue('Test response');

      // Act
      const result = await responseService.generateResponse(mockRequest);

      // Assert
      expect(result.metadata.timing.promptGeneration).toBeGreaterThanOrEqual(5);
      expect(result.metadata.timing.llmInvocation).toBeGreaterThanOrEqual(10);
      expect(result.metadata.timing.groundingValidation).toBeGreaterThanOrEqual(5);
      expect(result.metadata.timing.totalTime).toBeGreaterThanOrEqual(20);
      
      // Total time should be sum of individual components (approximately)
      const sumOfComponents = 
        result.metadata.timing.promptGeneration +
        result.metadata.timing.llmInvocation +
        result.metadata.timing.groundingValidation;
      
      expect(result.metadata.timing.totalTime).toBeGreaterThanOrEqual(sumOfComponents);
    });
  });
});