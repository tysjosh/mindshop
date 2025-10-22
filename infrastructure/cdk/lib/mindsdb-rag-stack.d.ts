import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as kms from "aws-cdk-lib/aws-kms";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { MindsDBService } from "./mindsdb-service";
import { BedrockAgentStack } from "./bedrock-agent-stack";
import { LambdaFunctionsStack } from "./lambda-functions-stack";
import { AuthSecurityStack } from "./auth-security-stack";
import { ApiGatewayIntegrationStack } from "./api-gateway-integration-stack";
import { MonitoringAlertingStack } from "./monitoring-alerting-stack";
export interface MindsDBRAGStackProps extends cdk.StackProps {
    stackName: string;
    environment: string;
}
export declare class MindsDBRAGStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    readonly cluster: ecs.Cluster;
    readonly database: rds.DatabaseCluster;
    readonly redis: elasticache.CfnCacheCluster;
    readonly kmsKey: kms.Key;
    readonly mindsdbService: MindsDBService;
    readonly bedrockAgentStack: BedrockAgentStack;
    readonly lambdaFunctionsStack: LambdaFunctionsStack;
    readonly authSecurityStack: AuthSecurityStack;
    readonly apiGatewayIntegrationStack: ApiGatewayIntegrationStack;
    readonly monitoringAlertingStack: MonitoringAlertingStack;
    readonly documentsBucket: s3.Bucket;
    readonly modelArtifactsBucket: s3.Bucket;
    readonly auditLogsBucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: MindsDBRAGStackProps);
    private createVpcEndpoints;
    private createSecurityGroups;
    private createAuroraCluster;
    private createRedisCluster;
    private createECSCluster;
    private createS3Buckets;
    private createIAMRoles;
    private createSecrets;
    private createOutputs;
}
