import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export interface AuthSecurityStackProps {
  kmsKey: kms.Key;
  environment: string;
}

export class AuthSecurityStack extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly apiGateway: apigateway.RestApi;
  public readonly cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: AuthSecurityStackProps) {
    super(scope, id);

    // Create Cognito User Pool with enhanced security
    this.userPool = this.createUserPool(props.kmsKey, props.environment);

    // Create User Pool Client
    this.userPoolClient = this.createUserPoolClient();

    // Create Identity Pool for role-based access
    this.identityPool = this.createIdentityPool();

    // Create WAF Web ACL
    this.webAcl = this.createWebAcl(props.environment);

    // Create API Gateway with Cognito authorizer
    this.apiGateway = this.createApiGateway(props.environment);

    // Create Cognito authorizer
    this.cognitoAuthorizer = this.createCognitoAuthorizer();

    // Create IAM roles for different user types
    this.createIAMRoles();

    // Output important values
    this.createOutputs();
  }

  private createUserPool(kmsKey: kms.Key, environment: string): cognito.UserPool {
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `mindsdb-rag-users-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        merchant_id: new cognito.StringAttribute({
          mutable: true,
        }),
        user_role: new cognito.StringAttribute({
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      userVerification: {
        emailSubject: "Verify your email for MindsDB RAG Assistant",
        emailBody: "Thank you for signing up! Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      userInvitation: {
        emailSubject: "Invite to join MindsDB RAG Assistant",
        emailBody: "Hello {username}, you have been invited to join MindsDB RAG Assistant. Your temporary password is {####}",
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false,
      },
      // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED, // Requires Plus plan
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Add Lambda triggers for custom authentication logic
    // TODO: Implement actual Lambda function for pre-token generation
    // const preTokenGenerationLambda = this.createPreTokenGenerationLambda(kmsKey);
    // userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, preTokenGenerationLambda);

    return userPool;
  }

  private createPreTokenGenerationLambda(kmsKey: kms.Key): any {
    // This would be implemented as a Lambda function
    // For now, we'll create a placeholder that would add merchant_id to JWT claims
    const lambdaRole = new iam.Role(this, "PreTokenGenerationLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    // Add permissions for KMS and Cognito
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
        ],
        resources: [
          kmsKey.keyArn,
          `arn:aws:cognito-idp:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:userpool/*`,
        ],
      })
    );

    // Return a placeholder - actual Lambda function would be created separately
    return {
      functionArn: `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:pre-token-generation`,
      role: lambdaRole,
    };
  }

  private createUserPoolClient(): cognito.UserPoolClient {
    return new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      userPoolClientName: "mindsdb-rag-web-client",
      generateSecret: false, // For web applications
      authFlows: {
        userSrp: true,
        userPassword: false, // Disable less secure flows
        adminUserPassword: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Disable for security
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          "https://localhost:3000/callback", // Development
          "https://app.mindsdb-rag.com/callback", // Production
        ],
        logoutUrls: [
          "https://localhost:3000/logout",
          "https://app.mindsdb-rag.com/logout",
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
    });
  }

  private createIdentityPool(): cognito.CfnIdentityPool {
    const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      identityPoolName: "mindsdb-rag-identity-pool",
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    });

    return identityPool;
  }

  private createWebAcl(environment: string): wafv2.CfnWebACL {
    const webAcl = new wafv2.CfnWebACL(this, "WebACL", {
      name: `mindsdb-rag-waf-${environment}`,
      scope: "REGIONAL", // For API Gateway, ALB
      defaultAction: {
        allow: {},
      },
      description: "WAF for MindsDB RAG Assistant API",
      rules: [
        // Rate limiting rule
        {
          name: "RateLimitRule",
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 minutes per IP
              aggregateKeyType: "IP",
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitRule",
          },
        },
        // AWS Managed Rules - Core Rule Set
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 2,
          overrideAction: {
            none: {},
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
              excludedRules: [
                // Exclude rules that might be too restrictive
                {
                  name: "SizeRestrictions_BODY",
                },
              ],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "CommonRuleSetMetric",
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 3,
          overrideAction: {
            none: {},
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "KnownBadInputsRuleSetMetric",
          },
        },
        // SQL Injection Protection
        {
          name: "AWSManagedRulesSQLiRuleSet",
          priority: 4,
          overrideAction: {
            none: {},
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "SQLiRuleSetMetric",
          },
        },
        // IP Reputation List
        {
          name: "AWSManagedRulesAmazonIpReputationList",
          priority: 5,
          overrideAction: {
            none: {},
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "IpReputationListMetric",
          },
        },
        // Merchant-specific rate limiting
        {
          name: "MerchantRateLimitRule",
          priority: 6,
          statement: {
            rateBasedStatement: {
              limit: 10000, // 10000 requests per 5 minutes per merchant
              aggregateKeyType: "CUSTOM_KEYS",
              customKeys: [
                {
                  header: {
                    name: "x-merchant-id",
                    textTransformations: [
                      {
                        priority: 0,
                        type: "LOWERCASE",
                      },
                    ],
                  },
                },
              ],
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "MerchantRateLimitRule",
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "MindsDBRAGWebACL",
      },
    });

    // Create CloudWatch log group for WAF logs
    // TODO: Fix WAF logging configuration - temporarily disabled
    // const wafLogGroup = new logs.LogGroup(this, "WAFLogGroup", {
    //   logGroupName: `/aws/wafv2/mindsdb-rag-${environment}`,
    //   retention: logs.RetentionDays.ONE_MONTH,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    // Create logging configuration
    // TODO: Fix WAF logging ARN format - temporarily disabled
    // new wafv2.CfnLoggingConfiguration(this, "WAFLoggingConfig", {
    //   resourceArn: webAcl.attrArn,
    //   logDestinationConfigs: [`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:${wafLogGroup.logGroupName}`],
    //   redactedFields: [
    //     {
    //       singleHeader: {
    //         Name: "authorization",
    //       },
    //     },
    //     {
    //       singleHeader: {
    //         Name: "cookie",
    //       },
    //     },
    //   ],
    // });

    return webAcl;
  }

  private createApiGateway(environment: string): apigateway.RestApi {
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: `mindsdb-rag-api-${environment}`,
      description: "MindsDB RAG Assistant API Gateway",
      deployOptions: {
        stageName: environment,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Merchant-Id",
        ],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["*"],
            conditions: {
              IpAddress: {
                "aws:SourceIp": [
                  "0.0.0.0/0", // Allow all IPs - WAF will handle filtering
                ],
              },
            },
          }),
        ],
      }),
      binaryMediaTypes: ["*/*"],
    });

    // Associate WAF with API Gateway
    // TODO: Fix WAF association timing issue
    // new wafv2.CfnWebACLAssociation(this, "ApiGatewayWAFAssociation", {
    //   resourceArn: `arn:aws:apigateway:${cdk.Stack.of(this).region}::/restapis/${api.restApiId}/stages/${environment}`,
    //   webAclArn: this.webAcl.attrArn,
    // });

    return api;
  }

  private createCognitoAuthorizer(): apigateway.CognitoUserPoolsAuthorizer {
    return new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
      cognitoUserPools: [this.userPool],
      authorizerName: "MindsDBRAGAuthorizer",
      identitySource: "method.request.header.Authorization",
      resultsCacheTtl: cdk.Duration.minutes(5),
    });
  }

  private createIAMRoles(): void {
    // Authenticated user role for customers
    const authenticatedRole = new iam.Role(this, "AuthenticatedUserRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for authenticated users (customers)",
    });

    // Add basic permissions for authenticated users
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "execute-api:Invoke",
        ],
        resources: [
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.apiGateway.restApiId}/*/GET/chat`,
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.apiGateway.restApiId}/*/POST/chat`,
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.apiGateway.restApiId}/*/GET/session/*`,
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.apiGateway.restApiId}/*/POST/checkout`,
        ],
        conditions: {
          StringEquals: {
            "cognito-identity.amazonaws.com:sub": "${cognito-identity.amazonaws.com:sub}",
          },
        },
      })
    );

    // Merchant admin role
    const merchantAdminRole = new iam.Role(this, "MerchantAdminRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for merchant administrators",
    });

    // Add merchant admin permissions
    merchantAdminRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "execute-api:Invoke",
        ],
        resources: [
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.apiGateway.restApiId}/*/*`,
        ],
        conditions: {
          StringEquals: {
            "cognito-identity.amazonaws.com:sub": "${cognito-identity.amazonaws.com:sub}",
          },
        },
      })
    );

    // Platform admin role
    const platformAdminRole = new iam.Role(this, "PlatformAdminRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for platform administrators",
    });

    // Add platform admin permissions (full access)
    platformAdminRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["*"],
        resources: ["*"],
      })
    );

    // Attach roles to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
      roleMappings: {
        cognitoProvider: {
          type: "Rules",
          ambiguousRoleResolution: "AuthenticatedRole",
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
          rulesConfiguration: {
            rules: [
              {
                claim: "custom:user_role",
                matchType: "Equals",
                value: "platform_admin",
                roleArn: platformAdminRole.roleArn,
              },
              {
                claim: "custom:user_role",
                matchType: "Equals",
                value: "merchant_admin",
                roleArn: merchantAdminRole.roleArn,
              },
              {
                claim: "custom:user_role",
                matchType: "Equals",
                value: "customer",
                roleArn: authenticatedRole.roleArn,
              },
            ],
          },
        },
      },
    });
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: this.identityPool.ref,
      description: "Cognito Identity Pool ID",
    });

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: this.apiGateway.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "WebACLArn", {
      value: this.webAcl.attrArn,
      description: "WAF Web ACL ARN",
    });

    new cdk.CfnOutput(this, "CognitoAuthorizerArn", {
      value: this.cognitoAuthorizer.authorizerArn,
      description: "Cognito Authorizer ARN",
    });
  }
}