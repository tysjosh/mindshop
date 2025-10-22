"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResponseGenerationService = exports.ResponseGenerationService = void 0;
const PromptTemplateService_1 = require("./PromptTemplateService");
const BedrockLLMService_1 = require("./BedrockLLMService");
const ResponseGroundingService_1 = require("./ResponseGroundingService");
class ResponseGenerationService {
    constructor(config) {
        this.config = config;
        this.promptService = (0, PromptTemplateService_1.getPromptTemplateService)(config.promptOptimization);
        this.llmService = (0, BedrockLLMService_1.createBedrockLLMService)(config.bedrock);
        this.groundingService = (0, ResponseGroundingService_1.createResponseGroundingService)(config.grounding);
    }
    async generateResponse(request) {
        const startTime = Date.now();
        let retryCount = 0;
        const warnings = [];
        while (retryCount <= this.config.qualityThresholds.maxRetries) {
            try {
                // Step 1: Generate prompt with PII protection
                const promptStart = Date.now();
                const promptResult = await this.promptService.renderTemplate(request.templateType, request.query, request.context);
                const promptTime = Date.now() - promptStart;
                // Step 2: Invoke LLM
                const llmStart = Date.now();
                const llmRequest = {
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
                let finalResponse = this.promptService.detokenizeResponse(llmResponse.response, promptResult.piiTokens);
                // Step 4: Validate grounding and quality
                const groundingStart = Date.now();
                const qualityAssessment = await this.groundingService.validateResponseGrounding(finalResponse, request.context.documents, request.query);
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
                            finalResponse = await this.groundingService.createFallbackResponse(request.query, request.context.documents, 'Quality validation failed');
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
            }
            catch (error) {
                retryCount++;
                warnings.push(`Retry ${retryCount}: Error occurred - ${error.message}`);
                if (retryCount > this.config.qualityThresholds.maxRetries) {
                    // Generate fallback response
                    const fallbackResponse = await this.groundingService.createFallbackResponse(request.query, request.context.documents, `Generation failed after ${retryCount} attempts: ${error.message}`);
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
    async generateStreamingResponse(request) {
        const startTime = Date.now();
        // Generate prompt
        const promptResult = await this.promptService.renderTemplate(request.templateType, request.query, request.context);
        // Start streaming LLM invocation
        const llmRequest = {
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
        const processedStream = this.createProcessedStream(streamResponse.stream, promptResult.piiTokens, (chunk) => {
            fullResponse += chunk;
        });
        // Create promises for metadata and quality assessment
        const metadataPromise = this.createStreamingMetadata(streamResponse, promptResult, startTime, fullResponse);
        const qualityAssessmentPromise = this.createStreamingQualityAssessment(request, fullResponse, metadataPromise);
        return {
            stream: processedStream,
            metadata: metadataPromise,
            qualityAssessment: qualityAssessmentPromise,
        };
    }
    async *createProcessedStream(originalStream, piiTokens, onChunk) {
        for await (const chunk of originalStream) {
            // Detokenize chunk if needed
            const processedChunk = this.promptService.detokenizeResponse(chunk, piiTokens);
            onChunk(processedChunk);
            yield processedChunk;
        }
    }
    async createStreamingMetadata(streamResponse, promptResult, startTime, fullResponse) {
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
    async createStreamingQualityAssessment(request, fullResponse, metadataPromise) {
        // Wait for streaming to complete, then assess quality
        await metadataPromise;
        return this.groundingService.validateResponseGrounding(fullResponse, request.context.documents, request.query);
    }
    meetsQualityThresholds(assessment) {
        return (assessment.groundingValidation.groundingScore >= this.config.qualityThresholds.minGroundingScore &&
            assessment.qualityScore.overall >= this.config.qualityThresholds.minQualityScore &&
            !assessment.qualityScore.hallucination.detected);
    }
    getSimplifiedTemplate(templateType) {
        // Map complex templates to simpler versions for retries
        const simplificationMap = {
            'product_recommendation': 'faq_response',
            'general_query': 'faq_response',
            'checkout_assistance': 'general_query',
        };
        return simplificationMap[templateType] || 'faq_response';
    }
    formatCitations(citations) {
        return citations.map(citation => citation.citationText || `[Source: ${citation.documentId}]`);
    }
    async estimateGenerationCost(request) {
        const costEstimate = await this.promptService.estimateCost(request.templateType, request.query, request.context);
        const estimatedLLMCost = costEstimate.costEstimate; // This would be more sophisticated in practice
        return {
            promptCost: costEstimate.costEstimate,
            estimatedLLMCost,
            totalEstimatedCost: costEstimate.costEstimate + estimatedLLMCost,
        };
    }
    async healthCheck() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                components: {
                    promptService: 'unhealthy',
                    llmService: 'unhealthy',
                    groundingService: 'unhealthy',
                },
                details: {
                    error: error.message,
                },
            };
        }
    }
}
exports.ResponseGenerationService = ResponseGenerationService;
// Export factory function
const createResponseGenerationService = (config) => {
    return new ResponseGenerationService(config);
};
exports.createResponseGenerationService = createResponseGenerationService;
//# sourceMappingURL=ResponseGenerationService.js.map