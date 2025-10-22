import { MindsDBService } from "./MindsDBService";
import { getCacheService } from "./CacheService";
import { config } from "../config";

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
export class MindsDBPredictorService {
  private mindsdbService: MindsDBService;
  private cacheService = getCacheService();

  constructor(mindsdbService?: MindsDBService) {
    this.mindsdbService = mindsdbService || new MindsDBService();
  }

  /**
   * Create and deploy the product_signals predictor with enhanced explainability
   */
  async createProductSignalsPredictor(
    config: ProductSignalsPredictorConfig
  ): Promise<PredictorStatus> {
    const predictorName = `product_signals_${config.merchantId}`;
    
    // Validate merchant ID
    this.validateMerchantId(config.merchantId);

    // Build feature list for training
    const allFeatures = [
      ...config.features.demographic,
      ...config.features.behavioral,
      ...config.features.product,
      ...config.features.contextual
    ];

    // Create the predictor with enhanced explainability
    const createPredictorSQL = `
      CREATE MODEL mindsdb.${predictorName}
      FROM ${config.trainingDataTable}
      (
        SELECT 
          ${allFeatures.join(', ')},
          ${config.targetColumns.demandScore} as demand_score,
          ${config.targetColumns.purchaseProbability} as purchase_probability,
          sku,
          merchant_id,
          user_id,
          session_context,
          created_at
        FROM ${config.trainingDataTable}
        WHERE merchant_id = '${config.merchantId}'
      )
      PREDICT demand_score, purchase_probability
      USING
        engine = '${config.hyperparameters.modelType}',
        explainability_config = '{
          "enable_feature_importance": ${config.explainabilityConfig.enableFeatureImportance},
          "enable_shap": ${config.explainabilityConfig.enableShap},
          "enable_lime": ${config.explainabilityConfig.enableLime},
          "max_features": ${config.explainabilityConfig.maxFeatures}
        }',
        model_config = '{
          "max_depth": ${config.hyperparameters.maxDepth || 6},
          "learning_rate": ${config.hyperparameters.learningRate || 0.1},
          "n_estimators": ${config.hyperparameters.nEstimators || 100},
          "regularization": ${config.hyperparameters.regularization || 0.01}
        }',
        tenant_isolation = true,
        merchant_id = '${config.merchantId}',
        feature_groups = '{
          "demographic": [${config.features.demographic.map(f => `"${f}"`).join(', ')}],
          "behavioral": [${config.features.behavioral.map(f => `"${f}"`).join(', ')}],
          "product": [${config.features.product.map(f => `"${f}"`).join(', ')}],
          "contextual": [${config.features.contextual.map(f => `"${f}"`).join(', ')}]
        }'
    `;

    const result = await this.mindsdbService.executeSQLQuery(createPredictorSQL);

    if (!result.data) {
      throw new Error(`Failed to create product_signals predictor`);
    }

    // Wait for training to complete and return status
    return this.waitForPredictorTraining(predictorName, config.merchantId);
  }

  /**
   * Get enhanced product signals prediction with feature importance and provenance
   */
  async getProductSignalsPrediction(
    sku: string,
    merchantId: string,
    userContext: {
      userId?: string;
      demographics: Record<string, any>;
      behavioralSignals: Record<string, any>;
      sessionContext: Record<string, any>;
      purchaseHistory: string[];
    }
  ): Promise<{
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
  }> {
    this.validateMerchantId(merchantId);
    
    if (!sku || sku.trim().length === 0) {
      throw new Error("SKU is required for product prediction");
    }

    const predictorName = `product_signals_${merchantId}`;

    // Enhanced prediction query with explainability
    const predictionSQL = `
      SELECT 
        sku,
        demand_score,
        purchase_probability,
        explanation,
        feature_importance,
        feature_groups,
        shap_values,
        lime_explanation,
        confidence,
        model_id,
        model_version,
        training_date,
        predictor_name,
        top_features
      FROM mindsdb.${predictorName}
      WHERE 
        sku = :sku
        AND merchant_id = :merchantId
        AND user_context = :userContext
        AND demographic_features = :demographicFeatures
        AND behavioral_features = :behavioralFeatures
        AND session_context = :sessionContext
    `;

    const queryParams = {
      sku,
      merchantId,
      userContext: JSON.stringify(userContext),
      demographicFeatures: JSON.stringify(userContext.demographics),
      behavioralFeatures: JSON.stringify(userContext.behavioralSignals),
      sessionContext: JSON.stringify(userContext.sessionContext)
    };

    const result = await this.mindsdbService.executeSQLQuery(predictionSQL);

    if (!result.success) {
      throw new Error(`Enhanced product prediction failed: ${result.error}`);
    }

    if (result.data.length === 0) {
      throw new Error(`No prediction available for SKU: ${sku}`);
    }

    const row = result.data[0];

    // Parse feature importance and group by categories
    const featureImportance = typeof row.feature_importance === 'string' 
      ? JSON.parse(row.feature_importance) 
      : row.feature_importance;

    const featureGroups = typeof row.feature_groups === 'string'
      ? JSON.parse(row.feature_groups)
      : row.feature_groups;

    const shapValues = row.shap_values 
      ? (typeof row.shap_values === 'string' ? JSON.parse(row.shap_values) : row.shap_values)
      : undefined;

    const topFeatures = typeof row.top_features === 'string'
      ? JSON.parse(row.top_features)
      : row.top_features || [];

    return {
      sku: row.sku,
      demandScore: row.demand_score,
      purchaseProbability: row.purchase_probability,
      explanation: row.explanation,
      featureImportance,
      featureGroups: {
        demographic: featureGroups.demographic || {},
        behavioral: featureGroups.behavioral || {},
        product: featureGroups.product || {},
        contextual: featureGroups.contextual || {}
      },
      provenance: {
        modelId: row.model_id,
        modelVersion: row.model_version,
        trainingDate: row.training_date,
        predictorName: row.predictor_name || predictorName
      },
      confidence: row.confidence,
      merchantId,
      timestamp: new Date().toISOString(),
      explainability: {
        shapValues,
        limeExplanation: row.lime_explanation,
        topFeatures: topFeatures.map((feature: any) => ({
          feature: feature.name,
          importance: feature.importance,
          value: feature.value,
          group: feature.group
        }))
      }
    };
  }

  /**
   * Update predictor with new training data and retrain
   */
  async retrainProductSignalsPredictor(
    merchantId: string,
    newTrainingData?: string
  ): Promise<PredictorStatus> {
    this.validateMerchantId(merchantId);
    
    const predictorName = `product_signals_${merchantId}`;

    // Retrain the predictor with new data
    const retrainSQL = `
      RETRAIN mindsdb.${predictorName}
      ${newTrainingData ? `FROM ${newTrainingData}` : ''}
      USING
        update_model = true,
        preserve_feature_importance = true,
        incremental_learning = true
    `;

    const result = await this.mindsdbService.executeSQLQuery(retrainSQL);

    if (!result.success) {
      throw new Error(`Failed to retrain product_signals predictor: ${result.error}`);
    }

    return this.waitForPredictorTraining(predictorName, merchantId);
  }

  /**
   * Get predictor status with enhanced metadata
   */
  async getPredictorStatus(
    predictorName: string,
    merchantId: string
  ): Promise<PredictorStatus> {
    this.validateMerchantId(merchantId);

    const statusSQL = `
      SELECT 
        name,
        status,
        accuracy,
        training_progress,
        error,
        model_version,
        training_date,
        updated_at,
        feature_count,
        training_data_size,
        model_size,
        training_duration
      FROM mindsdb.predictors
      WHERE name = :predictorName
        AND merchant_id = :merchantId
    `;

    const result = await this.mindsdbService.executeSQLQuery(statusSQL);

    if (!result.success) {
      throw new Error(`Failed to get predictor status: ${result.error}`);
    }

    if (result.data.length === 0) {
      throw new Error(`Predictor ${predictorName} not found for merchant ${merchantId}`);
    }

    const row = result.data[0];

    return {
      name: row.name,
      merchantId,
      status: row.status,
      accuracy: row.accuracy,
      trainingProgress: row.training_progress,
      error: row.error,
      modelVersion: row.model_version,
      trainingDate: row.training_date,
      lastUpdated: new Date(row.updated_at),
      metadata: {
        featureCount: row.feature_count || 0,
        trainingDataSize: row.training_data_size || 0,
        modelSize: row.model_size || 0,
        trainingDuration: row.training_duration
      }
    };
  }

  /**
   * List all predictors for a merchant with their status
   */
  async listMerchantPredictors(merchantId: string): Promise<PredictorStatus[]> {
    this.validateMerchantId(merchantId);

    const listSQL = `
      SELECT 
        name,
        status,
        accuracy,
        training_progress,
        error,
        model_version,
        training_date,
        updated_at,
        feature_count,
        training_data_size,
        model_size,
        training_duration
      FROM mindsdb.predictors
      WHERE merchant_id = :merchantId
      ORDER BY training_date DESC
    `;

    const result = await this.mindsdbService.executeSQLQuery(listSQL);

    if (!result.success) {
      throw new Error(`Failed to list predictors: ${result.error}`);
    }

    return result.data.map((row: any) => ({
      name: row.name,
      merchantId,
      status: row.status,
      accuracy: row.accuracy,
      trainingProgress: row.training_progress,
      error: row.error,
      modelVersion: row.model_version,
      trainingDate: row.training_date,
      lastUpdated: new Date(row.updated_at),
      metadata: {
        featureCount: row.feature_count || 0,
        trainingDataSize: row.training_data_size || 0,
        modelSize: row.model_size || 0,
        trainingDuration: row.training_duration
      }
    }));
  }

  /**
   * Delete a predictor
   */
  async deletePredictor(predictorName: string, merchantId: string): Promise<void> {
    this.validateMerchantId(merchantId);

    const deleteSQL = `
      DROP MODEL mindsdb.${predictorName}
      WHERE merchant_id = :merchantId
    `;

    const result = await this.mindsdbService.executeSQLQuery(deleteSQL);

    if (!result.success) {
      throw new Error(`Failed to delete predictor: ${result.error}`);
    }

    // Clear cache entries for this predictor
    await this.clearPredictorCache(predictorName, merchantId);
  }

  /**
   * Get feature importance analysis for a predictor
   */
  async getFeatureImportanceAnalysis(
    predictorName: string,
    merchantId: string
  ): Promise<{
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
  }> {
    this.validateMerchantId(merchantId);

    const analysisSQL = `
      SELECT 
        feature_importance_global,
        feature_groups_importance,
        top_features_analysis,
        importance_statistics
      FROM mindsdb.model_analysis
      WHERE predictor_name = :predictorName
        AND merchant_id = :merchantId
    `;

    const result = await this.mindsdbService.executeSQLQuery(analysisSQL);

    if (!result.success) {
      throw new Error(`Failed to get feature importance analysis: ${result.error}`);
    }

    if (result.data.length === 0) {
      throw new Error(`No analysis available for predictor ${predictorName}`);
    }

    const row = result.data[0];

    return {
      globalImportance: JSON.parse(row.feature_importance_global || '{}'),
      featureGroups: JSON.parse(row.feature_groups_importance || '{}'),
      topFeatures: JSON.parse(row.top_features_analysis || '[]'),
      importanceDistribution: JSON.parse(row.importance_statistics || '{}')
    };
  }

  /**
   * Wait for predictor training to complete
   */
  private async waitForPredictorTraining(
    predictorName: string,
    merchantId: string,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<PredictorStatus> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getPredictorStatus(predictorName, merchantId);
      
      if (status.status === 'complete') {
        return status;
      }
      
      if (status.status === 'error') {
        throw new Error(`Predictor training failed: ${status.error}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Predictor training timeout after ${maxWaitTime}ms`);
  }

  /**
   * Clear cache entries for a predictor
   */
  private async clearPredictorCache(predictorName: string, merchantId: string): Promise<void> {
    const pattern = `prediction:${merchantId}:*`;
    // Note: This would need to be implemented based on your cache service capabilities
    // For now, we'll just clear the general prediction cache
    await this.cacheService.delete(pattern);
  }

  /**
   * Validate merchant ID for tenant isolation
   */
  private validateMerchantId(merchantId: string): void {
    if (!merchantId || typeof merchantId !== "string") {
      throw new Error("Valid merchantId is required for tenant isolation");
    }
    if (merchantId.length < 3 || merchantId.length > 100) {
      throw new Error("merchantId must be between 3 and 100 characters");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(merchantId)) {
      throw new Error("merchantId contains invalid characters");
    }
  }
}

// Export singleton instance
let predictorServiceInstance: MindsDBPredictorService | null = null;

export const getMindsDBPredictorService = (): MindsDBPredictorService => {
  if (!predictorServiceInstance) {
    predictorServiceInstance = new MindsDBPredictorService();
  }
  return predictorServiceInstance;
};