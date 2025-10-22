// Use stub types for development
let BedrockRuntimeClient: any, InvokeModelCommand: any;
try {
  const bedrock = require('@aws-sdk/client-bedrock-runtime');
  BedrockRuntimeClient = bedrock.BedrockRuntimeClient;
  InvokeModelCommand = bedrock.InvokeModelCommand;
} catch {
  BedrockRuntimeClient = class { async send() { return {}; } };
  InvokeModelCommand = class { constructor() {} };
}
import { AmazonQService } from './AmazonQService';
import { config } from '../config';

export interface IntentParsingConfig {
  bedrockRegion: string;
  modelId: string;
  amazonQService: AmazonQService;
}

export interface ParsedIntent {
  intent: 'search' | 'recommend' | 'purchase' | 'question' | 'compare' | 'support';
  confidence: number;
  entities: {
    products?: string[];
    categories?: string[];
    priceRange?: { min?: number; max?: number };
    brands?: string[];
    features?: string[];
    quantity?: number;
  };
  context: {
    urgency: 'low' | 'medium' | 'high';
    complexity: 'simple' | 'moderate' | 'complex';
    userType: 'new' | 'returning' | 'vip';
  };
  reasoning: string;
}

export interface ExecutionPlan {
  steps: Array<{
    id: string;
    type: 'retrieval' | 'prediction' | 'grounding' | 'checkout' | 'validation';
    tool: string;
    parameters: Record<string, any>;
    priority: number;
    dependencies: string[];
    timeout: number;
    retryConfig: {
      maxRetries: number;
      backoffMs: number;
    };
  }>;
  parallelizable: boolean;
  estimatedLatency: number;
  fallbackPlan?: ExecutionPlan;
}

export interface PlanningContext {
  merchantId: string;
  userId: string;
  sessionHistory: Array<{ role: string; content: string }>;
  userContext: Record<string, any>;
  availableTools: string[];
  constraints: {
    maxLatency: number;
    maxCost: number;
    requireGrounding: boolean;
  };
}

export class IntentParsingService {
  private bedrockClient: any;
  private modelId: string;
  private amazonQService: AmazonQService;

  constructor(config: IntentParsingConfig) {
    this.bedrockClient = new BedrockRuntimeClient({ region: config.bedrockRegion });
    this.modelId = config.modelId;
    this.amazonQService = config.amazonQService;
  }

  /**
   * Parse user intent from query with context
   */
  async parseIntent(
    query: string,
    context: PlanningContext
  ): Promise<ParsedIntent> {
    try {
      // Use Bedrock for intent classification
      const intentPrompt = this.buildIntentPrompt(query, context);
      const intentResult = await this.invokeBedrockModel(intentPrompt);
      
      // Parse the structured response
      const parsedIntent = this.parseIntentResponse(intentResult);

      // Enhance with Amazon Q context if needed
      if (parsedIntent.intent === 'question' || parsedIntent.confidence < 0.7) {
        const qContext = await this.amazonQService.getAdditionalContext(
          query,
          context.merchantId,
          'general'
        );
        
        // Re-evaluate intent with additional context
        if (qContext.relevance > 0.6) {
          const enhancedPrompt = this.buildEnhancedIntentPrompt(query, context, qContext.context);
          const enhancedResult = await this.invokeBedrockModel(enhancedPrompt);
          const enhancedIntent = this.parseIntentResponse(enhancedResult);
          
          if (enhancedIntent.confidence > parsedIntent.confidence) {
            return enhancedIntent;
          }
        }
      }

      return parsedIntent;

    } catch (error) {
      console.error('Intent parsing error:', error);
      
      // Return fallback intent
      return this.getFallbackIntent(query);
    }
  }

  /**
   * Generate execution plan based on parsed intent
   */
  async generateExecutionPlan(
    intent: ParsedIntent,
    context: PlanningContext
  ): Promise<ExecutionPlan> {
    try {
      const steps: ExecutionPlan['steps'] = [];
      let estimatedLatency = 0;

      // Generate steps based on intent type
      switch (intent.intent) {
        case 'search':
          steps.push(...this.generateSearchSteps(intent, context));
          estimatedLatency = 200; // Base latency for search
          break;

        case 'recommend':
          steps.push(...this.generateRecommendationSteps(intent, context));
          estimatedLatency = 300; // Higher latency for recommendations
          break;

        case 'purchase':
          steps.push(...this.generatePurchaseSteps(intent, context));
          estimatedLatency = 500; // Highest latency for purchase flow
          break;

        case 'question':
          steps.push(...this.generateQuestionSteps(intent, context));
          estimatedLatency = 250; // Medium latency for Q&A
          break;

        case 'compare':
          steps.push(...this.generateComparisonSteps(intent, context));
          estimatedLatency = 400; // High latency for comparisons
          break;

        case 'support':
          steps.push(...this.generateSupportSteps(intent, context));
          estimatedLatency = 150; // Lower latency for support
          break;
      }

      // Add grounding step if required
      if (context.constraints.requireGrounding) {
        steps.push({
          id: 'grounding_validation',
          type: 'grounding',
          tool: 'amazonQ',
          parameters: {
            type: 'grounding_validation',
          },
          priority: 99, // Run after other steps
          dependencies: steps.map(s => s.id),
          timeout: 5000,
          retryConfig: {
            maxRetries: 2,
            backoffMs: 1000,
          },
        });
        estimatedLatency += 50;
      }

      // Determine if steps can be parallelized
      const parallelizable = this.canParallelizeSteps(steps);

      // Generate fallback plan for high-risk scenarios
      const fallbackPlan = intent.confidence < 0.6 ? 
        this.generateFallbackPlan(intent, context) : undefined;

      return {
        steps,
        parallelizable,
        estimatedLatency,
        fallbackPlan,
      };

    } catch (error) {
      console.error('Plan generation error:', error);
      
      // Return minimal fallback plan
      return this.getMinimalPlan(context);
    }
  }

  /**
   * Validate execution plan against constraints
   */
  validatePlan(plan: ExecutionPlan, constraints: PlanningContext['constraints']): {
    valid: boolean;
    violations: string[];
    suggestions: string[];
  } {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check latency constraint
    if (plan.estimatedLatency > constraints.maxLatency) {
      violations.push(`Estimated latency ${plan.estimatedLatency}ms exceeds limit ${constraints.maxLatency}ms`);
      suggestions.push('Consider reducing the number of steps or using cached results');
    }

    // Check cost constraint (simplified estimation)
    const estimatedCost = this.estimatePlanCost(plan);
    if (estimatedCost > constraints.maxCost) {
      violations.push(`Estimated cost $${estimatedCost} exceeds limit $${constraints.maxCost}`);
      suggestions.push('Consider using smaller models or reducing the number of API calls');
    }

    // Check grounding requirement
    const hasGrounding = plan.steps.some(step => step.type === 'grounding');
    if (constraints.requireGrounding && !hasGrounding) {
      violations.push('Grounding validation is required but not included in plan');
      suggestions.push('Add grounding validation step');
    }

    return {
      valid: violations.length === 0,
      violations,
      suggestions,
    };
  }

  /**
   * Build intent parsing prompt
   */
  private buildIntentPrompt(query: string, context: PlanningContext): string {
    return `
Analyze the following user query and classify the intent. Consider the conversation history and user context.

User Query: "${query}"

Conversation History:
${context.sessionHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User Context:
- User Type: ${context.userContext.userType || 'unknown'}
- Previous Purchases: ${context.userContext.purchaseHistory?.length || 0}
- Current Cart Items: ${context.userContext.currentCart?.length || 0}

Available Intents:
- search: User wants to find specific products or information
- recommend: User wants personalized product recommendations
- purchase: User wants to buy something or complete a transaction
- question: User has a general question about products, policies, or services
- compare: User wants to compare products or features
- support: User needs help or has an issue

Respond with a JSON object containing:
{
  "intent": "one of the available intents",
  "confidence": 0.0-1.0,
  "entities": {
    "products": ["extracted product names"],
    "categories": ["extracted categories"],
    "priceRange": {"min": number, "max": number},
    "brands": ["extracted brands"],
    "features": ["extracted features"],
    "quantity": number
  },
  "context": {
    "urgency": "low|medium|high",
    "complexity": "simple|moderate|complex",
    "userType": "new|returning|vip"
  },
  "reasoning": "explanation of the classification"
}
`;
  }

  /**
   * Build enhanced intent prompt with Amazon Q context
   */
  private buildEnhancedIntentPrompt(
    query: string,
    context: PlanningContext,
    qContext: string
  ): string {
    return `
Re-analyze the user query with additional context from knowledge base.

User Query: "${query}"

Additional Context from Knowledge Base:
${qContext}

${this.buildIntentPrompt(query, context)}
`;
  }

  /**
   * Invoke Bedrock model for intent parsing
   */
  private async invokeBedrockModel(prompt: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.content[0].text;
  }

  /**
   * Parse intent response from Bedrock
   */
  private parseIntentResponse(response: string): ParsedIntent {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        intent: parsed.intent || 'question',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        context: parsed.context || {
          urgency: 'medium',
          complexity: 'moderate',
          userType: 'returning',
        },
        reasoning: parsed.reasoning || 'Parsed from model response',
      };

    } catch (error) {
      console.error('Failed to parse intent response:', error);
      return this.getFallbackIntent(response);
    }
  }

  /**
   * Generate search steps
   */
  private generateSearchSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    return [
      {
        id: 'semantic_search',
        type: 'retrieval',
        tool: 'semanticRetrieval',
        parameters: {
          merchant_id: context.merchantId,
          limit: 5,
          threshold: 0.7,
        },
        priority: 1,
        dependencies: [],
        timeout: 3000,
        retryConfig: {
          maxRetries: 2,
          backoffMs: 500,
        },
      },
    ];
  }

  /**
   * Generate recommendation steps
   */
  private generateRecommendationSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    return [
      {
        id: 'semantic_search',
        type: 'retrieval',
        tool: 'semanticRetrieval',
        parameters: {
          merchant_id: context.merchantId,
          limit: 3,
          threshold: 0.6,
        },
        priority: 1,
        dependencies: [],
        timeout: 3000,
        retryConfig: {
          maxRetries: 2,
          backoffMs: 500,
        },
      },
      {
        id: 'product_prediction',
        type: 'prediction',
        tool: 'productPrediction',
        parameters: {
          merchant_id: context.merchantId,
          user_context: context.userContext,
        },
        priority: 2,
        dependencies: ['semantic_search'],
        timeout: 5000,
        retryConfig: {
          maxRetries: 3,
          backoffMs: 1000,
        },
      },
    ];
  }

  /**
   * Generate purchase steps
   */
  private generatePurchaseSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    return [
      {
        id: 'validate_cart',
        type: 'validation',
        tool: 'cartValidation',
        parameters: {
          merchant_id: context.merchantId,
          user_id: context.userId,
        },
        priority: 1,
        dependencies: [],
        timeout: 2000,
        retryConfig: {
          maxRetries: 2,
          backoffMs: 500,
        },
      },
      {
        id: 'process_checkout',
        type: 'checkout',
        tool: 'processCheckout',
        parameters: {
          merchant_id: context.merchantId,
          user_id: context.userId,
        },
        priority: 2,
        dependencies: ['validate_cart'],
        timeout: 10000,
        retryConfig: {
          maxRetries: 1,
          backoffMs: 2000,
        },
      },
    ];
  }

  /**
   * Generate question steps
   */
  private generateQuestionSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    return [
      {
        id: 'knowledge_search',
        type: 'retrieval',
        tool: 'amazonQ',
        parameters: {
          merchant_id: context.merchantId,
          context_type: 'faq',
        },
        priority: 1,
        dependencies: [],
        timeout: 4000,
        retryConfig: {
          maxRetries: 2,
          backoffMs: 1000,
        },
      },
    ];
  }

  /**
   * Generate comparison steps
   */
  private generateComparisonSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    const products = intent.entities.products || [];
    
    return products.map((product, index) => ({
      id: `product_info_${index}`,
      type: 'retrieval' as const,
      tool: 'semanticRetrieval',
      parameters: {
        query: product,
        merchant_id: context.merchantId,
        limit: 2,
      },
      priority: 1,
      dependencies: [],
      timeout: 3000,
      retryConfig: {
        maxRetries: 2,
        backoffMs: 500,
      },
    }));
  }

  /**
   * Generate support steps
   */
  private generateSupportSteps(intent: ParsedIntent, context: PlanningContext): ExecutionPlan['steps'] {
    return [
      {
        id: 'support_search',
        type: 'retrieval',
        tool: 'amazonQ',
        parameters: {
          merchant_id: context.merchantId,
          context_type: 'support',
        },
        priority: 1,
        dependencies: [],
        timeout: 3000,
        retryConfig: {
          maxRetries: 2,
          backoffMs: 500,
        },
      },
    ];
  }

  /**
   * Check if steps can be parallelized
   */
  private canParallelizeSteps(steps: ExecutionPlan['steps']): boolean {
    // Steps can be parallelized if they don't have dependencies on each other
    const stepIds = new Set(steps.map(s => s.id));
    
    return steps.every(step => 
      step.dependencies.every(dep => !stepIds.has(dep))
    );
  }

  /**
   * Generate fallback plan
   */
  private generateFallbackPlan(intent: ParsedIntent, context: PlanningContext): ExecutionPlan {
    return {
      steps: [
        {
          id: 'fallback_search',
          type: 'retrieval',
          tool: 'semanticRetrieval',
          parameters: {
            merchant_id: context.merchantId,
            limit: 3,
            threshold: 0.5, // Lower threshold for fallback
          },
          priority: 1,
          dependencies: [],
          timeout: 2000,
          retryConfig: {
            maxRetries: 1,
            backoffMs: 500,
          },
        },
      ],
      parallelizable: true,
      estimatedLatency: 100,
    };
  }

  /**
   * Get minimal plan for errors
   */
  private getMinimalPlan(context: PlanningContext): ExecutionPlan {
    return {
      steps: [
        {
          id: 'error_response',
          type: 'validation',
          tool: 'errorHandler',
          parameters: {
            merchant_id: context.merchantId,
          },
          priority: 1,
          dependencies: [],
          timeout: 1000,
          retryConfig: {
            maxRetries: 0,
            backoffMs: 0,
          },
        },
      ],
      parallelizable: true,
      estimatedLatency: 50,
    };
  }

  /**
   * Get fallback intent
   */
  private getFallbackIntent(query: string): ParsedIntent {
    return {
      intent: 'question',
      confidence: 0.3,
      entities: {},
      context: {
        urgency: 'medium',
        complexity: 'moderate',
        userType: 'returning',
      },
      reasoning: 'Fallback intent due to parsing error',
    };
  }

  /**
   * Estimate plan cost (simplified)
   */
  private estimatePlanCost(plan: ExecutionPlan): number {
    const costPerStep = {
      retrieval: 0.001,
      prediction: 0.005,
      grounding: 0.002,
      checkout: 0.01,
      validation: 0.0005,
    };

    return plan.steps.reduce((total, step) => {
      return total + (costPerStep[step.type] || 0.001);
    }, 0);
  }
}

// Factory function to create IntentParsingService with default config
export function createIntentParsingService(amazonQService: AmazonQService): IntentParsingService {
  return new IntentParsingService({
    bedrockRegion: config.bedrock.region,
    modelId: config.bedrock.modelId,
    amazonQService,
  });
}