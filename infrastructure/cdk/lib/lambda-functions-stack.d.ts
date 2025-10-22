import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
export interface LambdaFunctionsStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    kmsKeyArn: string;
    sessionTableArn: string;
    mindsdbInternalEndpoint: string;
    environment: string;
}
export declare class LambdaFunctionsStack extends cdk.Stack {
    readonly bedrockToolsFunction: lambda.Function;
    readonly checkoutFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: LambdaFunctionsStackProps);
    private createLambdaExecutionRole;
    private createBedrockToolsFunction;
    private createCheckoutFunction;
    private createOutputs;
}
