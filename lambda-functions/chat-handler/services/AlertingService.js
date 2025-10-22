"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertingService = void 0;
exports.getAlertingService = getAlertingService;
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const client_sns_1 = require("@aws-sdk/client-sns");
const LoggingService_1 = require("./LoggingService");
const MetricsCollectionService_1 = require("./MetricsCollectionService");
class AlertingService {
    constructor(region = 'us-east-1') {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsService = (0, MetricsCollectionService_1.getMetricsCollectionService)();
        this.alertRules = new Map();
        this.cloudWatch = new client_cloudwatch_1.CloudWatchClient({ region });
        this.sns = new client_sns_1.SNSClient({ region });
        this.initializeDefaultAlerts();
        this.setupSNSTopic();
    }
    async setupSNSTopic() {
        try {
            const topicName = 'mindsdb-rag-alerts';
            const createTopicResponse = await this.sns.send(new client_sns_1.CreateTopicCommand({
                Name: topicName
            }));
            this.snsTopicArn = createTopicResponse.TopicArn;
            await this.loggingService.logInfo('SNS topic created for alerts', {
                merchantId: 'system',
                requestId: `sns-setup-${Date.now()}`,
                operation: 'setup_sns_topic'
            }, { topicArn: this.snsTopicArn });
        }
        catch (error) {
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `sns-setup-error-${Date.now()}`,
                operation: 'setup_sns_topic'
            });
        }
    }
    initializeDefaultAlerts() {
        // Grounding accuracy alert (severity-high)
        this.addAlertRule({
            name: 'GroundingAccuracyLow',
            description: 'Grounding accuracy below 85% threshold',
            threshold: {
                metricName: 'grounding.accuracy',
                threshold: 85,
                comparisonOperator: 'LessThanThreshold',
                evaluationPeriods: 2,
                period: 300, // 5 minutes
                statistic: 'Average',
                treatMissingData: 'notBreaching'
            },
            severity: 'high',
            actions: [
                { type: 'sns', target: 'alerts' },
                { type: 'slack', target: process.env.SLACK_WEBHOOK_URL || '' },
                { type: 'retrain_trigger', target: 'auto' }
            ],
            enabled: true
        });
        // Prediction confidence drift alert
        this.addAlertRule({
            name: 'PredictionConfidenceDrift',
            description: 'Prediction confidence drift detected with retrain trigger',
            threshold: {
                metricName: 'predict.drift_score',
                threshold: 0.1,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 3,
                period: 600, // 10 minutes
                statistic: 'Average',
                treatMissingData: 'notBreaching'
            },
            severity: 'medium',
            actions: [
                { type: 'sns', target: 'alerts' },
                { type: 'retrain_trigger', target: 'auto' }
            ],
            enabled: true
        });
        // Cost per session alert with 24h rolling window
        this.addAlertRule({
            name: 'CostPerSessionHigh',
            description: 'Cost per session exceeds $0.05 threshold',
            threshold: {
                metricName: 'business.cost_per_session',
                threshold: 0.05,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 1,
                period: 86400, // 24 hours
                statistic: 'Average',
                treatMissingData: 'notBreaching'
            },
            severity: 'medium',
            actions: [
                { type: 'sns', target: 'alerts' },
                { type: 'email', target: process.env.FINANCE_ALERT_EMAIL || '' }
            ],
            enabled: true
        });
        // Retrieval latency p95 alert
        this.addAlertRule({
            name: 'RetrievalLatencyHigh',
            description: 'Retrieval latency P95 exceeds 250ms',
            threshold: {
                metricName: 'retrieval.latency_ms',
                threshold: 250,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300, // 5 minutes
                statistic: 'Average', // Will be overridden for P95 in CloudWatch
                treatMissingData: 'notBreaching'
            },
            severity: 'medium',
            actions: [
                { type: 'sns', target: 'alerts' },
                { type: 'slack', target: process.env.SLACK_WEBHOOK_URL || '' }
            ],
            enabled: true
        });
    }
    addAlertRule(rule) {
        this.alertRules.set(rule.name, rule);
    }
    async deployAlertRules() {
        const context = {
            merchantId: 'system',
            requestId: `deploy-alerts-${Date.now()}`,
            operation: 'deploy_alert_rules'
        };
        try {
            for (const [name, rule] of this.alertRules) {
                if (rule.enabled) {
                    await this.createCloudWatchAlarm(rule);
                }
            }
            await this.loggingService.logInfo('Alert rules deployed successfully', context, { rulesCount: this.alertRules.size });
        }
        catch (error) {
            await this.loggingService.logError(error, context);
        }
    }
    async createCloudWatchAlarm(rule) {
        try {
            const dimensions = Object.entries(rule.dimensions || {}).map(([name, value]) => ({
                Name: name,
                Value: value
            }));
            const alarmActions = [];
            if (this.snsTopicArn) {
                alarmActions.push(this.snsTopicArn);
            }
            await this.cloudWatch.send(new client_cloudwatch_1.PutMetricAlarmCommand({
                AlarmName: rule.name,
                AlarmDescription: rule.description,
                MetricName: rule.threshold.metricName,
                Namespace: 'MindsDB/RAG',
                Statistic: rule.threshold.statistic,
                Dimensions: dimensions,
                Period: rule.threshold.period,
                EvaluationPeriods: rule.threshold.evaluationPeriods,
                Threshold: rule.threshold.threshold,
                ComparisonOperator: rule.threshold.comparisonOperator,
                TreatMissingData: rule.threshold.treatMissingData,
                AlarmActions: alarmActions,
                Tags: [
                    { Key: 'Service', Value: 'MindsDB-RAG' },
                    { Key: 'Severity', Value: rule.severity },
                    { Key: 'Environment', Value: process.env.NODE_ENV || 'development' }
                ]
            }));
            await this.loggingService.logInfo('CloudWatch alarm created', {
                merchantId: 'system',
                requestId: `create-alarm-${Date.now()}`,
                operation: 'create_cloudwatch_alarm'
            }, { alarmName: rule.name, severity: rule.severity });
        }
        catch (error) {
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `create-alarm-error-${Date.now()}`,
                operation: 'create_cloudwatch_alarm'
            }, { alarmName: rule.name });
        }
    }
    async handleAlert(notification) {
        const context = {
            merchantId: notification.merchantId || 'system',
            sessionId: notification.sessionId,
            requestId: `handle-alert-${Date.now()}`,
            operation: 'handle_alert'
        };
        try {
            // Log the alert
            await this.loggingService.logWarning(`Alert triggered: ${notification.alertName}`, context, {
                severity: notification.severity,
                metricName: notification.metricName,
                currentValue: notification.currentValue,
                threshold: notification.threshold,
                message: notification.message
            });
            // Execute alert actions
            for (const action of notification.actions) {
                await this.executeAlertAction(action, notification, context);
            }
            // Collect alert metrics
            await this.metricsService.incrementCounter('suspiciousActivityAlerts', notification.merchantId || 'system', 1, {
                alertName: notification.alertName,
                severity: notification.severity,
                metricName: notification.metricName
            });
        }
        catch (error) {
            await this.loggingService.logError(error, context, {
                alertName: notification.alertName
            });
        }
    }
    async executeAlertAction(action, notification, context) {
        try {
            switch (action.type) {
                case 'sns':
                    await this.sendSNSNotification(notification);
                    break;
                case 'slack':
                    await this.sendSlackNotification(action.target, notification);
                    break;
                case 'email':
                    await this.sendEmailNotification(action.target, notification);
                    break;
                case 'webhook':
                    await this.sendWebhookNotification(action.target, notification);
                    break;
                case 'retrain_trigger':
                    await this.triggerModelRetrain(notification, context);
                    break;
                default:
                    await this.loggingService.logWarning(`Unknown alert action type: ${action.type}`, context);
            }
        }
        catch (error) {
            await this.loggingService.logError(error, context, {
                actionType: action.type,
                actionTarget: action.target
            });
        }
    }
    async sendSNSNotification(notification) {
        if (!this.snsTopicArn)
            return;
        const message = {
            alertName: notification.alertName,
            severity: notification.severity,
            timestamp: notification.timestamp.toISOString(),
            metricName: notification.metricName,
            currentValue: notification.currentValue,
            threshold: notification.threshold,
            merchantId: notification.merchantId,
            message: notification.message
        };
        await this.sns.send(new client_sns_1.PublishCommand({
            TopicArn: this.snsTopicArn,
            Message: JSON.stringify(message),
            Subject: `MindsDB RAG Alert: ${notification.alertName}`
        }));
    }
    async sendSlackNotification(webhookUrl, notification) {
        if (!webhookUrl)
            return;
        const color = {
            'critical': '#FF0000',
            'high': '#FF6600',
            'medium': '#FFCC00',
            'low': '#00FF00'
        }[notification.severity] || '#808080';
        const payload = {
            attachments: [{
                    color,
                    title: `🚨 ${notification.alertName}`,
                    text: notification.message,
                    fields: [
                        {
                            title: 'Severity',
                            value: notification.severity.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Metric',
                            value: notification.metricName,
                            short: true
                        },
                        {
                            title: 'Current Value',
                            value: notification.currentValue.toString(),
                            short: true
                        },
                        {
                            title: 'Threshold',
                            value: notification.threshold.toString(),
                            short: true
                        },
                        {
                            title: 'Merchant ID',
                            value: notification.merchantId || 'N/A',
                            short: true
                        },
                        {
                            title: 'Timestamp',
                            value: notification.timestamp.toISOString(),
                            short: true
                        }
                    ]
                }]
        };
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
    async sendEmailNotification(email, notification) {
        // This would integrate with SES or another email service
        // For now, we'll log the email that would be sent
        await this.loggingService.logInfo('Email notification would be sent', {
            merchantId: notification.merchantId || 'system',
            requestId: `email-notification-${Date.now()}`,
            operation: 'send_email_notification'
        }, {
            recipient: email,
            subject: `MindsDB RAG Alert: ${notification.alertName}`,
            alertDetails: notification
        });
    }
    async sendWebhookNotification(webhookUrl, notification) {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notification)
        });
    }
    async triggerModelRetrain(notification, context) {
        // This would integrate with the model retraining service
        await this.loggingService.logInfo('Model retrain triggered by alert', context, {
            alertName: notification.alertName,
            metricName: notification.metricName,
            merchantId: notification.merchantId
        });
        // Increment retrain trigger metric
        await this.metricsService.incrementCounter('suspiciousActivityAlerts', notification.merchantId || 'system', 1, {
            trigger: 'alert',
            alertName: notification.alertName
        });
    }
    async subscribeToAlerts(email) {
        if (!this.snsTopicArn)
            return;
        try {
            await this.sns.send(new client_sns_1.SubscribeCommand({
                TopicArn: this.snsTopicArn,
                Protocol: 'email',
                Endpoint: email
            }));
            await this.loggingService.logInfo('Email subscribed to alerts', {
                merchantId: 'system',
                requestId: `subscribe-${Date.now()}`,
                operation: 'subscribe_to_alerts'
            }, { email });
        }
        catch (error) {
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `subscribe-error-${Date.now()}`,
                operation: 'subscribe_to_alerts'
            }, { email });
        }
    }
    async getAlarmStatus() {
        try {
            const response = await this.cloudWatch.send(new client_cloudwatch_1.DescribeAlarmsCommand({
                AlarmNamePrefix: 'MindsDB'
            }));
            return response.MetricAlarms || [];
        }
        catch (error) {
            await this.loggingService.logError(error, {
                merchantId: 'system',
                requestId: `get-alarms-${Date.now()}`,
                operation: 'get_alarm_status'
            });
            return [];
        }
    }
}
exports.AlertingService = AlertingService;
// Singleton instance
let alertingServiceInstance = null;
function getAlertingService() {
    if (!alertingServiceInstance) {
        alertingServiceInstance = new AlertingService(process.env.AWS_REGION || 'us-east-1');
    }
    return alertingServiceInstance;
}
//# sourceMappingURL=AlertingService.js.map