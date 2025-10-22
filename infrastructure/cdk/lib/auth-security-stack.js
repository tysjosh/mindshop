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
exports.AuthSecurityStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const wafv2 = __importStar(require("aws-cdk-lib/aws-wafv2"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class AuthSecurityStack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
    createUserPool(kmsKey, environment) {
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
                emailBody: "You have been invited to join MindsDB RAG Assistant. Your temporary password is {####}",
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
    createPreTokenGenerationLambda(kmsKey) {
        // This would be implemented as a Lambda function
        // For now, we'll create a placeholder that would add merchant_id to JWT claims
        const lambdaRole = new iam.Role(this, "PreTokenGenerationLambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
            ],
        });
        // Add permissions for KMS and Cognito
        lambdaRole.addToPolicy(new iam.PolicyStatement({
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
        }));
        // Return a placeholder - actual Lambda function would be created separately
        return {
            functionArn: `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:pre-token-generation`,
            role: lambdaRole,
        };
    }
    createUserPoolClient() {
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
    createIdentityPool() {
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
    createWebAcl(environment) {
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
        const wafLogGroup = new logs.LogGroup(this, "WAFLogGroup", {
            logGroupName: `/aws/wafv2/mindsdb-rag-${environment}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create logging configuration
        new wafv2.CfnLoggingConfiguration(this, "WAFLoggingConfig", {
            resourceArn: webAcl.attrArn,
            logDestinationConfigs: [wafLogGroup.logGroupArn],
            redactedFields: [
                {
                    singleHeader: {
                        name: "authorization",
                    },
                },
                {
                    singleHeader: {
                        name: "cookie",
                    },
                },
            ],
        });
        return webAcl;
    }
    createApiGateway(environment) {
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
        new wafv2.CfnWebACLAssociation(this, "ApiGatewayWAFAssociation", {
            resourceArn: `arn:aws:apigateway:${cdk.Stack.of(this).region}::/restapis/${api.restApiId}/stages/${environment}`,
            webAclArn: this.webAcl.attrArn,
        });
        return api;
    }
    createCognitoAuthorizer() {
        return new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
            cognitoUserPools: [this.userPool],
            authorizerName: "MindsDBRAGAuthorizer",
            identitySource: "method.request.header.Authorization",
            resultsCacheTtl: cdk.Duration.minutes(5),
        });
    }
    createIAMRoles() {
        // Authenticated user role for customers
        const authenticatedRole = new iam.Role(this, "AuthenticatedUserRole", {
            assumedBy: new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated",
                },
            }, "sts:AssumeRoleWithWebIdentity"),
            description: "Role for authenticated users (customers)",
        });
        // Add basic permissions for authenticated users
        authenticatedRole.addToPolicy(new iam.PolicyStatement({
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
        }));
        // Merchant admin role
        const merchantAdminRole = new iam.Role(this, "MerchantAdminRole", {
            assumedBy: new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated",
                },
            }, "sts:AssumeRoleWithWebIdentity"),
            description: "Role for merchant administrators",
        });
        // Add merchant admin permissions
        merchantAdminRole.addToPolicy(new iam.PolicyStatement({
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
        }));
        // Platform admin role
        const platformAdminRole = new iam.Role(this, "PlatformAdminRole", {
            assumedBy: new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated",
                },
            }, "sts:AssumeRoleWithWebIdentity"),
            description: "Role for platform administrators",
        });
        // Add platform admin permissions (full access)
        platformAdminRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["*"],
            resources: ["*"],
        }));
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
    createOutputs() {
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
exports.AuthSecurityStack = AuthSecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1zZWN1cml0eS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgtc2VjdXJpdHktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUNuRCw2REFBK0M7QUFDL0MsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQywyREFBNkM7QUFFN0MsMkNBQXVDO0FBT3ZDLE1BQWEsaUJBQWtCLFNBQVEsc0JBQVM7SUFROUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFckUsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFFbEQsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFOUMscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFbkQsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUzRCw0QkFBNEI7UUFDNUIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBRXhELDRDQUE0QztRQUM1QyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFdEIsMEJBQTBCO1FBQzFCLElBQUksQ0FB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LEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYTtZQUMzQyxXQUFXLEVBQUUsd0JBQXdCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVsQkQsOENBNGxCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSBcImF3cy1jZGstbGliL2F3cy1jb2duaXRvXCI7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXdhZnYyXCI7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbG9nc1wiO1xuaW1wb3J0ICogYXMga21zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mta21zXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhTZWN1cml0eVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGttc0tleToga21zLktleTtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEF1dGhTZWN1cml0eVN0YWNrIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBpZGVudGl0eVBvb2w6IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQWNsOiB3YWZ2Mi5DZm5XZWJBQ0w7XG4gIHB1YmxpYyByZWFkb25seSBhcGlHYXRld2F5OiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBjb2duaXRvQXV0aG9yaXplcjogYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXV0aFNlY3VyaXR5U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2wgd2l0aCBlbmhhbmNlZCBzZWN1cml0eVxuICAgIHRoaXMudXNlclBvb2wgPSB0aGlzLmNyZWF0ZVVzZXJQb29sKHByb3BzLmttc0tleSwgcHJvcHMuZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gQ3JlYXRlIFVzZXIgUG9vbCBDbGllbnRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gdGhpcy5jcmVhdGVVc2VyUG9vbENsaWVudCgpO1xuXG4gICAgLy8gQ3JlYXRlIElkZW50aXR5IFBvb2wgZm9yIHJvbGUtYmFzZWQgYWNjZXNzXG4gICAgdGhpcy5pZGVudGl0eVBvb2wgPSB0aGlzLmNyZWF0ZUlkZW50aXR5UG9vbCgpO1xuXG4gICAgLy8gQ3JlYXRlIFdBRiBXZWIgQUNMXG4gICAgdGhpcy53ZWJBY2wgPSB0aGlzLmNyZWF0ZVdlYkFjbChwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXkgd2l0aCBDb2duaXRvIGF1dGhvcml6ZXJcbiAgICB0aGlzLmFwaUdhdGV3YXkgPSB0aGlzLmNyZWF0ZUFwaUdhdGV3YXkocHJvcHMuZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gYXV0aG9yaXplclxuICAgIHRoaXMuY29nbml0b0F1dGhvcml6ZXIgPSB0aGlzLmNyZWF0ZUNvZ25pdG9BdXRob3JpemVyKCk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGVzIGZvciBkaWZmZXJlbnQgdXNlciB0eXBlc1xuICAgIHRoaXMuY3JlYXRlSUFNUm9sZXMoKTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVVzZXJQb29sKGttc0tleToga21zLktleSwgZW52aXJvbm1lbnQ6IHN0cmluZyk6IGNvZ25pdG8uVXNlclBvb2wge1xuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJVc2VyUG9vbFwiLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGBtaW5kc2RiLXJhZy11c2Vycy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBtZXJjaGFudF9pZDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgdXNlcl9yb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTIsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICB0ZW1wUGFzc3dvcmRWYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xuICAgICAgICBzbXM6IHRydWUsXG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB1c2VyVmVyaWZpY2F0aW9uOiB7XG4gICAgICAgIGVtYWlsU3ViamVjdDogXCJWZXJpZnkgeW91ciBlbWFpbCBmb3IgTWluZHNEQiBSQUcgQXNzaXN0YW50XCIsXG4gICAgICAgIGVtYWlsQm9keTogXCJUaGFuayB5b3UgZm9yIHNpZ25pbmcgdXAhIFlvdXIgdmVyaWZpY2F0aW9uIGNvZGUgaXMgeyMjIyN9XCIsXG4gICAgICAgIGVtYWlsU3R5bGU6IGNvZ25pdG8uVmVyaWZpY2F0aW9uRW1haWxTdHlsZS5DT0RFLFxuICAgICAgfSxcbiAgICAgIHVzZXJJbnZpdGF0aW9uOiB7XG4gICAgICAgIGVtYWlsU3ViamVjdDogXCJJbnZpdGUgdG8gam9pbiBNaW5kc0RCIFJBRyBBc3Npc3RhbnRcIixcbiAgICAgICAgZW1haWxCb2R5OiBcIllvdSBoYXZlIGJlZW4gaW52aXRlZCB0byBqb2luIE1pbmRzREIgUkFHIEFzc2lzdGFudC4gWW91ciB0ZW1wb3JhcnkgcGFzc3dvcmQgaXMgeyMjIyN9XCIsXG4gICAgICB9LFxuICAgICAgZGV2aWNlVHJhY2tpbmc6IHtcbiAgICAgICAgY2hhbGxlbmdlUmVxdWlyZWRPbk5ld0RldmljZTogdHJ1ZSxcbiAgICAgICAgZGV2aWNlT25seVJlbWVtYmVyZWRPblVzZXJQcm9tcHQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIC8vIGFkdmFuY2VkU2VjdXJpdHlNb2RlOiBjb2duaXRvLkFkdmFuY2VkU2VjdXJpdHlNb2RlLkVORk9SQ0VELCAvLyBSZXF1aXJlcyBQbHVzIHBsYW5cbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIENoYW5nZSB0byBSRVRBSU4gZm9yIHByb2R1Y3Rpb25cbiAgICB9KTtcblxuICAgIC8vIEFkZCBMYW1iZGEgdHJpZ2dlcnMgZm9yIGN1c3RvbSBhdXRoZW50aWNhdGlvbiBsb2dpY1xuICAgIC8vIFRPRE86IEltcGxlbWVudCBhY3R1YWwgTGFtYmRhIGZ1bmN0aW9uIGZvciBwcmUtdG9rZW4gZ2VuZXJhdGlvblxuICAgIC8vIGNvbnN0IHByZVRva2VuR2VuZXJhdGlvbkxhbWJkYSA9IHRoaXMuY3JlYXRlUHJlVG9rZW5HZW5lcmF0aW9uTGFtYmRhKGttc0tleSk7XG4gICAgLy8gdXNlclBvb2wuYWRkVHJpZ2dlcihjb2duaXRvLlVzZXJQb29sT3BlcmF0aW9uLlBSRV9UT0tFTl9HRU5FUkFUSU9OLCBwcmVUb2tlbkdlbmVyYXRpb25MYW1iZGEpO1xuXG4gICAgcmV0dXJuIHVzZXJQb29sO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQcmVUb2tlbkdlbmVyYXRpb25MYW1iZGEoa21zS2V5OiBrbXMuS2V5KTogYW55IHtcbiAgICAvLyBUaGlzIHdvdWxkIGJlIGltcGxlbWVudGVkIGFzIGEgTGFtYmRhIGZ1bmN0aW9uXG4gICAgLy8gRm9yIG5vdywgd2UnbGwgY3JlYXRlIGEgcGxhY2Vob2xkZXIgdGhhdCB3b3VsZCBhZGQgbWVyY2hhbnRfaWQgdG8gSldUIGNsYWltc1xuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJQcmVUb2tlbkdlbmVyYXRpb25MYW1iZGFSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwibGFtYmRhLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwic2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZVwiKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIEtNUyBhbmQgQ29nbml0b1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwia21zOkRlY3J5cHRcIixcbiAgICAgICAgICBcImttczpHZW5lcmF0ZURhdGFLZXlcIixcbiAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluR2V0VXNlclwiLFxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlc1wiLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBrbXNLZXkua2V5QXJuLFxuICAgICAgICAgIGBhcm46YXdzOmNvZ25pdG8taWRwOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06dXNlcnBvb2wvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSZXR1cm4gYSBwbGFjZWhvbGRlciAtIGFjdHVhbCBMYW1iZGEgZnVuY3Rpb24gd291bGQgYmUgY3JlYXRlZCBzZXBhcmF0ZWx5XG4gICAgcmV0dXJuIHtcbiAgICAgIGZ1bmN0aW9uQXJuOiBgYXJuOmF3czpsYW1iZGE6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpmdW5jdGlvbjpwcmUtdG9rZW4tZ2VuZXJhdGlvbmAsXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVVzZXJQb29sQ2xpZW50KCk6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQge1xuICAgIHJldHVybiBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50XCIsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBcIm1pbmRzZGItcmFnLXdlYi1jbGllbnRcIixcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gRm9yIHdlYiBhcHBsaWNhdGlvbnNcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICB1c2VyUGFzc3dvcmQ6IGZhbHNlLCAvLyBEaXNhYmxlIGxlc3Mgc2VjdXJlIGZsb3dzXG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IGZhbHNlLCAvLyBEaXNhYmxlIGZvciBzZWN1cml0eVxuICAgICAgICB9LFxuICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgXCJodHRwczovL2xvY2FsaG9zdDozMDAwL2NhbGxiYWNrXCIsIC8vIERldmVsb3BtZW50XG4gICAgICAgICAgXCJodHRwczovL2FwcC5taW5kc2RiLXJhZy5jb20vY2FsbGJhY2tcIiwgLy8gUHJvZHVjdGlvblxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgXCJodHRwczovL2xvY2FsaG9zdDozMDAwL2xvZ291dFwiLFxuICAgICAgICAgIFwiaHR0cHM6Ly9hcHAubWluZHNkYi1yYWcuY29tL2xvZ291dFwiLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlLFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgZW5hYmxlVG9rZW5SZXZvY2F0aW9uOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJZGVudGl0eVBvb2woKTogY29nbml0by5DZm5JZGVudGl0eVBvb2wge1xuICAgIGNvbnN0IGlkZW50aXR5UG9vbCA9IG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCBcIklkZW50aXR5UG9vbFwiLCB7XG4gICAgICBpZGVudGl0eVBvb2xOYW1lOiBcIm1pbmRzZGItcmFnLWlkZW50aXR5LXBvb2xcIixcbiAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogZmFsc2UsXG4gICAgICBjb2duaXRvSWRlbnRpdHlQcm92aWRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGNsaWVudElkOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgICAgcHJvdmlkZXJOYW1lOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sUHJvdmlkZXJOYW1lLFxuICAgICAgICAgIHNlcnZlclNpZGVUb2tlbkNoZWNrOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHJldHVybiBpZGVudGl0eVBvb2w7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVdlYkFjbChlbnZpcm9ubWVudDogc3RyaW5nKTogd2FmdjIuQ2ZuV2ViQUNMIHtcbiAgICBjb25zdCB3ZWJBY2wgPSBuZXcgd2FmdjIuQ2ZuV2ViQUNMKHRoaXMsIFwiV2ViQUNMXCIsIHtcbiAgICAgIG5hbWU6IGBtaW5kc2RiLXJhZy13YWYtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgc2NvcGU6IFwiUkVHSU9OQUxcIiwgLy8gRm9yIEFQSSBHYXRld2F5LCBBTEJcbiAgICAgIGRlZmF1bHRBY3Rpb246IHtcbiAgICAgICAgYWxsb3c6IHt9LFxuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIldBRiBmb3IgTWluZHNEQiBSQUcgQXNzaXN0YW50IEFQSVwiLFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAgLy8gUmF0ZSBsaW1pdGluZyBydWxlXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIlJhdGVMaW1pdFJ1bGVcIixcbiAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIHJhdGVCYXNlZFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBsaW1pdDogMjAwMCwgLy8gMjAwMCByZXF1ZXN0cyBwZXIgNSBtaW51dGVzIHBlciBJUFxuICAgICAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiBcIklQXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICBibG9jazoge30sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJSYXRlTGltaXRSdWxlXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQVdTIE1hbmFnZWQgUnVsZXMgLSBDb3JlIFJ1bGUgU2V0XG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICBvdmVycmlkZUFjdGlvbjoge1xuICAgICAgICAgICAgbm9uZToge30sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIG1hbmFnZWRSdWxlR3JvdXBTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICAgICAgbmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0XCIsXG4gICAgICAgICAgICAgIGV4Y2x1ZGVkUnVsZXM6IFtcbiAgICAgICAgICAgICAgICAvLyBFeGNsdWRlIHJ1bGVzIHRoYXQgbWlnaHQgYmUgdG9vIHJlc3RyaWN0aXZlXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbmFtZTogXCJTaXplUmVzdHJpY3Rpb25zX0JPRFlcIixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkNvbW1vblJ1bGVTZXRNZXRyaWNcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBBV1MgTWFuYWdlZCBSdWxlcyAtIEtub3duIEJhZCBJbnB1dHNcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiQVdTTWFuYWdlZFJ1bGVzS25vd25CYWRJbnB1dHNSdWxlU2V0XCIsXG4gICAgICAgICAgcHJpb3JpdHk6IDMsXG4gICAgICAgICAgb3ZlcnJpZGVBY3Rpb246IHtcbiAgICAgICAgICAgIG5vbmU6IHt9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgICAgIG5hbWU6IFwiQVdTTWFuYWdlZFJ1bGVzS25vd25CYWRJbnB1dHNSdWxlU2V0XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiS25vd25CYWRJbnB1dHNSdWxlU2V0TWV0cmljXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gU1FMIEluamVjdGlvbiBQcm90ZWN0aW9uXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc1NRTGlSdWxlU2V0XCIsXG4gICAgICAgICAgcHJpb3JpdHk6IDQsXG4gICAgICAgICAgb3ZlcnJpZGVBY3Rpb246IHtcbiAgICAgICAgICAgIG5vbmU6IHt9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgICAgIG5hbWU6IFwiQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJTUUxpUnVsZVNldE1ldHJpY1wiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIElQIFJlcHV0YXRpb24gTGlzdFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNBbWF6b25JcFJlcHV0YXRpb25MaXN0XCIsXG4gICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgb3ZlcnJpZGVBY3Rpb246IHtcbiAgICAgICAgICAgIG5vbmU6IHt9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgICAgIG5hbWU6IFwiQVdTTWFuYWdlZFJ1bGVzQW1hem9uSXBSZXB1dGF0aW9uTGlzdFwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIklwUmVwdXRhdGlvbkxpc3RNZXRyaWNcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBNZXJjaGFudC1zcGVjaWZpYyByYXRlIGxpbWl0aW5nXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIk1lcmNoYW50UmF0ZUxpbWl0UnVsZVwiLFxuICAgICAgICAgIHByaW9yaXR5OiA2LFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIGxpbWl0OiAxMDAwMCwgLy8gMTAwMDAgcmVxdWVzdHMgcGVyIDUgbWludXRlcyBwZXIgbWVyY2hhbnRcbiAgICAgICAgICAgICAgYWdncmVnYXRlS2V5VHlwZTogXCJDVVNUT01fS0VZU1wiLFxuICAgICAgICAgICAgICBjdXN0b21LZXlzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgaGVhZGVyOiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwieC1tZXJjaGFudC1pZFwiLFxuICAgICAgICAgICAgICAgICAgICB0ZXh0VHJhbnNmb3JtYXRpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIkxPV0VSQ0FTRVwiLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICBibG9jazoge30sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJNZXJjaGFudFJhdGVMaW1pdFJ1bGVcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIk1pbmRzREJSQUdXZWJBQ0xcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBsb2cgZ3JvdXAgZm9yIFdBRiBsb2dzXG4gICAgY29uc3Qgd2FmTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIldBRkxvZ0dyb3VwXCIsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3Mvd2FmdjIvbWluZHNkYi1yYWctJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBsb2dnaW5nIGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgd2FmdjIuQ2ZuTG9nZ2luZ0NvbmZpZ3VyYXRpb24odGhpcywgXCJXQUZMb2dnaW5nQ29uZmlnXCIsIHtcbiAgICAgIHJlc291cmNlQXJuOiB3ZWJBY2wuYXR0ckFybixcbiAgICAgIGxvZ0Rlc3RpbmF0aW9uQ29uZmlnczogW3dhZkxvZ0dyb3VwLmxvZ0dyb3VwQXJuXSxcbiAgICAgIHJlZGFjdGVkRmllbGRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaW5nbGVIZWFkZXI6IHtcbiAgICAgICAgICAgIG5hbWU6IFwiYXV0aG9yaXphdGlvblwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzaW5nbGVIZWFkZXI6IHtcbiAgICAgICAgICAgIG5hbWU6IFwiY29va2llXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gd2ViQWNsO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBcGlHYXRld2F5KGVudmlyb25tZW50OiBzdHJpbmcpOiBhcGlnYXRld2F5LlJlc3RBcGkge1xuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgXCJBcGlHYXRld2F5XCIsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgbWluZHNkYi1yYWctYXBpLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk1pbmRzREIgUkFHIEFzc2lzdGFudCBBUEkgR2F0ZXdheVwiLFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50LFxuICAgICAgICB0aHJvdHRsaW5nUmF0ZUxpbWl0OiAxMDAwLFxuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogMjAwMCxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiLFxuICAgICAgICAgIFwiWC1BbXotRGF0ZVwiLFxuICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiLFxuICAgICAgICAgIFwiWC1BcGktS2V5XCIsXG4gICAgICAgICAgXCJYLUFtei1TZWN1cml0eS1Ub2tlblwiLFxuICAgICAgICAgIFwiWC1NZXJjaGFudC1JZFwiLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5BbnlQcmluY2lwYWwoKV0sXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJleGVjdXRlLWFwaTpJbnZva2VcIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgIElwQWRkcmVzczoge1xuICAgICAgICAgICAgICAgIFwiYXdzOlNvdXJjZUlwXCI6IFtcbiAgICAgICAgICAgICAgICAgIFwiMC4wLjAuMC8wXCIsIC8vIEFsbG93IGFsbCBJUHMgLSBXQUYgd2lsbCBoYW5kbGUgZmlsdGVyaW5nXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIGJpbmFyeU1lZGlhVHlwZXM6IFtcIiovKlwiXSxcbiAgICB9KTtcblxuICAgIC8vIEFzc29jaWF0ZSBXQUYgd2l0aCBBUEkgR2F0ZXdheVxuICAgIG5ldyB3YWZ2Mi5DZm5XZWJBQ0xBc3NvY2lhdGlvbih0aGlzLCBcIkFwaUdhdGV3YXlXQUZBc3NvY2lhdGlvblwiLCB7XG4gICAgICByZXNvdXJjZUFybjogYGFybjphd3M6YXBpZ2F0ZXdheToke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OjovcmVzdGFwaXMvJHthcGkucmVzdEFwaUlkfS9zdGFnZXMvJHtlbnZpcm9ubWVudH1gLFxuICAgICAgd2ViQWNsQXJuOiB0aGlzLndlYkFjbC5hdHRyQXJuLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ29nbml0b0F1dGhvcml6ZXIoKTogYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplciB7XG4gICAgcmV0dXJuIG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsIFwiQ29nbml0b0F1dGhvcml6ZXJcIiwge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3RoaXMudXNlclBvb2xdLFxuICAgICAgYXV0aG9yaXplck5hbWU6IFwiTWluZHNEQlJBR0F1dGhvcml6ZXJcIixcbiAgICAgIGlkZW50aXR5U291cmNlOiBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uXCIsXG4gICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJQU1Sb2xlcygpOiB2b2lkIHtcbiAgICAvLyBBdXRoZW50aWNhdGVkIHVzZXIgcm9sZSBmb3IgY3VzdG9tZXJzXG4gICAgY29uc3QgYXV0aGVudGljYXRlZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJBdXRoZW50aWNhdGVkVXNlclJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb21cIixcbiAgICAgICAge1xuICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IHRoaXMuaWRlbnRpdHlQb29sLnJlZixcbiAgICAgICAgICB9LFxuICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7XG4gICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXG4gICAgICApLFxuICAgICAgZGVzY3JpcHRpb246IFwiUm9sZSBmb3IgYXV0aGVudGljYXRlZCB1c2VycyAoY3VzdG9tZXJzKVwiLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGJhc2ljIHBlcm1pc3Npb25zIGZvciBhdXRoZW50aWNhdGVkIHVzZXJzXG4gICAgYXV0aGVudGljYXRlZFJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiZXhlY3V0ZS1hcGk6SW52b2tlXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06JHt0aGlzLmFwaUdhdGV3YXkucmVzdEFwaUlkfS8qL0dFVC9jaGF0YCxcbiAgICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OiR7dGhpcy5hcGlHYXRld2F5LnJlc3RBcGlJZH0vKi9QT1NUL2NoYXRgLFxuICAgICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06JHt0aGlzLmFwaUdhdGV3YXkucmVzdEFwaUlkfS8qL0dFVC9zZXNzaW9uLypgLFxuICAgICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06JHt0aGlzLmFwaUdhdGV3YXkucmVzdEFwaUlkfS8qL1BPU1QvY2hlY2tvdXRgLFxuICAgICAgICBdLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTpzdWJcIjogXCIke2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTpzdWJ9XCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIE1lcmNoYW50IGFkbWluIHJvbGVcbiAgICBjb25zdCBtZXJjaGFudEFkbWluUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIk1lcmNoYW50QWRtaW5Sb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5GZWRlcmF0ZWRQcmluY2lwYWwoXG4gICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiB0aGlzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcIkZvckFueVZhbHVlOlN0cmluZ0xpa2VcIjoge1xuICAgICAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yXCI6IFwiYXV0aGVudGljYXRlZFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFwic3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHlcIlxuICAgICAgKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlJvbGUgZm9yIG1lcmNoYW50IGFkbWluaXN0cmF0b3JzXCIsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgbWVyY2hhbnQgYWRtaW4gcGVybWlzc2lvbnNcbiAgICBtZXJjaGFudEFkbWluUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJleGVjdXRlLWFwaTpJbnZva2VcIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fToke3RoaXMuYXBpR2F0ZXdheS5yZXN0QXBpSWR9LyovKmAsXG4gICAgICAgIF0sXG4gICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOnN1YlwiOiBcIiR7Y29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOnN1Yn1cIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUGxhdGZvcm0gYWRtaW4gcm9sZVxuICAgIGNvbnN0IHBsYXRmb3JtQWRtaW5Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiUGxhdGZvcm1BZG1pblJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb21cIixcbiAgICAgICAge1xuICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IHRoaXMuaWRlbnRpdHlQb29sLnJlZixcbiAgICAgICAgICB9LFxuICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7XG4gICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXG4gICAgICApLFxuICAgICAgZGVzY3JpcHRpb246IFwiUm9sZSBmb3IgcGxhdGZvcm0gYWRtaW5pc3RyYXRvcnNcIixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBwbGF0Zm9ybSBhZG1pbiBwZXJtaXNzaW9ucyAoZnVsbCBhY2Nlc3MpXG4gICAgcGxhdGZvcm1BZG1pblJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1wiKlwiXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQXR0YWNoIHJvbGVzIHRvIGlkZW50aXR5IHBvb2xcbiAgICBuZXcgY29nbml0by5DZm5JZGVudGl0eVBvb2xSb2xlQXR0YWNobWVudCh0aGlzLCBcIklkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50XCIsIHtcbiAgICAgIGlkZW50aXR5UG9vbElkOiB0aGlzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgICByb2xlczoge1xuICAgICAgICBhdXRoZW50aWNhdGVkOiBhdXRoZW50aWNhdGVkUm9sZS5yb2xlQXJuLFxuICAgICAgfSxcbiAgICAgIHJvbGVNYXBwaW5nczoge1xuICAgICAgICBjb2duaXRvUHJvdmlkZXI6IHtcbiAgICAgICAgICB0eXBlOiBcIlJ1bGVzXCIsXG4gICAgICAgICAgYW1iaWd1b3VzUm9sZVJlc29sdXRpb246IFwiQXV0aGVudGljYXRlZFJvbGVcIixcbiAgICAgICAgICBpZGVudGl0eVByb3ZpZGVyOiBgJHt0aGlzLnVzZXJQb29sLnVzZXJQb29sUHJvdmlkZXJOYW1lfToke3RoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZH1gLFxuICAgICAgICAgIHJ1bGVzQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNsYWltOiBcImN1c3RvbTp1c2VyX3JvbGVcIixcbiAgICAgICAgICAgICAgICBtYXRjaFR5cGU6IFwiRXF1YWxzXCIsXG4gICAgICAgICAgICAgICAgdmFsdWU6IFwicGxhdGZvcm1fYWRtaW5cIixcbiAgICAgICAgICAgICAgICByb2xlQXJuOiBwbGF0Zm9ybUFkbWluUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY2xhaW06IFwiY3VzdG9tOnVzZXJfcm9sZVwiLFxuICAgICAgICAgICAgICAgIG1hdGNoVHlwZTogXCJFcXVhbHNcIixcbiAgICAgICAgICAgICAgICB2YWx1ZTogXCJtZXJjaGFudF9hZG1pblwiLFxuICAgICAgICAgICAgICAgIHJvbGVBcm46IG1lcmNoYW50QWRtaW5Sb2xlLnJvbGVBcm4sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjbGFpbTogXCJjdXN0b206dXNlcl9yb2xlXCIsXG4gICAgICAgICAgICAgICAgbWF0Y2hUeXBlOiBcIkVxdWFsc1wiLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBcImN1c3RvbWVyXCIsXG4gICAgICAgICAgICAgICAgcm9sZUFybjogYXV0aGVudGljYXRlZFJvbGUucm9sZUFybixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbElkXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb2duaXRvIFVzZXIgUG9vbCBJRFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbENsaWVudElkXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSURcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiSWRlbnRpdHlQb29sSWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuaWRlbnRpdHlQb29sLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvZ25pdG8gSWRlbnRpdHkgUG9vbCBJRFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBcGlHYXRld2F5VXJsXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaUdhdGV3YXkudXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiQVBJIEdhdGV3YXkgVVJMXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIldlYkFDTEFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJBY2wuYXR0ckFybixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIldBRiBXZWIgQUNMIEFSTlwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJDb2duaXRvQXV0aG9yaXplckFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb2duaXRvQXV0aG9yaXplci5hdXRob3JpemVyQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ29nbml0byBBdXRob3JpemVyIEFSTlwiLFxuICAgIH0pO1xuICB9XG59Il19