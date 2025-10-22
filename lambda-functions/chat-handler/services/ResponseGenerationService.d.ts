import { BedrockLLMConfig } from './BedrockLLMService';
import { ResponseQualityAssessment, GroundingConfig } from './ResponseGroundingService';
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
export declare class ResponseGenerationService {
    private readonly promptService;
    private readonly llmService;
    private readonly groundingService;
    private readonly config;
    constructor(config: ResponseGenerationConfig);
    generateResponse(request: GenerationRequest): Promise<GenerationResult>;
    generateStreamingResponse(request: GenerationRequest): Promise<StreamingGenerationResult>;
    private createProcessedStream;
    private createStreamingMetadata;
    private createStreamingQualityAssessment;
    private meetsQualityThresholds;
    private getSimplifiedTemplate;
    private formatCitations;
    estimateGenerationCost(request: GenerationRequest): Promise<{
        promptCost: number;
        estimatedLLMCost: number;
        totalEstimatedCost: number;
    }>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        components: {
            promptService: 'healthy' | 'unhealthy';
            llmService: 'healthy' | 'unhealthy';
            groundingService: 'healthy' | 'unhealthy';
        };
        details: any;
    }>;
}
export declare const createResponseGenerationService: (config: ResponseGenerationConfig) => ResponseGenerationService;
//# sourceMappingURL=ResponseGenerationService.d.ts.map