"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetMonitoringService = void 0;
exports.getBudgetMonitoringService = getBudgetMonitoringService;
const client_budgets_1 = require("@aws-sdk/client-budgets");
const LoggingService_1 = require("./LoggingService");
const AlertingService_1 = require("./AlertingService");
class BudgetMonitoringService {
    constructor(accountId, region = 'us-east-1') {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.alertingService = (0, AlertingService_1.getAlertingService)();
        this.budgets = new client_budgets_1.BudgetsClient({ region });
        this.accountId = accountId;
        this.setupDefaultBudgets();
    }
    async setupDefaultBudgets() {
        const context = {
            merchantId: 'system',
            requestId: `setup-budgets-${Date.now()}`,
            operation: 'setup_default_budgets'
        };
        try {
            // Overall MindsDB RAG service budget
            await this.createBudget({
                budgetName: 'MindsDB-RAG-Monthly-Budget',
                budgetLimit: 1000, // $1000 per month
                timeUnit: 'MONTHLY',
                budgetType: 'COST',
                costFilters: {
                    services: ['Amazon Bedrock', 'Amazon RDS', 'Amazon EKS', 'Amazon S3', 'Amazon CloudWatch'],
                    tags: {
                        'Project': ['MindsDB-RAG'],
                        'Environment': [process.env.NODE_ENV || 'development']
                    }
                },
                notifications: [
                    {
                        threshold: 50,
                        thresholdType: 'PERCENTAGE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'ACTUAL',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    },
                    {
                        threshold: 80,
                        thresholdType: 'PERCENTAGE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'ACTUAL',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    },
                    {
                        threshold: 100,
                        thresholdType: 'PERCENTAGE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'FORECASTED',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    }
                ]
            });
            // Bedrock-specific budget for LLM costs
            await this.createBudget({
                budgetName: 'MindsDB-RAG-Bedrock-Budget',
                budgetLimit: 500, // $500 per month for Bedrock
                timeUnit: 'MONTHLY',
                budgetType: 'COST',
                costFilters: {
                    services: ['Amazon Bedrock']
                },
                notifications: [
                    {
                        threshold: 0.05, // $0.05 per session threshold
                        thresholdType: 'ABSOLUTE_VALUE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'ACTUAL',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    }
                ]
            });
            // Per-merchant budget tracking
            await this.createBudget({
                budgetName: 'MindsDB-RAG-Per-Merchant-Budget',
                budgetLimit: 100, // $100 per merchant per month
                timeUnit: 'MONTHLY',
                budgetType: 'COST',
                costFilters: {
                    dimensions: {
                        'LINKED_ACCOUNT': [this.accountId]
                    }
                },
                notifications: [
                    {
                        threshold: 80,
                        thresholdType: 'PERCENTAGE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'ACTUAL',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    }
                ]
            });
            await this.loggingService.logInfo('Default budgets setup completed', context);
        }
        catch (error) {
            await this.loggingService.logError(error, context);
        }
    }
    async createBudget(config) {
        const context = {
            merchantId: 'system',
            requestId: `create-budget-${Date.now()}`,
            operation: 'create_budget'
        };
        try {
            // Create the budget
            const budgetCommand = new client_budgets_1.CreateBudgetCommand({
                AccountId: this.accountId,
                Budget: {
                    BudgetName: config.budgetName,
                    BudgetLimit: {
                        Amount: config.budgetLimit.toString(),
                        Unit: 'USD'
                    },
                    TimeUnit: config.timeUnit,
                    BudgetType: config.budgetType,
                    CostFilters: this.formatCostFilters(config.costFilters),
                    TimePeriod: {
                        Start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                        End: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
                    }
                }
            });
            await this.budgets.send(budgetCommand);
            // Create notifications for the budget
            for (const notification of config.notifications) {
                await this.createBudgetNotification(config.budgetName, notification);
            }
            await this.loggingService.logInfo('Budget created successfully', context, {
                budgetName: config.budgetName,
                budgetLimit: config.budgetLimit,
                notificationsCount: config.notifications.length
            });
        }
        catch (error) {
            await this.loggingService.logError(error, context, {
                budgetName: config.budgetName
            });
        }
    }
    formatCostFilters(filters) {
        if (!filters)
            return undefined;
        const costFilters = {};
        if (filters.services) {
            costFilters.Service = filters.services;
        }
        if (filters.tags) {
            costFilters.TagKey = Object.keys(filters.tags);
        }
        if (filters.dimensions) {
            Object.entries(filters.dimensions).forEach(([key, values]) => {
                costFilters[key] = values;
            });
        }
        return Object.keys(costFilters).length > 0 ? costFilters : undefined;
    }
    async createBudgetNotification(budgetName, notification) {
        try {
            const notificationCommand = new client_budgets_1.CreateNotificationCommand({
                AccountId: this.accountId,
                BudgetName: budgetName,
                Notification: {
                    NotificationType: notification.notificationType,
                    ComparisonOperator: notification.comparisonOperator,
                    Threshold: notification.threshold,
                    ThresholdType: notification.thresholdType
                },
                Subscribers: [
                    ...(notification.subscriberEmailAddresses || []).map(email => ({
                        SubscriptionType: 'EMAIL',
                        Address: email
                    })),
                    ...(notification.subscriberSnsTopicArns || []).map(arn => ({
                        SubscriptionType: 'SNS',
                        Address: arn
                    }))
                ]
            });
            await this.budgets.send(notificationCommand);
        }
        catch (error) {
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `create-notification-${Date.now()}`,
                operation: 'create_budget_notification'
            }, { budgetName });
        }
    }
    async checkBudgetStatus() {
        const context = {
            merchantId: 'system',
            requestId: `check-budgets-${Date.now()}`,
            operation: 'check_budget_status'
        };
        try {
            const response = await this.budgets.send(new client_budgets_1.DescribeBudgetsCommand({
                AccountId: this.accountId
            }));
            const alerts = [];
            for (const budget of response.Budgets || []) {
                if (budget.CalculatedSpend && budget.BudgetLimit) {
                    const currentSpend = parseFloat(budget.CalculatedSpend.ActualSpend?.Amount || '0');
                    const budgetLimit = parseFloat(budget.BudgetLimit.Amount || '0');
                    const forecastedSpend = parseFloat(budget.CalculatedSpend.ForecastedSpend?.Amount || '0');
                    const utilizationPercentage = (currentSpend / budgetLimit) * 100;
                    // Check if we're over 80% of budget
                    if (utilizationPercentage > 80) {
                        const alert = {
                            budgetName: budget.BudgetName || '',
                            currentSpend,
                            budgetLimit,
                            threshold: 80,
                            forecastedSpend,
                            timeRemaining: this.calculateTimeRemaining(budget.TimePeriod?.End),
                            services: this.extractServicesFromFilters(budget.CostFilters)
                        };
                        alerts.push(alert);
                        // Trigger alert notification
                        await this.triggerCostAlert(alert);
                    }
                }
            }
            await this.loggingService.logInfo('Budget status check completed', context, { budgetsChecked: response.Budgets?.length || 0, alertsTriggered: alerts.length });
            return alerts;
        }
        catch (error) {
            await this.loggingService.logError(error, context);
            return [];
        }
    }
    calculateTimeRemaining(endDate) {
        if (!endDate)
            return 'Unknown';
        const now = new Date();
        const diff = endDate.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return `${days} days`;
    }
    extractServicesFromFilters(costFilters) {
        if (!costFilters || !costFilters.Service)
            return [];
        return Array.isArray(costFilters.Service) ? costFilters.Service : [costFilters.Service];
    }
    async triggerCostAlert(alert) {
        const alertNotification = {
            alertName: 'BudgetThresholdExceeded',
            severity: alert.threshold >= 100 ? 'critical' : 'high',
            timestamp: new Date(),
            metricName: 'budget.utilization',
            currentValue: (alert.currentSpend / alert.budgetLimit) * 100,
            threshold: alert.threshold,
            merchantId: alert.merchantId,
            message: `Budget ${alert.budgetName} is at ${((alert.currentSpend / alert.budgetLimit) * 100).toFixed(1)}% utilization. Current spend: $${alert.currentSpend.toFixed(2)}, Budget: $${alert.budgetLimit.toFixed(2)}`,
            actions: [
                { type: 'sns', target: 'budget-alerts' },
                { type: 'email', target: process.env.BUDGET_ALERT_EMAIL || '' }
            ]
        };
        await this.alertingService.handleAlert(alertNotification);
    }
    async getCostPerSession(merchantId, timeRange) {
        // This would integrate with AWS Cost Explorer API to get actual costs
        // For now, we'll return a calculated estimate based on metrics
        const context = {
            merchantId,
            requestId: `cost-per-session-${Date.now()}`,
            operation: 'get_cost_per_session'
        };
        try {
            // This is a simplified calculation - in reality, you'd use Cost Explorer API
            const estimatedCostPerSession = 0.02; // $0.02 base cost
            await this.loggingService.logInfo('Cost per session calculated', context, { costPerSession: estimatedCostPerSession });
            return estimatedCostPerSession;
        }
        catch (error) {
            await this.loggingService.logError(error, context);
            return 0;
        }
    }
    async setupCostOptimizationAlerts() {
        const context = {
            merchantId: 'system',
            requestId: `setup-cost-optimization-${Date.now()}`,
            operation: 'setup_cost_optimization_alerts'
        };
        try {
            // Set up automated cost optimization triggers
            await this.createBudget({
                budgetName: 'MindsDB-RAG-Cost-Optimization-Trigger',
                budgetLimit: 50, // $50 daily limit
                timeUnit: 'DAILY',
                budgetType: 'COST',
                notifications: [
                    {
                        threshold: 80,
                        thresholdType: 'PERCENTAGE',
                        comparisonOperator: 'GREATER_THAN',
                        notificationType: 'ACTUAL',
                        subscriberEmailAddresses: [process.env.BUDGET_ALERT_EMAIL || '']
                    }
                ]
            });
            await this.loggingService.logInfo('Cost optimization alerts setup completed', context);
        }
        catch (error) {
            await this.loggingService.logError(error, context);
        }
    }
}
exports.BudgetMonitoringService = BudgetMonitoringService;
// Singleton instance
let budgetMonitoringInstance = null;
function getBudgetMonitoringService() {
    if (!budgetMonitoringInstance) {
        const accountId = process.env.AWS_ACCOUNT_ID;
        if (!accountId) {
            throw new Error('AWS_ACCOUNT_ID environment variable is required');
        }
        budgetMonitoringInstance = new BudgetMonitoringService(accountId, process.env.AWS_REGION || 'us-east-1');
    }
    return budgetMonitoringInstance;
}
//# sourceMappingURL=BudgetMonitoringService.js.map