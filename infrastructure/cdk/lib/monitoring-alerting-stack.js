"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringAlertingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
class MonitoringAlertingStack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
    createAlertTopic(props) {
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
    createDashboard(props) {
        const dashboard = new cloudwatch.Dashboard(this, "MindsDBRAGDashboard", {
            dashboardName: `MindsDB-RAG-${props.environment}`,
            defaultInterval: cdk.Duration.hours(1),
        });
        // API Gateway metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }), new cloudwatch.GraphWidget({
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
        }));
        // ECS Service metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        // Database metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        // Lambda function metrics
        if (props.lambdaFunctions.length > 0) {
            const lambdaMetrics = props.lambdaFunctions.map(func => new cloudwatch.Metric({
                namespace: "AWS/Lambda",
                metricName: "Duration",
                dimensionsMap: {
                    FunctionName: func.functionName,
                },
                statistic: "Average",
            }));
            dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: "Lambda Function Performance",
                left: lambdaMetrics,
                width: 12,
            }));
        }
        // Custom business metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }), new cloudwatch.SingleValueWidget({
            title: "Cost Per Session (Target: <$0.05)",
            metrics: [
                new cloudwatch.Metric({
                    namespace: "MindsDB/RAG",
                    metricName: "CostPerSession",
                    statistic: "Average",
                }),
            ],
            width: 6,
        }), new cloudwatch.SingleValueWidget({
            title: "Active Sessions",
            metrics: [
                new cloudwatch.Metric({
                    namespace: "MindsDB/RAG",
                    metricName: "ActiveSessions",
                    statistic: "Maximum",
                }),
            ],
            width: 6,
        }));
        return dashboard;
    }
    createPerformanceAlarms(props) {
        const alarms = [];
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
    createCostAlarm(props) {
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
    createCustomMetrics(props) {
        // Create custom metric filters for application logs
        const logGroup = logs.LogGroup.fromLogGroupName(this, "ApplicationLogGroup", `/aws/ecs/${props.ecsService.serviceName}`);
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
    createSyntheticMonitoring(props) {
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
        syntheticMonitoringFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["cloudwatch:PutMetricData"],
            resources: ["*"],
        }));
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
    createOutputs() {
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
exports.MonitoringAlertingStack = MonitoringAlertingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1hbGVydGluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3JpbmctYWxlcnRpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCxzRkFBd0U7QUFDeEUseURBQTJDO0FBQzNDLG9GQUFzRTtBQUN0RSx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBSzFELDJDQUF1QztBQWF2QyxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBTXBELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUM7UUFDM0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQiw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFL0MsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU3Qyw0QkFBNEI7UUFDNUIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU3RCwrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdDLHdCQUF3QjtRQUN4QixJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFaEMsOEJBQThCO1FBQzlCLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV0QyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxLQUFtQztRQUMxRCxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUM5QyxTQUFTLEVBQUUsc0JBQXNCLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDcEQsV0FBVyxFQUFFLDhCQUE4QjtZQUMzQyxJQUFJLEVBQUUsS0FBSztTQUNaLENBQUMsQ0FBQztRQUVILHFDQUFxQztRQUNyQyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNyQixLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVELHFFQUFxRTtRQUNyRSw4RUFBOEU7UUFFOUUsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sZUFBZSxDQUFDLEtBQW1DO1FBQ3pELE1BQU0sU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDdEUsYUFBYSxFQUFFLGVBQWUsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUNqRCxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ3ZDLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHNCQUFzQjtZQUM3QixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsT0FBTztvQkFDbkIsYUFBYSxFQUFFO3dCQUNiLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7cUJBQ3RDO29CQUNELFNBQVMsRUFBRSxLQUFLO2lCQUNqQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUU7Z0JBQ0wsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsU0FBUztvQkFDckIsYUFBYSxFQUFFO3dCQUNiLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7cUJBQ3RDO29CQUNELFNBQVMsRUFBRSxTQUFTO2lCQUNyQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsRUFBRTtTQUNWLENBQUMsRUFDRixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLG9CQUFvQjtZQUMzQixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsVUFBVTtvQkFDdEIsYUFBYSxFQUFFO3dCQUNiLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7cUJBQ3RDO29CQUNELFNBQVMsRUFBRSxLQUFLO2lCQUNqQixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLGdCQUFnQjtvQkFDM0IsVUFBVSxFQUFFLFVBQVU7b0JBQ3RCLGFBQWEsRUFBRTt3QkFDYixPQUFPLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXO3FCQUN0QztvQkFDRCxTQUFTLEVBQUUsS0FBSztpQkFDakIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLHNCQUFzQjtRQUN0QixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHFCQUFxQjtZQUM1QixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsU0FBUztvQkFDcEIsVUFBVSxFQUFFLGdCQUFnQjtvQkFDNUIsYUFBYSxFQUFFO3dCQUNiLFdBQVcsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7d0JBQ3pDLFdBQVcsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7cUJBQzFDO29CQUNELFNBQVMsRUFBRSxTQUFTO2lCQUNyQixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFNBQVM7b0JBQ3BCLFVBQVUsRUFBRSxtQkFBbUI7b0JBQy9CLGFBQWEsRUFBRTt3QkFDYixXQUFXLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXO3dCQUN6QyxXQUFXLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXO3FCQUMxQztvQkFDRCxTQUFTLEVBQUUsU0FBUztpQkFDckIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFO2dCQUNMLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLFNBQVM7b0JBQ3BCLFVBQVUsRUFBRSxrQkFBa0I7b0JBQzlCLGFBQWEsRUFBRTt3QkFDYixXQUFXLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXO3dCQUN6QyxXQUFXLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXO3FCQUMxQztvQkFDRCxTQUFTLEVBQUUsU0FBUztpQkFDckIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLG1CQUFtQjtRQUNuQixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLHNCQUFzQjtZQUM3QixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsU0FBUztvQkFDcEIsVUFBVSxFQUFFLGdCQUFnQjtvQkFDNUIsYUFBYSxFQUFFO3dCQUNiLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsaUJBQWlCO3FCQUN0RDtvQkFDRCxTQUFTLEVBQUUsU0FBUztpQkFDckIsQ0FBQztnQkFDRixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxTQUFTO29CQUNwQixVQUFVLEVBQUUscUJBQXFCO29CQUNqQyxhQUFhLEVBQUU7d0JBQ2IsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUI7cUJBQ3REO29CQUNELFNBQVMsRUFBRSxTQUFTO2lCQUNyQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUU7Z0JBQ0wsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsU0FBUztvQkFDcEIsVUFBVSxFQUFFLGFBQWE7b0JBQ3pCLGFBQWEsRUFBRTt3QkFDYixtQkFBbUIsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQjtxQkFDdEQ7b0JBQ0QsU0FBUyxFQUFFLFNBQVM7aUJBQ3JCLENBQUM7Z0JBQ0YsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsU0FBUztvQkFDcEIsVUFBVSxFQUFFLGNBQWM7b0JBQzFCLGFBQWEsRUFBRTt3QkFDYixtQkFBbUIsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQjtxQkFDdEQ7b0JBQ0QsU0FBUyxFQUFFLFNBQVM7aUJBQ3JCLENBQUM7YUFDSDtZQUNELEtBQUssRUFBRSxFQUFFO1NBQ1YsQ0FBQyxDQUNILENBQUM7UUFFRiwwQkFBMEI7UUFDMUIsSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNyQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUNyRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxZQUFZO2dCQUN2QixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsYUFBYSxFQUFFO29CQUNiLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtpQkFDaEM7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7YUFDckIsQ0FBQyxDQUNILENBQUM7WUFFRixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7Z0JBQ3pCLEtBQUssRUFBRSw2QkFBNkI7Z0JBQ3BDLElBQUksRUFBRSxhQUFhO2dCQUNuQixLQUFLLEVBQUUsRUFBRTthQUNWLENBQUMsQ0FDSCxDQUFDO1FBQ0osQ0FBQztRQUVELDBCQUEwQjtRQUMxQixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGtCQUFrQjtZQUN6QixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsYUFBYTtvQkFDeEIsVUFBVSxFQUFFLG1CQUFtQjtvQkFDL0IsU0FBUyxFQUFFLEtBQUs7aUJBQ2pCLENBQUM7Z0JBQ0YsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsYUFBYTtvQkFDeEIsVUFBVSxFQUFFLGdCQUFnQjtvQkFDNUIsU0FBUyxFQUFFLFNBQVM7aUJBQ3JCLENBQUM7YUFDSDtZQUNELEtBQUssRUFBRTtnQkFDTCxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxhQUFhO29CQUN4QixVQUFVLEVBQUUscUJBQXFCO29CQUNqQyxTQUFTLEVBQUUsS0FBSztpQkFDakIsQ0FBQztnQkFDRixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxhQUFhO29CQUN4QixVQUFVLEVBQUUsaUJBQWlCO29CQUM3QixTQUFTLEVBQUUsS0FBSztpQkFDakIsQ0FBQzthQUNIO1lBQ0QsS0FBSyxFQUFFLEVBQUU7U0FDVixDQUFDLEVBQ0YsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUM7WUFDL0IsS0FBSyxFQUFFLG1DQUFtQztZQUMxQyxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsYUFBYTtvQkFDeEIsVUFBVSxFQUFFLGdCQUFnQjtvQkFDNUIsU0FBUyxFQUFFLFNBQVM7aUJBQ3JCLENBQUM7YUFDSDtZQUNELEtBQUssRUFBRSxDQUFDO1NBQ1QsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDO1lBQy9CLEtBQUssRUFBRSxpQkFBaUI7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLGFBQWE7b0JBQ3hCLFVBQVUsRUFBRSxnQkFBZ0I7b0JBQzVCLFNBQVMsRUFBRSxTQUFTO2lCQUNyQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsQ0FBQztTQUNULENBQUMsQ0FDSCxDQUFDO1FBRUYsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVPLHVCQUF1QixDQUFDLEtBQW1DO1FBQ2pFLE1BQU0sTUFBTSxHQUF1QixFQUFFLENBQUM7UUFFdEMsaUNBQWlDO1FBQ2pDLE1BQU0sZUFBZSxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDcEUsU0FBUyxFQUFFLDJCQUEyQixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3pELGdCQUFnQixFQUFFLGlDQUFpQztZQUNuRCxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsZ0JBQWdCO2dCQUMzQixVQUFVLEVBQUUsU0FBUztnQkFDckIsYUFBYSxFQUFFO29CQUNiLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7aUJBQ3RDO2dCQUNELFNBQVMsRUFBRSxTQUFTO2FBQ3JCLENBQUM7WUFDRixTQUFTLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDN0IsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCO1lBQ3hFLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUNILGVBQWUsQ0FBQyxjQUFjLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakYsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3QiwrQkFBK0I7UUFDL0IsTUFBTSxhQUFhLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDaEUsU0FBUyxFQUFFLDBCQUEwQixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3hELGdCQUFnQixFQUFFLG9DQUFvQztZQUN0RCxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsY0FBYyxDQUFDO2dCQUNwQyxVQUFVLEVBQUUsc0JBQXNCO2dCQUNsQyxZQUFZLEVBQUU7b0JBQ1osRUFBRSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQzt3QkFDeEIsU0FBUyxFQUFFLGdCQUFnQjt3QkFDM0IsVUFBVSxFQUFFLFVBQVU7d0JBQ3RCLGFBQWEsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTt3QkFDeEQsU0FBUyxFQUFFLEtBQUs7cUJBQ2pCLENBQUM7b0JBQ0YsRUFBRSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQzt3QkFDeEIsU0FBUyxFQUFFLGdCQUFnQjt3QkFDM0IsVUFBVSxFQUFFLFVBQVU7d0JBQ3RCLGFBQWEsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTt3QkFDeEQsU0FBUyxFQUFFLEtBQUs7cUJBQ2pCLENBQUM7b0JBQ0YsRUFBRSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQzt3QkFDeEIsU0FBUyxFQUFFLGdCQUFnQjt3QkFDM0IsVUFBVSxFQUFFLE9BQU87d0JBQ25CLGFBQWEsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTt3QkFDeEQsU0FBUyxFQUFFLEtBQUs7cUJBQ2pCLENBQUM7aUJBQ0g7YUFDRixDQUFDO1lBQ0YsU0FBUyxFQUFFLENBQUMsRUFBRSxnQkFBZ0I7WUFDOUIsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCO1NBQ3pFLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDL0UsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUzQiw0QkFBNEI7UUFDNUIsTUFBTSxXQUFXLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDNUQsU0FBUyxFQUFFLHVCQUF1QixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3JELGdCQUFnQixFQUFFLHlDQUF5QztZQUMzRCxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsU0FBUztnQkFDcEIsVUFBVSxFQUFFLGdCQUFnQjtnQkFDNUIsYUFBYSxFQUFFO29CQUNiLFdBQVcsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7b0JBQ3pDLFdBQVcsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVc7aUJBQzFDO2dCQUNELFNBQVMsRUFBRSxTQUFTO2FBQ3JCLENBQUM7WUFDRixTQUFTLEVBQUUsRUFBRSxFQUFFLFVBQVU7WUFDekIsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCO1NBQ3pFLENBQUMsQ0FBQztRQUNILFdBQVcsQ0FBQyxjQUFjLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDN0UsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV6Qiw0QkFBNEI7UUFDNUIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3hFLFNBQVMsRUFBRSw4QkFBOEIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUM1RCxnQkFBZ0IsRUFBRSx1Q0FBdUM7WUFDekQsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLFNBQVM7Z0JBQ3BCLFVBQVUsRUFBRSxxQkFBcUI7Z0JBQ2pDLGFBQWEsRUFBRTtvQkFDYixtQkFBbUIsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQjtpQkFDdEQ7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7YUFDckIsQ0FBQztZQUNGLFNBQVMsRUFBRSxFQUFFLEVBQUUseUJBQXlCO1lBQ3hDLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtTQUN6RSxDQUFDLENBQUM7UUFDSCxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbkYsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRS9CLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFTyxlQUFlLENBQUMsS0FBbUM7UUFDekQseUJBQXlCO1FBQ3pCLE1BQU0sU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsU0FBUyxFQUFFLGdDQUFnQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQzlELGdCQUFnQixFQUFFLDBDQUEwQztZQUM1RCxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsYUFBYTtnQkFDeEIsVUFBVSxFQUFFLGdCQUFnQjtnQkFDNUIsU0FBUyxFQUFFLFNBQVM7YUFDckIsQ0FBQztZQUNGLFNBQVMsRUFBRSxJQUFJLEVBQUUsZUFBZTtZQUNoQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0I7WUFDeEUsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7U0FDNUQsQ0FBQyxDQUFDO1FBQ0gsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUUzRSxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRU8sbUJBQW1CLENBQUMsS0FBbUM7UUFDN0Qsb0RBQW9EO1FBQ3BELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQzdDLElBQUksRUFDSixxQkFBcUIsRUFDckIsWUFBWSxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUMzQyxDQUFDO1FBRUYsa0JBQWtCO1FBQ2xCLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDaEQsUUFBUTtZQUNSLGVBQWUsRUFBRSxhQUFhO1lBQzlCLFVBQVUsRUFBRSxpQkFBaUI7WUFDN0IsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGlFQUFpRSxDQUFDO1lBQzVHLFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILGVBQWU7UUFDZixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4QyxRQUFRO1lBQ1IsZUFBZSxFQUFFLGFBQWE7WUFDOUIsVUFBVSxFQUFFLGdCQUFnQjtZQUM1QixhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsK0VBQStFLENBQUM7WUFDMUgsV0FBVyxFQUFFLE9BQU87U0FDckIsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbkQsUUFBUTtZQUNSLGVBQWUsRUFBRSxhQUFhO1lBQzlCLFVBQVUsRUFBRSxxQkFBcUI7WUFDakMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGlGQUFpRixDQUFDO1lBQzVILFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbkQsUUFBUTtZQUNSLGVBQWUsRUFBRSxhQUFhO1lBQzlCLFVBQVUsRUFBRSxpQkFBaUI7WUFDN0IsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGtFQUFrRSxDQUFDO1lBQzdHLFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILG1CQUFtQjtRQUNuQixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2pELFFBQVE7WUFDUixlQUFlLEVBQUUsc0JBQXNCO1lBQ3ZDLFVBQVUsRUFBRSxnQkFBZ0I7WUFDNUIsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGdFQUFnRSxDQUFDO1lBQzNHLFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILHdCQUF3QjtRQUN4QixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ2hELFFBQVE7WUFDUixlQUFlLEVBQUUsc0JBQXNCO1lBQ3ZDLFVBQVUsRUFBRSxhQUFhO1lBQ3pCLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyw0RUFBNEUsQ0FBQztZQUN2SCxXQUFXLEVBQUUsR0FBRztTQUNqQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8seUJBQXlCLENBQUMsS0FBbUM7UUFDbkUsOENBQThDO1FBQzlDLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUMzRixZQUFZLEVBQUUsb0NBQW9DLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDckUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsNkJBQTZCO1lBQ3RDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FvRTVCLENBQUM7WUFDRixXQUFXLEVBQUU7Z0JBQ1gsT0FBTyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRzthQUM5QjtZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7U0FDaEIsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLDJCQUEyQixDQUFDLGVBQWUsQ0FDekMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFLENBQUMsMEJBQTBCLENBQUM7WUFDckMsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FDSCxDQUFDO1FBRUYsZ0RBQWdEO1FBQ2hELE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDNUQsUUFBUSxFQUFFLG9DQUFvQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ2pFLFdBQVcsRUFBRSw4Q0FBOEM7WUFDM0QsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3hELENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztRQUV4RSxpREFBaUQ7UUFDakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUM1RSxTQUFTLEVBQUUsa0NBQWtDLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDaEUsZ0JBQWdCLEVBQUUsaUNBQWlDO1lBQ25ELE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSx1QkFBdUI7Z0JBQ2xDLFVBQVUsRUFBRSxvQkFBb0I7Z0JBQ2hDLFNBQVMsRUFBRSxTQUFTO2FBQ3JCLENBQUM7WUFDRixTQUFTLEVBQUUsR0FBRyxFQUFFLG1CQUFtQjtZQUNuQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUI7U0FDdEUsQ0FBQyxDQUFDO1FBQ0gsY0FBYyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRU8sYUFBYTtRQUNuQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRO1lBQy9CLFdBQVcsRUFBRSwwQkFBMEI7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFdBQVcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxrREFBa0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxvQkFBb0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDeEssV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRO1lBQzlCLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcGtCRCwwREFva0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2hcIjtcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zXCI7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnNcIjtcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbG9nc1wiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1ldmVudHNcIjtcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0c1wiO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWNzXCI7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1yZHNcIjtcbmltcG9ydCAqIGFzIGVsYXN0aWNhY2hlIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2FjaGVcIjtcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1vbml0b3JpbmdBbGVydGluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVjc0NsdXN0ZXI6IGVjcy5DbHVzdGVyO1xuICBlY3NTZXJ2aWNlOiBlY3MuRmFyZ2F0ZVNlcnZpY2U7XG4gIGRhdGFiYXNlOiByZHMuRGF0YWJhc2VDbHVzdGVyO1xuICByZWRpczogZWxhc3RpY2FjaGUuQ2ZuQ2FjaGVDbHVzdGVyO1xuICBhcGlHYXRld2F5OiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIGxhbWJkYUZ1bmN0aW9uczogbGFtYmRhLkZ1bmN0aW9uW107XG4gIGFsZXJ0RW1haWw/OiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nQWxlcnRpbmdTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBhbGVydFRvcGljOiBzbnMuVG9waWM7XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBwdWJsaWMgcmVhZG9ubHkgY29zdEFsYXJtOiBjbG91ZHdhdGNoLkFsYXJtO1xuICBwdWJsaWMgcmVhZG9ubHkgcGVyZm9ybWFuY2VBbGFybXM6IGNsb3Vkd2F0Y2guQWxhcm1bXTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ0FsZXJ0aW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBhbGVydHNcbiAgICB0aGlzLmFsZXJ0VG9waWMgPSB0aGlzLmNyZWF0ZUFsZXJ0VG9waWMocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggZGFzaGJvYXJkXG4gICAgdGhpcy5kYXNoYm9hcmQgPSB0aGlzLmNyZWF0ZURhc2hib2FyZChwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgcGVyZm9ybWFuY2UgYWxhcm1zXG4gICAgdGhpcy5wZXJmb3JtYW5jZUFsYXJtcyA9IHRoaXMuY3JlYXRlUGVyZm9ybWFuY2VBbGFybXMocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGNvc3QgbW9uaXRvcmluZyBhbGFybVxuICAgIHRoaXMuY29zdEFsYXJtID0gdGhpcy5jcmVhdGVDb3N0QWxhcm0ocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBtZXRyaWNzXG4gICAgdGhpcy5jcmVhdGVDdXN0b21NZXRyaWNzKHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBzeW50aGV0aWMgbW9uaXRvcmluZ1xuICAgIHRoaXMuY3JlYXRlU3ludGhldGljTW9uaXRvcmluZyhwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgb3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBbGVydFRvcGljKHByb3BzOiBNb25pdG9yaW5nQWxlcnRpbmdTdGFja1Byb3BzKTogc25zLlRvcGljIHtcbiAgICBjb25zdCB0b3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgXCJBbGVydFRvcGljXCIsIHtcbiAgICAgIHRvcGljTmFtZTogYG1pbmRzZGItcmFnLWFsZXJ0cy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkaXNwbGF5TmFtZTogXCJNaW5kc0RCIFJBRyBBc3Npc3RhbnQgQWxlcnRzXCIsXG4gICAgICBmaWZvOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBlbWFpbCBzdWJzY3JpcHRpb24gaWYgcHJvdmlkZWRcbiAgICBpZiAocHJvcHMuYWxlcnRFbWFpbCkge1xuICAgICAgdG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzbnNTdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLmFsZXJ0RW1haWwpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgU01TIHN1YnNjcmlwdGlvbiBmb3IgY3JpdGljYWwgYWxlcnRzICh3b3VsZCBuZWVkIHBob25lIG51bWJlcilcbiAgICAvLyB0b3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuU21zU3Vic2NyaXB0aW9uKCcrMTIzNDU2Nzg5MCcpKTtcblxuICAgIHJldHVybiB0b3BpYztcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRGFzaGJvYXJkKHByb3BzOiBNb25pdG9yaW5nQWxlcnRpbmdTdGFja1Byb3BzKTogY2xvdWR3YXRjaC5EYXNoYm9hcmQge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCBcIk1pbmRzREJSQUdEYXNoYm9hcmRcIiwge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYE1pbmRzREItUkFHLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlZmF1bHRJbnRlcnZhbDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgbWV0cmljc1xuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogXCJBUEkgR2F0ZXdheSBSZXF1ZXN0c1wiLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvQXBpR2F0ZXdheVwiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJDb3VudFwiLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBBcGlOYW1lOiBwcm9wcy5hcGlHYXRld2F5LnJlc3RBcGlOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9BcGlHYXRld2F5XCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkxhdGVuY3lcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgQXBpTmFtZTogcHJvcHMuYXBpR2F0ZXdheS5yZXN0QXBpTmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiQVBJIEdhdGV3YXkgRXJyb3JzXCIsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9BcGlHYXRld2F5XCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIjRYWEVycm9yXCIsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgIEFwaU5hbWU6IHByb3BzLmFwaUdhdGV3YXkucmVzdEFwaU5hbWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0FwaUdhdGV3YXlcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiNVhYRXJyb3JcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgQXBpTmFtZTogcHJvcHMuYXBpR2F0ZXdheS5yZXN0QXBpTmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEVDUyBTZXJ2aWNlIG1ldHJpY3NcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiRUNTIFNlcnZpY2UgTWV0cmljc1wiLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvRUNTXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkNQVVV0aWxpemF0aW9uXCIsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgIFNlcnZpY2VOYW1lOiBwcm9wcy5lY3NTZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgICAgICAgICBDbHVzdGVyTmFtZTogcHJvcHMuZWNzQ2x1c3Rlci5jbHVzdGVyTmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0VDU1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJNZW1vcnlVdGlsaXphdGlvblwiLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBTZXJ2aWNlTmFtZTogcHJvcHMuZWNzU2VydmljZS5zZXJ2aWNlTmFtZSxcbiAgICAgICAgICAgICAgQ2x1c3Rlck5hbWU6IHByb3BzLmVjc0NsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9FQ1NcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiUnVubmluZ1Rhc2tDb3VudFwiLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBTZXJ2aWNlTmFtZTogcHJvcHMuZWNzU2VydmljZS5zZXJ2aWNlTmFtZSxcbiAgICAgICAgICAgICAgQ2x1c3Rlck5hbWU6IHByb3BzLmVjc0NsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRGF0YWJhc2UgbWV0cmljc1xuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogXCJEYXRhYmFzZSBQZXJmb3JtYW5jZVwiLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvUkRTXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkNQVVV0aWxpemF0aW9uXCIsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgIERCQ2x1c3RlcklkZW50aWZpZXI6IHByb3BzLmRhdGFiYXNlLmNsdXN0ZXJJZGVudGlmaWVyLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvUkRTXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkRhdGFiYXNlQ29ubmVjdGlvbnNcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgREJDbHVzdGVySWRlbnRpZmllcjogcHJvcHMuZGF0YWJhc2UuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9SRFNcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiUmVhZExhdGVuY3lcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgREJDbHVzdGVySWRlbnRpZmllcjogcHJvcHMuZGF0YWJhc2UuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9SRFNcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiV3JpdGVMYXRlbmN5XCIsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgIERCQ2x1c3RlcklkZW50aWZpZXI6IHByb3BzLmRhdGFiYXNlLmNsdXN0ZXJJZGVudGlmaWVyLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBtZXRyaWNzXG4gICAgaWYgKHByb3BzLmxhbWJkYUZ1bmN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsYW1iZGFNZXRyaWNzID0gcHJvcHMubGFtYmRhRnVuY3Rpb25zLm1hcChmdW5jID0+IFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvTGFtYmRhXCIsXG4gICAgICAgICAgbWV0cmljTmFtZTogXCJEdXJhdGlvblwiLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogZnVuYy5mdW5jdGlvbk5hbWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogXCJMYW1iZGEgRnVuY3Rpb24gUGVyZm9ybWFuY2VcIixcbiAgICAgICAgICBsZWZ0OiBsYW1iZGFNZXRyaWNzLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ3VzdG9tIGJ1c2luZXNzIG1ldHJpY3NcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiQnVzaW5lc3MgTWV0cmljc1wiLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJNaW5kc0RCL1JBR1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJTZXNzaW9uc1Blck1pbnV0ZVwiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiTWluZHNEQi9SQUdcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiQ29zdFBlclNlc3Npb25cIixcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJNaW5kc0RCL1JBR1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJTdWNjZXNzZnVsQ2hlY2tvdXRzXCIsXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJNaW5kc0RCL1JBR1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJGYWlsZWRDaGVja291dHNcIixcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBcIkNvc3QgUGVyIFNlc3Npb24gKFRhcmdldDogPCQwLjA1KVwiLFxuICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJNaW5kc0RCL1JBR1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJDb3N0UGVyU2Vzc2lvblwiLFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiQWN0aXZlIFNlc3Npb25zXCIsXG4gICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHXCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkFjdGl2ZVNlc3Npb25zXCIsXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiTWF4aW11bVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHJldHVybiBkYXNoYm9hcmQ7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVBlcmZvcm1hbmNlQWxhcm1zKHByb3BzOiBNb25pdG9yaW5nQWxlcnRpbmdTdGFja1Byb3BzKTogY2xvdWR3YXRjaC5BbGFybVtdIHtcbiAgICBjb25zdCBhbGFybXM6IGNsb3Vkd2F0Y2guQWxhcm1bXSA9IFtdO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgaGlnaCBsYXRlbmN5IGFsYXJtXG4gICAgY29uc3QgYXBpTGF0ZW5jeUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJBcGlMYXRlbmN5QWxhcm1cIiwge1xuICAgICAgYWxhcm1OYW1lOiBgbWluZHNkYi1yYWctYXBpLWxhdGVuY3ktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJBUEkgR2F0ZXdheSBsYXRlbmN5IGlzIHRvbyBoaWdoXCIsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJBV1MvQXBpR2F0ZXdheVwiLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkxhdGVuY3lcIixcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IHByb3BzLmFwaUdhdGV3YXkucmVzdEFwaU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNTAwMCwgLy8gNSBzZWNvbmRzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuICAgIGFwaUxhdGVuY3lBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYykpO1xuICAgIGFsYXJtcy5wdXNoKGFwaUxhdGVuY3lBbGFybSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBlcnJvciByYXRlIGFsYXJtXG4gICAgY29uc3QgYXBpRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiQXBpRXJyb3JBbGFybVwiLCB7XG4gICAgICBhbGFybU5hbWU6IGBtaW5kc2RiLXJhZy1hcGktZXJyb3JzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiQVBJIEdhdGV3YXkgZXJyb3IgcmF0ZSBpcyB0b28gaGlnaFwiLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NYXRoRXhwcmVzc2lvbih7XG4gICAgICAgIGV4cHJlc3Npb246IFwiKG0xICsgbTIpIC8gbTMgKiAxMDBcIixcbiAgICAgICAgdXNpbmdNZXRyaWNzOiB7XG4gICAgICAgICAgbTE6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0FwaUdhdGV3YXlcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiNFhYRXJyb3JcIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgQXBpTmFtZTogcHJvcHMuYXBpR2F0ZXdheS5yZXN0QXBpTmFtZSB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG0yOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9BcGlHYXRld2F5XCIsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIjVYWEVycm9yXCIsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEFwaU5hbWU6IHByb3BzLmFwaUdhdGV3YXkucmVzdEFwaU5hbWUgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJTdW1cIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtMzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvQXBpR2F0ZXdheVwiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJDb3VudFwiLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBBcGlOYW1lOiBwcm9wcy5hcGlHYXRld2F5LnJlc3RBcGlOYW1lIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiU3VtXCIsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNSwgLy8gNSUgZXJyb3IgcmF0ZVxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgfSk7XG4gICAgYXBpRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYykpO1xuICAgIGFsYXJtcy5wdXNoKGFwaUVycm9yQWxhcm0pO1xuXG4gICAgLy8gRUNTIENQVSB1dGlsaXphdGlvbiBhbGFybVxuICAgIGNvbnN0IGVjc0NwdUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJFY3NDcHVBbGFybVwiLCB7XG4gICAgICBhbGFybU5hbWU6IGBtaW5kc2RiLXJhZy1lY3MtY3B1LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiRUNTIHNlcnZpY2UgQ1BVIHV0aWxpemF0aW9uIGlzIHRvbyBoaWdoXCIsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJBV1MvRUNTXCIsXG4gICAgICAgIG1ldHJpY05hbWU6IFwiQ1BVVXRpbGl6YXRpb25cIixcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIFNlcnZpY2VOYW1lOiBwcm9wcy5lY3NTZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgICAgIENsdXN0ZXJOYW1lOiBwcm9wcy5lY3NDbHVzdGVyLmNsdXN0ZXJOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDgwLCAvLyA4MCUgQ1BVXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICB9KTtcbiAgICBlY3NDcHVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYykpO1xuICAgIGFsYXJtcy5wdXNoKGVjc0NwdUFsYXJtKTtcblxuICAgIC8vIERhdGFiYXNlIGNvbm5lY3Rpb24gYWxhcm1cbiAgICBjb25zdCBkYkNvbm5lY3Rpb25BbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiRGJDb25uZWN0aW9uQWxhcm1cIiwge1xuICAgICAgYWxhcm1OYW1lOiBgbWluZHNkYi1yYWctZGItY29ubmVjdGlvbnMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJEYXRhYmFzZSBjb25uZWN0aW9uIGNvdW50IGlzIHRvbyBoaWdoXCIsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJBV1MvUkRTXCIsXG4gICAgICAgIG1ldHJpY05hbWU6IFwiRGF0YWJhc2VDb25uZWN0aW9uc1wiLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgREJDbHVzdGVySWRlbnRpZmllcjogcHJvcHMuZGF0YWJhc2UuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogODAsIC8vIDgwJSBvZiBtYXggY29ubmVjdGlvbnNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgIH0pO1xuICAgIGRiQ29ubmVjdGlvbkFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKSk7XG4gICAgYWxhcm1zLnB1c2goZGJDb25uZWN0aW9uQWxhcm0pO1xuXG4gICAgcmV0dXJuIGFsYXJtcztcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ29zdEFsYXJtKHByb3BzOiBNb25pdG9yaW5nQWxlcnRpbmdTdGFja1Byb3BzKTogY2xvdWR3YXRjaC5BbGFybSB7XG4gICAgLy8gQ29zdCBwZXIgc2Vzc2lvbiBhbGFybVxuICAgIGNvbnN0IGNvc3RBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiQ29zdFBlclNlc3Npb25BbGFybVwiLCB7XG4gICAgICBhbGFybU5hbWU6IGBtaW5kc2RiLXJhZy1jb3N0LXBlci1zZXNzaW9uLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiQ29zdCBwZXIgc2Vzc2lvbiBleGNlZWRzIHRhcmdldCBvZiAkMC4wNVwiLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IFwiTWluZHNEQi9SQUdcIixcbiAgICAgICAgbWV0cmljTmFtZTogXCJDb3N0UGVyU2Vzc2lvblwiLFxuICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDAuMDUsIC8vICQwLjA1IHRhcmdldFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICBjb3N0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpKTtcblxuICAgIHJldHVybiBjb3N0QWxhcm07XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUN1c3RvbU1ldHJpY3MocHJvcHM6IE1vbml0b3JpbmdBbGVydGluZ1N0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICAvLyBDcmVhdGUgY3VzdG9tIG1ldHJpYyBmaWx0ZXJzIGZvciBhcHBsaWNhdGlvbiBsb2dzXG4gICAgY29uc3QgbG9nR3JvdXAgPSBsb2dzLkxvZ0dyb3VwLmZyb21Mb2dHcm91cE5hbWUoXG4gICAgICB0aGlzLFxuICAgICAgXCJBcHBsaWNhdGlvbkxvZ0dyb3VwXCIsXG4gICAgICBgL2F3cy9lY3MvJHtwcm9wcy5lY3NTZXJ2aWNlLnNlcnZpY2VOYW1lfWBcbiAgICApO1xuXG4gICAgLy8gU2Vzc2lvbiBtZXRyaWNzXG4gICAgbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsIFwiU2Vzc2lvblN0YXJ0TWV0cmljXCIsIHtcbiAgICAgIGxvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHXCIsXG4gICAgICBtZXRyaWNOYW1lOiBcIlNlc3Npb25zU3RhcnRlZFwiLFxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmxpdGVyYWwoJ1t0aW1lc3RhbXAsIHJlcXVlc3RJZCwgbGV2ZWw9XCJpbmZvXCIsIG1lc3NhZ2U9XCJTZXNzaW9uIHN0YXJ0ZWRcIl0nKSxcbiAgICAgIG1ldHJpY1ZhbHVlOiBcIjFcIixcbiAgICB9KTtcblxuICAgIC8vIENvc3QgbWV0cmljc1xuICAgIG5ldyBsb2dzLk1ldHJpY0ZpbHRlcih0aGlzLCBcIkNvc3RNZXRyaWNcIiwge1xuICAgICAgbG9nR3JvdXAsXG4gICAgICBtZXRyaWNOYW1lc3BhY2U6IFwiTWluZHNEQi9SQUdcIixcbiAgICAgIG1ldHJpY05hbWU6IFwiQ29zdFBlclNlc3Npb25cIixcbiAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5saXRlcmFsKCdbdGltZXN0YW1wLCByZXF1ZXN0SWQsIGxldmVsPVwiaW5mb1wiLCBtZXNzYWdlPVwiU2Vzc2lvbiBjb3N0IGNhbGN1bGF0ZWRcIiwgY29zdF0nKSxcbiAgICAgIG1ldHJpY1ZhbHVlOiBcIiRjb3N0XCIsXG4gICAgfSk7XG5cbiAgICAvLyBDaGVja291dCBtZXRyaWNzXG4gICAgbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsIFwiQ2hlY2tvdXRTdWNjZXNzTWV0cmljXCIsIHtcbiAgICAgIGxvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHXCIsXG4gICAgICBtZXRyaWNOYW1lOiBcIlN1Y2Nlc3NmdWxDaGVja291dHNcIixcbiAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5saXRlcmFsKCdbdGltZXN0YW1wLCByZXF1ZXN0SWQsIGxldmVsPVwiaW5mb1wiLCBtZXNzYWdlPVwiQ2hlY2tvdXQgY29tcGxldGVkIHN1Y2Nlc3NmdWxseVwiXScpLFxuICAgICAgbWV0cmljVmFsdWU6IFwiMVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsIFwiQ2hlY2tvdXRGYWlsdXJlTWV0cmljXCIsIHtcbiAgICAgIGxvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHXCIsXG4gICAgICBtZXRyaWNOYW1lOiBcIkZhaWxlZENoZWNrb3V0c1wiLFxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmxpdGVyYWwoJ1t0aW1lc3RhbXAsIHJlcXVlc3RJZCwgbGV2ZWw9XCJlcnJvclwiLCBtZXNzYWdlPVwiQ2hlY2tvdXQgZmFpbGVkXCJdJyksXG4gICAgICBtZXRyaWNWYWx1ZTogXCIxXCIsXG4gICAgfSk7XG5cbiAgICAvLyBTZWN1cml0eSBtZXRyaWNzXG4gICAgbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsIFwiU2VjdXJpdHlFdmVudE1ldHJpY1wiLCB7XG4gICAgICBsb2dHcm91cCxcbiAgICAgIG1ldHJpY05hbWVzcGFjZTogXCJNaW5kc0RCL1JBRy9TZWN1cml0eVwiLFxuICAgICAgbWV0cmljTmFtZTogXCJTZWN1cml0eUV2ZW50c1wiLFxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmxpdGVyYWwoJ1t0aW1lc3RhbXAsIHJlcXVlc3RJZCwgbGV2ZWw9XCJ3YXJuXCIsIG1lc3NhZ2U9XCJTRUNVUklUWV9FVkVOVFwiXScpLFxuICAgICAgbWV0cmljVmFsdWU6IFwiMVwiLFxuICAgIH0pO1xuXG4gICAgLy8gUElJIGRldGVjdGlvbiBtZXRyaWNzXG4gICAgbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsIFwiUElJRGV0ZWN0aW9uTWV0cmljXCIsIHtcbiAgICAgIGxvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHL1NlY3VyaXR5XCIsXG4gICAgICBtZXRyaWNOYW1lOiBcIlBJSURldGVjdGVkXCIsXG4gICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4ubGl0ZXJhbCgnW3RpbWVzdGFtcCwgcmVxdWVzdElkLCBsZXZlbD1cImluZm9cIiwgbWVzc2FnZT1cIlBJSSBkZXRlY3RlZCBhbmQgdG9rZW5pemVkXCJdJyksXG4gICAgICBtZXRyaWNWYWx1ZTogXCIxXCIsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVN5bnRoZXRpY01vbml0b3JpbmcocHJvcHM6IE1vbml0b3JpbmdBbGVydGluZ1N0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICAvLyBDcmVhdGUgc3ludGhldGljIG1vbml0b3JpbmcgTGFtYmRhIGZ1bmN0aW9uXG4gICAgY29uc3Qgc3ludGhldGljTW9uaXRvcmluZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIlN5bnRoZXRpY01vbml0b3JpbmdGdW5jdGlvblwiLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBtaW5kc2RiLXJhZy1zeW50aGV0aWMtbW9uaXRvcmluZy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6IFwic3ludGhldGljTW9uaXRvcmluZy5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGNsb3Vkd2F0Y2ggPSBuZXcgQVdTLkNsb3VkV2F0Y2goKTtcblxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCBhcGlVcmwgPSBwcm9jZXNzLmVudi5BUElfVVJMO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFRlc3QgaGVhbHRoIGVuZHBvaW50XG4gICAgICAgICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGF3YWl0IG1ha2VSZXF1ZXN0KGFwaVVybCArICcvaGVhbHRoJyk7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTZW5kIG1ldHJpY3MgdG8gQ2xvdWRXYXRjaFxuICAgICAgICAgICAgYXdhaXQgY2xvdWR3YXRjaC5wdXRNZXRyaWNEYXRhKHtcbiAgICAgICAgICAgICAgTmFtZXNwYWNlOiAnTWluZHNEQi9SQUcvU3ludGhldGljJyxcbiAgICAgICAgICAgICAgTWV0cmljRGF0YTogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdIZWFsdGhDaGVja1Jlc3BvbnNlVGltZScsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogcmVzcG9uc2VUaW1lLFxuICAgICAgICAgICAgICAgICAgVW5pdDogJ01pbGxpc2Vjb25kcycsXG4gICAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdIZWFsdGhDaGVja1N1Y2Nlc3MnLFxuICAgICAgICAgICAgICAgICAgVmFsdWU6IGhlYWx0aENoZWNrLnN0YXR1c0NvZGUgPT09IDIwMCA/IDEgOiAwLFxuICAgICAgICAgICAgICAgICAgVW5pdDogJ0NvdW50JyxcbiAgICAgICAgICAgICAgICAgIFRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnU3ludGhldGljIG1vbml0b3JpbmcgY29tcGxldGVkJyxcbiAgICAgICAgICAgICAgICByZXNwb25zZVRpbWUsXG4gICAgICAgICAgICAgICAgaGVhbHRoU3RhdHVzOiBoZWFsdGhDaGVjay5zdGF0dXNDb2RlXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAvLyBTZW5kIGZhaWx1cmUgbWV0cmljXG4gICAgICAgICAgICBhd2FpdCBjbG91ZHdhdGNoLnB1dE1ldHJpY0RhdGEoe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdNaW5kc0RCL1JBRy9TeW50aGV0aWMnLFxuICAgICAgICAgICAgICBNZXRyaWNEYXRhOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ0hlYWx0aENoZWNrU3VjY2VzcycsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogMCxcbiAgICAgICAgICAgICAgICAgIFVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gbWFrZVJlcXVlc3QodXJsKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcSA9IGh0dHBzLmdldCh1cmwsIChyZXMpID0+IHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN0YXR1c0NvZGU6IHJlcy5zdGF0dXNDb2RlIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXEub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgICAgICAgIHJlcS5zZXRUaW1lb3V0KDUwMDAsICgpID0+IHJlamVjdChuZXcgRXJyb3IoJ1RpbWVvdXQnKSkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFQSV9VUkw6IHByb3BzLmFwaUdhdGV3YXkudXJsLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkV2F0Y2ggcGVybWlzc2lvbnNcbiAgICBzeW50aGV0aWNNb25pdG9yaW5nRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcImNsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YVwiXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU2NoZWR1bGUgc3ludGhldGljIG1vbml0b3JpbmcgZXZlcnkgNSBtaW51dGVzXG4gICAgY29uc3QgcnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCBcIlN5bnRoZXRpY01vbml0b3JpbmdSdWxlXCIsIHtcbiAgICAgIHJ1bGVOYW1lOiBgbWluZHNkYi1yYWctc3ludGhldGljLW1vbml0b3JpbmctJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiVHJpZ2dlciBzeW50aGV0aWMgbW9uaXRvcmluZyBldmVyeSA1IG1pbnV0ZXNcIixcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24ubWludXRlcyg1KSksXG4gICAgfSk7XG5cbiAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzeW50aGV0aWNNb25pdG9yaW5nRnVuY3Rpb24pKTtcblxuICAgIC8vIENyZWF0ZSBhbGFybSBmb3Igc3ludGhldGljIG1vbml0b3JpbmcgZmFpbHVyZXNcbiAgICBjb25zdCBzeW50aGV0aWNBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiU3ludGhldGljTW9uaXRvcmluZ0FsYXJtXCIsIHtcbiAgICAgIGFsYXJtTmFtZTogYG1pbmRzZGItcmFnLXN5bnRoZXRpYy1mYWlsdXJlcy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiBcIlN5bnRoZXRpYyBtb25pdG9yaW5nIGlzIGZhaWxpbmdcIixcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiBcIk1pbmRzREIvUkFHL1N5bnRoZXRpY1wiLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkhlYWx0aENoZWNrU3VjY2Vzc1wiLFxuICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDAuOCwgLy8gODAlIHN1Y2Nlc3MgcmF0ZVxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkxFU1NfVEhBTl9USFJFU0hPTEQsXG4gICAgfSk7XG4gICAgc3ludGhldGljQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFsZXJ0VG9waWNBcm5cIiwge1xuICAgICAgdmFsdWU6IHRoaXMuYWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNOUyBUb3BpYyBBUk4gZm9yIGFsZXJ0c1wiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJEYXNoYm9hcmRVcmxcIiwge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7dGhpcy5kYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkNvc3RBbGFybUFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb3N0QWxhcm0uYWxhcm1Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3N0IHBlciBzZXNzaW9uIGFsYXJtIEFSTlwiLFxuICAgIH0pO1xuICB9XG59Il19