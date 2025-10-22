import { RetrainingJobConfig } from './ModelRetrainingService';
import { DriftDetectionConfig } from './DriftDetectionService';
export interface PipelineConfig {
    merchantId: string;
    predictorName: string;
    retrainingConfig: RetrainingJobConfig;
    driftConfig: DriftDetectionConfig;
    scheduledRetraining: {
        enabled: boolean;
        cronExpression: string;
        timezone: string;
    };
    costLimits: {
        maxCostPerJob: number;
        maxMonthlyCost: number;
        alertThreshold: number;
    };
    notifications: {
        email?: string[];
        slack?: {
            webhook: string;
            channel: string;
        };
        sns?: {
            topicArn: string;
        };
    };
}
export interface PipelineStatus {
    merchantId: string;
    predictorName: string;
    isActive: boolean;
    lastRetraining: Date | null;
    nextScheduledRetraining: Date | null;
    driftStatus: {
        lastCheck: Date;
        isDrifting: boolean;
        alertsCount: number;
    };
    costTracking: {
        monthlySpend: number;
        lastJobCost: number;
        remainingBudget: number;
    };
    performance: {
        currentAccuracy: number;
        baselineAccuracy: number;
        confidenceTrend: 'improving' | 'stable' | 'declining';
    };
}
export interface PipelineMetrics {
    totalRetrainingJobs: number;
    successfulJobs: number;
    failedJobs: number;
    averageJobDuration: number;
    totalCostSavings: number;
    driftDetectionAccuracy: number;
    averageModelImprovement: number;
}
/**
 * Model Retraining Pipeline
 * Orchestrates the complete model retraining and drift detection workflow
 */
export declare class ModelRetrainingPipeline {
    private retrainingService;
    private driftService;
    private artifactService;
    private orchestrator;
    private cacheService;
    private activePipelines;
    private scheduledJobs;
    constructor();
    /**
     * Initialize existing pipelines from configuration
     */
    private initializePipelines;
    /**
     * Create and start a new retraining pipeline
     */
    createPipeline(config: PipelineConfig): Promise<void>;
    /**
     * Update an existing pipeline configuration
     */
    updatePipeline(merchantId: string, predictorName: string, updates: Partial<PipelineConfig>): Promise<void>;
    /**
     * Stop and remove a pipeline
     */
    removePipeline(merchantId: string, predictorName: string): Promise<void>;
    /**
     * Trigger manual retraining
     */
    triggerRetraining(merchantId: string, predictorName: string, reason?: string): Promise<string>;
    /**
     * Get pipeline status
     */
    getPipelineStatus(merchantId: string, predictorName: string): Promise<PipelineStatus>;
    /**
     * Get pipeline metrics
     */
    getPipelineMetrics(merchantId?: string): Promise<PipelineMetrics>;
    /**
     * List all active pipelines
     */
    listPipelines(merchantId?: string): PipelineConfig[];
    /**
     * Validate pipeline configuration
     */
    private validatePipelineConfig;
    /**
     * Schedule automatic retraining
     */
    private scheduleRetraining;
    /**
     * Unschedule automatic retraining
     */
    private unscheduleRetraining;
    /**
     * Calculate next scheduled time from cron expression
     */
    private calculateNextScheduledTime;
    /**
     * Check cost limits before starting retraining
     */
    private checkCostLimits;
    /**
     * Calculate monthly spend for a predictor
     */
    private calculateMonthlySpend;
    /**
     * Monitor retraining job completion
     */
    private monitorRetrainingJob;
    /**
     * Send retraining notifications
     */
    private sendRetrainingNotification;
    /**
     * Format notification message
     */
    private formatNotificationMessage;
    /**
     * Send email notification
     */
    private sendEmailNotification;
    /**
     * Send Slack notification
     */
    private sendSlackNotification;
    /**
     * Send SNS notification
     */
    private sendSNSNotification;
    /**
     * Update pipeline metrics after job completion
     */
    private updatePipelineMetrics;
    /**
     * Store pipeline configuration
     */
    private storePipelineConfig;
    /**
     * Remove pipeline configuration
     */
    private removePipelineConfig;
    /**
     * Start pipeline monitoring loop
     */
    private startPipelineMonitoring;
}
export declare const getModelRetrainingPipeline: () => ModelRetrainingPipeline;
//# sourceMappingURL=ModelRetrainingPipeline.d.ts.map