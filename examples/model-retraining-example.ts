/**
 * Example: Model Retraining and Drift Detection Pipeline
 * 
 * This example demonstrates how to set up and use the model retraining pipeline
 * with drift detection, cost-effective Spot instances, and S3 artifact storage.
 */

import { 
  getModelRetrainingPipeline,
  getDriftDetectionService,
  getModelArtifactService,
  PipelineConfig 
} from '../src/services';

async function demonstrateRetrainingPipeline() {
  console.log('🚀 Model Retraining Pipeline Demo\n');

  // Get service instances
  const pipeline = getModelRetrainingPipeline();
  const driftService = getDriftDetectionService();
  const artifactService = getModelArtifactService();

  // 1. Create a comprehensive retraining pipeline configuration
  const pipelineConfig: PipelineConfig = {
    merchantId: 'demo-merchant',
    predictorName: 'product_recommendation',
    
    // Retraining job configuration
    retrainingConfig: {
      merchantId: 'demo-merchant',
      predictorName: 'product_recommendation',
      trainingDataQuery: `
        SELECT 
          sku, user_id, rating, purchase_date, category, price,
          user_demographics, seasonal_factors
        FROM training_data 
        WHERE merchant_id = 'demo-merchant' 
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY purchase_date DESC
      `,
      schedule: 'weekly',
      
      // Cost-effective Spot instance configuration
      spotInstanceConfig: {
        instanceType: 'c5.xlarge',
        maxPrice: 0.08, // 80% savings over on-demand
        availabilityZone: 'us-east-1a'
      },
      
      // Resource limits for training job
      resourceLimits: {
        cpu: '4',
        memory: '8192',
        timeout: 7200 // 2 hours max
      }
    },
    
    // Drift detection configuration
    driftConfig: {
      merchantId: 'demo-merchant',
      predictorName: 'product_recommendation',
      monitoringWindow: 6, // Check every 6 hours
      confidenceThreshold: 0.15, // Alert if confidence drops by 15%
      accuracyThreshold: 0.10, // Alert if accuracy drops by 10%
      featureImportanceThreshold: 0.20, // Alert if feature importance shifts by 20%
      dataDistributionThreshold: 0.15, // Alert if data distribution shifts by 15%
      alertChannels: ['email', 'slack'],
      autoRetrain: true // Automatically trigger retraining on drift
    },
    
    // Scheduled retraining (weekly on Sundays at 2 AM)
    scheduledRetraining: {
      enabled: true,
      cronExpression: '0 2 * * 0',
      timezone: 'UTC'
    },
    
    // Cost limits and budgets
    costLimits: {
      maxCostPerJob: 5.0, // $5 max per retraining job
      maxMonthlyCost: 50.0, // $50 max per month
      alertThreshold: 40.0 // Alert at $40 monthly spend
    },
    
    // Notification channels
    notifications: {
      email: ['ml-team@company.com', 'ops@company.com'],
      slack: {
        webhook: 'https://hooks.slack.com/services/...',
        channel: '#ml-alerts'
      },
      sns: {
        topicArn: 'arn:aws:sns:us-east-1:123456789012:ml-alerts'
      }
    }
  };

  try {
    // 2. Create and start the retraining pipeline
    console.log('📋 Creating retraining pipeline...');
    await pipeline.createPipeline(pipelineConfig);
    console.log('✅ Pipeline created successfully\n');

    // 3. Check pipeline status
    console.log('📊 Checking pipeline status...');
    const status = await pipeline.getPipelineStatus('demo-merchant', 'product_recommendation');
    console.log('Pipeline Status:', {
      isActive: status.isActive,
      lastRetraining: status.lastRetraining,
      nextScheduled: status.nextScheduledRetraining,
      isDrifting: status.driftStatus.isDrifting,
      monthlySpend: `$${status.costTracking.monthlySpend.toFixed(2)}`,
      remainingBudget: `$${status.costTracking.remainingBudget.toFixed(2)}`,
      currentAccuracy: `${(status.performance.currentAccuracy * 100).toFixed(1)}%`
    });
    console.log('');

    // 4. Demonstrate manual retraining trigger
    console.log('🔄 Triggering manual retraining...');
    const jobId = await pipeline.triggerRetraining(
      'demo-merchant', 
      'product_recommendation', 
      'performance_degradation_detected'
    );
    console.log(`✅ Retraining job started: ${jobId}\n`);

    // 5. Simulate drift detection
    console.log('🔍 Demonstrating drift detection...');
    
    // Start monitoring (this would normally run continuously)
    await driftService.startMonitoring(pipelineConfig.driftConfig);
    
    // Get drift history
    const driftHistory = await driftService.getDriftHistory('demo-merchant', 'product_recommendation', 7);
    console.log(`📈 Drift history (last 7 days): ${driftHistory.length} data points`);
    
    if (driftHistory.length > 0) {
      const latestDrift = driftHistory[0];
      console.log('Latest drift metrics:', {
        timestamp: latestDrift.timestamp.toISOString(),
        confidenceMean: latestDrift.confidenceDistribution.mean.toFixed(3),
        accuracyDrift: `${(latestDrift.accuracyMetrics.drift * 100).toFixed(1)}%`,
        shouldRetrain: latestDrift.shouldRetrain
      });
    }
    console.log('');

    // 6. Demonstrate model artifact management
    console.log('📦 Demonstrating model artifact management...');
    
    // List artifact versions
    const versions = await artifactService.listVersions('demo-merchant', 'product_recommendation');
    console.log(`📚 Available model versions: ${versions.length}`);
    
    versions.forEach((version, index) => {
      console.log(`  ${index + 1}. ${version.version} (${(version.size / 1024 / 1024).toFixed(1)}MB) ${version.isActive ? '← Active' : ''}`);
    });
    console.log('');

    // 7. Get pipeline metrics
    console.log('📊 Pipeline performance metrics...');
    const metrics = await pipeline.getPipelineMetrics('demo-merchant');
    console.log('Overall Metrics:', {
      totalJobs: metrics.totalRetrainingJobs,
      successRate: `${((metrics.successfulJobs / metrics.totalRetrainingJobs) * 100).toFixed(1)}%`,
      avgDuration: `${Math.round(metrics.averageJobDuration / 60)} minutes`,
      costSavings: `$${metrics.totalCostSavings.toFixed(2)} (from Spot instances)`,
      driftAccuracy: `${(metrics.driftDetectionAccuracy * 100).toFixed(1)}%`,
      avgImprovement: `${(metrics.averageModelImprovement * 100).toFixed(1)}%`
    });
    console.log('');

    // 8. Demonstrate cost optimization features
    console.log('💰 Cost optimization features...');
    console.log('- Using Spot instances for 60-90% cost savings');
    console.log('- Automated job scheduling during off-peak hours');
    console.log('- Resource right-sizing based on workload requirements');
    console.log('- Budget alerts and automatic cost controls');
    console.log('- S3 lifecycle policies for artifact storage optimization');
    console.log('');

    // 9. Show active alerts
    const activeAlerts = driftService.getActiveAlerts('demo-merchant');
    if (activeAlerts.length > 0) {
      console.log('🚨 Active drift alerts:');
      activeAlerts.forEach(alert => {
        console.log(`  - ${alert.alertType}: ${alert.message} (${alert.severity})`);
      });
    } else {
      console.log('✅ No active drift alerts');
    }
    console.log('');

    // 10. Update pipeline configuration
    console.log('⚙️  Updating pipeline configuration...');
    await pipeline.updatePipeline('demo-merchant', 'product_recommendation', {
      costLimits: {
        maxCostPerJob: 7.0, // Increase job limit
        maxMonthlyCost: 75.0, // Increase monthly limit
        alertThreshold: 60.0 // Increase alert threshold
      }
    });
    console.log('✅ Pipeline configuration updated\n');

    console.log('🎉 Model retraining pipeline demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('✓ Automated weekly retraining with Spot instances');
    console.log('✓ Real-time drift detection and alerting');
    console.log('✓ Cost-effective training with budget controls');
    console.log('✓ Model artifact versioning and management');
    console.log('✓ Multi-channel notifications (email, Slack, SNS)');
    console.log('✓ Comprehensive monitoring and metrics');
    console.log('✓ ECS/EKS job orchestration');
    console.log('✓ S3 integration with lifecycle policies');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup: Remove the demo pipeline
    console.log('\n🧹 Cleaning up demo pipeline...');
    try {
      await pipeline.removePipeline('demo-merchant', 'product_recommendation');
      console.log('✅ Demo pipeline removed');
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error);
    }
  }
}

// Additional utility functions for the demo

async function demonstrateSpotInstanceOptimization() {
  console.log('\n💡 Spot Instance Optimization Strategies:');
  console.log('');
  
  console.log('1. Multi-AZ Diversification:');
  console.log('   - Spread jobs across multiple availability zones');
  console.log('   - Reduce interruption risk by 50-70%');
  console.log('');
  
  console.log('2. Instance Type Flexibility:');
  console.log('   - Use multiple instance types (c5.large, c5.xlarge, c5.2xlarge)');
  console.log('   - Automatic fallback to alternative types');
  console.log('');
  
  console.log('3. Interruption Handling:');
  console.log('   - Checkpoint model training every 15 minutes');
  console.log('   - Automatic job restart on interruption');
  console.log('   - State preservation in S3');
  console.log('');
  
  console.log('4. Cost Monitoring:');
  console.log('   - Real-time cost tracking per job');
  console.log('   - Budget alerts and automatic scaling');
  console.log('   - Historical cost analysis and optimization');
}

async function demonstrateDriftDetectionScenarios() {
  console.log('\n🔍 Drift Detection Scenarios:');
  console.log('');
  
  console.log('1. Confidence Drift:');
  console.log('   - Model predictions become less confident over time');
  console.log('   - Triggered when mean confidence drops by >15%');
  console.log('   - Often indicates data distribution changes');
  console.log('');
  
  console.log('2. Accuracy Drift:');
  console.log('   - Model performance degrades against ground truth');
  console.log('   - Triggered when accuracy drops by >10%');
  console.log('   - Requires labeled validation data');
  console.log('');
  
  console.log('3. Feature Importance Drift:');
  console.log('   - Feature importance rankings change significantly');
  console.log('   - Triggered when importance shifts by >20%');
  console.log('   - Indicates changing business patterns');
  console.log('');
  
  console.log('4. Data Distribution Drift:');
  console.log('   - Input feature distributions change over time');
  console.log('   - Triggered when distribution shifts by >15%');
  console.log('   - Detected using statistical tests');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateRetrainingPipeline()
    .then(() => demonstrateSpotInstanceOptimization())
    .then(() => demonstrateDriftDetectionScenarios())
    .catch(console.error);
}

export {
  demonstrateRetrainingPipeline,
  demonstrateSpotInstanceOptimization,
  demonstrateDriftDetectionScenarios
};