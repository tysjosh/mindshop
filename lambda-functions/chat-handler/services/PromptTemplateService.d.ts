import { PromptTemplate, RetrievalResult, PredictionResult, UserSession } from '../types';
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
export declare class PromptTemplateService {
    private readonly piiRedactor;
    private readonly templates;
    private readonly defaultConfig;
    constructor(config?: Partial<PromptOptimizationConfig>);
    private initializeTemplates;
    private createFallbackTemplates;
    renderTemplate(templateType: string, userQuery: string, context: PromptContext, config?: Partial<PromptOptimizationConfig>): Promise<TemplateRenderResult>;
    private shouldUseFallback;
    private buildPrompt;
    private estimateTokenCount;
    private selectOptimalModelSize;
    getTemplateTypes(): string[];
    getTemplate(templateType: string): EnhancedPromptTemplate | undefined;
    addCustomTemplate(templateType: string, template: EnhancedPromptTemplate): void;
    estimateCost(templateType: string, userQuery: string, context: PromptContext, config?: Partial<PromptOptimizationConfig>): Promise<{
        tokenCount: number;
        costEstimate: number;
        modelSize: 'small' | 'medium' | 'large';
    }>;
    detokenizeResponse(response: string, piiTokens: Map<string, string>): string;
}
export declare const getPromptTemplateService: (config?: Partial<PromptOptimizationConfig>) => PromptTemplateService;
//# sourceMappingURL=PromptTemplateService.d.ts.map