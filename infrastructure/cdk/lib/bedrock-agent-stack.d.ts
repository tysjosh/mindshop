import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
export interface BedrockAgentStackProps extends cdk.StackProps {
    kmsKey: kms.Key;
    mindsdbInternalEndpoint: string;
    environment: string;
}
export declare class BedrockAgentStack extends cdk.Stack {
    readonly sessionTable: dynamodb.Table;
    readonly bedrockAgent: bedrock.CfnAgent;
    readonly agentExecutionRole: iam.Role;
    constructor(scope: Construct, id: string, props: BedrockAgentStackProps);
    private createSessionTable;
    private createBedrockAgentRole;
    private createBedrockAgent;
    private createOutputs;
}
