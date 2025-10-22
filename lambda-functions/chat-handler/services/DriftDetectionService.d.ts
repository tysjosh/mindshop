export interface DriftDetectionConfig {
    merchantId: string;
    predictorName: string;
    monitoringWindow: number;
    confidenceThreshold: number;
    accuracyThreshold: number;
    featureImportanceThreshold: number;
    dataDistributionThreshold: number;
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
        drift: number;
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
export declare class DriftDetectionService {
    private mindsdbService;
    private cacheService;
    private modelRetrainingService;
    private monitoringIntervals;
    private activeAlerts;
    constructor();
    /**
     * Initialize drift monitoring for all configured predictors
     */
    private initializeMonitoring;
    /**
     * Start monitoring a predictor for drift
     */
    startMonitoring(config: DriftDetectionConfig): Promise<void>;
    /**
     * Stop monitoring a predictor
     */
    stopMonitoring(merchantId: string, predictorName: string): void;
    /**
     * Establish baseline metrics for a predictor
     */
    establishBaseline(config: DriftDetectionConfig): Promise<BaselineMetrics>;
    /**
     * Check for drift in model performance
     */
    checkForDrift(config: DriftDetectionConfig): Promise<DriftMetrics>;
    /**
     * Collect recent predictions for analysis
     */
    private collectRecentPredictions;
    /**
     * Calculate accuracy based on ground truth data
     */
    private calculateAccuracy;
    /**
     * Calculate data distribution metrics
     */
    private calculateDataDistribution;
    /**
     * Calculate data distribution shift
     */
    private calculateDataDistributionShift;
    /**
     * Aggregate feature importances from multiple predictions
     */
    private aggregateFeatureImportances;
    /**
     * Calculate feature importance shift
     */
    private calculateFeatureImportanceShift;
    /**
     * Determine if retraining should be triggered
     */
    private shouldTriggerRetraining;
    /**
     * Generate drift alerts
     */
    private generateDriftAlerts;
    /**
     * Send alert through configured channels
     */
    private sendAlert;
    /**
     * Send email alert
     */
    private sendEmailAlert;
    /**
     * Send Slack alert
     */
    private sendSlackAlert;
    /**
     * Send SNS alert
     */
    private sendSNSAlert;
    /**
     * Trigger automatic retraining
     */
    private triggerAutoRetraining;
    /**
     * Store drift metrics for historical analysis
     */
    private storeDriftMetrics;
    /**
     * Get drift history for a predictor
     */
    getDriftHistory(merchantId: string, predictorName: string, days?: number): Promise<DriftMetrics[]>;
    /**
     * Get active alerts
     */
    getActiveAlerts(merchantId?: string): DriftAlert[];
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void;
    /**
     * Create empty drift metrics for insufficient data scenarios
     */
    private createEmptyDriftMetrics;
    /**
     * Utility functions for statistical calculations
     */
    private calculateMean;
    private calculateStandardDeviation;
    private calculatePercentiles;
}
export declare const getDriftDetectionService: () => DriftDetectionService;
//# sourceMappingURL=DriftDetectionService.d.ts.map