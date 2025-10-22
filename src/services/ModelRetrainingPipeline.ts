import { config } from '../config';
import { getModelRetrainingService, RetrainingJobConfig } from './ModelRetrainingService';
import { getDriftDetectionService, DriftDetectionConfig } from './DriftDetectionService';
import { getModelArtifactService } from './ModelArtifactService';
import { getTrainingJobOrchestrator } from './TrainingJobOrchestrator';
import { getCacheService } from './CacheService';

export interface PipelineConfig {
  merchantId: string;
  predictorName: string;
  retrainingConfig: RetrainingJobConfig;
  driftConfig: DriftDetectionConfig;
  scheduledRetraining: {
    enabled: boolean;
    cronExpression: string; // e.g., "0 2 * * 0" for weekly Sunday 2 AM
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
  totalCostSavings: number; // from using Spot instances
  driftDetectionAccuracy: number;
  averageModelImprovement: number;
}

/**
 * Model Retraining Pipeline
 * Orchestrates the complete model retraining and drift detection workflow
 */
export class ModelRetrainingPipeline {
  private retrainingService = getModelRetrainingService();
  private driftService = getDriftDetectionService();
  private artifactService = getModelArtifactService();
  private orchestrator = getTrainingJobOrchestrator();
  private cacheService = getCacheService();
  
  private activePipelines = new Map<string, PipelineConfig>();
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initializePipelines();
  }

  /**
   * Initialize existing pipelines from configuration
   */
  private async initializePipelines(): Promise<void> {
    console.log('Initializing model retraining pipelines...');
    
    // This would load pipeline configurations from a persistent store
    // For now, we'll set up basic initialization
    
    // Start the pipeline monitoring loop
    this.startPipelineMonitoring();
  }

  /**
   * Create and start a new retraining pipeline
   */
  async createPipeline(config: PipelineConfig): Promise<void> {
    const pipelineKey = `${config.merchantId}:${config.predictorName}`;
    
    // Validate configuration
    this.validatePipelineConfig(config);
    
    // Store pipeline configuration
    this.activePipelines.set(pipelineKey, config);
    
    // Start drift detection monitoring
    await this.driftService.startMonitoring(config.driftConfig);
    
    // Schedule automatic retraining if enabled
    if (config.scheduledRetraining.enabled) {
      this.scheduleRetraining(pipelineKey, config);
    }
    
    // Store configuration for persistence
    await this.storePipelineConfig(config);
    
    console.log(`Created retraining pipeline for ${pipelineKey}`);
  }

  /**
   * Update an existing pipeline configuration
   */
  async updatePipeline(
    merchantId: string,
    predictorName: string,
    updates: Partial<PipelineConfig>
  ): Promise<void> {
    const pipelineKey = `${merchantId}:${predictorName}`;
    const existingConfig = this.activePipelines.get(pipelineKey);
    
    if (!existingConfig) {
      throw new Error(`Pipeline ${pipelineKey} not found`);
    }
    
    const updatedConfig = { ...existingConfig, ...updates };
    this.validatePipelineConfig(updatedConfig);
    
    // Stop existing monitoring and scheduling
    this.driftService.stopMonitoring(merchantId, predictorName);
    this.unscheduleRetraining(pipelineKey);
    
    // Apply updates
    this.activePipelines.set(pipelineKey, updatedConfig);
    
    // Restart with new configuration
    await this.driftService.startMonitoring(updatedConfig.driftConfig);
    
    if (updatedConfig.scheduledRetraining.enabled) {
      this.scheduleRetraining(pipelineKey, updatedConfig);
    }
    
    await this.storePipelineConfig(updatedConfig);
    
    console.log(`Updated retraining pipeline for ${pipelineKey}`);
  }

  /**
   * Stop and remove a pipeline
   */
  async removePipeline(merchantId: string, predictorName: string): Promise<void> {
    const pipelineKey = `${merchantId}:${predictorName}`;
    
    // Stop monitoring and scheduling
    this.driftService.stopMonitoring(merchantId, predictorName);
    this.unscheduleRetraining(pipelineKey);
    
    // Remove from active pipelines
    this.activePipelines.delete(pipelineKey);
    
    // Remove from persistent storage
    await this.removePipelineConfig(merchantId, predictorName);
    
    console.log(`Removed retraining pipeline for ${pipelineKey}`);
  }

  /**
   * Trigger manual retraining
   */
  async triggerRetraining(
    merchantId: string,
    predictorName: string,
    reason: string = 'manual'
  ): Promise<string> {
    const pipelineKey = `${merchantId}:${predictorName}`;
    const config = this.activePipelines.get(pipelineKey);
    
    if (!config) {
      throw new Error(`Pipeline ${pipelineKey} not found`);
    }
    
    // Check cost limits
    await this.checkCostLimits(config);
    
    // Create retraining job
    const jobId = await this.retrainingService.createRetrainingJob(config.retrainingConfig);
    
    // Send notifications
    await this.sendRetrainingNotification(config, 'started', {
      jobId,
      reason,
      estimatedCost: config.retrainingConfig.spotInstanceConfig.maxPrice
    });
    
    // Monitor job completion
    this.monitorRetrainingJob(jobId, config);
    
    return jobId;
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(merchantId: string, predictorName: string): Promise<PipelineStatus> {
    const pipelineKey = `${merchantId}:${predictorName}`;
    const config = this.activePipelines.get(pipelineKey);
    
    if (!config) {
      throw new Error(`Pipeline ${pipelineKey} not found`);
    }
    
    // Get recent retraining jobs
    const recentJobs = this.retrainingService.listJobs(merchantId)
      .filter(job => job.predictorName === predictorName)
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
    
    // Get drift alerts
    const activeAlerts = this.driftService.getActiveAlerts(merchantId)
      .filter(alert => alert.predictorName === predictorName);
    
    // Calculate next scheduled retraining
    const nextScheduled = config.scheduledRetraining.enabled 
      ? this.calculateNextScheduledTime(config.scheduledRetraining.cronExpression)
      : null;
    
    // Get cost tracking
    const monthlySpend = await this.calculateMonthlySpend(merchantId, predictorName);
    const lastJobCost = recentJobs[0]?.actualCost || 0;
    
    return {
      merchantId,
      predictorName,
      isActive: true,
      lastRetraining: recentJobs[0]?.endTime || null,
      nextScheduledRetraining: nextScheduled,
      driftStatus: {
        lastCheck: new Date(), // This would come from drift service
        isDrifting: activeAlerts.length > 0,
        alertsCount: activeAlerts.length
      },
      costTracking: {
        monthlySpend,
        lastJobCost,
        remainingBudget: config.costLimits.maxMonthlyCost - monthlySpend
      },
      performance: {
        currentAccuracy: 0.85, // This would come from actual metrics
        baselineAccuracy: 0.82,
        confidenceTrend: 'improving'
      }
    };
  }

  /**
   * Get pipeline metrics
   */
  async getPipelineMetrics(merchantId?: string): Promise<PipelineMetrics> {
    // This would aggregate metrics from all services
    // For now, we'll return simulated metrics
    
    return {
      totalRetrainingJobs: 45,
      successfulJobs: 42,
      failedJobs: 3,
      averageJobDuration: 3600, // 1 hour
      totalCostSavings: 156.78, // from Spot instances
      driftDetectionAccuracy: 0.92,
      averageModelImprovement: 0.03 // 3% improvement on average
    };
  }

  /**
   * List all active pipelines
   */
  listPipelines(merchantId?: string): PipelineConfig[] {
    const pipelines = Array.from(this.activePipelines.values());
    return merchantId ? pipelines.filter(p => p.merchantId === merchantId) : pipelines;
  }

  /**
   * Validate pipeline configuration
   */
  private validatePipelineConfig(config: PipelineConfig): void {
    if (!config.merchantId || !config.predictorName) {
      throw new Error('merchantId and predictorName are required');
    }
    
    if (config.costLimits.maxCostPerJob <= 0 || config.costLimits.maxMonthlyCost <= 0) {
      throw new Error('Cost limits must be positive values');
    }
    
    if (config.driftConfig.confidenceThreshold < 0 || config.driftConfig.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    
    if (config.retrainingConfig.spotInstanceConfig.maxPrice <= 0) {
      throw new Error('Spot instance max price must be positive');
    }
  }

  /**
   * Schedule automatic retraining
   */
  private scheduleRetraining(pipelineKey: string, config: PipelineConfig): void {
    // Parse cron expression and calculate next execution time
    const nextExecution = this.calculateNextScheduledTime(config.scheduledRetraining.cronExpression);
    
    if (nextExecution) {
      const delay = nextExecution.getTime() - Date.now();
      
      const timeoutId = setTimeout(async () => {
        try {
          await this.triggerRetraining(
            config.merchantId,
            config.predictorName,
            'scheduled'
          );
          
          // Reschedule for next execution
          this.scheduleRetraining(pipelineKey, config);
        } catch (error) {
          console.error(`Scheduled retraining failed for ${pipelineKey}:`, error);
        }
      }, delay);
      
      this.scheduledJobs.set(pipelineKey, timeoutId);
    }
  }

  /**
   * Unschedule automatic retraining
   */
  private unscheduleRetraining(pipelineKey: string): void {
    const timeoutId = this.scheduledJobs.get(pipelineKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledJobs.delete(pipelineKey);
    }
  }

  /**
   * Calculate next scheduled time from cron expression
   */
  private calculateNextScheduledTime(cronExpression: string): Date | null {
    // This would use a cron parser library
    // For now, we'll simulate weekly scheduling
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(2, 0, 0, 0); // 2 AM
    return nextWeek;
  }

  /**
   * Check cost limits before starting retraining
   */
  private async checkCostLimits(config: PipelineConfig): Promise<void> {
    const monthlySpend = await this.calculateMonthlySpend(config.merchantId, config.predictorName);
    const estimatedJobCost = config.retrainingConfig.spotInstanceConfig.maxPrice;
    
    if (estimatedJobCost > config.costLimits.maxCostPerJob) {
      throw new Error(`Estimated job cost ($${estimatedJobCost}) exceeds limit ($${config.costLimits.maxCostPerJob})`);
    }
    
    if (monthlySpend + estimatedJobCost > config.costLimits.maxMonthlyCost) {
      throw new Error(`Monthly cost limit would be exceeded: $${monthlySpend + estimatedJobCost} > $${config.costLimits.maxMonthlyCost}`);
    }
  }

  /**
   * Calculate monthly spend for a predictor
   */
  private async calculateMonthlySpend(merchantId: string, predictorName: string): Promise<number> {
    const jobs = this.retrainingService.listJobs(merchantId)
      .filter(job => job.predictorName === predictorName);
    
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    return jobs
      .filter(job => job.startTime && job.startTime >= currentMonth)
      .reduce((sum, job) => sum + (job.actualCost || job.costEstimate), 0);
  }

  /**
   * Monitor retraining job completion
   */
  private monitorRetrainingJob(jobId: string, config: PipelineConfig): void {
    const checkInterval = setInterval(async () => {
      const jobStatus = this.retrainingService.getJobStatus(jobId);
      
      if (!jobStatus) {
        clearInterval(checkInterval);
        return;
      }
      
      if (jobStatus.status === 'completed') {
        clearInterval(checkInterval);
        
        await this.sendRetrainingNotification(config, 'completed', {
          jobId,
          actualCost: jobStatus.actualCost,
          modelVersion: jobStatus.modelVersion
        });
        
        // Update pipeline metrics
        await this.updatePipelineMetrics(config, jobStatus);
        
      } else if (jobStatus.status === 'failed') {
        clearInterval(checkInterval);
        
        await this.sendRetrainingNotification(config, 'failed', {
          jobId,
          error: jobStatus.error
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Send retraining notifications
   */
  private async sendRetrainingNotification(
    config: PipelineConfig,
    event: 'started' | 'completed' | 'failed',
    details: Record<string, any>
  ): Promise<void> {
    const message = this.formatNotificationMessage(config, event, details);
    
    // Send email notifications
    if (config.notifications.email) {
      for (const email of config.notifications.email) {
        await this.sendEmailNotification(email, message);
      }
    }
    
    // Send Slack notifications
    if (config.notifications.slack) {
      await this.sendSlackNotification(config.notifications.slack, message);
    }
    
    // Send SNS notifications
    if (config.notifications.sns) {
      await this.sendSNSNotification(config.notifications.sns.topicArn, message);
    }
  }

  /**
   * Format notification message
   */
  private formatNotificationMessage(
    config: PipelineConfig,
    event: string,
    details: Record<string, any>
  ): string {
    const predictor = `${config.merchantId}/${config.predictorName}`;
    
    switch (event) {
      case 'started':
        return `🚀 Retraining started for ${predictor}\nJob ID: ${details.jobId}\nReason: ${details.reason}\nEstimated Cost: $${details.estimatedCost}`;
      
      case 'completed':
        return `✅ Retraining completed for ${predictor}\nJob ID: ${details.jobId}\nActual Cost: $${details.actualCost}\nNew Model Version: ${details.modelVersion}`;
      
      case 'failed':
        return `❌ Retraining failed for ${predictor}\nJob ID: ${details.jobId}\nError: ${details.error}`;
      
      default:
        return `Retraining ${event} for ${predictor}`;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(email: string, message: string): Promise<void> {
    // This would integrate with SES or another email service
    console.log(`Email notification sent to ${email}: ${message}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    slackConfig: { webhook: string; channel: string },
    message: string
  ): Promise<void> {
    // This would integrate with Slack webhook
    console.log(`Slack notification sent to ${slackConfig.channel}: ${message}`);
  }

  /**
   * Send SNS notification
   */
  private async sendSNSNotification(topicArn: string, message: string): Promise<void> {
    // This would integrate with AWS SNS
    console.log(`SNS notification sent to ${topicArn}: ${message}`);
  }

  /**
   * Update pipeline metrics after job completion
   */
  private async updatePipelineMetrics(
    config: PipelineConfig,
    jobStatus: any
  ): Promise<void> {
    // This would update metrics in a persistent store
    console.log(`Updated metrics for ${config.merchantId}/${config.predictorName}`);
  }

  /**
   * Store pipeline configuration
   */
  private async storePipelineConfig(config: PipelineConfig): Promise<void> {
    const cacheKey = `pipeline_config:${config.merchantId}:${config.predictorName}`;
    await this.cacheService.set(cacheKey, config, 24 * 60 * 60); // 24 hours
  }

  /**
   * Remove pipeline configuration
   */
  private async removePipelineConfig(merchantId: string, predictorName: string): Promise<void> {
    const cacheKey = `pipeline_config:${merchantId}:${predictorName}`;
    await this.cacheService.delete(cacheKey);
  }

  /**
   * Start pipeline monitoring loop
   */
  private startPipelineMonitoring(): void {
    setInterval(async () => {
      for (const [pipelineKey, config] of this.activePipelines.entries()) {
        try {
          // Check for cost alerts
          const monthlySpend = await this.calculateMonthlySpend(config.merchantId, config.predictorName);
          
          if (monthlySpend > config.costLimits.alertThreshold) {
            await this.sendRetrainingNotification(config, 'started', {
              alert: 'cost_threshold_exceeded',
              monthlySpend,
              threshold: config.costLimits.alertThreshold
            });
          }
          
          // Check for failed jobs that need attention
          const recentJobs = this.retrainingService.listJobs(config.merchantId)
            .filter(job => job.predictorName === config.predictorName && job.status === 'failed');
          
          if (recentJobs.length > 0) {
            console.warn(`Found ${recentJobs.length} failed jobs for ${pipelineKey}`);
          }
          
        } catch (error) {
          console.error(`Pipeline monitoring error for ${pipelineKey}:`, error);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
}

// Export singleton instance
let modelRetrainingPipelineInstance: ModelRetrainingPipeline | null = null;

export const getModelRetrainingPipeline = (): ModelRetrainingPipeline => {
  if (!modelRetrainingPipelineInstance) {
    modelRetrainingPipelineInstance = new ModelRetrainingPipeline();
  }
  return modelRetrainingPipelineInstance;
};