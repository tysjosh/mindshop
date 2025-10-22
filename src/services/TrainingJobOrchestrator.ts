import { config } from '../config';
import { getCacheService } from './CacheService';

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
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
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
  timeout: number; // in seconds
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
export class TrainingJobOrchestrator {
  private cacheService = getCacheService();
  private activeExecutions = new Map<string, JobExecution>();
  private spotInstancePools = new Map<string, SpotInstanceConfig[]>();

  constructor() {
    this.initializeSpotInstancePools();
    this.startCostMonitoring();
  }

  /**
   * Initialize Spot instance pools for different workload types
   */
  private initializeSpotInstancePools(): void {
    // CPU-optimized instances for general ML training
    this.spotInstancePools.set('cpu-optimized', [
      {
        instanceType: 'c5.large',
        maxPrice: 0.05,
        availabilityZone: 'us-east-1a',
        securityGroupIds: ['sg-cpu-training']
      },
      {
        instanceType: 'c5.xlarge',
        maxPrice: 0.10,
        availabilityZone: 'us-east-1b',
        securityGroupIds: ['sg-cpu-training']
      },
      {
        instanceType: 'c5.2xlarge',
        maxPrice: 0.20,
        availabilityZone: 'us-east-1c',
        securityGroupIds: ['sg-cpu-training']
      }
    ]);

    // Memory-optimized instances for large datasets
    this.spotInstancePools.set('memory-optimized', [
      {
        instanceType: 'r5.large',
        maxPrice: 0.08,
        availabilityZone: 'us-east-1a',
        securityGroupIds: ['sg-memory-training']
      },
      {
        instanceType: 'r5.xlarge',
        maxPrice: 0.16,
        availabilityZone: 'us-east-1b',
        securityGroupIds: ['sg-memory-training']
      }
    ]);

    // GPU instances for deep learning (if needed)
    this.spotInstancePools.set('gpu-optimized', [
      {
        instanceType: 'p3.2xlarge',
        maxPrice: 1.50,
        availabilityZone: 'us-east-1a',
        securityGroupIds: ['sg-gpu-training']
      }
    ]);
  }

  /**
   * Submit a training job for execution
   */
  async submitJob(
    jobSpec: TrainingJobSpec,
    platform: 'ecs' | 'eks' | 'batch' = 'ecs',
    spotConfig?: SpotInstanceConfig
  ): Promise<string> {
    const executionId = `exec-${jobSpec.jobId}-${Date.now()}`;
    
    const execution: JobExecution = {
      jobId: jobSpec.jobId,
      executionId,
      platform,
      status: 'pending',
      logs: [],
      metrics: {
        cpuUtilization: [],
        memoryUtilization: [],
        networkIO: [],
        diskIO: []
      },
      cost: {
        estimated: this.estimateJobCost(jobSpec, spotConfig),
        breakdown: {
          compute: 0,
          storage: 0,
          network: 0
        }
      }
    };

    this.activeExecutions.set(executionId, execution);

    // Execute job based on platform
    try {
      switch (platform) {
        case 'ecs':
          await this.executeECSJob(executionId, jobSpec, spotConfig);
          break;
        case 'eks':
          await this.executeEKSJob(executionId, jobSpec, spotConfig);
          break;
        case 'batch':
          await this.executeBatchJob(executionId, jobSpec, spotConfig);
          break;
      }
    } catch (error: any) {
      this.updateExecution(executionId, {
        status: 'failed',
        endTime: new Date(),
        logs: [...execution.logs, `Job submission failed: ${error.message}`]
      });
      throw error;
    }

    return executionId;
  }

  /**
   * Execute job on ECS with Spot instances
   */
  private async executeECSJob(
    executionId: string,
    jobSpec: TrainingJobSpec,
    spotConfig?: SpotInstanceConfig
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Select optimal Spot instance
    const selectedSpot = spotConfig || await this.selectOptimalSpotInstance(jobSpec);
    
    this.updateExecution(executionId, {
      status: 'running',
      startTime: new Date(),
      spotInstanceInfo: {
        instanceId: `i-${Math.random().toString(36).substr(2, 9)}`,
        instanceType: selectedSpot.instanceType,
        actualPrice: selectedSpot.maxPrice * 0.8, // Simulate actual spot price
        interruptions: 0
      },
      logs: [...execution.logs, `Starting ECS task on ${selectedSpot.instanceType} Spot instance`]
    });

    // Create ECS task definition
    const taskDefinition = this.createECSTaskDefinition(jobSpec, selectedSpot);
    
    // Run ECS task
    const taskArn = await this.runECSTask(taskDefinition, selectedSpot);
    
    // Monitor task execution
    await this.monitorECSTask(executionId, taskArn);
  }

  /**
   * Execute job on EKS with Spot instances
   */
  private async executeEKSJob(
    executionId: string,
    jobSpec: TrainingJobSpec,
    spotConfig?: SpotInstanceConfig
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const selectedSpot = spotConfig || await this.selectOptimalSpotInstance(jobSpec);
    
    this.updateExecution(executionId, {
      status: 'running',
      startTime: new Date(),
      spotInstanceInfo: {
        instanceId: `i-${Math.random().toString(36).substr(2, 9)}`,
        instanceType: selectedSpot.instanceType,
        actualPrice: selectedSpot.maxPrice * 0.8,
        interruptions: 0
      },
      logs: [...execution.logs, `Starting EKS job on ${selectedSpot.instanceType} Spot instance`]
    });

    // Create Kubernetes Job manifest
    const jobManifest = this.createEKSJobManifest(jobSpec, selectedSpot);
    
    // Submit job to EKS
    const jobName = await this.submitEKSJob(jobManifest);
    
    // Monitor job execution
    await this.monitorEKSJob(executionId, jobName);
  }

  /**
   * Execute job on AWS Batch with Spot instances
   */
  private async executeBatchJob(
    executionId: string,
    jobSpec: TrainingJobSpec,
    spotConfig?: SpotInstanceConfig
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const selectedSpot = spotConfig || await this.selectOptimalSpotInstance(jobSpec);
    
    this.updateExecution(executionId, {
      status: 'running',
      startTime: new Date(),
      logs: [...execution.logs, `Starting AWS Batch job with Spot instances`]
    });

    // Submit to AWS Batch
    const batchJobId = await this.submitBatchJob(jobSpec, selectedSpot);
    
    // Monitor batch job
    await this.monitorBatchJob(executionId, batchJobId);
  }

  /**
   * Select optimal Spot instance based on job requirements and current pricing
   */
  private async selectOptimalSpotInstance(jobSpec: TrainingJobSpec): Promise<SpotInstanceConfig> {
    // Determine workload type based on resource requirements
    const workloadType = this.determineWorkloadType(jobSpec);
    const availableInstances = this.spotInstancePools.get(workloadType) || [];
    
    if (availableInstances.length === 0) {
      throw new Error(`No Spot instances available for workload type: ${workloadType}`);
    }

    // Get current Spot pricing (simulated)
    const instancePricing = await this.getCurrentSpotPricing(availableInstances);
    
    // Select instance with best price/performance ratio
    let bestInstance = availableInstances[0];
    let bestScore = 0;
    
    for (const instance of availableInstances) {
      const currentPrice = instancePricing[instance.instanceType] || instance.maxPrice;
      const performance = this.getInstancePerformanceScore(instance.instanceType);
      const score = performance / currentPrice;
      
      if (score > bestScore && currentPrice <= instance.maxPrice) {
        bestScore = score;
        bestInstance = instance;
      }
    }
    
    return bestInstance;
  }

  /**
   * Determine workload type based on resource requirements
   */
  private determineWorkloadType(jobSpec: TrainingJobSpec): string {
    const cpuRequirement = parseFloat(jobSpec.resourceRequirements.cpu);
    const memoryRequirement = parseFloat(jobSpec.resourceRequirements.memory);
    
    if (jobSpec.resourceRequirements.gpu) {
      return 'gpu-optimized';
    } else if (memoryRequirement / cpuRequirement > 4) {
      return 'memory-optimized';
    } else {
      return 'cpu-optimized';
    }
  }

  /**
   * Get current Spot pricing for instances
   */
  private async getCurrentSpotPricing(instances: SpotInstanceConfig[]): Promise<Record<string, number>> {
    // This would call AWS EC2 API to get current Spot pricing
    // For now, we'll simulate pricing
    const pricing: Record<string, number> = {};
    
    for (const instance of instances) {
      // Simulate current price as 60-90% of max price
      pricing[instance.instanceType] = instance.maxPrice * (0.6 + Math.random() * 0.3);
    }
    
    return pricing;
  }

  /**
   * Get performance score for instance type
   */
  private getInstancePerformanceScore(instanceType: string): number {
    // Simplified performance scoring based on instance type
    const scores: Record<string, number> = {
      'c5.large': 2,
      'c5.xlarge': 4,
      'c5.2xlarge': 8,
      'r5.large': 2.5,
      'r5.xlarge': 5,
      'p3.2xlarge': 20
    };
    
    return scores[instanceType] || 1;
  }

  /**
   * Create ECS task definition
   */
  private createECSTaskDefinition(jobSpec: TrainingJobSpec, spotConfig: SpotInstanceConfig): any {
    return {
      family: 'mindsdb-training',
      requiresCompatibilities: ['EC2'],
      networkMode: 'awsvpc',
      cpu: jobSpec.resourceRequirements.cpu,
      memory: jobSpec.resourceRequirements.memory,
      containerDefinitions: [{
        name: 'training-container',
        image: 'mindsdb/training:latest',
        cpu: parseInt(jobSpec.resourceRequirements.cpu),
        memory: parseInt(jobSpec.resourceRequirements.memory),
        environment: Object.entries(jobSpec.environment).map(([name, value]) => ({ name, value })),
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': '/aws/ecs/mindsdb-training',
            'awslogs-region': config.aws?.region || 'us-east-1',
            'awslogs-stream-prefix': jobSpec.jobId
          }
        }
      }],
      placementConstraints: [{
        type: 'memberOf',
        expression: `attribute:ecs.instance-type =~ ${spotConfig.instanceType}`
      }]
    };
  }

  /**
   * Run ECS task
   */
  private async runECSTask(taskDefinition: any, spotConfig: SpotInstanceConfig): Promise<string> {
    // This would use AWS ECS API to run the task
    // For now, we'll simulate task execution
    const taskArn = `arn:aws:ecs:us-east-1:123456789012:task/${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Running ECS task: ${taskArn}`);
    return taskArn;
  }

  /**
   * Monitor ECS task execution
   */
  private async monitorECSTask(executionId: string, taskArn: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Simulate task monitoring
    const monitoringInterval = setInterval(async () => {
      try {
        const taskStatus = await this.getECSTaskStatus(taskArn);
        
        this.updateExecution(executionId, {
          logs: [...execution.logs, `Task status: ${taskStatus.status}`],
          metrics: {
            cpuUtilization: [...execution.metrics.cpuUtilization, taskStatus.cpuUtilization],
            memoryUtilization: [...execution.metrics.memoryUtilization, taskStatus.memoryUtilization],
            networkIO: [...execution.metrics.networkIO, taskStatus.networkIO],
            diskIO: [...execution.metrics.diskIO, taskStatus.diskIO]
          }
        });

        if (taskStatus.status === 'STOPPED') {
          clearInterval(monitoringInterval);
          
          this.updateExecution(executionId, {
            status: taskStatus.exitCode === 0 ? 'completed' : 'failed',
            endTime: new Date(),
            exitCode: taskStatus.exitCode,
            cost: {
              ...execution.cost,
              actual: this.calculateActualCost(execution)
            }
          });
        }
      } catch (error) {
        console.error(`Error monitoring ECS task ${taskArn}:`, error);
      }
    }, 30000); // Check every 30 seconds

    // Set timeout
    setTimeout(() => {
      clearInterval(monitoringInterval);
      this.updateExecution(executionId, {
        status: 'timeout',
        endTime: new Date()
      });
    }, execution.cost.estimated * 1000); // Use estimated time as timeout
  }

  /**
   * Get ECS task status
   */
  private async getECSTaskStatus(taskArn: string): Promise<{
    status: string;
    exitCode: number;
    cpuUtilization: number;
    memoryUtilization: number;
    networkIO: number;
    diskIO: number;
  }> {
    // This would call AWS ECS API
    // For now, we'll simulate status
    return {
      status: Math.random() > 0.1 ? 'RUNNING' : 'STOPPED',
      exitCode: Math.random() > 0.9 ? 1 : 0,
      cpuUtilization: 50 + Math.random() * 40,
      memoryUtilization: 60 + Math.random() * 30,
      networkIO: Math.random() * 1000,
      diskIO: Math.random() * 500
    };
  }

  /**
   * Create EKS job manifest
   */
  private createEKSJobManifest(jobSpec: TrainingJobSpec, spotConfig: SpotInstanceConfig): any {
    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `training-${jobSpec.jobId}`,
        namespace: 'mindsdb-training'
      },
      spec: {
        template: {
          spec: {
            restartPolicy: 'Never',
            nodeSelector: {
              'node.kubernetes.io/instance-type': spotConfig.instanceType,
              'karpenter.sh/capacity-type': 'spot'
            },
            tolerations: [{
              key: 'spot',
              operator: 'Equal',
              value: 'true',
              effect: 'NoSchedule'
            }],
            containers: [{
              name: 'training',
              image: 'mindsdb/training:latest',
              resources: {
                requests: {
                  cpu: jobSpec.resourceRequirements.cpu,
                  memory: jobSpec.resourceRequirements.memory
                },
                limits: {
                  cpu: jobSpec.resourceRequirements.cpu,
                  memory: jobSpec.resourceRequirements.memory
                }
              },
              env: Object.entries(jobSpec.environment).map(([name, value]) => ({ name, value }))
            }]
          }
        },
        backoffLimit: jobSpec.retryPolicy.maxRetries
      }
    };
  }

  /**
   * Submit EKS job
   */
  private async submitEKSJob(jobManifest: any): Promise<string> {
    // This would use Kubernetes API to submit the job
    // For now, we'll simulate job submission
    const jobName = jobManifest.metadata.name;
    
    console.log(`Submitting EKS job: ${jobName}`);
    return jobName;
  }

  /**
   * Monitor EKS job execution
   */
  private async monitorEKSJob(executionId: string, jobName: string): Promise<void> {
    // Similar to ECS monitoring but using Kubernetes API
    // Implementation would be similar to monitorECSTask
    console.log(`Monitoring EKS job: ${jobName}`);
  }

  /**
   * Submit AWS Batch job
   */
  private async submitBatchJob(jobSpec: TrainingJobSpec, spotConfig: SpotInstanceConfig): Promise<string> {
    // This would use AWS Batch API
    // For now, we'll simulate job submission
    const batchJobId = `batch-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Submitting AWS Batch job: ${batchJobId}`);
    return batchJobId;
  }

  /**
   * Monitor AWS Batch job
   */
  private async monitorBatchJob(executionId: string, batchJobId: string): Promise<void> {
    // Similar to ECS monitoring but using AWS Batch API
    console.log(`Monitoring AWS Batch job: ${batchJobId}`);
  }

  /**
   * Get job execution status
   */
  getExecution(executionId: string): JobExecution | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * List executions for a job
   */
  listExecutions(jobId: string): JobExecution[] {
    return Array.from(this.activeExecutions.values())
      .filter(execution => execution.jobId === jobId);
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'running') {
      throw new Error(`Execution ${executionId} is not running`);
    }

    // Cancel based on platform
    switch (execution.platform) {
      case 'ecs':
        await this.cancelECSTask(executionId);
        break;
      case 'eks':
        await this.cancelEKSJob(executionId);
        break;
      case 'batch':
        await this.cancelBatchJob(executionId);
        break;
    }

    this.updateExecution(executionId, {
      status: 'cancelled',
      endTime: new Date()
    });
  }

  /**
   * Cancel ECS task
   */
  private async cancelECSTask(executionId: string): Promise<void> {
    // This would use AWS ECS API to stop the task
    console.log(`Cancelling ECS task for execution: ${executionId}`);
  }

  /**
   * Cancel EKS job
   */
  private async cancelEKSJob(executionId: string): Promise<void> {
    // This would use Kubernetes API to delete the job
    console.log(`Cancelling EKS job for execution: ${executionId}`);
  }

  /**
   * Cancel AWS Batch job
   */
  private async cancelBatchJob(executionId: string): Promise<void> {
    // This would use AWS Batch API to cancel the job
    console.log(`Cancelling AWS Batch job for execution: ${executionId}`);
  }

  /**
   * Estimate job cost
   */
  private estimateJobCost(jobSpec: TrainingJobSpec, spotConfig?: SpotInstanceConfig): number {
    const cpu = parseFloat(jobSpec.resourceRequirements.cpu);
    const memory = parseFloat(jobSpec.resourceRequirements.memory) / 1024; // Convert to GB
    const hours = jobSpec.timeout / 3600;
    
    // Base cost calculation (simplified)
    const cpuCost = cpu * 0.04048 * hours; // per vCPU hour
    const memoryCost = memory * 0.004445 * hours; // per GB hour
    
    // Apply Spot discount (typically 50-90% off on-demand)
    const spotDiscount = 0.7; // 70% discount
    const computeCost = (cpuCost + memoryCost) * spotDiscount;
    
    return computeCost;
  }

  /**
   * Calculate actual cost based on execution metrics
   */
  private calculateActualCost(execution: JobExecution): number {
    if (!execution.startTime || !execution.endTime) {
      return execution.cost.estimated;
    }

    const actualHours = (execution.endTime.getTime() - execution.startTime.getTime()) / (1000 * 60 * 60);
    const spotPrice = execution.spotInstanceInfo?.actualPrice || 0.05;
    
    return actualHours * spotPrice;
  }

  /**
   * Update execution status
   */
  private updateExecution(executionId: string, updates: Partial<JobExecution>): void {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      Object.assign(execution, updates);
      this.activeExecutions.set(executionId, execution);
    }
  }

  /**
   * Start cost monitoring for all active executions
   */
  private startCostMonitoring(): void {
    setInterval(() => {
      for (const [executionId, execution] of this.activeExecutions.entries()) {
        if (execution.status === 'running' && execution.startTime) {
          const runningHours = (Date.now() - execution.startTime.getTime()) / (1000 * 60 * 60);
          const currentCost = this.calculateActualCost(execution);
          
          // Update cost breakdown
          execution.cost.breakdown.compute = currentCost;
          this.activeExecutions.set(executionId, execution);
          
          // Alert if cost exceeds estimate by 50%
          if (currentCost > execution.cost.estimated * 1.5) {
            console.warn(`Execution ${executionId} cost exceeded estimate: $${currentCost.toFixed(4)} vs $${execution.cost.estimated.toFixed(4)}`);
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get cost statistics
   */
  getCostStatistics(): {
    totalEstimated: number;
    totalActual: number;
    savings: number;
    averageSpotDiscount: number;
  } {
    const executions = Array.from(this.activeExecutions.values());
    const completedExecutions = executions.filter(e => e.status === 'completed' && e.cost.actual);
    
    const totalEstimated = executions.reduce((sum, e) => sum + e.cost.estimated, 0);
    const totalActual = completedExecutions.reduce((sum, e) => sum + (e.cost.actual || 0), 0);
    const savings = totalEstimated - totalActual;
    const averageSpotDiscount = completedExecutions.length > 0 ? savings / totalEstimated : 0;
    
    return {
      totalEstimated,
      totalActual,
      savings,
      averageSpotDiscount
    };
  }
}

// Export singleton instance
let trainingJobOrchestratorInstance: TrainingJobOrchestrator | null = null;

export const getTrainingJobOrchestrator = (): TrainingJobOrchestrator => {
  if (!trainingJobOrchestratorInstance) {
    trainingJobOrchestratorInstance = new TrainingJobOrchestrator();
  }
  return trainingJobOrchestratorInstance;
};