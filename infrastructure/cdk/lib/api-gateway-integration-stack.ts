import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as stepfunctions from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";

export interface ApiGatewayIntegrationStackProps {
  vpc: ec2.Vpc;
  apiGateway: apigateway.RestApi;
  cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;
  internalLoadBalancer: elbv2.ApplicationLoadBalancer;
  bedrockToolsFunction: lambda.Function;
  checkoutFunction: lambda.Function;
  environment: string;
}

export class ApiGatewayIntegrationStack extends Construct {
  public vpcLink: apigateway.VpcLink;
  public apiKey: apigateway.ApiKey;
  public usagePlan: apigateway.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiGatewayIntegrationStackProps) {
    super(scope, id);

    // Create VPC Link for private ALB integration
    this.vpcLink = this.createVpcLink(props);

    // Create API resources and methods
    this.createApiResources(props);

    // Create API key and usage plan
    this.createApiKeyAndUsagePlan(props);

    // Create outputs
    this.createOutputs();
  }

  private createVpcLink(props: ApiGatewayIntegrationStackProps): apigateway.VpcLink {
    // VPC Link requires Network Load Balancer, but we have Application Load Balancer
    // For now, we'll use direct HTTP integrations without VPC Link
    // TODO: Create Network Load Balancer and proper VPC Link for production
    return null as any; // Returning null to avoid VPC Link usage
  }

  private createApiResources(props: ApiGatewayIntegrationStackProps): void {
    const api = props.apiGateway;
    const authorizer = props.cognitoAuthorizer;

    // Create API version resource
    const v1 = api.root.addResource("v1");

    // Chat endpoints
    const chat = v1.addResource("chat");
    this.createChatEndpoints(chat, props, authorizer);

    // Document endpoints
    const documents = v1.addResource("documents");
    this.createDocumentEndpoints(documents, props, authorizer);

    // Bedrock Agent endpoints
    const bedrockAgent = v1.addResource("bedrock-agent");
    this.createBedrockAgentEndpoints(bedrockAgent, props, authorizer);

    // Checkout endpoints
    const checkout = v1.addResource("checkout");
    this.createCheckoutEndpoints(checkout, props, authorizer);

    // Session endpoints
    const sessions = v1.addResource("sessions");
    this.createSessionEndpoints(sessions, props, authorizer);

    // Health check endpoint (no auth required)
    const health = api.root.addResource("health");
    this.createHealthEndpoint(health, props);

    // Admin endpoints (platform admin only)
    const admin = v1.addResource("admin");
    this.createAdminEndpoints(admin, props, authorizer);
  }

  private createChatEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // POST /v1/chat - Main chat interface
    resource.addMethod("POST", 
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/chat`, {
        httpMethod: "POST",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          timeout: cdk.Duration.seconds(29),
          requestParameters: {
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
            "integration.request.header.Authorization": "method.request.header.Authorization",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.header.X-Merchant-Id": true,
          "method.request.header.Authorization": true,
        },
        requestValidator: new apigateway.RequestValidator(this, "ChatRequestValidator", {
          restApi: props.apiGateway,
          requestValidatorName: "chat-request-validator",
          validateRequestBody: true,
          validateRequestParameters: true,
        }),
        requestModels: {
          "application/json": new apigateway.Model(this, "ChatRequestModel", {
            restApi: props.apiGateway,
            modelName: "ChatRequest",
            description: "Chat request model",
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                message: {
                  type: apigateway.JsonSchemaType.STRING,
                  minLength: 1,
                  maxLength: 4000,
                },
                sessionId: {
                  type: apigateway.JsonSchemaType.STRING,
                  pattern: "^[a-zA-Z0-9-_]{1,100}$",
                },
                context: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  properties: {
                    previousMessages: {
                      type: apigateway.JsonSchemaType.ARRAY,
                      maxItems: 10,
                    },
                  },
                },
              },
              required: ["message"],
            },
          }),
        },
        methodResponses: [
          {
            statusCode: "200",
            responseModels: {
              "application/json": apigateway.Model.EMPTY_MODEL,
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
          {
            statusCode: "400",
            responseModels: {
              "application/json": apigateway.Model.ERROR_MODEL,
            },
          },
          {
            statusCode: "401",
            responseModels: {
              "application/json": apigateway.Model.ERROR_MODEL,
            },
          },
          {
            statusCode: "429",
            responseModels: {
              "application/json": apigateway.Model.ERROR_MODEL,
            },
          },
        ],
      }
    );

    // GET /v1/chat/history - Chat history
    const history = resource.addResource("history");
    history.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/chat/history`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
            "integration.request.header.Authorization": "method.request.header.Authorization",
            "integration.request.querystring.sessionId": "method.request.querystring.sessionId",
            "integration.request.querystring.limit": "method.request.querystring.limit",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.header.X-Merchant-Id": true,
          "method.request.querystring.sessionId": false,
          "method.request.querystring.limit": false,
        },
      }
    );
  }

  private createDocumentEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // POST /v1/documents/ingest - Document ingestion
    resource.addMethod("POST",
      new apigateway.LambdaIntegration(props.bedrockToolsFunction, {
        proxy: false,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": JSON.stringify({
                status: "SUCCESS",
                message: "Document processing completed",
              }),
            },
          },
        ],
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestValidator: new apigateway.RequestValidator(this, "DocumentIngestValidator", {
          restApi: props.apiGateway,
          requestValidatorName: "document-ingest-validator",
          validateRequestBody: true,
        }),
        requestModels: {
          "application/json": new apigateway.Model(this, "DocumentIngestModel", {
            restApi: props.apiGateway,
            modelName: "DocumentIngest",
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                bucket: {
                  type: apigateway.JsonSchemaType.STRING,
                  minLength: 3,
                  maxLength: 63,
                },
                key: {
                  type: apigateway.JsonSchemaType.STRING,
                  minLength: 1,
                  maxLength: 1024,
                },
              },
              required: ["bucket", "key"],
            },
          }),
        },
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "401" },
        ],
      }
    );

    // GET /v1/documents/{id}/status - Document processing status
    const documentId = resource.addResource("{id}");
    const status = documentId.addResource("status");
    status.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/documents/{id}/status`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.path.id": "method.request.path.id",
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.path.id": true,
          "method.request.header.X-Merchant-Id": true,
        },
      }
    );
  }

  private createBedrockAgentEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // POST /v1/bedrock-agent/tools/execute - Execute Bedrock Agent tools
    const tools = resource.addResource("tools");
    tools.addMethod("POST",
      new apigateway.LambdaIntegration(props.bedrockToolsFunction, {
        requestTemplates: {
          "application/json": JSON.stringify({
            toolName: "$input.json('$.toolName')",
            input: "$input.json('$.input')",
            context: {
              merchantId: "$context.authorizer.claims.merchant_id",
              userId: "$context.authorizer.claims.sub",
              requestId: "$context.requestId",
              timestamp: "$context.requestTimeEpoch",
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": "$input.json('$')",
            },
          },
        ],
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [{ statusCode: "200" }],
      }
    );

    // GET /v1/bedrock-agent/tools/openapi - Get OpenAPI specification
    const openapi = tools.addResource("openapi");
    openapi.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/bedrock-agent/tools/openapi`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
        },
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
      }
    );

    // GET /v1/bedrock-agent/config - Get Bedrock Agent configuration
    const config = resource.addResource("config");
    config.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/bedrock-agent/config`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
        },
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
      }
    );
  }

  private createCheckoutEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // POST /v1/checkout/process - Process checkout
    resource.addMethod("POST",
      new apigateway.LambdaIntegration(props.checkoutFunction, {
        requestTemplates: {
          "application/json": JSON.stringify({
            action: "process",
            merchantId: "$context.authorizer.claims.merchant_id",
            userId: "$context.authorizer.claims.sub",
            requestId: "$context.requestId",
            items: "$input.json('$.items')",
            paymentMethod: "$input.json('$.paymentMethod')",
            customerInfo: "$input.json('$.customerInfo')",
          }),
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // POST /v1/checkout/cancel - Cancel checkout
    const cancel = resource.addResource("cancel");
    cancel.addMethod("POST",
      new apigateway.LambdaIntegration(props.checkoutFunction, {
        requestTemplates: {
          "application/json": JSON.stringify({
            action: "cancel",
            merchantId: "$context.authorizer.claims.merchant_id",
            userId: "$context.authorizer.claims.sub",
            transactionId: "$input.json('$.transactionId')",
            reason: "$input.json('$.reason')",
          }),
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /v1/checkout/status/{transactionId} - Get checkout status
    const transactionId = resource.addResource("{transactionId}");
    const status = transactionId.addResource("status");
    status.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/checkout/status/{transactionId}`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.path.transactionId": "method.request.path.transactionId",
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.path.transactionId": true,
          "method.request.header.X-Merchant-Id": true,
        },
      }
    );
  }

  private createSessionEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // GET /v1/sessions/{sessionId} - Get session details
    const sessionId = resource.addResource("{sessionId}");
    sessionId.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/sessions/{sessionId}`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.path.sessionId": "method.request.path.sessionId",
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.path.sessionId": true,
          "method.request.header.X-Merchant-Id": true,
        },
      }
    );

    // DELETE /v1/sessions/{sessionId} - Delete session
    sessionId.addMethod("DELETE",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/sessions/{sessionId}`, {
        httpMethod: "DELETE",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.path.sessionId": "method.request.path.sessionId",
            "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          "method.request.path.sessionId": true,
          "method.request.header.X-Merchant-Id": true,
        },
      }
    );
  }

  private createHealthEndpoint(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps
  ): void {
    resource.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/health`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
        },
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
      }
    );
  }

  private createAdminEndpoints(
    resource: apigateway.Resource,
    props: ApiGatewayIntegrationStackProps,
    authorizer: apigateway.CognitoUserPoolsAuthorizer
  ): void {
    // GET /v1/admin/metrics - Platform metrics (platform admin only)
    const metrics = resource.addResource("metrics");
    metrics.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/admin/metrics`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.header.Authorization": "method.request.header.Authorization",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        // Note: Role-based access control would be handled by the backend service
      }
    );

    // GET /v1/admin/merchants - List merchants (platform admin only)
    const merchants = resource.addResource("merchants");
    merchants.addMethod("GET",
      new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/admin/merchants`, {
        httpMethod: "GET",
        options: {
          // vpcLink: this.vpcLink, // Removed - using direct HTTP integration
          requestParameters: {
            "integration.request.header.Authorization": "method.request.header.Authorization",
          },
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );
  }

  private createApiKeyAndUsagePlan(props: ApiGatewayIntegrationStackProps): void {
    // Create API key for programmatic access
    this.apiKey = new apigateway.ApiKey(this, "MindsDBRAGApiKey", {
      apiKeyName: `mindsdb-rag-api-key-${props.environment}`,
      description: "API key for MindsDB RAG Assistant programmatic access",
    });

    // Create usage plan
    this.usagePlan = new apigateway.UsagePlan(this, "MindsDBRAGUsagePlan", {
      name: `mindsdb-rag-usage-plan-${props.environment}`,
      description: "Usage plan for MindsDB RAG Assistant API",
      throttle: {
        rateLimit: 1000, // requests per second
        burstLimit: 2000, // burst capacity
      },
      quota: {
        limit: 1000000, // requests per month
        period: apigateway.Period.MONTH,
      },
      apiStages: [
        {
          api: props.apiGateway,
          stage: props.apiGateway.deploymentStage,
        },
      ],
    });

    // Associate API key with usage plan
    this.usagePlan.addApiKey(this.apiKey);
  }

  private createOutputs(): void {
    // VPC Link simplified for now
    // new cdk.CfnOutput(this, "VpcLinkId", {
    //   value: this.vpcLink.vpcLinkId,
    //   description: "VPC Link ID for internal service integration",
    // });

    new cdk.CfnOutput(this, "ApiKeyId", {
      value: this.apiKey.keyId,
      description: "API Key ID for programmatic access",
    });

    new cdk.CfnOutput(this, "UsagePlanId", {
      value: this.usagePlan.usagePlanId,
      description: "Usage Plan ID",
    });
  }
}