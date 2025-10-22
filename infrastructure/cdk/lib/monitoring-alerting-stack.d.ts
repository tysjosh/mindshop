import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
export interface MonitoringAlertingStackProps extends cdk.StackProps {
    ecsCluster: ecs.Cluster;
    ecsService: ecs.FargateService;
    database: rds.DatabaseCluster;
    redis: elasticache.CfnCacheCluster;
    apiGateway: apigateway.RestApi;
    lambdaFunctions: lambda.Function[];
    alertEmail?: string;
    environment: string;
}
export declare class MonitoringAlertingStack extends Construct {
    readonly alertTopic: sns.Topic;
    readonly dashboard: cloudwatch.Dashboard;
    readonly costAlarm: cloudwatch.Alarm;
    readonly performanceAlarms: cloudwatch.Alarm[];
    constructor(scope: Construct, id: string, props: MonitoringAlertingStackProps);
    private createAlertTopic;
    private createDashboard;
    private createPerformanceAlarms;
    private createCostAlarm;
    private createCustomMetrics;
    private createSyntheticMonitoring;
    private createOutputs;
}
