import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
export interface AuthSecurityStackProps extends cdk.StackProps {
    kmsKey: kms.Key;
    environment: string;
}
export declare class AuthSecurityStack extends Construct {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly identityPool: cognito.CfnIdentityPool;
    readonly webAcl: wafv2.CfnWebACL;
    readonly apiGateway: apigateway.RestApi;
    readonly cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;
    constructor(scope: Construct, id: string, props: AuthSecurityStackProps);
    private createUserPool;
    private createPreTokenGenerationLambda;
    private createUserPoolClient;
    private createIdentityPool;
    private createWebAcl;
    private createApiGateway;
    private createCognitoAuthorizer;
    private createIAMRoles;
    private createOutputs;
}
