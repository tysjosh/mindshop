export interface RetrainingJobConfig {
    merchantId: string;
    predictorName: string;
    trainingDataQuery: string;
    schedule: 'weekly' | 'monthly' | 'on-demand';
    spotInstanceConfig: {
        instanceType: string;
        maxPrice: number;
        availabilityZone?: string;
    };
    resourceLimits: {
        cpu: string;
        memory: string;
        timeout: number;
    };
}
export interface RetrainingJobStatus {
    jobId: string;
    merchantId: string;
    predictorName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime?: Date;
    endTime?: Date;
    progress: number;
    logs: string[];
    error?: string;
    costEstimate: number;
    actualCost?: number;
    modelVersion: string;
    artifactLocation: string;
}
export interface ModelArtifact {
    modelId: string;
    version: string;
    merchantId: string;
    predictorName: string;
    s3Location: string;
    metadata: {
        trainingDataSize: number;
        accuracy: number;
        features: string[];
        hyperparameters: Record<string, any>;
        trainingDuration: number;
    };
    createdAt: Date;
    size: number;
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
/**
 * Model Retraining Service
 * Manages automated retraining pipelines, drift detection, and model artifacts
 */
export declare class ModelRetrainingService {
    private mindsdbService;
    private cacheService;
    private circuitBreaker;
    private activeJobs;
    constructor();
    /**
     * Initialize scheduled retraining jobs
     */
    private initializeScheduledJobs;
    /**
     * Create a new retraining job
     */
    createRetrainingJob(config: RetrainingJobConfig): Promise<string>;
    /**
     * Execute a retraining job
     */
    private executeRetrainingJob;
    /**
     * Prepare training data from RDS and S3
     */
    private prepareTrainingData;
    /**
     * Launch ECS/EKS training task with Spot instances
     */
    private launchTrainingTask;
    /**
     * Monitor training progress
     */
    private monitorTrainingProgress;
    /**
     * Store model artifacts in S3 with versioning
     */
    private storeModelArtifacts;
    /**
     * Update MindsDB predictor with new model
     */
    private updateMindsDBPredictor;
    /**
     * Extract historical data from RDS
     */
    private extractHistoricalData;
    /**
     * Extract event data from S3
     */
    private extractEventData;
    /**
     * Store training data in S3
     */
    private storeTrainingData;
    /**
     * Get job status
     */
    getJobStatus(jobId: string): RetrainingJobStatus | null;
    /**
     * List jobs for a merchant
     */
    listJobs(merchantId: string): RetrainingJobStatus[];
    /**
     * Cancel a running job
     */
    cancelJob(jobId: string): Promise<void>;
    /**
     * Update job status
     */
    private updateJobStatus;
    /**
     * Estimate training cost
     */
    private estimateTrainingCost;
    /**
     * Generate model version
     */
    private generateModelVersion;
    /**
     * Generate artifact location
     */
    private generateArtifactLocation;
}
export declare const getModelRetrainingService: () => ModelRetrainingService;
//# sourceMappingURL=ModelRetrainingService.d.ts.map