import {
  PromptTemplate,
  RetrievalResult,
  PredictionResult,
  UserSession,
  RedactedQuery,
  TokenizedContext,
} from '../types';
import { getPIIRedactor } from './PIIRedactor';

export interface EnhancedPromptTemplate extends PromptTemplate {
  templateType: 'product_recommendation' | 'general_query' | 'checkout_assistance' | 'faq_response';
  tokenEstimate: number;
  costEstimate: number;
  modelSize: 'small' | 'medium' | 'large';
  fallbackTemplate?: EnhancedPromptTemplate;
}

export interface PromptContext {
  documents: RetrievalResult[];
  predictions: PredictionResult[];
  sessionState: UserSession;
  queryType?: string;
  userIntent?: string;
}

export interface PromptOptimizationConfig {
  maxTokens: number;
  targetCostPerPrompt: number;
  preferredModelSize: 'small' | 'medium' | 'large';
  enableFallback: boolean;
  tokenCostPerModel: {
    small: number;
    medium: number;
    large: number;
  };
}

export interface TemplateRenderResult {
  renderedPrompt: string;
  tokenCount: number;
  costEstimate: number;
  modelSize: 'small' | 'medium' | 'large';
  piiTokens: Map<string, string>;
  templateUsed: string;
  fallbackUsed: boolean;
}

export class PromptTemplateService {
  private readonly piiRedactor = getPIIRedactor();
  private readonly templates: Map<string, EnhancedPromptTemplate> = new Map();
  
  private readonly defaultConfig: PromptOptimizationConfig = {
    maxTokens: 4000,
    targetCostPerPrompt: 0.01,
    preferredModelSize: 'medium',
    enableFallback: true,
    tokenCostPerModel: {
      small: 0.0001,   // $0.0001 per token for small models
      medium: 0.0003,  // $0.0003 per token for medium models
      large: 0.001,    // $0.001 per token for large models
    },
  };

  constructor(config?: Partial<PromptOptimizationConfig>) {
    this.initializeTemplates();
    if (config) {
      Object.assign(this.defaultConfig, config);
    }
  }

  private initializeTemplates(): void {
    // Product recommendation template
    this.templates.set('product_recommendation', {
      templateType: 'product_recommendation',
      system: `You are an expert e-commerce assistant helping customers find products. 
Your responses must be grounded in the provided product documents and predictions.
Always cite sources using [Source: Document ID] format.
Limit recommendations to 3 products maximum.
Include confidence scores and explanations from the prediction data.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Analyze the user query for product intent',
        'Review retrieved documents for relevant products',
        'Consider prediction scores and feature importance',
        'Provide personalized recommendations with explanations',
        'Include source citations for all factual claims',
      ],
      constraints: [
        'Maximum 3 product recommendations',
        'All claims must be grounded in provided documents',
        'Include confidence scores from predictions',
        'Maintain conversational tone',
        'Respect user preferences from session context',
      ],
      tokenEstimate: 2500,
      costEstimate: 0.0075,
      modelSize: 'medium',
    });

    // General query template
    this.templates.set('general_query', {
      templateType: 'general_query',
      system: `You are a helpful e-commerce assistant. Answer user questions based on the provided context.
If information is not available in the documents, clearly state this limitation.
Always cite your sources using [Source: Document ID] format.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Understand the user query intent',
        'Search provided documents for relevant information',
        'Provide accurate, grounded responses',
        'Cite all sources appropriately',
      ],
      constraints: [
        'Only use information from provided documents',
        'Clearly indicate when information is unavailable',
        'Maintain helpful and professional tone',
        'Include source citations',
      ],
      tokenEstimate: 1800,
      costEstimate: 0.0054,
      modelSize: 'medium',
    });

    // Checkout assistance template
    this.templates.set('checkout_assistance', {
      templateType: 'checkout_assistance',
      system: `You are a checkout assistant helping users complete their purchases.
Guide users through the checkout process while ensuring they understand all details.
Always confirm product details, quantities, and pricing before proceeding.
Maintain security by not exposing sensitive payment information.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Review cart contents and user intent',
        'Confirm product details and pricing',
        'Guide through checkout process',
        'Ensure user consent for transactions',
      ],
      constraints: [
        'Confirm all transaction details',
        'Protect sensitive payment information',
        'Require explicit user consent',
        'Provide clear error messages if issues occur',
      ],
      tokenEstimate: 2000,
      costEstimate: 0.006,
      modelSize: 'medium',
    });

    // FAQ response template (optimized for small model)
    this.templates.set('faq_response', {
      templateType: 'faq_response',
      system: `Answer the user's question based on the FAQ documents provided.
Keep responses concise and direct. Cite the relevant FAQ source.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Find relevant FAQ information',
        'Provide concise, direct answer',
        'Cite FAQ source',
      ],
      constraints: [
        'Keep response under 150 words',
        'Use simple, clear language',
        'Include source citation',
      ],
      tokenEstimate: 800,
      costEstimate: 0.0008,
      modelSize: 'small',
    });

    // Create fallback templates for each main template
    this.createFallbackTemplates();
  }

  private createFallbackTemplates(): void {
    // Create simplified fallback for product recommendation
    const productFallback: EnhancedPromptTemplate = {
      templateType: 'product_recommendation',
      system: `You are an e-commerce assistant. Recommend products based on the provided information.
Keep responses concise and cite sources.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Recommend relevant products',
        'Keep response brief',
        'Cite sources',
      ],
      constraints: [
        'Maximum 2 recommendations',
        'Under 100 words',
        'Include sources',
      ],
      tokenEstimate: 1200,
      costEstimate: 0.0012,
      modelSize: 'small',
    };

    const originalProduct = this.templates.get('product_recommendation')!;
    originalProduct.fallbackTemplate = productFallback;

    // Create fallback for general query
    const generalFallback: EnhancedPromptTemplate = {
      templateType: 'general_query',
      system: `Answer the user's question using the provided information. Be concise.`,
      userQuery: '',
      context: {
        documents: [],
        predictions: [],
        sessionState: {} as UserSession,
      },
      instructions: [
        'Answer user question',
        'Use provided information',
        'Be concise',
      ],
      constraints: [
        'Under 80 words',
        'Cite sources',
      ],
      tokenEstimate: 900,
      costEstimate: 0.0009,
      modelSize: 'small',
    };

    const originalGeneral = this.templates.get('general_query')!;
    originalGeneral.fallbackTemplate = generalFallback;
  }

  public async renderTemplate(
    templateType: string,
    userQuery: string,
    context: PromptContext,
    config?: Partial<PromptOptimizationConfig>
  ): Promise<TemplateRenderResult> {
    const effectiveConfig = { ...this.defaultConfig, ...config };
    let template = this.templates.get(templateType);
    
    if (!template) {
      throw new Error(`Template type '${templateType}' not found`);
    }

    // Redact PII from user query
    const redactedQuery = await this.piiRedactor.redactQuery(userQuery);
    
    // Tokenize user context if present
    let tokenizedContext: TokenizedContext | null = null;
    if (context.sessionState?.context) {
      tokenizedContext = this.piiRedactor.tokenizeUserData(context.sessionState.context);
    }

    // Check if we need to use fallback based on token/cost constraints
    const shouldUseFallback = this.shouldUseFallback(template, effectiveConfig);
    if (shouldUseFallback && template.fallbackTemplate) {
      template = template.fallbackTemplate;
    }

    // Render the prompt
    const renderedPrompt = this.buildPrompt(template, redactedQuery.sanitizedText, context);
    
    // Calculate token count and cost
    const tokenCount = this.estimateTokenCount(renderedPrompt);
    const modelSize = this.selectOptimalModelSize(tokenCount, effectiveConfig);
    const costEstimate = tokenCount * effectiveConfig.tokenCostPerModel[modelSize];

    return {
      renderedPrompt,
      tokenCount,
      costEstimate,
      modelSize,
      piiTokens: redactedQuery.tokens,
      templateUsed: templateType,
      fallbackUsed: shouldUseFallback,
    };
  }

  private shouldUseFallback(
    template: EnhancedPromptTemplate,
    config: PromptOptimizationConfig
  ): boolean {
    if (!config.enableFallback || !template.fallbackTemplate) {
      return false;
    }

    // Use fallback if estimated cost exceeds target
    if (template.costEstimate > config.targetCostPerPrompt) {
      return true;
    }

    // Use fallback if estimated tokens exceed limit
    if (template.tokenEstimate > config.maxTokens) {
      return true;
    }

    return false;
  }

  private buildPrompt(
    template: EnhancedPromptTemplate,
    sanitizedQuery: string,
    context: PromptContext
  ): string {
    const sections: string[] = [];

    // System prompt
    sections.push(`SYSTEM: ${template.system}`);

    // Context sections
    if (context.documents.length > 0) {
      sections.push('\nRELEVANT DOCUMENTS:');
      context.documents.forEach((doc, index) => {
        sections.push(`Document ${index + 1} (ID: ${doc.id}):`);
        sections.push(`Title: ${doc.metadata.sku || 'N/A'}`);
        sections.push(`Content: ${doc.snippet}`);
        sections.push(`Relevance Score: ${doc.score.toFixed(3)}`);
        sections.push('---');
      });
    }

    if (context.predictions.length > 0) {
      sections.push('\nPREDICTION DATA:');
      context.predictions.forEach((pred, index) => {
        sections.push(`Prediction ${index + 1}:`);
        sections.push(`SKU: ${pred.sku}`);
        sections.push(`Demand Score: ${pred.demandScore.toFixed(3)}`);
        sections.push(`Purchase Probability: ${pred.purchaseProbability.toFixed(3)}`);
        sections.push(`Explanation: ${pred.explanation}`);
        sections.push(`Confidence: ${pred.confidence.toFixed(3)}`);
        
        // Include top feature importance
        const topFeatures = Object.entries(pred.featureImportance)
          .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
          .slice(0, 3);
        
        if (topFeatures.length > 0) {
          sections.push('Top Features:');
          topFeatures.forEach(([feature, importance]) => {
            sections.push(`  - ${feature}: ${importance.toFixed(3)}`);
          });
        }
        sections.push('---');
      });
    }

    // Session context (if available and relevant)
    if (context.sessionState?.context) {
      sections.push('\nUSER CONTEXT:');
      if (context.sessionState.context.currentCart.length > 0) {
        sections.push('Current Cart:');
        context.sessionState.context.currentCart.forEach(item => {
          sections.push(`  - ${item.name || item.sku}: Qty ${item.quantity}, $${item.price}`);
        });
      }
      
      if (context.sessionState.context.preferences && Object.keys(context.sessionState.context.preferences).length > 0) {
        sections.push('User Preferences:');
        Object.entries(context.sessionState.context.preferences).forEach(([key, value]) => {
          sections.push(`  - ${key}: ${value}`);
        });
      }
    }

    // Instructions
    sections.push('\nINSTRUCTIONS:');
    template.instructions.forEach((instruction, index) => {
      sections.push(`${index + 1}. ${instruction}`);
    });

    // Constraints
    sections.push('\nCONSTRAINTS:');
    template.constraints.forEach((constraint, index) => {
      sections.push(`${index + 1}. ${constraint}`);
    });

    // User query
    sections.push(`\nUSER QUERY: ${sanitizedQuery}`);
    sections.push('\nRESPONSE:');

    return sections.join('\n');
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is a simplified estimation - in production, use a proper tokenizer
    return Math.ceil(text.length / 4);
  }

  private selectOptimalModelSize(
    tokenCount: number,
    config: PromptOptimizationConfig
  ): 'small' | 'medium' | 'large' {
    const costBySize = {
      small: tokenCount * config.tokenCostPerModel.small,
      medium: tokenCount * config.tokenCostPerModel.medium,
      large: tokenCount * config.tokenCostPerModel.large,
    };

    // If preferred size is within budget, use it
    if (costBySize[config.preferredModelSize] <= config.targetCostPerPrompt) {
      return config.preferredModelSize;
    }

    // Otherwise, find the largest model within budget
    if (costBySize.small <= config.targetCostPerPrompt) {
      if (costBySize.medium <= config.targetCostPerPrompt) {
        if (costBySize.large <= config.targetCostPerPrompt) {
          return 'large';
        }
        return 'medium';
      }
      return 'small';
    }

    // If even small model exceeds budget, still use small (with warning)
    return 'small';
  }

  public getTemplateTypes(): string[] {
    return Array.from(this.templates.keys());
  }

  public getTemplate(templateType: string): EnhancedPromptTemplate | undefined {
    return this.templates.get(templateType);
  }

  public addCustomTemplate(templateType: string, template: EnhancedPromptTemplate): void {
    this.templates.set(templateType, template);
  }

  public async estimateCost(
    templateType: string,
    userQuery: string,
    context: PromptContext,
    config?: Partial<PromptOptimizationConfig>
  ): Promise<{
    tokenCount: number;
    costEstimate: number;
    modelSize: 'small' | 'medium' | 'large';
  }> {
    const result = await this.renderTemplate(templateType, userQuery, context, config);
    return {
      tokenCount: result.tokenCount,
      costEstimate: result.costEstimate,
      modelSize: result.modelSize,
    };
  }

  public detokenizeResponse(response: string, piiTokens: Map<string, string>): string {
    return this.piiRedactor.detokenize(response, piiTokens);
  }
}

// Export singleton instance
let promptTemplateServiceInstance: PromptTemplateService | null = null;

export const getPromptTemplateService = (config?: Partial<PromptOptimizationConfig>): PromptTemplateService => {
  if (!promptTemplateServiceInstance) {
    promptTemplateServiceInstance = new PromptTemplateService(config);
  }
  return promptTemplateServiceInstance;
};