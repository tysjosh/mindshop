import { CloudWatchClient, PutMetricAlarmCommand, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { getLoggingService, LogContext } from './LoggingService';
import { getMetricsCollectionService } from './MetricsCollectionService';

export interface AlertThreshold {
  metricName: string;
  threshold: number;
  comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
  evaluationPeriods: number;
  period: number; // in seconds
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

export class AlertingService {
  private cloudWatch: CloudWatchClient;
  private sns: SNSClient;
  private loggingService = getLoggingService();
  private metricsService = getMetricsCollectionService();
  private alertRules: Map<string, AlertRule> = new Map();
  private snsTopicArn?: string;

  constructor(region: string = 'us-east-1') {
    this.cloudWatch = new CloudWatchClient({ region });
    this.sns = new SNSClient({ region });
    this.initializeDefaultAlerts();
    this.setupSNSTopic();
  }

  private async setupSNSTopic(): Promise<void> {
    try {
      const topicName = 'mindsdb-rag-alerts';
      const createTopicResponse = await this.sns.send(new CreateTopicCommand({
        Name: topicName
      }));
      
      this.snsTopicArn = createTopicResponse.TopicArn;
      
      await this.loggingService.logInfo('SNS topic created for alerts', {
        merchantId: 'system',
        requestId: `sns-setup-${Date.now()}`,
        operation: 'setup_sns_topic'
      }, { topicArn: this.snsTopicArn });

    } catch (error) {
      await this.loggingService.logError(error as Error, {
        merchantId: 'system',
        requestId: `sns-setup-error-${Date.now()}`,
        operation: 'setup_sns_topic'
      });
    }
  }

  private initializeDefaultAlerts(): void {
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

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.name, rule);
  }

  public async deployAlertRules(): Promise<void> {
    const context: LogContext = {
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

      await this.loggingService.logInfo(
        'Alert rules deployed successfully',
        context,
        { rulesCount: this.alertRules.size }
      );

    } catch (error) {
      await this.loggingService.logError(error as Error, context);
    }
  }

  private async createCloudWatchAlarm(rule: AlertRule): Promise<void> {
    try {
      const dimensions = Object.entries(rule.dimensions || {}).map(([name, value]) => ({
        Name: name,
        Value: value
      }));

      const alarmActions = [];
      if (this.snsTopicArn) {
        alarmActions.push(this.snsTopicArn);
      }

      await this.cloudWatch.send(new PutMetricAlarmCommand({
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

      await this.loggingService.logInfo(
        'CloudWatch alarm created',
        {
          merchantId: 'system',
          requestId: `create-alarm-${Date.now()}`,
          operation: 'create_cloudwatch_alarm'
        },
        { alarmName: rule.name, severity: rule.severity }
      );

    } catch (error) {
      await this.loggingService.logError(error as Error, {
        merchantId: 'system',
        requestId: `create-alarm-error-${Date.now()}`,
        operation: 'create_cloudwatch_alarm'
      }, { alarmName: rule.name });
    }
  }

  public async handleAlert(notification: AlertNotification): Promise<void> {
    const context: LogContext = {
      merchantId: notification.merchantId || 'system',
      sessionId: notification.sessionId,
      requestId: `handle-alert-${Date.now()}`,
      operation: 'handle_alert'
    };

    try {
      // Log the alert
      await this.loggingService.logWarning(
        `Alert triggered: ${notification.alertName}`,
        context,
        {
          severity: notification.severity,
          metricName: notification.metricName,
          currentValue: notification.currentValue,
          threshold: notification.threshold,
          message: notification.message
        }
      );

      // Execute alert actions
      for (const action of notification.actions) {
        await this.executeAlertAction(action, notification, context);
      }

      // Collect alert metrics
      await this.metricsService.incrementCounter(
        'suspiciousActivityAlerts',
        notification.merchantId || 'system',
        1,
        {
          alertName: notification.alertName,
          severity: notification.severity,
          metricName: notification.metricName
        }
      );

    } catch (error) {
      await this.loggingService.logError(error as Error, context, {
        alertName: notification.alertName
      });
    }
  }

  private async executeAlertAction(
    action: AlertAction,
    notification: AlertNotification,
    context: LogContext
  ): Promise<void> {
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
          await this.loggingService.logWarning(
            `Unknown alert action type: ${action.type}`,
            context
          );
      }

    } catch (error) {
      await this.loggingService.logError(error as Error, context, {
        actionType: action.type,
        actionTarget: action.target
      });
    }
  }

  private async sendSNSNotification(notification: AlertNotification): Promise<void> {
    if (!this.snsTopicArn) return;

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

    await this.sns.send(new PublishCommand({
      TopicArn: this.snsTopicArn,
      Message: JSON.stringify(message),
      Subject: `MindsDB RAG Alert: ${notification.alertName}`
    }));
  }

  private async sendSlackNotification(webhookUrl: string, notification: AlertNotification): Promise<void> {
    if (!webhookUrl) return;

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

  private async sendEmailNotification(email: string, notification: AlertNotification): Promise<void> {
    // This would integrate with SES or another email service
    // For now, we'll log the email that would be sent
    await this.loggingService.logInfo(
      'Email notification would be sent',
      {
        merchantId: notification.merchantId || 'system',
        requestId: `email-notification-${Date.now()}`,
        operation: 'send_email_notification'
      },
      {
        recipient: email,
        subject: `MindsDB RAG Alert: ${notification.alertName}`,
        alertDetails: notification
      }
    );
  }

  private async sendWebhookNotification(webhookUrl: string, notification: AlertNotification): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    });
  }

  private async triggerModelRetrain(notification: AlertNotification, context: LogContext): Promise<void> {
    // This would integrate with the model retraining service
    await this.loggingService.logInfo(
      'Model retrain triggered by alert',
      context,
      {
        alertName: notification.alertName,
        metricName: notification.metricName,
        merchantId: notification.merchantId
      }
    );

    // Increment retrain trigger metric
    await this.metricsService.incrementCounter(
      'suspiciousActivityAlerts',
      notification.merchantId || 'system',
      1,
      {
        trigger: 'alert',
        alertName: notification.alertName
      }
    );
  }

  public async subscribeToAlerts(email: string): Promise<void> {
    if (!this.snsTopicArn) return;

    try {
      await this.sns.send(new SubscribeCommand({
        TopicArn: this.snsTopicArn,
        Protocol: 'email',
        Endpoint: email
      }));

      await this.loggingService.logInfo(
        'Email subscribed to alerts',
        {
          merchantId: 'system',
          requestId: `subscribe-${Date.now()}`,
          operation: 'subscribe_to_alerts'
        },
        { email }
      );

    } catch (error) {
      await this.loggingService.logError(error as Error, {
        merchantId: 'system',
        requestId: `subscribe-error-${Date.now()}`,
        operation: 'subscribe_to_alerts'
      }, { email });
    }
  }

  public async getAlarmStatus(): Promise<any[]> {
    try {
      const response = await this.cloudWatch.send(new DescribeAlarmsCommand({
        AlarmNamePrefix: 'MindsDB'
      }));

      return response.MetricAlarms || [];

    } catch (error) {
      await this.loggingService.logError(error as Error, {
        merchantId: 'system',
        requestId: `get-alarms-${Date.now()}`,
        operation: 'get_alarm_status'
      });
      return [];
    }
  }
}

// Singleton instance
let alertingServiceInstance: AlertingService | null = null;

export function getAlertingService(): AlertingService {
  if (!alertingServiceInstance) {
    alertingServiceInstance = new AlertingService(
      process.env.AWS_REGION || 'us-east-1'
    );
  }
  return alertingServiceInstance;
}