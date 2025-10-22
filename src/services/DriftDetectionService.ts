import { createHash } from 'crypto';
import { config } from '../config';
import { MindsDBService } from './MindsDBService';
import { getCacheService } from './CacheService';
import { getModelRetrainingService } from './ModelRetrainingService';

export interface DriftDetectionConfig {
  merchantId: string;
  predictorName: string;
  monitoringWindow: number; // in hours
  confidenceThreshold: number; // 0-1
  accuracyThreshold: number; // 0-1
  featureImportanceThreshold: number; // 0-1
  dataDistributionThreshold: number; // 0-1
  alertChannels: ('email' | 'slack' | 'sns')[];
  autoRetrain: boolean;
}

export interface DriftAlert {
  id: string;
  merchantId: string;
  predictorName: string;
  alertType: 'confidence_drift' | 'accuracy_drift' | 'feature_drift' | 'data_drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: DriftMetrics;
  timestamp: Date;
  acknowledged: boolean;
  actionTaken?: string;
}

export interface DriftMetrics {
  merchantId: string;
  predictorName: string;
  timestamp: Date;
  confidenceDistribution: {
    mean: number;
    std: number;
    percentiles: Record<string, number>;
  };
  accuracyMetrics: {
    current: number;
    baseline: number;
    drift: number; // percentage change
  };
  featureImportanceShift: Record<string, number>;
  dataDistributionShift: number;
  alertThreshold: number;
  shouldRetrain: boolean;
}

export interface BaselineMetrics {
  merchantId: string;
  predictorName: string;
  confidenceBaseline: {
    mean: number;
    std: number;
    percentiles: Record<string, number>;
  };
  accuracyBaseline: number;
  featureImportanceBaseline: Record<string, number>;
  dataDistributionBaseline: Record<string, number>;
  establishedAt: Date;
  sampleSize: number;
}

/**
 * Drift Detection Service
 * Monitors model performance and triggers retraining when drift is detected
 */
export class DriftDetectionService {
  private mindsdbService = new MindsDBService();
  private cacheService = getCacheService();
  private modelRetrainingService = getModelRetrainingService();
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private activeAlerts = new Map<string, DriftAlert>();

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Initialize drift monitoring for all configured predictors
   */
  private async initializeMonitoring(): Promise<void> {
    console.log('Initializing drift detection monitoring...');
    // This would load monitoring configurations from a store
    // For now, we'll set up basic monitoring
  }

  /**
   * Start monitoring a predictor for drift
   */
  async startMonitoring(config: DriftDetectionConfig): Promise<void> {
    const monitoringKey = `${config.merchantId}:${config.predictorName}`;
    
    // Stop existing monitoring if any
    this.stopMonitoring(config.merchantId, config.predictorName);
    
    // Establish baseline metrics if not exists
    await this.establishBaseline(config);
    
    // Start periodic monitoring
    const interval = setInterval(async () => {
      try {
        await this.checkForDrift(config);
      } catch (error) {
        console.error(`Drift monitoring error for ${monitoringKey}:`, error);
      }
    }, config.monitoringWindow * 60 * 60 * 1000); // Convert hours to milliseconds
    
    this.monitoringIntervals.set(monitoringKey, interval);
    console.log(`Started drift monitoring for ${monitoringKey}`);
  }

  /**
   * Stop monitoring a predictor
   */
  stopMonitoring(merchantId: string, predictorName: string): void {
    const monitoringKey = `${merchantId}:${predictorName}`;
    const interval = this.monitoringIntervals.get(monitoringKey);
    
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(monitoringKey);
      console.log(`Stopped drift monitoring for ${monitoringKey}`);
    }
  }

  /**
   * Establish baseline metrics for a predictor
   */
  async establishBaseline(config: DriftDetectionConfig): Promise<BaselineMetrics> {
    const cacheKey = `baseline:${config.merchantId}:${config.predictorName}`;
    
    // Check if baseline already exists
    const existingBaseline = await this.cacheService.get<BaselineMetrics>(cacheKey);
    if (existingBaseline) {
      return existingBaseline;
    }

    // Collect recent predictions to establish baseline
    const recentPredictions = await this.collectRecentPredictions(config, 1000);
    
    if (recentPredictions.length < 100) {
      throw new Error(`Insufficient data to establish baseline. Need at least 100 predictions, got ${recentPredictions.length}`);
    }

    const confidences = recentPredictions.map(p => p.confidence);
    const featureImportances = this.aggregateFeatureImportances(recentPredictions);
    
    const baseline: BaselineMetrics = {
      merchantId: config.merchantId,
      predictorName: config.predictorName,
      confidenceBaseline: {
        mean: this.calculateMean(confidences),
        std: this.calculateStandardDeviation(confidences),
        percentiles: this.calculatePercentiles(confidences)
      },
      accuracyBaseline: await this.calculateAccuracy(config, recentPredictions),
      featureImportanceBaseline: featureImportances,
      dataDistributionBaseline: await this.calculateDataDistribution(config),
      establishedAt: new Date(),
      sampleSize: recentPredictions.length
    };

    // Cache baseline for 30 days
    await this.cacheService.set(cacheKey, baseline, 30 * 24 * 60 * 60);
    
    return baseline;
  }

  /**
   * Check for drift in model performance
   */
  async checkForDrift(config: DriftDetectionConfig): Promise<DriftMetrics> {
    const baseline = await this.establishBaseline(config);
    const recentPredictions = await this.collectRecentPredictions(config, 500);
    
    if (recentPredictions.length < 50) {
      console.warn(`Insufficient recent data for drift detection: ${recentPredictions.length} predictions`);
      return this.createEmptyDriftMetrics(config);
    }

    const confidences = recentPredictions.map(p => p.confidence);
    const currentFeatureImportances = this.aggregateFeatureImportances(recentPredictions);
    
    const driftMetrics: DriftMetrics = {
      merchantId: config.merchantId,
      predictorName: config.predictorName,
      timestamp: new Date(),
      confidenceDistribution: {
        mean: this.calculateMean(confidences),
        std: this.calculateStandardDeviation(confidences),
        percentiles: this.calculatePercentiles(confidences)
      },
      accuracyMetrics: {
        current: await this.calculateAccuracy(config, recentPredictions),
        baseline: baseline.accuracyBaseline,
        drift: 0 // Will be calculated below
      },
      featureImportanceShift: this.calculateFeatureImportanceShift(
        baseline.featureImportanceBaseline,
        currentFeatureImportances
      ),
      dataDistributionShift: await this.calculateDataDistributionShift(config, baseline),
      alertThreshold: config.confidenceThreshold,
      shouldRetrain: false
    };

    // Calculate accuracy drift
    driftMetrics.accuracyMetrics.drift = 
      Math.abs(driftMetrics.accuracyMetrics.current - driftMetrics.accuracyMetrics.baseline) / 
      driftMetrics.accuracyMetrics.baseline;

    // Determine if retraining is needed
    driftMetrics.shouldRetrain = this.shouldTriggerRetraining(config, baseline, driftMetrics);

    // Generate alerts if thresholds are exceeded
    await this.generateDriftAlerts(config, baseline, driftMetrics);

    // Trigger automatic retraining if configured
    if (config.autoRetrain && driftMetrics.shouldRetrain) {
      await this.triggerAutoRetraining(config, driftMetrics);
    }

    // Store drift metrics for historical analysis
    await this.storeDriftMetrics(driftMetrics);

    return driftMetrics;
  }

  /**
   * Collect recent predictions for analysis
   */
  private async collectRecentPredictions(config: DriftDetectionConfig, limit: number): Promise<any[]> {
    // This would query the prediction results from the database
    // For now, we'll simulate recent predictions
    const predictions = [];
    for (let i = 0; i < Math.min(limit, 200); i++) {
      predictions.push({
        confidence: 0.7 + Math.random() * 0.3,
        featureImportance: {
          price: Math.random(),
          category: Math.random(),
          rating: Math.random(),
          reviews: Math.random()
        },
        timestamp: new Date(Date.now() - i * 60000) // 1 minute intervals
      });
    }
    return predictions;
  }

  /**
   * Calculate accuracy based on ground truth data
   */
  private async calculateAccuracy(config: DriftDetectionConfig, predictions: any[]): Promise<number> {
    // This would compare predictions with actual outcomes
    // For now, we'll simulate accuracy calculation
    return 0.85 + (Math.random() - 0.5) * 0.1; // Simulate accuracy between 0.8-0.9
  }

  /**
   * Calculate data distribution metrics
   */
  private async calculateDataDistribution(config: DriftDetectionConfig): Promise<Record<string, number>> {
    // This would analyze the distribution of input features
    // For now, we'll return simulated distribution metrics
    return {
      price_distribution: Math.random(),
      category_distribution: Math.random(),
      rating_distribution: Math.random()
    };
  }

  /**
   * Calculate data distribution shift
   */
  private async calculateDataDistributionShift(
    config: DriftDetectionConfig, 
    baseline: BaselineMetrics
  ): Promise<number> {
    const currentDistribution = await this.calculateDataDistribution(config);
    
    let totalShift = 0;
    let featureCount = 0;
    
    for (const [feature, currentValue] of Object.entries(currentDistribution)) {
      const baselineValue = baseline.dataDistributionBaseline[feature];
      if (baselineValue !== undefined) {
        totalShift += Math.abs(currentValue - baselineValue);
        featureCount++;
      }
    }
    
    return featureCount > 0 ? totalShift / featureCount : 0;
  }

  /**
   * Aggregate feature importances from multiple predictions
   */
  private aggregateFeatureImportances(predictions: any[]): Record<string, number> {
    const aggregated: Record<string, number[]> = {};
    
    for (const prediction of predictions) {
      if (prediction.featureImportance) {
        for (const [feature, importance] of Object.entries(prediction.featureImportance)) {
          if (!aggregated[feature]) {
            aggregated[feature] = [];
          }
          aggregated[feature].push(importance as number);
        }
      }
    }
    
    const result: Record<string, number> = {};
    for (const [feature, importances] of Object.entries(aggregated)) {
      result[feature] = this.calculateMean(importances);
    }
    
    return result;
  }

  /**
   * Calculate feature importance shift
   */
  private calculateFeatureImportanceShift(
    baseline: Record<string, number>,
    current: Record<string, number>
  ): Record<string, number> {
    const shift: Record<string, number> = {};
    
    for (const [feature, baselineImportance] of Object.entries(baseline)) {
      const currentImportance = current[feature];
      if (currentImportance !== undefined) {
        shift[feature] = Math.abs(currentImportance - baselineImportance);
      }
    }
    
    return shift;
  }

  /**
   * Determine if retraining should be triggered
   */
  private shouldTriggerRetraining(
    config: DriftDetectionConfig,
    baseline: BaselineMetrics,
    metrics: DriftMetrics
  ): boolean {
    // Check confidence drift
    const confidenceDrift = Math.abs(metrics.confidenceDistribution.mean - baseline.confidenceBaseline.mean);
    if (confidenceDrift > config.confidenceThreshold) {
      return true;
    }

    // Check accuracy drift
    if (metrics.accuracyMetrics.drift > config.accuracyThreshold) {
      return true;
    }

    // Check feature importance drift
    const maxFeatureShift = Math.max(...Object.values(metrics.featureImportanceShift));
    if (maxFeatureShift > config.featureImportanceThreshold) {
      return true;
    }

    // Check data distribution drift
    if (metrics.dataDistributionShift > config.dataDistributionThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Generate drift alerts
   */
  private async generateDriftAlerts(
    config: DriftDetectionConfig,
    baseline: BaselineMetrics,
    metrics: DriftMetrics
  ): Promise<void> {
    const alerts: DriftAlert[] = [];

    // Confidence drift alert
    const confidenceDrift = Math.abs(metrics.confidenceDistribution.mean - baseline.confidenceBaseline.mean);
    if (confidenceDrift > config.confidenceThreshold) {
      alerts.push({
        id: `confidence-${Date.now()}`,
        merchantId: config.merchantId,
        predictorName: config.predictorName,
        alertType: 'confidence_drift',
        severity: confidenceDrift > config.confidenceThreshold * 2 ? 'critical' : 'high',
        message: `Confidence drift detected: ${(confidenceDrift * 100).toFixed(2)}% change from baseline`,
        metrics,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Accuracy drift alert
    if (metrics.accuracyMetrics.drift > config.accuracyThreshold) {
      alerts.push({
        id: `accuracy-${Date.now()}`,
        merchantId: config.merchantId,
        predictorName: config.predictorName,
        alertType: 'accuracy_drift',
        severity: metrics.accuracyMetrics.drift > config.accuracyThreshold * 2 ? 'critical' : 'high',
        message: `Accuracy drift detected: ${(metrics.accuracyMetrics.drift * 100).toFixed(2)}% change from baseline`,
        metrics,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Feature importance drift alert
    const maxFeatureShift = Math.max(...Object.values(metrics.featureImportanceShift));
    if (maxFeatureShift > config.featureImportanceThreshold) {
      const driftedFeature = Object.entries(metrics.featureImportanceShift)
        .find(([_, shift]) => shift === maxFeatureShift)?.[0];
      
      alerts.push({
        id: `feature-${Date.now()}`,
        merchantId: config.merchantId,
        predictorName: config.predictorName,
        alertType: 'feature_drift',
        severity: maxFeatureShift > config.featureImportanceThreshold * 2 ? 'critical' : 'medium',
        message: `Feature importance drift detected in '${driftedFeature}': ${(maxFeatureShift * 100).toFixed(2)}% change`,
        metrics,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Data distribution drift alert
    if (metrics.dataDistributionShift > config.dataDistributionThreshold) {
      alerts.push({
        id: `data-${Date.now()}`,
        merchantId: config.merchantId,
        predictorName: config.predictorName,
        alertType: 'data_drift',
        severity: metrics.dataDistributionShift > config.dataDistributionThreshold * 2 ? 'critical' : 'medium',
        message: `Data distribution drift detected: ${(metrics.dataDistributionShift * 100).toFixed(2)}% change`,
        metrics,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Store and send alerts
    for (const alert of alerts) {
      this.activeAlerts.set(alert.id, alert);
      await this.sendAlert(alert, config.alertChannels);
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: DriftAlert, channels: ('email' | 'slack' | 'sns')[]): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailAlert(alert);
            break;
          case 'slack':
            await this.sendSlackAlert(alert);
            break;
          case 'sns':
            await this.sendSNSAlert(alert);
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel}:`, error);
      }
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: DriftAlert): Promise<void> {
    // This would integrate with SES or another email service
    console.log(`Email alert sent: ${alert.message}`);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: DriftAlert): Promise<void> {
    // This would integrate with Slack API
    console.log(`Slack alert sent: ${alert.message}`);
  }

  /**
   * Send SNS alert
   */
  private async sendSNSAlert(alert: DriftAlert): Promise<void> {
    // This would integrate with AWS SNS
    console.log(`SNS alert sent: ${alert.message}`);
  }

  /**
   * Trigger automatic retraining
   */
  private async triggerAutoRetraining(config: DriftDetectionConfig, metrics: DriftMetrics): Promise<void> {
    try {
      const retrainingConfig = {
        merchantId: config.merchantId,
        predictorName: config.predictorName,
        trainingDataQuery: `SELECT * FROM training_data WHERE merchant_id = '${config.merchantId}' AND created_at > NOW() - INTERVAL '30 days'`,
        schedule: 'on-demand' as const,
        spotInstanceConfig: {
          instanceType: 'm5.large',
          maxPrice: 0.1,
          availabilityZone: 'us-east-1a'
        },
        resourceLimits: {
          cpu: '2',
          memory: '4096',
          timeout: 3600
        }
      };

      const jobId = await this.modelRetrainingService.createRetrainingJob(retrainingConfig);
      
      console.log(`Auto-retraining triggered for ${config.predictorName}: Job ID ${jobId}`);
      
      // Update alerts with action taken
      for (const [alertId, alert] of this.activeAlerts.entries()) {
        if (alert.merchantId === config.merchantId && alert.predictorName === config.predictorName) {
          alert.actionTaken = `Auto-retraining job ${jobId} started`;
          this.activeAlerts.set(alertId, alert);
        }
      }
    } catch (error) {
      console.error('Failed to trigger auto-retraining:', error);
    }
  }

  /**
   * Store drift metrics for historical analysis
   */
  private async storeDriftMetrics(metrics: DriftMetrics): Promise<void> {
    const cacheKey = `drift_metrics:${metrics.merchantId}:${metrics.predictorName}:${metrics.timestamp.getTime()}`;
    await this.cacheService.set(cacheKey, metrics, 7 * 24 * 60 * 60); // Store for 7 days
  }

  /**
   * Get drift history for a predictor
   */
  async getDriftHistory(merchantId: string, predictorName: string, days: number = 7): Promise<DriftMetrics[]> {
    // This would query stored drift metrics
    // For now, we'll return simulated history
    const history: DriftMetrics[] = [];
    const now = Date.now();
    
    for (let i = 0; i < days; i++) {
      history.push({
        merchantId,
        predictorName,
        timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
        confidenceDistribution: {
          mean: 0.8 + Math.random() * 0.1,
          std: 0.1 + Math.random() * 0.05,
          percentiles: { '50': 0.8, '90': 0.9, '95': 0.95 }
        },
        accuracyMetrics: {
          current: 0.85 + Math.random() * 0.1,
          baseline: 0.85,
          drift: Math.random() * 0.05
        },
        featureImportanceShift: {
          price: Math.random() * 0.1,
          category: Math.random() * 0.1,
          rating: Math.random() * 0.1
        },
        dataDistributionShift: Math.random() * 0.1,
        alertThreshold: 0.1,
        shouldRetrain: Math.random() > 0.8
      });
    }
    
    return history;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(merchantId?: string): DriftAlert[] {
    const alerts = Array.from(this.activeAlerts.values());
    return merchantId ? alerts.filter(alert => alert.merchantId === merchantId) : alerts;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.activeAlerts.set(alertId, alert);
    }
  }

  /**
   * Create empty drift metrics for insufficient data scenarios
   */
  private createEmptyDriftMetrics(config: DriftDetectionConfig): DriftMetrics {
    return {
      merchantId: config.merchantId,
      predictorName: config.predictorName,
      timestamp: new Date(),
      confidenceDistribution: { mean: 0, std: 0, percentiles: {} },
      accuracyMetrics: { current: 0, baseline: 0, drift: 0 },
      featureImportanceShift: {},
      dataDistributionShift: 0,
      alertThreshold: config.confidenceThreshold,
      shouldRetrain: false
    };
  }

  /**
   * Utility functions for statistical calculations
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];
    const result: Record<string, number> = {};
    
    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[p.toString()] = sorted[Math.max(0, index)];
    }
    
    return result;
  }
}

// Export singleton instance
let driftDetectionServiceInstance: DriftDetectionService | null = null;

export const getDriftDetectionService = (): DriftDetectionService => {
  if (!driftDetectionServiceInstance) {
    driftDetectionServiceInstance = new DriftDetectionService();
  }
  return driftDetectionServiceInstance;
};