"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingJobOrchestrator = exports.TrainingJobOrchestrator = void 0;
const config_1 = require("../config");
const CacheService_1 = require("./CacheService");
/**
 * Training Job Orchestrator
 * Manages ECS/EKS training jobs with Spot instances for cost optimization
 */
class TrainingJobOrchestrator {
    constructor() {
        this.cacheService = (0, CacheService_1.getCacheService)();
        this.activeExecutions = new Map();
        this.spotInstancePools = new Map();
        this.initializeSpotInstancePools();
        this.startCostMonitoring();
    }
    /**
     * Initialize Spot instance pools for different workload types
     */
    initializeSpotInstancePools() {
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
    async submitJob(jobSpec, platform = 'ecs', spotConfig) {
        const executionId = `exec-${jobSpec.jobId}-${Date.now()}`;
        const execution = {
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
        }
        catch (error) {
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
    async executeECSJob(executionId, jobSpec, spotConfig) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution)
            return;
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
    async executeEKSJob(executionId, jobSpec, spotConfig) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution)
            return;
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
    async executeBatchJob(executionId, jobSpec, spotConfig) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution)
            return;
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
    async selectOptimalSpotInstance(jobSpec) {
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
    determineWorkloadType(jobSpec) {
        const cpuRequirement = parseFloat(jobSpec.resourceRequirements.cpu);
        const memoryRequirement = parseFloat(jobSpec.resourceRequirements.memory);
        if (jobSpec.resourceRequirements.gpu) {
            return 'gpu-optimized';
        }
        else if (memoryRequirement / cpuRequirement > 4) {
            return 'memory-optimized';
        }
        else {
            return 'cpu-optimized';
        }
    }
    /**
     * Get current Spot pricing for instances
     */
    async getCurrentSpotPricing(instances) {
        // This would call AWS EC2 API to get current Spot pricing
        // For now, we'll simulate pricing
        const pricing = {};
        for (const instance of instances) {
            // Simulate current price as 60-90% of max price
            pricing[instance.instanceType] = instance.maxPrice * (0.6 + Math.random() * 0.3);
        }
        return pricing;
    }
    /**
     * Get performance score for instance type
     */
    getInstancePerformanceScore(instanceType) {
        // Simplified performance scoring based on instance type
        const scores = {
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
    createECSTaskDefinition(jobSpec, spotConfig) {
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
                            'awslogs-region': config_1.config.aws?.region || 'us-east-1',
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
    async runECSTask(taskDefinition, spotConfig) {
        // This would use AWS ECS API to run the task
        // For now, we'll simulate task execution
        const taskArn = `arn:aws:ecs:us-east-1:123456789012:task/${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Running ECS task: ${taskArn}`);
        return taskArn;
    }
    /**
     * Monitor ECS task execution
     */
    async monitorECSTask(executionId, taskArn) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution)
            return;
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
            }
            catch (error) {
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
    async getECSTaskStatus(taskArn) {
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
    createEKSJobManifest(jobSpec, spotConfig) {
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
    async submitEKSJob(jobManifest) {
        // This would use Kubernetes API to submit the job
        // For now, we'll simulate job submission
        const jobName = jobManifest.metadata.name;
        console.log(`Submitting EKS job: ${jobName}`);
        return jobName;
    }
    /**
     * Monitor EKS job execution
     */
    async monitorEKSJob(executionId, jobName) {
        // Similar to ECS monitoring but using Kubernetes API
        // Implementation would be similar to monitorECSTask
        console.log(`Monitoring EKS job: ${jobName}`);
    }
    /**
     * Submit AWS Batch job
     */
    async submitBatchJob(jobSpec, spotConfig) {
        // This would use AWS Batch API
        // For now, we'll simulate job submission
        const batchJobId = `batch-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Submitting AWS Batch job: ${batchJobId}`);
        return batchJobId;
    }
    /**
     * Monitor AWS Batch job
     */
    async monitorBatchJob(executionId, batchJobId) {
        // Similar to ECS monitoring but using AWS Batch API
        console.log(`Monitoring AWS Batch job: ${batchJobId}`);
    }
    /**
     * Get job execution status
     */
    getExecution(executionId) {
        return this.activeExecutions.get(executionId) || null;
    }
    /**
     * List executions for a job
     */
    listExecutions(jobId) {
        return Array.from(this.activeExecutions.values())
            .filter(execution => execution.jobId === jobId);
    }
    /**
     * Cancel a running execution
     */
    async cancelExecution(executionId) {
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
    async cancelECSTask(executionId) {
        // This would use AWS ECS API to stop the task
        console.log(`Cancelling ECS task for execution: ${executionId}`);
    }
    /**
     * Cancel EKS job
     */
    async cancelEKSJob(executionId) {
        // This would use Kubernetes API to delete the job
        console.log(`Cancelling EKS job for execution: ${executionId}`);
    }
    /**
     * Cancel AWS Batch job
     */
    async cancelBatchJob(executionId) {
        // This would use AWS Batch API to cancel the job
        console.log(`Cancelling AWS Batch job for execution: ${executionId}`);
    }
    /**
     * Estimate job cost
     */
    estimateJobCost(jobSpec, spotConfig) {
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
    calculateActualCost(execution) {
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
    updateExecution(executionId, updates) {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
            Object.assign(execution, updates);
            this.activeExecutions.set(executionId, execution);
        }
    }
    /**
     * Start cost monitoring for all active executions
     */
    startCostMonitoring() {
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
    getCostStatistics() {
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
exports.TrainingJobOrchestrator = TrainingJobOrchestrator;
// Export singleton instance
let trainingJobOrchestratorInstance = null;
const getTrainingJobOrchestrator = () => {
    if (!trainingJobOrchestratorInstance) {
        trainingJobOrchestratorInstance = new TrainingJobOrchestrator();
    }
    return trainingJobOrchestratorInstance;
};
exports.getTrainingJobOrchestrator = getTrainingJobOrchestrator;
//# sourceMappingURL=TrainingJobOrchestrator.js.map