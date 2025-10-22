export interface ScalingMetrics {
    cpuUtilization: number;
    memoryUtilization: number;
    requestCount: number;
    responseTime: number;
    errorRate: number;
    queueLength: number;
    activeConnections: number;
}
export interface ScalingDecision {
    component: 'api' | 'mindsdb' | 'aurora' | 'elasticache';
    action: 'scale_up' | 'scale_down' | 'no_action';
    currentCapacity: number;
    targetCapacity: number;
    reason: string;
    confidence: number;
}
export interface AutoScalingConfig {
    api: {
        minCapacity: number;
        maxCapacity: number;
        targetCpuUtilization: number;
        targetMemoryUtilization: number;
        scaleUpCooldown: number;
        scaleDownCooldown: number;
    };
    mindsdb: {
        minCapacity: number;
        maxCapacity: number;
        targetCpuUtilization: number;
        targetMemoryUtilization: number;
        scaleUpCooldown: number;
        scaleDownCooldown: number;
    };
    aurora: {
        minCapacity: number;
        maxCapacity: number;
        targetCpuUtilization: number;
        targetConnections: number;
    };
    elasticache: {
        minNodes: number;
        maxNodes: number;
        targetCpuUtilization: number;
        targetMemoryUtilization: number;
    };
}
/**
 * Auto-Scaling Service
 *
 * Implements intelligent auto-scaling across all tiers:
 * - ECS tasks for API and MindsDB services
 * - Aurora read replicas
 * - ElastiCache nodes
 * - Predictive scaling based on usage patterns
 */
export declare class AutoScalingService {
    private cloudWatchClient;
    private ecsClient;
    private rdsClient;
    private elastiCacheClient;
    private config;
    private lastScalingActions;
    constructor(scalingConfig?: Partial<AutoScalingConfig>);
    /**
     * Main auto-scaling evaluation and execution
     */
    evaluateAndScale(): Promise<ScalingDecision[]>;
    /**
     * Collect metrics from all components
     */
    private collectMetrics;
    /**
     * Make scaling decisions based on metrics
     */
    private makeScalingDecisions;
    /**
     * Evaluate API service scaling
     */
    private evaluateAPIScaling;
    /**
     * Evaluate MindsDB service scaling
     */
    private evaluateMindsDBScaling;
    /**
     * Evaluate Aurora scaling
     */
    private evaluateAuroraScaling;
    /**
     * Evaluate ElastiCache scaling
     */
    private evaluateElastiCacheScaling;
    /**
     * Execute scaling decisions
     */
    private executeScalingDecisions;
    /**
     * Helper methods for getting current capacities and scaling
     */
    private getCurrentECSCapacity;
    private scaleECSService;
    private getCurrentAuroraCapacity;
    private scaleAuroraCluster;
    private getCurrentElastiCacheCapacity;
    private scaleElastiCacheCluster;
    private getCloudWatchMetric;
    private logScalingActions;
}
export declare const getAutoScalingService: () => AutoScalingService;
//# sourceMappingURL=AutoScalingService.d.ts.map