import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
export interface MindsDBServiceProps {
    vpc: ec2.Vpc;
    cluster: ecs.Cluster;
    databaseEndpoint: string;
    databaseCredentialsSecret: secretsmanager.ISecret;
    kmsKeyArn: string;
    environment: string;
}
export declare class MindsDBService extends Construct {
    readonly service: ecs.FargateService;
    readonly loadBalancer: elbv2.ApplicationLoadBalancer;
    readonly targetGroup: elbv2.ApplicationTargetGroup;
    constructor(scope: Construct, id: string, props: MindsDBServiceProps);
    private createSecurityGroups;
    private createInternalALB;
    private createTaskDefinition;
    private createECSService;
    private createTargetGroup;
    private createListener;
    private configureAutoScaling;
    private createCloudWatchAlarms;
    getInternalEndpoint(): string;
}
