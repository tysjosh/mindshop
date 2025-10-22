import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MindsDBPredictorService, ProductSignalsPredictorConfig } from '../MindsDBPredictorService';
import { MindsDBService } from '../MindsDBService';

// Mock the MindsDB service
vi.mock('../MindsDBService');
vi.mock('../CacheService');

describe('MindsDBPredictorService', () => {
  let predictorService: MindsDBPredictorService;
  let mockMindsDBService: any;

  beforeEach(() => {
    mockMindsDBService = {
      executeSQLQuery: vi.fn(),
    };

    predictorService = new MindsDBPredictorService(mockMindsDBService);
  });

  describe('createProductSignalsPredictor', () => {
    it('should create a product signals predictor with enhanced explainability', async () => {
      const config: ProductSignalsPredictorConfig = {
        merchantId: 'test_merchant_123',
        trainingDataTable: 'test_training_data',
        features: {
          demographic: ['age', 'gender', 'location'],
          behavioral: ['page_views', 'session_duration'],
          product: ['price', 'category', 'brand'],
          contextual: ['time_of_day', 'device_type']
        },
        targetColumns: {
          demandScore: 'demand_score',
          purchaseProbability: 'purchase_probability'
        },
        hyperparameters: {
          modelType: 'lightgbm',
          maxDepth: 6,
          learningRate: 0.1,
          nEstimators: 100,
          regularization: 0.01
        },
        explainabilityConfig: {
          enableFeatureImportance: true,
          enableShap: true,
          enableLime: true,
          maxFeatures: 20
        }
      };

      // Mock successful predictor creation
      mockMindsDBService.executeSQLQuery
        .mockResolvedValueOnce({
          success: true,
          data: [{ status: 'training' }],
          executionTime: 100
        })
        // Mock predictor status check
        .mockResolvedValueOnce({
          success: true,
          data: [{
            name: 'product_signals_test_merchant_123',
            status: 'complete',
            accuracy: 0.85,
            model_version: '1.0',
            training_date: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            feature_count: 10,
            training_data_size: 1000,
            model_size: 50000
          }],
          executionTime: 50
        });

      const result = await predictorService.createProductSignalsPredictor(config);

      expect(result).toEqual({
        name: 'product_signals_test_merchant_123',
        merchantId: 'test_merchant_123',
        status: 'complete',
        accuracy: 0.85,
        modelVersion: '1.0',
        trainingDate: '2024-01-01T00:00:00Z',
        lastUpdated: new Date('2024-01-01T00:00:00Z'),
        metadata: {
          featureCount: 10,
          trainingDataSize: 1000,
          modelSize: 50000,
          trainingDuration: undefined
        }
      });

      expect(mockMindsDBService.executeSQLQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE MODEL mindsdb.product_signals_test_merchant_123'),
        {},
        'create_product_signals_predictor'
      );
    });

    it('should validate merchant ID', async () => {
      const config: ProductSignalsPredictorConfig = {
        merchantId: '', // Invalid merchant ID
        trainingDataTable: 'test_training_data',
        features: {
          demographic: ['age'],
          behavioral: ['page_views'],
          product: ['price'],
          contextual: ['time_of_day']
        },
        targetColumns: {
          demandScore: 'demand_score',
          purchaseProbability: 'purchase_probability'
        },
        hyperparameters: {
          modelType: 'lightgbm'
        },
        explainabilityConfig: {
          enableFeatureImportance: true,
          enableShap: false,
          enableLime: false,
          maxFeatures: 10
        }
      };

      await expect(predictorService.createProductSignalsPredictor(config))
        .rejects.toThrow('Valid merchantId is required for tenant isolation');
    });
  });

  describe('getProductSignalsPrediction', () => {
    it('should return enhanced prediction with feature importance and explainability', async () => {
      const userContext = {
        userId: 'user_123',
        demographics: { age: 30, gender: 'M' },
        behavioralSignals: { page_views: 10, session_duration: 300 },
        sessionContext: { device_type: 'mobile', time_of_day: 'evening' },
        purchaseHistory: ['SKU_001', 'SKU_002']
      };

      mockMindsDBService.executeSQLQuery.mockResolvedValueOnce({
        success: true,
        data: [{
          sku: 'SKU_123',
          demand_score: 0.75,
          purchase_probability: 0.65,
          explanation: 'High demand based on user profile and product features',
          feature_importance: JSON.stringify({
            age: 0.25,
            page_views: 0.20,
            price: 0.15,
            device_type: 0.10
          }),
          feature_groups: JSON.stringify({
            demographic: { age: 0.25 },
            behavioral: { page_views: 0.20 },
            product: { price: 0.15 },
            contextual: { device_type: 0.10 }
          }),
          shap_values: JSON.stringify({
            age: 0.05,
            page_views: 0.03,
            price: -0.02
          }),
          lime_explanation: 'User age and browsing behavior strongly indicate purchase intent',
          confidence: 0.85,
          model_id: 'model_123',
          model_version: '1.0',
          training_date: '2024-01-01',
          predictor_name: 'product_signals_test_merchant_123',
          top_features: JSON.stringify([
            { name: 'age', importance: 0.25, value: 30, group: 'demographic' },
            { name: 'page_views', importance: 0.20, value: 10, group: 'behavioral' }
          ])
        }],
        executionTime: 150
      });

      const result = await predictorService.getProductSignalsPrediction(
        'SKU_123',
        'test_merchant_123',
        userContext
      );

      expect(result).toEqual({
        sku: 'SKU_123',
        demandScore: 0.75,
        purchaseProbability: 0.65,
        explanation: 'High demand based on user profile and product features',
        featureImportance: {
          age: 0.25,
          page_views: 0.20,
          price: 0.15,
          device_type: 0.10
        },
        featureGroups: {
          demographic: { age: 0.25 },
          behavioral: { page_views: 0.20 },
          product: { price: 0.15 },
          contextual: { device_type: 0.10 }
        },
        provenance: {
          modelId: 'model_123',
          modelVersion: '1.0',
          trainingDate: '2024-01-01',
          predictorName: 'product_signals_test_merchant_123'
        },
        confidence: 0.85,
        merchantId: 'test_merchant_123',
        timestamp: expect.any(String),
        explainability: {
          shapValues: {
            age: 0.05,
            page_views: 0.03,
            price: -0.02
          },
          limeExplanation: 'User age and browsing behavior strongly indicate purchase intent',
          topFeatures: [
            { feature: 'age', importance: 0.25, value: 30, group: 'demographic' },
            { feature: 'page_views', importance: 0.20, value: 10, group: 'behavioral' }
          ]
        }
      });
    });

    it('should handle missing prediction data', async () => {
      mockMindsDBService.executeSQLQuery.mockResolvedValueOnce({
        success: true,
        data: [],
        executionTime: 50
      });

      await expect(
        predictorService.getProductSignalsPrediction(
          'SKU_NONEXISTENT',
          'test_merchant_123',
          {
            demographics: {},
            behavioralSignals: {},
            sessionContext: {},
            purchaseHistory: []
          }
        )
      ).rejects.toThrow('No prediction available for SKU: SKU_NONEXISTENT');
    });
  });

  describe('getPredictorStatus', () => {
    it('should return predictor status with metadata', async () => {
      mockMindsDBService.executeSQLQuery.mockResolvedValueOnce({
        success: true,
        data: [{
          name: 'product_signals_test_merchant_123',
          status: 'complete',
          accuracy: 0.87,
          training_progress: 100,
          error: null,
          model_version: '1.2',
          training_date: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          feature_count: 15,
          training_data_size: 5000,
          model_size: 125000,
          training_duration: 3600
        }],
        executionTime: 75
      });

      const result = await predictorService.getPredictorStatus(
        'product_signals_test_merchant_123',
        'test_merchant_123'
      );

      expect(result).toEqual({
        name: 'product_signals_test_merchant_123',
        merchantId: 'test_merchant_123',
        status: 'complete',
        accuracy: 0.87,
        trainingProgress: 100,
        error: null,
        modelVersion: '1.2',
        trainingDate: '2024-01-01T10:00:00Z',
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        metadata: {
          featureCount: 15,
          trainingDataSize: 5000,
          modelSize: 125000,
          trainingDuration: 3600
        }
      });
    });
  });

  describe('getFeatureImportanceAnalysis', () => {
    it('should return comprehensive feature importance analysis', async () => {
      mockMindsDBService.executeSQLQuery.mockResolvedValueOnce({
        success: true,
        data: [{
          feature_importance_global: JSON.stringify({
            age: 0.25,
            page_views: 0.20,
            price: 0.15,
            device_type: 0.10,
            session_duration: 0.08
          }),
          feature_groups_importance: JSON.stringify({
            demographic: { age: 0.25, gender: 0.05 },
            behavioral: { page_views: 0.20, session_duration: 0.08 },
            product: { price: 0.15, category: 0.07 },
            contextual: { device_type: 0.10, time_of_day: 0.05 }
          }),
          top_features_analysis: JSON.stringify([
            { feature: 'age', importance: 0.25, group: 'demographic', description: 'User age in years' },
            { feature: 'page_views', importance: 0.20, group: 'behavioral', description: 'Pages viewed in session' }
          ]),
          importance_statistics: JSON.stringify({
            mean: 0.12,
            std: 0.08,
            percentiles: {
              '50': 0.10,
              '75': 0.15,
              '90': 0.20,
              '95': 0.25
            }
          })
        }],
        executionTime: 100
      });

      const result = await predictorService.getFeatureImportanceAnalysis(
        'product_signals_test_merchant_123',
        'test_merchant_123'
      );

      expect(result).toEqual({
        globalImportance: {
          age: 0.25,
          page_views: 0.20,
          price: 0.15,
          device_type: 0.10,
          session_duration: 0.08
        },
        featureGroups: {
          demographic: { age: 0.25, gender: 0.05 },
          behavioral: { page_views: 0.20, session_duration: 0.08 },
          product: { price: 0.15, category: 0.07 },
          contextual: { device_type: 0.10, time_of_day: 0.05 }
        },
        topFeatures: [
          { feature: 'age', importance: 0.25, group: 'demographic', description: 'User age in years' },
          { feature: 'page_views', importance: 0.20, group: 'behavioral', description: 'Pages viewed in session' }
        ],
        importanceDistribution: {
          mean: 0.12,
          std: 0.08,
          percentiles: {
            '50': 0.10,
            '75': 0.15,
            '90': 0.20,
            '95': 0.25
          }
        }
      });
    });
  });
});