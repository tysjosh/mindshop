/**
 * Example: Product Signals Predictor with Enhanced Explainability
 * 
 * This example demonstrates how to:
 * 1. Deploy a product signals predictor with feature importance
 * 2. Make predictions with demographic and behavioral signals
 * 3. Extract explainability information including SHAP values
 * 4. Monitor predictor performance and model provenance
 */

import {
  getPredictorDeploymentService,
  getMindsDBService,
  getMindsDBPredictorService,
  type DeploymentConfig,
  type ProductSignalsPredictorConfig
} from '../src/services';

async function deployProductSignalsPredictor() {
  const deploymentService = getPredictorDeploymentService();
  const merchantId = 'merchant_demo_123';

  // Configuration for the product signals predictor
  const deploymentConfig: DeploymentConfig = {
    merchantId,
    trainingDataTable: `merchant_${merchantId}_training_data`,
    features: {
      // Demographic features for user profiling
      demographic: [
        'age',
        'gender',
        'location',
        'income_bracket',
        'education_level',
        'occupation'
      ],
      // Behavioral signals from user interactions
      behavioral: [
        'page_views_last_30d',
        'session_duration_avg',
        'click_through_rate',
        'bounce_rate',
        'cart_abandonment_rate',
        'previous_purchases_count',
        'avg_order_value',
        'days_since_last_purchase'
      ],
      // Product-specific features
      product: [
        'price',
        'category',
        'brand',
        'rating',
        'availability',
        'discount_percentage',
        'inventory_level',
        'seasonality_score'
      ],
      // Contextual features
      contextual: [
        'time_of_day',
        'day_of_week',
        'season',
        'device_type',
        'traffic_source',
        'campaign_id',
        'weather_condition',
        'holiday_proximity'
      ]
    },
    hyperparameters: {
      modelType: 'lightgbm',
      maxDepth: 8,
      learningRate: 0.05,
      nEstimators: 200,
      regularization: 0.01
    },
    explainabilityConfig: {
      enableFeatureImportance: true,
      enableShap: true,
      enableLime: true,
      maxFeatures: 25
    }
  };

  console.log('🚀 Deploying product signals predictor...');
  
  try {
    const deploymentStatus = await deploymentService.deployProductSignalsPredictor(deploymentConfig);
    
    console.log('📊 Deployment Status:', {
      merchantId: deploymentStatus.merchantId,
      predictorName: deploymentStatus.predictorName,
      status: deploymentStatus.status,
      progress: deploymentStatus.progress,
      deploymentId: deploymentStatus.deploymentId
    });

    if (deploymentStatus.status === 'failed') {
      console.error('❌ Deployment failed:', deploymentStatus.error);
      return;
    }

    console.log('✅ Predictor deployed successfully!');
    return deploymentStatus;

  } catch (error) {
    console.error('❌ Deployment error:', error);
    throw error;
  }
}

async function makePredictionWithExplainability() {
  const mindsdbService = getMindsDBService();
  const predictorService = getMindsDBPredictorService();
  const merchantId = 'merchant_demo_123';

  // Example user context with demographic and behavioral signals
  const userContext = {
    userId: 'user_456',
    demographics: {
      age: 32,
      gender: 'F',
      location: 'San Francisco, CA',
      income_bracket: '75k-100k',
      education_level: 'Bachelor',
      occupation: 'Software Engineer'
    },
    behavioralSignals: {
      page_views_last_30d: 45,
      session_duration_avg: 420, // 7 minutes
      click_through_rate: 0.12,
      bounce_rate: 0.25,
      cart_abandonment_rate: 0.30,
      previous_purchases_count: 8,
      avg_order_value: 125.50,
      days_since_last_purchase: 14
    },
    sessionContext: {
      time_of_day: 'evening',
      day_of_week: 'friday',
      season: 'winter',
      device_type: 'mobile',
      traffic_source: 'organic_search',
      campaign_id: null,
      weather_condition: 'rainy',
      holiday_proximity: 'christmas_week'
    },
    purchaseHistory: ['SKU_001', 'SKU_045', 'SKU_123'],
    preferences: {
      preferred_categories: ['electronics', 'books'],
      price_sensitivity: 'medium',
      brand_loyalty: 'high'
    }
  };

  console.log('🔮 Making enhanced prediction with explainability...');

  try {
    // Make prediction using the enhanced MindsDB service
    const prediction = await mindsdbService.predictProductSignals({
      sku: 'SKU_789',
      merchantId,
      userContext
    });

    console.log('📈 Prediction Results:');
    console.log('  SKU:', prediction.sku);
    console.log('  Demand Score:', prediction.demandScore);
    console.log('  Purchase Probability:', prediction.purchaseProbability);
    console.log('  Confidence:', prediction.confidence);
    console.log('  Explanation:', prediction.explanation);

    console.log('\n🧠 Model Provenance:');
    console.log('  Model ID:', prediction.provenance.modelId);
    console.log('  Model Version:', prediction.provenance.modelVersion);
    console.log('  Training Date:', prediction.provenance.trainingDate);

    console.log('\n🔍 Feature Importance (Top 10):');
    const sortedFeatures = Object.entries(prediction.featureImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedFeatures.forEach(([feature, importance]) => {
      console.log(`  ${feature}: ${(importance * 100).toFixed(2)}%`);
    });

    // Get enhanced prediction with explainability
    const enhancedPrediction = await predictorService.getProductSignalsPrediction(
      'SKU_789',
      merchantId,
      userContext
    );

    console.log('\n🎯 Feature Groups Analysis:');
    console.log('  Demographic Features:');
    Object.entries(enhancedPrediction.featureGroups.demographic).forEach(([feature, importance]) => {
      console.log(`    ${feature}: ${(importance * 100).toFixed(2)}%`);
    });

    console.log('  Behavioral Features:');
    Object.entries(enhancedPrediction.featureGroups.behavioral).forEach(([feature, importance]) => {
      console.log(`    ${feature}: ${(importance * 100).toFixed(2)}%`);
    });

    console.log('\n🔬 Explainability Analysis:');
    if (enhancedPrediction.explainability.shapValues) {
      console.log('  SHAP Values (Top 5):');
      const topShapValues = Object.entries(enhancedPrediction.explainability.shapValues)
        .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a))
        .slice(0, 5);
      
      topShapValues.forEach(([feature, value]) => {
        const impact = value > 0 ? 'increases' : 'decreases';
        console.log(`    ${feature}: ${value.toFixed(4)} (${impact} prediction)`);
      });
    }

    console.log('\n🏆 Top Contributing Features:');
    enhancedPrediction.explainability.topFeatures.forEach((feature, index) => {
      console.log(`  ${index + 1}. ${feature.feature} (${feature.group}): ${(feature.importance * 100).toFixed(2)}%`);
      console.log(`     Current Value: ${feature.value}`);
    });

    if (enhancedPrediction.explainability.limeExplanation) {
      console.log('\n📝 LIME Explanation:');
      console.log(enhancedPrediction.explainability.limeExplanation);
    }

    return enhancedPrediction;

  } catch (error) {
    console.error('❌ Prediction error:', error);
    throw error;
  }
}

async function monitorPredictorPerformance() {
  const predictorService = getMindsDBPredictorService();
  const merchantId = 'merchant_demo_123';
  const predictorName = `product_signals_${merchantId}`;

  console.log('📊 Monitoring predictor performance...');

  try {
    // Get predictor status
    const status = await predictorService.getPredictorStatus(predictorName, merchantId);
    
    console.log('🎯 Predictor Status:');
    console.log('  Name:', status.name);
    console.log('  Status:', status.status);
    console.log('  Accuracy:', status.accuracy);
    console.log('  Model Version:', status.modelVersion);
    console.log('  Training Date:', status.trainingDate);
    console.log('  Feature Count:', status.metadata.featureCount);
    console.log('  Training Data Size:', status.metadata.trainingDataSize);
    console.log('  Model Size:', status.metadata.modelSize);

    // Get feature importance analysis
    const featureAnalysis = await predictorService.getFeatureImportanceAnalysis(predictorName, merchantId);
    
    console.log('\n📈 Feature Importance Analysis:');
    console.log('  Global Importance (Top 5):');
    const topGlobalFeatures = Object.entries(featureAnalysis.globalImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    topGlobalFeatures.forEach(([feature, importance]) => {
      console.log(`    ${feature}: ${(importance * 100).toFixed(2)}%`);
    });

    console.log('\n📊 Importance Distribution:');
    console.log('  Mean:', featureAnalysis.importanceDistribution.mean.toFixed(4));
    console.log('  Std Dev:', featureAnalysis.importanceDistribution.std.toFixed(4));
    console.log('  95th Percentile:', featureAnalysis.importanceDistribution.percentiles['95'].toFixed(4));

    return { status, featureAnalysis };

  } catch (error) {
    console.error('❌ Monitoring error:', error);
    throw error;
  }
}

async function runCompleteExample() {
  console.log('🎬 Starting Product Signals Predictor Example\n');

  try {
    // Step 1: Deploy the predictor
    console.log('=== STEP 1: DEPLOYMENT ===');
    const deploymentStatus = await deployProductSignalsPredictor();
    
    if (deploymentStatus?.status !== 'complete') {
      console.log('⏳ Waiting for deployment to complete...');
      // In a real scenario, you would poll for completion
      return;
    }

    console.log('\n=== STEP 2: PREDICTION WITH EXPLAINABILITY ===');
    const prediction = await makePredictionWithExplainability();

    console.log('\n=== STEP 3: PERFORMANCE MONITORING ===');
    const monitoring = await monitorPredictorPerformance();

    console.log('\n✅ Example completed successfully!');
    
    return {
      deployment: deploymentStatus,
      prediction,
      monitoring
    };

  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

// Export for use in other modules
export {
  deployProductSignalsPredictor,
  makePredictionWithExplainability,
  monitorPredictorPerformance,
  runCompleteExample
};

// Run example if this file is executed directly
if (require.main === module) {
  runCompleteExample()
    .then(() => {
      console.log('🎉 Product Signals Predictor example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}