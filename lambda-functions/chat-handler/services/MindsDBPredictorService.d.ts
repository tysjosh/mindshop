import { MindsDBService } from "./MindsDBService";
export interface PredictorDefinition {
    name: string;
    merchantId: string;
    type: 'semantic_retriever' | 'product_signals';
    trainingQuery: string;
    targetColumn: string;
    features: string[];
    hyperparameters?: Record<string, any>;
    description?: string;
}
export interface ProductSignalsPredictorConfig {
    merchantId: string;
    trainingDataTable: string;
    features: {
        demographic: string[];
        behavioral: string[];
        product: string[];
        contextual: string[];
    };
    targetColumns: {
        demandScore: string;
        purchaseProbability: string;
    };
    hyperparameters: {
        modelType: 'lightgbm' | 'xgboost' | 'neural_network';
        maxDepth?: number;
        learningRate?: number;
        nEstimators?: number;
        regularization?: number;
    };
    explainabilityConfig: {
        enableFeatureImportance: boolean;
        enableShap: boolean;
        enableLime: boolean;
        maxFeatures: number;
    };
}
export interface PredictorStatus {
    name: string;
    merchantId: string;
    status: 'training' | 'complete' | 'error' | 'pending';
    accuracy?: number;
    trainingProgress?: number;
    error?: string;
    modelVersion: string;
    trainingDate: string;
    lastUpdated: Date;
    metadata: {
        featureCount: number;
        trainingDataSize: number;
        modelSize: number;
        trainingDuration?: number;
    };
}
/**
 * MindsDB Predictor Management Service
 * Handles creation, deployment, and management of MindsDB predictors
 */
export declare class MindsDBPredictorService {
    private mindsdbService;
    private cacheService;
    constructor(mindsdbService?: MindsDBService);
    /**
     * Create and deploy the product_signals predictor with enhanced explainability
     */
    createProductSignalsPredictor(config: ProductSignalsPredictorConfig): Promise<PredictorStatus>;
    /**
     * Get enhanced product signals prediction with feature importance and provenance
     */
    getProductSignalsPrediction(sku: string, merchantId: string, userContext: {
        userId?: string;
        demographics: Record<string, any>;
        behavioralSignals: Record<string, any>;
        sessionContext: Record<string, any>;
        purchaseHistory: string[];
    }): Promise<{
        sku: string;
        demandScore: number;
        purchaseProbability: number;
        explanation: string;
        featureImportance: Record<string, number>;
        featureGroups: {
            demographic: Record<string, number>;
            behavioral: Record<string, number>;
            product: Record<string, number>;
            contextual: Record<string, number>;
        };
        provenance: {
            modelId: string;
            modelVersion: string;
            trainingDate: string;
            predictorName: string;
        };
        confidence: number;
        merchantId: string;
        timestamp: string;
        explainability: {
            shapValues?: Record<string, number>;
            limeExplanation?: string;
            topFeatures: Array<{
                feature: string;
                importance: number;
                value: any;
                group: string;
            }>;
        };
    }>;
    /**
     * Update predictor with new training data and retrain
     */
    retrainProductSignalsPredictor(merchantId: string, newTrainingData?: string): Promise<PredictorStatus>;
    /**
     * Get predictor status with enhanced metadata
     */
    getPredictorStatus(predictorName: string, merchantId: string): Promise<PredictorStatus>;
    /**
     * List all predictors for a merchant with their status
     */
    listMerchantPredictors(merchantId: string): Promise<PredictorStatus[]>;
    /**
     * Delete a predictor
     */
    deletePredictor(predictorName: string, merchantId: string): Promise<void>;
    /**
     * Get feature importance analysis for a predictor
     */
    getFeatureImportanceAnalysis(predictorName: string, merchantId: string): Promise<{
        globalImportance: Record<string, number>;
        featureGroups: Record<string, Record<string, number>>;
        topFeatures: Array<{
            feature: string;
            importance: number;
            group: string;
            description?: string;
        }>;
        importanceDistribution: {
            mean: number;
            std: number;
            percentiles: Record<string, number>;
        };
    }>;
    /**
     * Wait for predictor training to complete
     */
    private waitForPredictorTraining;
    /**
     * Clear cache entries for a predictor
     */
    private clearPredictorCache;
    /**
     * Validate merchant ID for tenant isolation
     */
    private validateMerchantId;
}
export declare const getMindsDBPredictorService: () => MindsDBPredictorService;
//# sourceMappingURL=MindsDBPredictorService.d.ts.map