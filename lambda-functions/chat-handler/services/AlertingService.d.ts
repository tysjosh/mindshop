export interface AlertThreshold {
    metricName: string;
    threshold: number;
    comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
    evaluationPeriods: number;
    period: number;
    statistic: 'Average' | 'Sum' | 'Maximum' | 'Minimum';
    treatMissingData: 'breaching' | 'notBreaching' | 'ignore' | 'missing';
}
export interface AlertRule {
    name: string;
    description: string;
    threshold: AlertThreshold;
    severity: 'critical' | 'high' | 'medium' | 'low';
    dimensions?: Record<string, string>;
    actions: AlertAction[];
    enabled: boolean;
}
export interface AlertAction {
    type: 'sns' | 'slack' | 'email' | 'webhook' | 'retrain_trigger';
    target: string;
    template?: string;
}
export interface AlertNotification {
    alertName: string;
    severity: string;
    timestamp: Date;
    metricName: string;
    currentValue: number;
    threshold: number;
    merchantId?: string;
    sessionId?: string;
    message: string;
    actions: AlertAction[];
}
export declare class AlertingService {
    private cloudWatch;
    private sns;
    private loggingService;
    private metricsService;
    private alertRules;
    private snsTopicArn?;
    constructor(region?: string);
    private setupSNSTopic;
    private initializeDefaultAlerts;
    addAlertRule(rule: AlertRule): void;
    deployAlertRules(): Promise<void>;
    private createCloudWatchAlarm;
    handleAlert(notification: AlertNotification): Promise<void>;
    private executeAlertAction;
    private sendSNSNotification;
    private sendSlackNotification;
    private sendEmailNotification;
    private sendWebhookNotification;
    private triggerModelRetrain;
    subscribeToAlerts(email: string): Promise<void>;
    getAlarmStatus(): Promise<any[]>;
}
export declare function getAlertingService(): AlertingService;
//# sourceMappingURL=AlertingService.d.ts.map