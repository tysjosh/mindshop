import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  BedrockRuntimeClientConfig,
} from '@aws-sdk/client-bedrock-runtime';
import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { TemplateRenderResult } from './PromptTemplateService';

export interface BedrockLLMConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  timeout: number;
  retryAttempts: number;
  costTracking: {
    enabled: boolean;
    cloudWatchNamespace: string;
    inputTokenCost: number;
    outputTokenCost: number;
  };
}

export interface LLMRequest {
  prompt: string;
  sessionId: string;
  merchantId: string;
  userId?: string;
  modelSize: 'small' | 'medium' | 'large';
  streaming?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  response: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  modelId: string;
  responseTime: number;
  requestId: string;
}

export interface LLMStreamResponse {
  stream: AsyncIterable<string>;
  metadata: {
    requestId: string;
    modelId: string;
    startTime: number;
  };
}

export interface CostMetrics {
  sessionId: string;
  merchantId: string;
  userId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  responseTime: number;
  timestamp: Date;
}

export interface BedrockSessionCostSummary {
  sessionId: string;
  merchantId: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageResponseTime: number;
  modelBreakdown: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export class BedrockLLMService {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly config: BedrockLLMConfig;
  private readonly sessionCosts: Map<string, CostMetrics[]> = new Map();

  // Model configurations for different sizes
  private readonly modelConfigs = {
    small: {
      modelId: 'amazon.nova-micro-v1:0',
      maxTokens: 2048,
      inputTokenCost: 0.000035,  // $0.000035 per input token
      outputTokenCost: 0.00014,  // $0.00014 per output token
    },
    medium: {
      modelId: 'amazon.nova-lite-v1:0',
      maxTokens: 4096,
      inputTokenCost: 0.00006,   // $0.00006 per input token
      outputTokenCost: 0.00024,  // $0.00024 per output token
    },
    large: {
      modelId: 'amazon.nova-pro-v1:0',
      maxTokens: 8192,
      inputTokenCost: 0.0008,    // $0.0008 per input token
      outputTokenCost: 0.0032,   // $0.0032 per output token
    },
  };

  constructor(config: BedrockLLMConfig) {
    this.config = config;
    
    const bedrockConfig: BedrockRuntimeClientConfig = {
      region: config.region,
    };

    this.bedrockClient = new BedrockRuntimeClient(bedrockConfig);
    this.cloudWatchClient = new CloudWatchClient({ region: config.region });
  }

  public async invokeModel(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Select model configuration based on size
      const modelConfig = this.modelConfigs[request.modelSize];
      const modelId = modelConfig.modelId;
      
      // Prepare the request payload
      const payload = this.buildModelPayload(request, modelConfig);
      
      // Invoke the model
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Parse response based on model type
      const parsedResponse = this.parseModelResponse(responseBody, modelId);
      const responseTime = Date.now() - startTime;

      // Calculate costs
      const inputCost = parsedResponse.tokenUsage.inputTokens * modelConfig.inputTokenCost;
      const outputCost = parsedResponse.tokenUsage.outputTokens * modelConfig.outputTokenCost;
      const totalCost = inputCost + outputCost;

      const llmResponse: LLMResponse = {
        response: parsedResponse.response,
        tokenUsage: parsedResponse.tokenUsage,
        cost: {
          inputCost,
          outputCost,
          totalCost,
        },
        modelId,
        responseTime,
        requestId,
      };

      // Track costs and emit metrics
      await this.trackCosts(request, llmResponse);
      await this.emitMetrics(request, llmResponse);

      return llmResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Emit error metrics
      await this.emitErrorMetrics(request, error as Error, responseTime);
      
      // Check if we should retry with a fallback
      if (this.shouldRetryWithFallback(error as Error, request)) {
        return this.retryWithFallback(request, requestId);
      }
      
      throw new Error(`Bedrock LLM invocation failed: ${(error as Error).message}`);
    }
  }

  public async invokeModelStream(request: LLMRequest): Promise<LLMStreamResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      const modelConfig = this.modelConfigs[request.modelSize];
      const modelId = modelConfig.modelId;
      
      const payload = this.buildModelPayload(request, modelConfig);
      
      const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      
      if (!response.body) {
        throw new Error('No response body received from Bedrock');
      }

      const stream = this.createStreamProcessor(response.body, request, modelConfig, requestId, startTime);

      return {
        stream,
        metadata: {
          requestId,
          modelId,
          startTime,
        },
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.emitErrorMetrics(request, error as Error, responseTime);
      throw new Error(`Bedrock LLM streaming failed: ${(error as Error).message}`);
    }
  }

  private buildModelPayload(request: LLMRequest, modelConfig: any): any {
    // Build payload based on Nova model format
    return {
      messages: [
        {
          role: 'user',
          content: [
            {
              text: request.prompt,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: request.maxTokens || modelConfig.maxTokens,
        temperature: request.temperature || this.config.temperature,
        topP: this.config.topP || 0.9,
        stopSequences: this.config.stopSequences || [],
      },
    };
  }

  private parseModelResponse(responseBody: any, modelId: string): {
    response: string;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  } {
    // Parse Nova model response format
    const content = responseBody.output?.message?.content?.[0]?.text || '';
    const usage = responseBody.usage || {};
    
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    
    return {
      response: content,
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  private async *createStreamProcessor(
    responseStream: any,
    request: LLMRequest,
    modelConfig: any,
    requestId: string,
    startTime: number
  ): AsyncIterable<string> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let fullResponse = '';

    try {
      for await (const chunk of responseStream) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          
          if (chunkData.contentBlockDelta?.delta?.text) {
            const text = chunkData.contentBlockDelta.delta.text;
            fullResponse += text;
            yield text;
          }
          
          if (chunkData.messageStart?.usage) {
            totalInputTokens = chunkData.messageStart.usage.inputTokens || 0;
          }
          
          if (chunkData.messageStop?.usage) {
            totalOutputTokens = chunkData.messageStop.usage.outputTokens || 0;
          }
        }
      }

      // Track final costs for streaming
      const responseTime = Date.now() - startTime;
      const inputCost = totalInputTokens * modelConfig.inputTokenCost;
      const outputCost = totalOutputTokens * modelConfig.outputTokenCost;
      
      const streamResponse: LLMResponse = {
        response: fullResponse,
        tokenUsage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
        cost: {
          inputCost,
          outputCost,
          totalCost: inputCost + outputCost,
        },
        modelId: modelConfig.modelId,
        responseTime,
        requestId,
      };

      await this.trackCosts(request, streamResponse);
      await this.emitMetrics(request, streamResponse);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.emitErrorMetrics(request, error as Error, responseTime);
      throw error;
    }
  }

  private async retryWithFallback(request: LLMRequest, originalRequestId: string): Promise<LLMResponse> {
    // Try with smaller model size and simplified prompt
    const fallbackRequest: LLMRequest = {
      ...request,
      modelSize: request.modelSize === 'large' ? 'medium' : 'small',
      prompt: this.simplifyPrompt(request.prompt),
      maxTokens: Math.min(request.maxTokens || 2048, 1024),
    };

    try {
      const response = await this.invokeModel(fallbackRequest);
      
      // Mark as fallback in metrics
      await this.emitFallbackMetrics(request, fallbackRequest, originalRequestId);
      
      return response;
    } catch (error) {
      throw new Error(`Both primary and fallback LLM invocations failed: ${(error as Error).message}`);
    }
  }

  private simplifyPrompt(prompt: string): string {
    // Simplify prompt by removing some context and instructions
    const lines = prompt.split('\n');
    const essentialSections = ['SYSTEM:', 'USER QUERY:', 'RESPONSE:'];
    
    const simplifiedLines = lines.filter(line => {
      return essentialSections.some(section => line.includes(section)) ||
             line.trim().length === 0 ||
             (line.startsWith('Document ') && line.includes('ID:')) ||
             line.startsWith('Content:');
    });

    return simplifiedLines.join('\n');
  }

  private shouldRetryWithFallback(error: Error, request: LLMRequest): boolean {
    const retryableErrors = [
      'ThrottlingException',
      'ModelTimeoutException',
      'ServiceQuotaExceededException',
      'ValidationException',
    ];

    const errorMessage = error.message;
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError)) &&
           request.modelSize !== 'small'; // Don't retry if already using smallest model
  }

  private async trackCosts(request: LLMRequest, response: LLMResponse): Promise<void> {
    const costMetric: CostMetrics = {
      sessionId: request.sessionId,
      merchantId: request.merchantId,
      userId: request.userId,
      modelId: response.modelId,
      inputTokens: response.tokenUsage.inputTokens,
      outputTokens: response.tokenUsage.outputTokens,
      inputCost: response.cost.inputCost,
      outputCost: response.cost.outputCost,
      totalCost: response.cost.totalCost,
      responseTime: response.responseTime,
      timestamp: new Date(),
    };

    // Store in session costs map
    if (!this.sessionCosts.has(request.sessionId)) {
      this.sessionCosts.set(request.sessionId, []);
    }
    this.sessionCosts.get(request.sessionId)!.push(costMetric);

    // Clean up old sessions (keep only last 1000 sessions)
    if (this.sessionCosts.size > 1000) {
      const oldestSession = Array.from(this.sessionCosts.keys())[0];
      this.sessionCosts.delete(oldestSession);
    }
  }

  private async emitMetrics(request: LLMRequest, response: LLMResponse): Promise<void> {
    if (!this.config.costTracking.enabled) {
      return;
    }

    const namespace = this.config.costTracking.cloudWatchNamespace;
    const timestamp = new Date();

    const metrics = [
      {
        MetricName: 'TokenUsage',
        Dimensions: [
          { Name: 'MerchantId', Value: request.merchantId },
          { Name: 'ModelId', Value: response.modelId },
          { Name: 'TokenType', Value: 'Input' },
        ],
        Value: response.tokenUsage.inputTokens,
        Unit: StandardUnit.Count,
        Timestamp: timestamp,
      },
      {
        MetricName: 'TokenUsage',
        Dimensions: [
          { Name: 'MerchantId', Value: request.merchantId },
          { Name: 'ModelId', Value: response.modelId },
          { Name: 'TokenType', Value: 'Output' },
        ],
        Value: response.tokenUsage.outputTokens,
        Unit: StandardUnit.Count,
        Timestamp: timestamp,
      },
      {
        MetricName: 'Cost',
        Dimensions: [
          { Name: 'MerchantId', Value: request.merchantId },
          { Name: 'ModelId', Value: response.modelId },
        ],
        Value: response.cost.totalCost,
        Unit: StandardUnit.None,
        Timestamp: timestamp,
      },
      {
        MetricName: 'ResponseTime',
        Dimensions: [
          { Name: 'MerchantId', Value: request.merchantId },
          { Name: 'ModelId', Value: response.modelId },
        ],
        Value: response.responseTime,
        Unit: StandardUnit.Milliseconds,
        Timestamp: timestamp,
      },
    ];

    try {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: metrics,
      }));
    } catch (error) {
      console.error('Failed to emit CloudWatch metrics:', error);
      // Don't throw - metrics emission failure shouldn't break the main flow
    }
  }

  private async emitErrorMetrics(request: LLMRequest, error: Error, responseTime: number): Promise<void> {
    if (!this.config.costTracking.enabled) {
      return;
    }

    const namespace = this.config.costTracking.cloudWatchNamespace;
    
    try {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: 'Errors',
            Dimensions: [
              { Name: 'MerchantId', Value: request.merchantId },
              { Name: 'ModelSize', Value: request.modelSize },
              { Name: 'ErrorType', Value: error.constructor.name },
            ],
            Value: 1,
            Unit: StandardUnit.Count,
            Timestamp: new Date(),
          },
          {
            MetricName: 'ErrorResponseTime',
            Dimensions: [
              { Name: 'MerchantId', Value: request.merchantId },
              { Name: 'ModelSize', Value: request.modelSize },
            ],
            Value: responseTime,
            Unit: StandardUnit.Milliseconds,
            Timestamp: new Date(),
          },
        ],
      }));
    } catch (metricsError) {
      console.error('Failed to emit error metrics:', metricsError);
    }
  }

  private async emitFallbackMetrics(
    originalRequest: LLMRequest,
    fallbackRequest: LLMRequest,
    originalRequestId: string
  ): Promise<void> {
    if (!this.config.costTracking.enabled) {
      return;
    }

    const namespace = this.config.costTracking.cloudWatchNamespace;
    
    try {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: 'Fallbacks',
            Dimensions: [
              { Name: 'MerchantId', Value: originalRequest.merchantId },
              { Name: 'OriginalModelSize', Value: originalRequest.modelSize },
              { Name: 'FallbackModelSize', Value: fallbackRequest.modelSize },
            ],
            Value: 1,
            Unit: StandardUnit.Count,
            Timestamp: new Date(),
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to emit fallback metrics:', error);
    }
  }

  public getSessionCostSummary(sessionId: string): BedrockSessionCostSummary | null {
    const sessionMetrics = this.sessionCosts.get(sessionId);
    if (!sessionMetrics || sessionMetrics.length === 0) {
      return null;
    }

    const totalRequests = sessionMetrics.length;
    const totalInputTokens = sessionMetrics.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = sessionMetrics.reduce((sum, m) => sum + m.outputTokens, 0);
    const totalCost = sessionMetrics.reduce((sum, m) => sum + m.totalCost, 0);
    const averageResponseTime = sessionMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;

    const modelBreakdown: Record<string, { requests: number; tokens: number; cost: number }> = {};
    
    sessionMetrics.forEach(metric => {
      if (!modelBreakdown[metric.modelId]) {
        modelBreakdown[metric.modelId] = { requests: 0, tokens: 0, cost: 0 };
      }
      modelBreakdown[metric.modelId].requests += 1;
      modelBreakdown[metric.modelId].tokens += metric.inputTokens + metric.outputTokens;
      modelBreakdown[metric.modelId].cost += metric.totalCost;
    });

    return {
      sessionId,
      merchantId: sessionMetrics[0].merchantId,
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      averageResponseTime,
      modelBreakdown,
    };
  }

  public getMerchantCostSummary(merchantId: string, timeRange?: { start: Date; end: Date }): {
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    averageCostPerRequest: number;
    modelBreakdown: Record<string, { requests: number; tokens: number; cost: number }>;
  } {
    let relevantMetrics: CostMetrics[] = [];
    
    // Collect all metrics for the merchant
    for (const sessionMetrics of this.sessionCosts.values()) {
      const merchantMetrics = sessionMetrics.filter(m => m.merchantId === merchantId);
      if (timeRange) {
        relevantMetrics.push(...merchantMetrics.filter(m => 
          m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
        ));
      } else {
        relevantMetrics.push(...merchantMetrics);
      }
    }

    if (relevantMetrics.length === 0) {
      return {
        totalCost: 0,
        totalRequests: 0,
        totalTokens: 0,
        averageCostPerRequest: 0,
        modelBreakdown: {},
      };
    }

    const totalCost = relevantMetrics.reduce((sum, m) => sum + m.totalCost, 0);
    const totalRequests = relevantMetrics.length;
    const totalTokens = relevantMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const averageCostPerRequest = totalCost / totalRequests;

    const modelBreakdown: Record<string, { requests: number; tokens: number; cost: number }> = {};
    
    relevantMetrics.forEach(metric => {
      if (!modelBreakdown[metric.modelId]) {
        modelBreakdown[metric.modelId] = { requests: 0, tokens: 0, cost: 0 };
      }
      modelBreakdown[metric.modelId].requests += 1;
      modelBreakdown[metric.modelId].tokens += metric.inputTokens + metric.outputTokens;
      modelBreakdown[metric.modelId].cost += metric.totalCost;
    });

    return {
      totalCost,
      totalRequests,
      totalTokens,
      averageCostPerRequest,
      modelBreakdown,
    };
  }

  private generateRequestId(): string {
    return `bedrock-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Simple health check with minimal token usage
      const testRequest: LLMRequest = {
        prompt: 'Health check',
        sessionId: 'health-check',
        merchantId: 'system',
        modelSize: 'small',
        maxTokens: 10,
        temperature: 0,
      };

      const response = await this.invokeModel(testRequest);
      
      return {
        status: 'healthy',
        details: {
          responseTime: response.responseTime,
          modelId: response.modelId,
          tokenUsage: response.tokenUsage,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
        },
      };
    }
  }
}

// Export factory function
export const createBedrockLLMService = (config: BedrockLLMConfig): BedrockLLMService => {
  return new BedrockLLMService(config);
};