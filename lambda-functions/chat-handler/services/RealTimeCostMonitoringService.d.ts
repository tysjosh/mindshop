export interface CostThreshold {
    name: string;
    type: 'per_session' | 'per_hour' | 'per_day' | 'per_merchant';
    threshold: number;
    windowSize: number;
    action: 'alert' | 'throttle' | 'scale_down' | 'block';
    enabled: boolean;
}
export interface ScalingAction {
    type: 'scale_down_replicas' | 'enable_spot_instances' | 'reduce_model_size' | 'enable_caching' | 'throttle_requests';
    parameters: any;
    estimatedSavings: number;
    reversible: boolean;
}
export interface CostMonitoringConfig {
    monitoringIntervalMs: number;
    costThresholds: CostThreshold[];
    scalingActions: ScalingAction[];
    emergencyShutdownThreshold: number;
    enableAutomaticScaling: boolean;
}
export interface RealTimeCostMetrics {
    currentHourlyCost: number;
    projectedDailyCost: number;
    projectedMonthlyCost: number;
    costPerSession: number;
    costTrend: 'increasing' | 'decreasing' | 'stable';
    activeOptimizations: string[];
    savingsFromOptimizations: number;
}
export declare class RealTimeCostMonitoringService {
    private loggingService;
    private metricsService;
    private costTrackingService;
    private alertingService;
    private config;
    private monitoringInterval?;
    private costHistory;
    private activeScalingActions;
    private emergencyMode;
    constructor(config: CostMonitoringConfig);
    private initializeDefaultThresholds;
    private startMonitoring;
    private performCostCheck;
    private getCurrentCostMetrics;
    private calculateCostTrend;
    private calculateOptimizationSavings;
    private checkThreshold;
    private handleThresholdBreach;
    private executeScalingAction;
    private enterEmergencyMode;
    private emitCostMetrics;
    getCostProjection(timeHorizonHours: number): Promise<number>;
    reverseScalingAction(actionType: string): Promise<void>;
    exitEmergencyMode(): Promise<void>;
    destroy(): void;
}
export declare function createRealTimeCostMonitoringService(config?: Partial<CostMonitoringConfig>): RealTimeCostMonitoringService;
//# sourceMappingURL=RealTimeCostMonitoringService.d.ts.map