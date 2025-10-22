import { MindsDBService } from "./MindsDBService";
export interface DeploymentConfig {
    merchantId: string;
    trainingDataTable: string;
    features: {
        demographic: string[];
        behavioral: string[];
        product: string[];
        contextual: string[];
    };
    hyperparameters?: {
        modelType: 'lightgbm' | 'xgboost' | 'neural_network';
        maxDepth?: number;
        learningRate?: number;
        nEstimators?: number;
        regularization?: number;
    };
    explainabilityConfig?: {
        enableFeatureImportance: boolean;
        enableShap: boolean;
        enableLime: boolean;
        maxFeatures: number;
    };
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
        modelType: string;
        maxDepth: number;
        learningRate: number;
        nEstimators: number;
        regularization: number;
    };
    explainabilityConfig: {
        enableFeatureImportance: boolean;
        enableShap: boolean;
        enableLime: boolean;
        maxFeatures: number;
    };
}
export interface DeploymentStatus {
    merchantId: string;
    predictorName: string;
    status: 'deploying' | 'training' | 'complete' | 'failed';
    progress: number;
    error?: string;
    startTime: Date;
    estimatedCompletionTime?: Date;
    deploymentId: string;
}
/**
 * Service for deploying and managing MindsDB predictors
 */
export declare class PredictorDeploymentService {
    private mindsdbService;
    private cacheService;
    constructor(mindsdbService?: MindsDBService);
    /**
     * Deploy the product signals predictor for a merchant
     */
    deployProductSignalsPredictor(config: DeploymentConfig): Promise<DeploymentStatus>;
    /**
     * Get deployment status
     */
    getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null>;
    /**
     * List all deployed predictors for a merchant
     */
    listMerchantDeployments(merchantId: string): Promise<DeploymentStatus[]>;
    /**
     * Redeploy a predictor with new configuration
     */
    redeployPredictor(merchantId: string, config: Partial<DeploymentConfig>): Promise<DeploymentStatus>;
    /**
     * Create product signals predictor using MindsDB
     */
    private createProductSignalsPredictor;
    /**
     * Validate deployment configuration
     */
    private validateDeploymentConfig;
    /**
     * Validate that training data exists and has required columns
     */
    private validateTrainingData;
    /**
     * Validate predictor functionality with a test prediction
     */
    private validatePredictorFunctionality;
}
export declare const getPredictorDeploymentService: () => PredictorDeploymentService;
//# sourceMappingURL=PredictorDeploymentService.d.ts.map