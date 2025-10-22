import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export interface MonitoringAlertingStackProps {
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
  database: rds.DatabaseCluster;
  redis: elasticache.CfnCacheCluster;
  apiGateway: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  alertEmail?: string;
  environment: string;
}

export class MonitoringAlertingStack extends Construct {
  public readonly alertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly costAlarm: cloudwatch.Alarm;
  public readonly performanceAlarms: cloudwatch.Alarm[];

  constructor(scope: Construct, id: string, props: MonitoringAlertingStackProps) {
    super(scope, id);

    // Create SNS topic for alerts
    this.alertTopic = this.createAlertTopic(props);

    // Create CloudWatch dashboard
    this.dashboard = this.createDashboard(props);

    // Create performance alarms
    this.performanceAlarms = this.createPerformanceAlarms(props);

    // Create cost monitoring alarm
    this.costAlarm = this.createCostAlarm(props);

    // Create custom metrics
    this.createCustomMetrics(props);

    // Create synthetic monitoring
    this.createSyntheticMonitoring(props);

    // Create outputs
    this.createOutputs();
  }

  private createAlertTopic(props: MonitoringAlertingStackProps): sns.Topic {
    const topic = new sns.Topic(this, "AlertTopic", {
      topicName: `mindsdb-rag-alerts-${props.environment}`,
      displayName: "MindsDB RAG Assistant Alerts",
      fifo: false,
    });

    // Add email subscription if provided
    if (props.alertEmail) {
      topic.addSubscription(new snsSubscriptions.EmailSubscription(props.alertEmail));
    }

    // Add SMS subscription for critical alerts (would need phone number)
    // topic.addSubscription(new snsSubscriptions.SmsSubscription('+1234567890'));

    return topic;
  }

  private createDashboard(props: MonitoringAlertingStackProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, "MindsDBRAGDashboard", {
      dashboardName: `MindsDB-RAG-${props.environment}`,
      defaultInterval: cdk.Duration.hours(1),
    });

    // API Gateway metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Gateway Requests",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Count",
            dimensionsMap: {
              ApiName: props.apiGateway.restApiName,
            },
            statistic: "Sum",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Latency",
            dimensionsMap: {
              ApiName: props.apiGateway.restApiName,
            },
            statistic: "Average",
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "API Gateway Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "4XXError",
            dimensionsMap: {
              ApiName: props.apiGateway.restApiName,
            },
            statistic: "Sum",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "5XXError",
            dimensionsMap: {
              ApiName: props.apiGateway.restApiName,
            },
            statistic: "Sum",
          }),
        ],
        width: 12,
      })
    );

    // ECS Service metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "ECS Service Metrics",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "CPUUtilization",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsCluster.clusterName,
            },
            statistic: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "MemoryUtilization",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsCluster.clusterName,
            },
            statistic: "Average",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "RunningTaskCount",
            dimensionsMap: {
              ServiceName: props.ecsService.serviceName,
              ClusterName: props.ecsCluster.clusterName,
            },
            statistic: "Average",
          }),
        ],
        width: 12,
      })
    );

    // Database metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Database Performance",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/RDS",
            metricName: "CPUUtilization",
            dimensionsMap: {
              DBClusterIdentifier: props.database.clusterIdentifier,
            },
            statistic: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/RDS",
            metricName: "DatabaseConnections",
            dimensionsMap: {
              DBClusterIdentifier: props.database.clusterIdentifier,
            },
            statistic: "Average",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/RDS",
            metricName: "ReadLatency",
            dimensionsMap: {
              DBClusterIdentifier: props.database.clusterIdentifier,
            },
            statistic: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/RDS",
            metricName: "WriteLatency",
            dimensionsMap: {
              DBClusterIdentifier: props.database.clusterIdentifier,
            },
            statistic: "Average",
          }),
        ],
        width: 12,
      })
    );

    // Lambda function metrics
    if (props.lambdaFunctions.length > 0) {
      const lambdaMetrics = props.lambdaFunctions.map(func => 
        new cloudwatch.Metric({
          namespace: "AWS/Lambda",
          metricName: "Duration",
          dimensionsMap: {
            FunctionName: func.functionName,
          },
          statistic: "Average",
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: "Lambda Function Performance",
          left: lambdaMetrics,
          width: 12,
        })
      );
    }

    // Custom business metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Business Metrics",
        left: [
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "SessionsPerMinute",
            statistic: "Sum",
          }),
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "CostPerSession",
            statistic: "Average",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "SuccessfulCheckouts",
            statistic: "Sum",
          }),
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "FailedCheckouts",
            statistic: "Sum",
          }),
        ],
        width: 12,
      }),
      new cloudwatch.SingleValueWidget({
        title: "Cost Per Session (Target: <$0.05)",
        metrics: [
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "CostPerSession",
            statistic: "Average",
          }),
        ],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: "Active Sessions",
        metrics: [
          new cloudwatch.Metric({
            namespace: "MindsDB/RAG",
            metricName: "ActiveSessions",
            statistic: "Maximum",
          }),
        ],
        width: 6,
      })
    );

    return dashboard;
  }

  private createPerformanceAlarms(props: MonitoringAlertingStackProps): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // API Gateway high latency alarm
    const apiLatencyAlarm = new cloudwatch.Alarm(this, "ApiLatencyAlarm", {
      alarmName: `mindsdb-rag-api-latency-${props.environment}`,
      alarmDescription: "API Gateway latency is too high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApiGateway",
        metricName: "Latency",
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName,
        },
        statistic: "Average",
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    alarms.push(apiLatencyAlarm);

    // API Gateway error rate alarm
    const apiErrorAlarm = new cloudwatch.Alarm(this, "ApiErrorAlarm", {
      alarmName: `mindsdb-rag-api-errors-${props.environment}`,
      alarmDescription: "API Gateway error rate is too high",
      metric: new cloudwatch.MathExpression({
        expression: "(m1 + m2) / m3 * 100",
        usingMetrics: {
          m1: new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "4XXError",
            dimensionsMap: { ApiName: props.apiGateway.restApiName },
            statistic: "Sum",
          }),
          m2: new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "5XXError",
            dimensionsMap: { ApiName: props.apiGateway.restApiName },
            statistic: "Sum",
          }),
          m3: new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Count",
            dimensionsMap: { ApiName: props.apiGateway.restApiName },
            statistic: "Sum",
          }),
        },
      }),
      threshold: 5, // 5% error rate
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    apiErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    alarms.push(apiErrorAlarm);

    // ECS CPU utilization alarm
    const ecsCpuAlarm = new cloudwatch.Alarm(this, "EcsCpuAlarm", {
      alarmName: `mindsdb-rag-ecs-cpu-${props.environment}`,
      alarmDescription: "ECS service CPU utilization is too high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ECS",
        metricName: "CPUUtilization",
        dimensionsMap: {
          ServiceName: props.ecsService.serviceName,
          ClusterName: props.ecsCluster.clusterName,
        },
        statistic: "Average",
      }),
      threshold: 80, // 80% CPU
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    ecsCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    alarms.push(ecsCpuAlarm);

    // Database connection alarm
    const dbConnectionAlarm = new cloudwatch.Alarm(this, "DbConnectionAlarm", {
      alarmName: `mindsdb-rag-db-connections-${props.environment}`,
      alarmDescription: "Database connection count is too high",
      metric: new cloudwatch.Metric({
        namespace: "AWS/RDS",
        metricName: "DatabaseConnections",
        dimensionsMap: {
          DBClusterIdentifier: props.database.clusterIdentifier,
        },
        statistic: "Average",
      }),
      threshold: 80, // 80% of max connections
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    dbConnectionAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    alarms.push(dbConnectionAlarm);

    return alarms;
  }

  private createCostAlarm(props: MonitoringAlertingStackProps): cloudwatch.Alarm {
    // Cost per session alarm
    const costAlarm = new cloudwatch.Alarm(this, "CostPerSessionAlarm", {
      alarmName: `mindsdb-rag-cost-per-session-${props.environment}`,
      alarmDescription: "Cost per session exceeds target of $0.05",
      metric: new cloudwatch.Metric({
        namespace: "MindsDB/RAG",
        metricName: "CostPerSession",
        statistic: "Average",
      }),
      threshold: 0.05, // $0.05 target
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    costAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    return costAlarm;
  }

  private createCustomMetrics(props: MonitoringAlertingStackProps): void {
    // Create custom metric filters for application logs
    const logGroup = logs.LogGroup.fromLogGroupName(
      this,
      "ApplicationLogGroup",
      `/aws/ecs/${props.ecsService.serviceName}`
    );

    // Session metrics
    new logs.MetricFilter(this, "SessionStartMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG",
      metricName: "SessionsStarted",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="info", message="Session started"]'),
      metricValue: "1",
    });

    // Cost metrics
    new logs.MetricFilter(this, "CostMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG",
      metricName: "CostPerSession",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="info", message="Session cost calculated", cost]'),
      metricValue: "$cost",
    });

    // Checkout metrics
    new logs.MetricFilter(this, "CheckoutSuccessMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG",
      metricName: "SuccessfulCheckouts",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="info", message="Checkout completed successfully"]'),
      metricValue: "1",
    });

    new logs.MetricFilter(this, "CheckoutFailureMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG",
      metricName: "FailedCheckouts",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="error", message="Checkout failed"]'),
      metricValue: "1",
    });

    // Security metrics
    new logs.MetricFilter(this, "SecurityEventMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG/Security",
      metricName: "SecurityEvents",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="warn", message="SECURITY_EVENT"]'),
      metricValue: "1",
    });

    // PII detection metrics
    new logs.MetricFilter(this, "PIIDetectionMetric", {
      logGroup,
      metricNamespace: "MindsDB/RAG/Security",
      metricName: "PIIDetected",
      filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="info", message="PII detected and tokenized"]'),
      metricValue: "1",
    });
  }

  private createSyntheticMonitoring(props: MonitoringAlertingStackProps): void {
    // Create synthetic monitoring Lambda function
    const syntheticMonitoringFunction = new lambda.Function(this, "SyntheticMonitoringFunction", {
      functionName: `mindsdb-rag-synthetic-monitoring-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "syntheticMonitoring.handler",
      code: lambda.Code.fromInline(`
        const https = require('https');
        const AWS = require('aws-sdk');
        const cloudwatch = new AWS.CloudWatch();

        exports.handler = async (event) => {
          const apiUrl = process.env.API_URL;
          const startTime = Date.now();
          
          try {
            // Test health endpoint
            const healthCheck = await makeRequest(apiUrl + '/health');
            const responseTime = Date.now() - startTime;
            
            // Send metrics to CloudWatch
            await cloudwatch.putMetricData({
              Namespace: 'MindsDB/RAG/Synthetic',
              MetricData: [
                {
                  MetricName: 'HealthCheckResponseTime',
                  Value: responseTime,
                  Unit: 'Milliseconds',
                  Timestamp: new Date()
                },
                {
                  MetricName: 'HealthCheckSuccess',
                  Value: healthCheck.statusCode === 200 ? 1 : 0,
                  Unit: 'Count',
                  Timestamp: new Date()
                }
              ]
            }).promise();
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Synthetic monitoring completed',
                responseTime,
                healthStatus: healthCheck.statusCode
              })
            };
          } catch (error) {
            // Send failure metric
            await cloudwatch.putMetricData({
              Namespace: 'MindsDB/RAG/Synthetic',
              MetricData: [
                {
                  MetricName: 'HealthCheckSuccess',
                  Value: 0,
                  Unit: 'Count',
                  Timestamp: new Date()
                }
              ]
            }).promise();
            
            throw error;
          }
        };
        
        function makeRequest(url) {
          return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
              resolve({ statusCode: res.statusCode });
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('Timeout')));
          });
        }
      `),
      environment: {
        API_URL: props.apiGateway.url,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Grant CloudWatch permissions
    syntheticMonitoringFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
      })
    );

    // Schedule synthetic monitoring every 5 minutes
    const rule = new events.Rule(this, "SyntheticMonitoringRule", {
      ruleName: `mindsdb-rag-synthetic-monitoring-${props.environment}`,
      description: "Trigger synthetic monitoring every 5 minutes",
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    rule.addTarget(new targets.LambdaFunction(syntheticMonitoringFunction));

    // Create alarm for synthetic monitoring failures
    const syntheticAlarm = new cloudwatch.Alarm(this, "SyntheticMonitoringAlarm", {
      alarmName: `mindsdb-rag-synthetic-failures-${props.environment}`,
      alarmDescription: "Synthetic monitoring is failing",
      metric: new cloudwatch.Metric({
        namespace: "MindsDB/RAG/Synthetic",
        metricName: "HealthCheckSuccess",
        statistic: "Average",
      }),
      threshold: 0.8, // 80% success rate
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    });
    syntheticAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, "AlertTopicArn", {
      value: this.alertTopic.topicArn,
      description: "SNS Topic ARN for alerts",
    });

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL",
    });

    new cdk.CfnOutput(this, "CostAlarmArn", {
      value: this.costAlarm.alarmArn,
      description: "Cost per session alarm ARN",
    });
  }
}