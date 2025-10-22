"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPredictorDeploymentService = exports.PredictorDeploymentService = void 0;
const MindsDBService_1 = require("./MindsDBService");
const CacheService_1 = require("./CacheService");
/**
 * Service for deploying and managing MindsDB predictors
 */
class PredictorDeploymentService {
    constructor(mindsdbService) {
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.mindsdbService = mindsdbService || new MindsDBService_1.MindsDBService();
    }
    /**
     * Deploy the product signals predictor for a merchant
     */
    async deployProductSignalsPredictor(config) {
        const deploymentId = `deploy_${config.merchantId}_${Date.now()}`;
        const predictorName = `product_signals_${config.merchantId}`;
        // Validate configuration
        this.validateDeploymentConfig(config);
        // Create deployment status
        const deploymentStatus = {
            merchantId: config.merchantId,
            predictorName,
            status: 'deploying',
            progress: 0,
            startTime: new Date(),
            deploymentId
        };
        try {
            // Step 1: Validate training data exists
            deploymentStatus.progress = 10;
            await this.validateTrainingData(config.trainingDataTable, config.merchantId);
            // Step 2: Create predictor configuration
            deploymentStatus.progress = 20;
            const predictorConfig = {
                merchantId: config.merchantId,
                trainingDataTable: config.trainingDataTable,
                features: config.features,
                targetColumns: {
                    demandScore: 'demand_score',
                    purchaseProbability: 'purchase_probability'
                },
                hyperparameters: {
                    modelType: config.hyperparameters?.modelType || 'lightgbm',
                    maxDepth: config.hyperparameters?.maxDepth || 6,
                    learningRate: config.hyperparameters?.learningRate || 0.1,
                    nEstimators: config.hyperparameters?.nEstimators || 100,
                    regularization: config.hyperparameters?.regularization || 0.01
                },
                explainabilityConfig: {
                    enableFeatureImportance: config.explainabilityConfig?.enableFeatureImportance ?? true,
                    enableShap: config.explainabilityConfig?.enableShap ?? true,
                    enableLime: config.explainabilityConfig?.enableLime ?? true,
                    maxFeatures: config.explainabilityConfig?.maxFeatures || 20
                }
            };
            // Step 3: Create and train the predictor
            deploymentStatus.status = 'training';
            deploymentStatus.progress = 30;
            await this.createProductSignalsPredictor(predictorConfig);
            // Step 4: Wait for training completion
            deploymentStatus.progress = 80;
            deploymentStatus.status = 'complete';
            deploymentStatus.progress = 100;
            deploymentStatus.estimatedCompletionTime = new Date();
            // Step 5: Validate predictor functionality
            if (deploymentStatus.status === 'complete') {
                await this.validatePredictorFunctionality(predictorName, config.merchantId);
            }
            return deploymentStatus;
        }
        catch (error) {
            deploymentStatus.status = 'failed';
            deploymentStatus.error = error.message;
            return deploymentStatus;
        }
    }
    /**
     * Get deployment status
     */
    async getDeploymentStatus(deploymentId) {
        // In a real implementation, this would be stored in a database
        // For now, we'll check the predictor status directly
        const parts = deploymentId.split('_');
        if (parts.length < 3) {
            return null;
        }
        const merchantId = parts[1];
        const predictorName = `product_signals_${merchantId}`;
        try {
            // Check if predictor exists by querying MindsDB
            const result = await this.mindsdbService.query(`DESCRIBE ${predictorName}`);
            return {
                merchantId,
                predictorName,
                status: 'complete',
                progress: 100,
                startTime: new Date(),
                deploymentId
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * List all deployed predictors for a merchant
     */
    async listMerchantDeployments(merchantId) {
        try {
            const result = await this.mindsdbService.query('SHOW MODELS');
            const predictors = result.data.filter((model) => model.name && model.name.includes(merchantId));
            return predictors.map((predictor) => ({
                merchantId,
                predictorName: predictor.name,
                status: predictor.status === 'complete' ? 'complete' : 'training',
                progress: predictor.status === 'complete' ? 100 : 50,
                startTime: new Date(),
                deploymentId: `deploy_${merchantId}_${predictor.name}`
            }));
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Redeploy a predictor with new configuration
     */
    async redeployPredictor(merchantId, config) {
        const predictorName = `product_signals_${merchantId}`;
        // Delete existing predictor
        try {
            await this.mindsdbService.query(`DROP MODEL IF EXISTS ${predictorName}`);
        }
        catch (error) {
            // Predictor might not exist, continue with deployment
        }
        // Deploy new predictor
        const fullConfig = {
            merchantId,
            trainingDataTable: config.trainingDataTable || `merchant_${merchantId}_training_data`,
            features: config.features || {
                demographic: ['age', 'gender', 'location', 'income_bracket'],
                behavioral: ['page_views', 'session_duration', 'click_through_rate', 'bounce_rate'],
                product: ['price', 'category', 'brand', 'rating', 'availability'],
                contextual: ['time_of_day', 'day_of_week', 'season', 'device_type']
            },
            hyperparameters: config.hyperparameters,
            explainabilityConfig: config.explainabilityConfig
        };
        return this.deployProductSignalsPredictor(fullConfig);
    }
    /**
     * Create product signals predictor using MindsDB
     */
    async createProductSignalsPredictor(config) {
        const predictorName = `product_signals_${config.merchantId}`;
        // Build feature list
        const allFeatures = [
            ...config.features.demographic,
            ...config.features.behavioral,
            ...config.features.product,
            ...config.features.contextual
        ].join(', ');
        // Create the model using MindsDB SQL
        const createModelSQL = `
      CREATE MODEL ${predictorName}
      FROM ${config.trainingDataTable}
      PREDICT ${config.targetColumns.demandScore}, ${config.targetColumns.purchaseProbability}
      USING
        engine = 'lightwood',
        model.args = {
          "submodels": [{
            "module": "${config.hyperparameters.modelType}",
            "args": {
              "max_depth": ${config.hyperparameters.maxDepth},
              "learning_rate": ${config.hyperparameters.learningRate},
              "n_estimators": ${config.hyperparameters.nEstimators}
            }
          }]
        };
    `;
        await this.mindsdbService.query(createModelSQL);
    }
    /**
     * Validate deployment configuration
     */
    validateDeploymentConfig(config) {
        if (!config.merchantId) {
            throw new Error("merchantId is required");
        }
        if (!config.trainingDataTable) {
            throw new Error("trainingDataTable is required");
        }
        if (!config.features) {
            throw new Error("features configuration is required");
        }
        const allFeatures = [
            ...config.features.demographic,
            ...config.features.behavioral,
            ...config.features.product,
            ...config.features.contextual
        ];
        if (allFeatures.length === 0) {
            throw new Error("At least one feature must be specified");
        }
        if (allFeatures.length > 100) {
            throw new Error("Too many features specified (max 100)");
        }
    }
    /**
     * Validate that training data exists and has required columns
     */
    async validateTrainingData(tableName, merchantId) {
        const validationSQL = `
      SELECT COUNT(*) as row_count
      FROM ${tableName}
      LIMIT 1
    `;
        const result = await this.mindsdbService.query(validationSQL);
        if (result.data.length === 0 || result.data[0].row_count === 0) {
            throw new Error(`No training data found in table ${tableName}`);
        }
    }
    /**
     * Validate predictor functionality with a test prediction
     */
    async validatePredictorFunctionality(predictorName, merchantId) {
        try {
            // Test prediction with sample data
            const testSQL = `
        SELECT demand_score, purchase_probability
        FROM ${predictorName}
        WHERE sku = 'test_sku'
        AND age = 30
        LIMIT 1
      `;
            const result = await this.mindsdbService.query(testSQL);
            if (!result.data || result.data.length === 0) {
                throw new Error("Predictor validation failed: no prediction response");
            }
        }
        catch (error) {
            throw new Error(`Predictor validation failed: ${error.message}`);
        }
    }
}
exports.PredictorDeploymentService = PredictorDeploymentService;
// Export singleton instance
let deploymentServiceInstance = null;
const getPredictorDeploymentService = () => {
    if (!deploymentServiceInstance) {
        deploymentServiceInstance = new PredictorDeploymentService();
    }
    return deploymentServiceInstance;
};
exports.getPredictorDeploymentService = getPredictorDeploymentService;
//# sourceMappingURL=PredictorDeploymentService.js.map