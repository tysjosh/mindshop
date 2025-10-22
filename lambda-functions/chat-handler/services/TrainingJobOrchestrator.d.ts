export interface SpotInstanceConfig {
    instanceType: string;
    maxPrice: number;
    availabilityZone?: string;
    subnetId?: string;
    securityGroupIds: string[];
}
export interface ECSTaskConfig {
    taskDefinitionArn: string;
    clusterName: string;
    subnets: string[];
    securityGroups: string[];
    assignPublicIp: boolean;
    platformVersion?: string;
}
export interface EKSJobConfig {
    namespace: string;
    jobName: string;
    image: string;
    resources: {
        requests: {
            cpu: string;
            memory: string;
        };
        limits: {
            cpu: string;
            memory: string;
        };
    };
    nodeSelector?: Record<string, string>;
    tolerations?: Array<{
        key: string;
        operator: string;
        value?: string;
        effect: string;
    }>;
}
export interface TrainingJobSpec {
    jobId: string;
    merchantId: string;
    predictorName: string;
    trainingDataLocation: string;
    outputLocation: string;
    environment: Record<string, string>;
    resourceRequirements: {
        cpu: string;
        memory: string;
        gpu?: string;
        storage: string;
    };
    timeout: number;
    retryPolicy: {
        maxRetries: number;
        backoffMultiplier: number;
    };
}
export interface JobExecution {
    jobId: string;
    executionId: string;
    platform: 'ecs' | 'eks' | 'batch';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
    startTime?: Date;
    endTime?: Date;
    exitCode?: number;
    logs: string[];
    metrics: {
        cpuUtilization: number[];
        memoryUtilization: number[];
        networkIO: number[];
        diskIO: number[];
    };
    cost: {
        estimated: number;
        actual?: number;
        breakdown: {
            compute: number;
            storage: number;
            network: number;
        };
    };
    spotInstanceInfo?: {
        instanceId: string;
        instanceType: string;
        actualPrice: number;
        interruptions: number;
    };
}
/**
 * Training Job Orchestrator
 * Manages ECS/EKS training jobs with Spot instances for cost optimization
 */
export declare class TrainingJobOrchestrator {
    private cacheService;
    private activeExecutions;
    private spotInstancePools;
    constructor();
    /**
     * Initialize Spot instance pools for different workload types
     */
    private initializeSpotInstancePools;
    /**
     * Submit a training job for execution
     */
    submitJob(jobSpec: TrainingJobSpec, platform?: 'ecs' | 'eks' | 'batch', spotConfig?: SpotInstanceConfig): Promise<string>;
    /**
     * Execute job on ECS with Spot instances
     */
    private executeECSJob;
    /**
     * Execute job on EKS with Spot instances
     */
    private executeEKSJob;
    /**
     * Execute job on AWS Batch with Spot instances
     */
    private executeBatchJob;
    /**
     * Select optimal Spot instance based on job requirements and current pricing
     */
    private selectOptimalSpotInstance;
    /**
     * Determine workload type based on resource requirements
     */
    private determineWorkloadType;
    /**
     * Get current Spot pricing for instances
     */
    private getCurrentSpotPricing;
    /**
     * Get performance score for instance type
     */
    private getInstancePerformanceScore;
    /**
     * Create ECS task definition
     */
    private createECSTaskDefinition;
    /**
     * Run ECS task
     */
    private runECSTask;
    /**
     * Monitor ECS task execution
     */
    private monitorECSTask;
    /**
     * Get ECS task status
     */
    private getECSTaskStatus;
    /**
     * Create EKS job manifest
     */
    private createEKSJobManifest;
    /**
     * Submit EKS job
     */
    private submitEKSJob;
    /**
     * Monitor EKS job execution
     */
    private monitorEKSJob;
    /**
     * Submit AWS Batch job
     */
    private submitBatchJob;
    /**
     * Monitor AWS Batch job
     */
    private monitorBatchJob;
    /**
     * Get job execution status
     */
    getExecution(executionId: string): JobExecution | null;
    /**
     * List executions for a job
     */
    listExecutions(jobId: string): JobExecution[];
    /**
     * Cancel a running execution
     */
    cancelExecution(executionId: string): Promise<void>;
    /**
     * Cancel ECS task
     */
    private cancelECSTask;
    /**
     * Cancel EKS job
     */
    private cancelEKSJob;
    /**
     * Cancel AWS Batch job
     */
    private cancelBatchJob;
    /**
     * Estimate job cost
     */
    private estimateJobCost;
    /**
     * Calculate actual cost based on execution metrics
     */
    private calculateActualCost;
    /**
     * Update execution status
     */
    private updateExecution;
    /**
     * Start cost monitoring for all active executions
     */
    private startCostMonitoring;
    /**
     * Get cost statistics
     */
    getCostStatistics(): {
        totalEstimated: number;
        totalActual: number;
        savings: number;
        averageSpotDiscount: number;
    };
}
export declare const getTrainingJobOrchestrator: () => TrainingJobOrchestrator;
//# sourceMappingURL=TrainingJobOrchestrator.d.ts.map