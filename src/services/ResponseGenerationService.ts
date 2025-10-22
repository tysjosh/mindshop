import {
  PromptTemplateService,
  getPromptTemplateService,
  TemplateRenderResult,
  PromptContext,
} from './PromptTemplateService';
import {
  BedrockLLMService,
  createBedrockLLMService,
  BedrockLLMConfig,
  LLMRequest,
  LLMResponse,
} from './BedrockLLMService';
import {
  ResponseGroundingService,
  createResponseGroundingService,
  ResponseQualityAssessment,
  GroundingConfig,
} from './ResponseGroundingService';
import { RetrievalResult, PredictionResult, UserSession } from '../types';

export interface ResponseGenerationConfig {
  bedrock: BedrockLLMConfig;
  grounding: GroundingConfig;
  promptOptimization: {
    maxTokens: number;
    targetCostPerPrompt: number;
    preferredModelSize: 'small' | 'medium' | 'large';
    enableFallback: boolean;
  };
  qualityThresholds: {
    minGroundingScore: number;
    minQualityScore: number;
    maxRetries: number;
  };
}

export interface GenerationRequest {
  query: string;
  sessionId: string;
  merchantId: string;
  userId?: string;
  templateType: string;
  context: {
    documents: RetrievalResult[];
    predictions: PredictionResult[];
    sessionState: UserSession;
  };
  streaming?: boolean;
}

export interface GenerationResult {
  response: string;
  qualityAssessment: ResponseQualityAssessment;
  metadata: {
    templateUsed: string;
    modelUsed: string;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    cost: {
      promptCost: number;
      llmCost: number;
      totalCost: number;
    };
    timing: {
      promptGeneration: number;
      llmInvocation: number;
      groundingValidation: number;
      totalTime: number;
    };
    fallbackUsed: boolean;
    retryCount: number;
  };
  citations: string[];
  warnings: string[];
}

export interface StreamingGenerationResult {
  stream: AsyncIterable<string>;
  metadata: Promise<GenerationResult['metadata']>;
  qualityAssessment: Promise<ResponseQualityAssessment>;
}

export class ResponseGenerationService {
  private readonly promptService: PromptTemplateService;
  private readonly llmService: BedrockLLMService;
  private readonly groundingService: ResponseGroundingService;
  private readonly config: ResponseGenerationConfig;

  constructor(config: ResponseGenerationConfig) {
    this.config = config;
    this.promptService = getPromptTemplateService(config.promptOptimization);
    this.llmService = createBedrockLLMService(config.bedrock);
    this.groundingService = createResponseGroundingService(config.grounding);
  }

  public async generateResponse(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const warnings: string[] = [];

    while (retryCount <= this.config.qualityThresholds.maxRetries) {
      try {
        // Step 1: Generate prompt with PII protection
        const promptStart = Date.now();
        const promptResult = await this.promptService.renderTemplate(
          request.templateType,
          request.query,
          request.context
        );
        const promptTime = Date.now() - promptStart;

        // Step 2: Invoke LLM
        const llmStart = Date.now();
        const llmRequest: LLMRequest = {
          prompt: promptResult.renderedPrompt,
          sessionId: request.sessionId,
          merchantId: request.merchantId,
          userId: request.userId,
          modelSize: promptResult.modelSize,
          streaming: false,
        };

        const llmResponse = await this.llmService.invokeModel(llmRequest);
        const llmTime = Date.now() - llmStart;

        // Step 3: Detokenize response (restore PII if needed)
        let finalResponse = this.promptService.detokenizeResponse(
          llmResponse.response,
          promptResult.piiTokens
        );

        // Step 4: Validate grounding and quality
        const groundingStart = Date.now();
        const qualityAssessment = await this.groundingService.validateResponseGrounding(
          finalResponse,
          request.context.documents,
          request.query
        );
        const groundingTime = Date.now() - groundingStart;

        // Step 5: Check if quality meets thresholds
        const meetsQualityThreshold = this.meetsQualityThresholds(qualityAssessment);

        if (meetsQualityThreshold || retryCount >= this.config.qualityThresholds.maxRetries) {
          // Generate citations
          const citations = this.formatCitations(qualityAssessment.citations);

          // Add warnings if quality is below threshold but we've exhausted retries
          if (!meetsQualityThreshold) {
            warnings.push('Response quality below threshold after maximum retries');
            if (qualityAssessment.fallbackRecommended) {
              warnings.push('Fallback response recommended due to quality concerns');
              finalResponse = await this.groundingService.createFallbackResponse(
                request.query,
                request.context.documents,
                'Quality validation failed'
              );
            }
          }

          const totalTime = Date.now() - startTime;

          return {
            response: finalResponse,
            qualityAssessment,
            metadata: {
              templateUsed: promptResult.templateUsed,
              modelUsed: llmResponse.modelId,
              tokenUsage: llmResponse.tokenUsage,
              cost: {
                promptCost: promptResult.costEstimate,
                llmCost: llmResponse.cost.totalCost,
                totalCost: promptResult.costEstimate + llmResponse.cost.totalCost,
              },
              timing: {
                promptGeneration: promptTime,
                llmInvocation: llmTime,
                groundingValidation: groundingTime,
                totalTime,
              },
              fallbackUsed: promptResult.fallbackUsed,
              retryCount,
            },
            citations,
            warnings,
          };
        }

        // Quality doesn't meet threshold, prepare for retry
        retryCount++;
        warnings.push(`Retry ${retryCount}: Quality score ${qualityAssessment.qualityScore.overall.toFixed(3)} below threshold`);

        // For retry, try with more conservative settings
        if (retryCount <= this.config.qualityThresholds.maxRetries) {
          // Modify request for retry (e.g., use smaller model, simpler template)
          request.templateType = this.getSimplifiedTemplate(request.templateType);
        }

      } catch (error) {
        retryCount++;
        warnings.push(`Retry ${retryCount}: Error occurred - ${(error as Error).message}`);

        if (retryCount > this.config.qualityThresholds.maxRetries) {
          // Generate fallback response
          const fallbackResponse = await this.groundingService.createFallbackResponse(
            request.query,
            request.context.documents,
            `Generation failed after ${retryCount} attempts: ${(error as Error).message}`
          );

          const totalTime = Date.now() - startTime;

          return {
            response: fallbackResponse,
            qualityAssessment: {
              response: fallbackResponse,
              groundingValidation: {
                isGrounded: false,
                groundingScore: 0,
                sourceCitations: [],
                factualClaims: [],
                validatedClaims: 0,
                totalClaims: 0,
                groundingAccuracy: 0,
                confidence: 0,
                validationDetails: [],
              },
              qualityScore: {
                overall: 0.3, // Low score for fallback
                dimensions: {
                  factualAccuracy: 0.5,
                  relevance: 0.6,
                  completeness: 0.3,
                  clarity: 0.8,
                  groundedness: 0,
                },
                hallucination: {
                  detected: false,
                  confidence: 0,
                  indicators: [],
                },
                recommendations: ['Use fallback response due to generation failure'],
              },
              citations: [],
              fallbackRecommended: true,
              improvementSuggestions: ['Retry with different parameters', 'Check document quality'],
            },
            metadata: {
              templateUsed: 'fallback',
              modelUsed: 'none',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
              cost: {
                promptCost: 0,
                llmCost: 0,
                totalCost: 0,
              },
              timing: {
                promptGeneration: 0,
                llmInvocation: 0,
                groundingValidation: 0,
                totalTime,
              },
              fallbackUsed: true,
              retryCount,
            },
            citations: [],
            warnings,
          };
        }
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  public async generateStreamingResponse(request: GenerationRequest): Promise<StreamingGenerationResult> {
    const startTime = Date.now();

    // Generate prompt
    const promptResult = await this.promptService.renderTemplate(
      request.templateType,
      request.query,
      request.context
    );

    // Start streaming LLM invocation
    const llmRequest: LLMRequest = {
      prompt: promptResult.renderedPrompt,
      sessionId: request.sessionId,
      merchantId: request.merchantId,
      userId: request.userId,
      modelSize: promptResult.modelSize,
      streaming: true,
    };

    const streamResponse = await this.llmService.invokeModelStream(llmRequest);
    
    // Collect full response for quality assessment
    let fullResponse = '';
    const processedStream = this.createProcessedStream(
      streamResponse.stream,
      promptResult.piiTokens,
      (chunk) => {
        fullResponse += chunk;
      }
    );

    // Create promises for metadata and quality assessment
    const metadataPromise = this.createStreamingMetadata(
      streamResponse,
      promptResult,
      startTime,
      fullResponse
    );

    const qualityAssessmentPromise = this.createStreamingQualityAssessment(
      request,
      fullResponse,
      metadataPromise
    );

    return {
      stream: processedStream,
      metadata: metadataPromise,
      qualityAssessment: qualityAssessmentPromise,
    };
  }

  private async *createProcessedStream(
    originalStream: AsyncIterable<string>,
    piiTokens: Map<string, string>,
    onChunk: (chunk: string) => void
  ): AsyncIterable<string> {
    for await (const chunk of originalStream) {
      // Detokenize chunk if needed
      const processedChunk = this.promptService.detokenizeResponse(chunk, piiTokens);
      onChunk(processedChunk);
      yield processedChunk;
    }
  }

  private async createStreamingMetadata(
    streamResponse: any,
    promptResult: TemplateRenderResult,
    startTime: number,
    fullResponse: string
  ): Promise<GenerationResult['metadata']> {
    // Wait for stream to complete to get final token counts
    // This is a simplified implementation - in practice, you'd track this during streaming
    const totalTime = Date.now() - startTime;

    return {
      templateUsed: promptResult.templateUsed,
      modelUsed: streamResponse.metadata.modelId,
      tokenUsage: {
        inputTokens: promptResult.tokenCount,
        outputTokens: Math.ceil(fullResponse.length / 4), // Rough estimate
        totalTokens: promptResult.tokenCount + Math.ceil(fullResponse.length / 4),
      },
      cost: {
        promptCost: promptResult.costEstimate,
        llmCost: 0, // Would be calculated based on actual token usage
        totalCost: promptResult.costEstimate,
      },
      timing: {
        promptGeneration: 0, // Already included in total
        llmInvocation: totalTime,
        groundingValidation: 0, // Done separately
        totalTime,
      },
      fallbackUsed: promptResult.fallbackUsed,
      retryCount: 0,
    };
  }

  private async createStreamingQualityAssessment(
    request: GenerationRequest,
    fullResponse: string,
    metadataPromise: Promise<GenerationResult['metadata']>
  ): Promise<ResponseQualityAssessment> {
    // Wait for streaming to complete, then assess quality
    await metadataPromise;
    
    return this.groundingService.validateResponseGrounding(
      fullResponse,
      request.context.documents,
      request.query
    );
  }

  private meetsQualityThresholds(assessment: ResponseQualityAssessment): boolean {
    return (
      assessment.groundingValidation.groundingScore >= this.config.qualityThresholds.minGroundingScore &&
      assessment.qualityScore.overall >= this.config.qualityThresholds.minQualityScore &&
      !assessment.qualityScore.hallucination.detected
    );
  }

  private getSimplifiedTemplate(templateType: string): string {
    // Map complex templates to simpler versions for retries
    const simplificationMap: Record<string, string> = {
      'product_recommendation': 'faq_response',
      'general_query': 'faq_response',
      'checkout_assistance': 'general_query',
    };

    return simplificationMap[templateType] || 'faq_response';
  }

  private formatCitations(citations: any[]): string[] {
    return citations.map(citation => citation.citationText || `[Source: ${citation.documentId}]`);
  }

  public async estimateGenerationCost(request: GenerationRequest): Promise<{
    promptCost: number;
    estimatedLLMCost: number;
    totalEstimatedCost: number;
  }> {
    const costEstimate = await this.promptService.estimateCost(
      request.templateType,
      request.query,
      request.context
    );

    const estimatedLLMCost = costEstimate.costEstimate; // This would be more sophisticated in practice
    
    return {
      promptCost: costEstimate.costEstimate,
      estimatedLLMCost,
      totalEstimatedCost: costEstimate.costEstimate + estimatedLLMCost,
    };
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      promptService: 'healthy' | 'unhealthy';
      llmService: 'healthy' | 'unhealthy';
      groundingService: 'healthy' | 'unhealthy';
    };
    details: any;
  }> {
    try {
      // Test prompt service
      const promptHealth = this.promptService.getTemplateTypes().length > 0 ? 'healthy' : 'unhealthy';
      
      // Test LLM service
      const llmHealth = await this.llmService.healthCheck();
      
      // Grounding service is always healthy if it can be instantiated
      const groundingHealth = 'healthy';

      const allHealthy = promptHealth === 'healthy' && 
                        llmHealth.status === 'healthy' && 
                        groundingHealth === 'healthy';

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        components: {
          promptService: promptHealth,
          llmService: llmHealth.status,
          groundingService: groundingHealth,
        },
        details: {
          llmDetails: llmHealth.details,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        components: {
          promptService: 'unhealthy',
          llmService: 'unhealthy',
          groundingService: 'unhealthy',
        },
        details: {
          error: (error as Error).message,
        },
      };
    }
  }
}

// Export factory function
export const createResponseGenerationService = (config: ResponseGenerationConfig): ResponseGenerationService => {
  return new ResponseGenerationService(config);
};