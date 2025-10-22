import { MindsDBService } from "./MindsDBService";
export interface QueryAnalysisPrediction {
    intent: string;
    complexity: "low" | "medium" | "high";
    estimatedResponseTime: number;
    optimalDocumentCount: number;
    confidence: number;
}
export interface DocumentRelevancePrediction {
    documentId: string;
    relevanceScore: number;
    shouldInclude: boolean;
    confidence: number;
    reasons: string[];
}
export interface ResponseQualityPrediction {
    qualityScore: number;
    needsRevision: boolean;
    improvementSuggestions: string[];
    confidence: number;
}
export interface UserSatisfactionPrediction {
    satisfactionScore: number;
    riskFactors: string[];
    improvementActions: string[];
    nextQuestionProbability: Record<string, number>;
}
export interface DocumentClassificationPrediction {
    category: string;
    priority: "low" | "medium" | "high";
    routingDepartment: string;
    confidence: number;
}
/**
 * Prediction Service for RAG Intelligence
 * Uses MindsDB's ML capabilities to enhance RAG performance
 */
export declare class PredictionService {
    private mindsdbService;
    private cacheService;
    constructor(mindsdbService?: MindsDBService);
    /**
     * Deploy prediction models for a merchant
     */
    deployPredictionModels(merchantId: string, openaiApiKey?: string): Promise<void>;
    /**
     * Predict query analysis (intent, complexity, optimal parameters)
     */
    predictQueryAnalysis(merchantId: string, query: string, userContext?: any): Promise<QueryAnalysisPrediction>;
    /**
     * Predict document relevance for a query
     */
    predictDocumentRelevance(merchantId: string, query: string, documentIds: string[]): Promise<DocumentRelevancePrediction[]>;
    /**
     * Predict response quality before sending to user
     */
    predictResponseQuality(merchantId: string, query: string, response: string, context?: any): Promise<ResponseQualityPrediction>;
    /**
     * Predict user satisfaction and next actions
     */
    predictUserSatisfaction(merchantId: string, sessionId: string, interactionHistory: any[]): Promise<UserSatisfactionPrediction>;
    /**
     * Classify documents automatically
     */
    classifyDocument(merchantId: string, content: string, title?: string): Promise<DocumentClassificationPrediction>;
    /**
     * Create query analysis model
     */
    private createQueryAnalysisModel;
    /**
     * Create document relevance model
     */
    private createDocumentRelevanceModel;
    /**
     * Create response quality model
     */
    private createResponseQualityModel;
    /**
     * Create user satisfaction model
     */
    private createUserSatisfactionModel;
    /**
     * Create document classification model
     */
    private createDocumentClassificationModel;
    /**
     * Batch predict document relevance for multiple documents
     */
    batchPredictDocumentRelevance(merchantId: string, query: string, documents: Array<{
        id: string;
        content: string;
        title?: string;
    }>): Promise<DocumentRelevancePrediction[]>;
    /**
     * Predict optimal RAG parameters for a query
     */
    predictOptimalRAGParameters(merchantId: string, query: string, userProfile?: any): Promise<{
        maxDocuments: number;
        relevanceThreshold: number;
        useHybridSearch: boolean;
        responseLength: "short" | "medium" | "long";
        temperature: number;
    }>;
    /**
     * Fallback query analysis using rule-based approach
     */
    private fallbackQueryAnalysis;
    /**
     * Fallback response quality assessment
     */
    private fallbackQualityAssessment;
    /**
     * Fallback document classification
     */
    private fallbackDocumentClassification;
    /**
     * Get prediction model status for a merchant
     */
    getPredictionModelStatus(merchantId: string): Promise<{
        models: Array<{
            name: string;
            status: string;
            accuracy?: number;
            lastTrained?: string;
        }>;
        overallHealth: "healthy" | "degraded" | "unhealthy";
    }>;
}
export declare const predictionService: PredictionService;
//# sourceMappingURL=PredictionService.d.ts.map