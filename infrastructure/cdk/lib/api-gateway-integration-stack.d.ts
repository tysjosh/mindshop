import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
export interface ApiGatewayIntegrationStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    apiGateway: apigateway.RestApi;
    cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;
    internalLoadBalancer: elbv2.ApplicationLoadBalancer;
    bedrockToolsFunction: lambda.Function;
    checkoutFunction: lambda.Function;
    environment: string;
}
export declare class ApiGatewayIntegrationStack extends Construct {
    vpcLink: apigateway.VpcLink;
    apiKey: apigateway.ApiKey;
    usagePlan: apigateway.UsagePlan;
    constructor(scope: Construct, id: string, props: ApiGatewayIntegrationStackProps);
    private createVpcLink;
    private createApiResources;
    private createChatEndpoints;
    private createDocumentEndpoints;
    private createBedrockAgentEndpoints;
    private createCheckoutEndpoints;
    private createSessionEndpoints;
    private createHealthEndpoint;
    private createAdminEndpoints;
    private createApiKeyAndUsagePlan;
    private createOutputs;
}
