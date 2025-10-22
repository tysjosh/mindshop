export interface BudgetConfig {
    budgetName: string;
    budgetLimit: number;
    timeUnit: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    budgetType: 'COST' | 'USAGE';
    costFilters?: {
        services?: string[];
        tags?: Record<string, string[]>;
        dimensions?: Record<string, string[]>;
    };
    notifications: BudgetNotification[];
}
export interface BudgetNotification {
    threshold: number;
    thresholdType: 'PERCENTAGE' | 'ABSOLUTE_VALUE';
    comparisonOperator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL_TO';
    notificationType: 'ACTUAL' | 'FORECASTED';
    subscriberEmailAddresses?: string[];
    subscriberSnsTopicArns?: string[];
}
export interface CostAlert {
    budgetName: string;
    currentSpend: number;
    budgetLimit: number;
    threshold: number;
    forecastedSpend?: number;
    timeRemaining: string;
    merchantId?: string;
    services: string[];
}
export declare class BudgetMonitoringService {
    private budgets;
    private loggingService;
    private alertingService;
    private accountId;
    constructor(accountId: string, region?: string);
    private setupDefaultBudgets;
    createBudget(config: BudgetConfig): Promise<void>;
    private formatCostFilters;
    private createBudgetNotification;
    checkBudgetStatus(): Promise<CostAlert[]>;
    private calculateTimeRemaining;
    private extractServicesFromFilters;
    private triggerCostAlert;
    getCostPerSession(merchantId: string, timeRange: {
        start: Date;
        end: Date;
    }): Promise<number>;
    setupCostOptimizationAlerts(): Promise<void>;
}
export declare function getBudgetMonitoringService(): BudgetMonitoringService;
//# sourceMappingURL=BudgetMonitoringService.d.ts.map