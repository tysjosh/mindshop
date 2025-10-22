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
exports.ApiGatewayIntegrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const constructs_1 = require("constructs");
class ApiGatewayIntegrationStack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
    createVpcLink(props) {
        // Simplified: Using Lambda integrations instead of VPC Link for now
        // VPC Link requires Network Load Balancer, but we have Application Load Balancer
        return {};
    }
    createApiResources(props) {
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
    createChatEndpoints(resource, props, authorizer) {
        // POST /v1/chat - Main chat interface
        resource.addMethod("POST", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/chat`, {
            httpMethod: "POST",
            options: {
                vpcLink: this.vpcLink,
                timeout: cdk.Duration.seconds(29),
                requestParameters: {
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                    "integration.request.header.Authorization": "method.request.header.Authorization",
                },
            },
        }), {
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
        });
        // GET /v1/chat/history - Chat history
        const history = resource.addResource("history");
        history.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/chat/history`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                    "integration.request.header.Authorization": "method.request.header.Authorization",
                    "integration.request.querystring.sessionId": "method.request.querystring.sessionId",
                    "integration.request.querystring.limit": "method.request.querystring.limit",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                "method.request.header.X-Merchant-Id": true,
                "method.request.querystring.sessionId": false,
                "method.request.querystring.limit": false,
            },
        });
    }
    createDocumentEndpoints(resource, props, authorizer) {
        // POST /v1/documents/ingest - Document ingestion
        resource.addMethod("POST", new apigateway.LambdaIntegration(props.bedrockToolsFunction, {
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
        }), {
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
        });
        // GET /v1/documents/{id}/status - Document processing status
        const documentId = resource.addResource("{id}");
        const status = documentId.addResource("status");
        status.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/documents/{id}/status`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.path.id": "method.request.path.id",
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                "method.request.path.id": true,
                "method.request.header.X-Merchant-Id": true,
            },
        });
    }
    createBedrockAgentEndpoints(resource, props, authorizer) {
        // POST /v1/bedrock-agent/tools/execute - Execute Bedrock Agent tools
        const tools = resource.addResource("tools");
        tools.addMethod("POST", new apigateway.LambdaIntegration(props.bedrockToolsFunction, {
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
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            methodResponses: [{ statusCode: "200" }],
        });
        // GET /v1/bedrock-agent/tools/openapi - Get OpenAPI specification
        const openapi = tools.addResource("openapi");
        openapi.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/bedrock-agent/tools/openapi`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
            },
        }), {
            authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
        });
        // GET /v1/bedrock-agent/config - Get Bedrock Agent configuration
        const config = resource.addResource("config");
        config.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/bedrock-agent/config`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
            },
        }), {
            authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
        });
    }
    createCheckoutEndpoints(resource, props, authorizer) {
        // POST /v1/checkout/process - Process checkout
        resource.addMethod("POST", new apigateway.LambdaIntegration(props.checkoutFunction, {
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
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // POST /v1/checkout/cancel - Cancel checkout
        const cancel = resource.addResource("cancel");
        cancel.addMethod("POST", new apigateway.LambdaIntegration(props.checkoutFunction, {
            requestTemplates: {
                "application/json": JSON.stringify({
                    action: "cancel",
                    merchantId: "$context.authorizer.claims.merchant_id",
                    userId: "$context.authorizer.claims.sub",
                    transactionId: "$input.json('$.transactionId')",
                    reason: "$input.json('$.reason')",
                }),
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // GET /v1/checkout/status/{transactionId} - Get checkout status
        const transactionId = resource.addResource("{transactionId}");
        const status = transactionId.addResource("status");
        status.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/checkout/status/{transactionId}`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.path.transactionId": "method.request.path.transactionId",
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                "method.request.path.transactionId": true,
                "method.request.header.X-Merchant-Id": true,
            },
        });
    }
    createSessionEndpoints(resource, props, authorizer) {
        // GET /v1/sessions/{sessionId} - Get session details
        const sessionId = resource.addResource("{sessionId}");
        sessionId.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/sessions/{sessionId}`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.path.sessionId": "method.request.path.sessionId",
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                "method.request.path.sessionId": true,
                "method.request.header.X-Merchant-Id": true,
            },
        });
        // DELETE /v1/sessions/{sessionId} - Delete session
        sessionId.addMethod("DELETE", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/sessions/{sessionId}`, {
            httpMethod: "DELETE",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.path.sessionId": "method.request.path.sessionId",
                    "integration.request.header.X-Merchant-Id": "method.request.header.X-Merchant-Id",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestParameters: {
                "method.request.path.sessionId": true,
                "method.request.header.X-Merchant-Id": true,
            },
        });
    }
    createHealthEndpoint(resource, props) {
        resource.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/health`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
            },
        }), {
            authorizationType: apigateway.AuthorizationType.NONE,
        });
    }
    createAdminEndpoints(resource, props, authorizer) {
        // GET /v1/admin/metrics - Platform metrics (platform admin only)
        const metrics = resource.addResource("metrics");
        metrics.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/admin/metrics`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.header.Authorization": "method.request.header.Authorization",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            // Note: Role-based access control would be handled by the backend service
        });
        // GET /v1/admin/merchants - List merchants (platform admin only)
        const merchants = resource.addResource("merchants");
        merchants.addMethod("GET", new apigateway.HttpIntegration(`http://${props.internalLoadBalancer.loadBalancerDnsName}/api/admin/merchants`, {
            httpMethod: "GET",
            options: {
                vpcLink: this.vpcLink,
                requestParameters: {
                    "integration.request.header.Authorization": "method.request.header.Authorization",
                },
            },
        }), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
    }
    createApiKeyAndUsagePlan(props) {
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
    createOutputs() {
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
exports.ApiGatewayIntegrationStack = ApiGatewayIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktaW50ZWdyYXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGktZ2F0ZXdheS1pbnRlZ3JhdGlvbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdUVBQXlEO0FBT3pELDJDQUF1QztBQWF2QyxNQUFhLDBCQUEyQixTQUFRLHNCQUFTO0lBS3ZELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0M7UUFDOUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQiw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXpDLG1DQUFtQztRQUNuQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFL0IsZ0NBQWdDO1FBQ2hDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyQyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFTyxhQUFhLENBQUMsS0FBc0M7UUFDMUQsb0VBQW9FO1FBQ3BFLGlGQUFpRjtRQUNqRixPQUFPLEVBQXdCLENBQUM7SUFDbEMsQ0FBQztJQUVPLGtCQUFrQixDQUFDLEtBQXNDO1FBQy9ELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7UUFDN0IsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixDQUFDO1FBRTNDLDhCQUE4QjtRQUM5QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV0QyxpQkFBaUI7UUFDakIsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztR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QyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2xDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXO1lBQ2pDLFdBQVcsRUFBRSxlQUFlO1NBQzdCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXBqQkQsZ0VBb2pCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCAqIGFzIGVsYnYyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2MlwiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sb2dzXCI7XG5pbXBvcnQgKiBhcyBzdGVwZnVuY3Rpb25zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9uc1wiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICB2cGM6IGVjMi5WcGM7XG4gIGFwaUdhdGV3YXk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgY29nbml0b0F1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXI7XG4gIGludGVybmFsTG9hZEJhbGFuY2VyOiBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcjtcbiAgYmVkcm9ja1Rvb2xzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgY2hlY2tvdXRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyB2cGNMaW5rOiBhcGlnYXRld2F5LlZwY0xpbms7XG4gIHB1YmxpYyBhcGlLZXk6IGFwaWdhdGV3YXkuQXBpS2V5O1xuICBwdWJsaWMgdXNhZ2VQbGFuOiBhcGlnYXRld2F5LlVzYWdlUGxhbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgVlBDIExpbmsgZm9yIHByaXZhdGUgQUxCIGludGVncmF0aW9uXG4gICAgdGhpcy52cGNMaW5rID0gdGhpcy5jcmVhdGVWcGNMaW5rKHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBBUEkgcmVzb3VyY2VzIGFuZCBtZXRob2RzXG4gICAgdGhpcy5jcmVhdGVBcGlSZXNvdXJjZXMocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBrZXkgYW5kIHVzYWdlIHBsYW5cbiAgICB0aGlzLmNyZWF0ZUFwaUtleUFuZFVzYWdlUGxhbihwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgb3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVWcGNMaW5rKHByb3BzOiBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzKTogYXBpZ2F0ZXdheS5WcGNMaW5rIHtcbiAgICAvLyBTaW1wbGlmaWVkOiBVc2luZyBMYW1iZGEgaW50ZWdyYXRpb25zIGluc3RlYWQgb2YgVlBDIExpbmsgZm9yIG5vd1xuICAgIC8vIFZQQyBMaW5rIHJlcXVpcmVzIE5ldHdvcmsgTG9hZCBCYWxhbmNlciwgYnV0IHdlIGhhdmUgQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICAgIHJldHVybiB7fSBhcyBhcGlnYXRld2F5LlZwY0xpbms7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwaVJlc291cmNlcyhwcm9wczogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IGFwaSA9IHByb3BzLmFwaUdhdGV3YXk7XG4gICAgY29uc3QgYXV0aG9yaXplciA9IHByb3BzLmNvZ25pdG9BdXRob3JpemVyO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSB2ZXJzaW9uIHJlc291cmNlXG4gICAgY29uc3QgdjEgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInYxXCIpO1xuXG4gICAgLy8gQ2hhdCBlbmRwb2ludHNcbiAgICBjb25zdCBjaGF0ID0gdjEuYWRkUmVzb3VyY2UoXCJjaGF0XCIpO1xuICAgIHRoaXMuY3JlYXRlQ2hhdEVuZHBvaW50cyhjaGF0LCBwcm9wcywgYXV0aG9yaXplcik7XG5cbiAgICAvLyBEb2N1bWVudCBlbmRwb2ludHNcbiAgICBjb25zdCBkb2N1bWVudHMgPSB2MS5hZGRSZXNvdXJjZShcImRvY3VtZW50c1wiKTtcbiAgICB0aGlzLmNyZWF0ZURvY3VtZW50RW5kcG9pbnRzKGRvY3VtZW50cywgcHJvcHMsIGF1dGhvcml6ZXIpO1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudCBlbmRwb2ludHNcbiAgICBjb25zdCBiZWRyb2NrQWdlbnQgPSB2MS5hZGRSZXNvdXJjZShcImJlZHJvY2stYWdlbnRcIik7XG4gICAgdGhpcy5jcmVhdGVCZWRyb2NrQWdlbnRFbmRwb2ludHMoYmVkcm9ja0FnZW50LCBwcm9wcywgYXV0aG9yaXplcik7XG5cbiAgICAvLyBDaGVja291dCBlbmRwb2ludHNcbiAgICBjb25zdCBjaGVja291dCA9IHYxLmFkZFJlc291cmNlKFwiY2hlY2tvdXRcIik7XG4gICAgdGhpcy5jcmVhdGVDaGVja291dEVuZHBvaW50cyhjaGVja291dCwgcHJvcHMsIGF1dGhvcml6ZXIpO1xuXG4gICAgLy8gU2Vzc2lvbiBlbmRwb2ludHNcbiAgICBjb25zdCBzZXNzaW9ucyA9IHYxLmFkZFJlc291cmNlKFwic2Vzc2lvbnNcIik7XG4gICAgdGhpcy5jcmVhdGVTZXNzaW9uRW5kcG9pbnRzKHNlc3Npb25zLCBwcm9wcywgYXV0aG9yaXplcik7XG5cbiAgICAvLyBIZWFsdGggY2hlY2sgZW5kcG9pbnQgKG5vIGF1dGggcmVxdWlyZWQpXG4gICAgY29uc3QgaGVhbHRoID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJoZWFsdGhcIik7XG4gICAgdGhpcy5jcmVhdGVIZWFsdGhFbmRwb2ludChoZWFsdGgsIHByb3BzKTtcblxuICAgIC8vIEFkbWluIGVuZHBvaW50cyAocGxhdGZvcm0gYWRtaW4gb25seSlcbiAgICBjb25zdCBhZG1pbiA9IHYxLmFkZFJlc291cmNlKFwiYWRtaW5cIik7XG4gICAgdGhpcy5jcmVhdGVBZG1pbkVuZHBvaW50cyhhZG1pbiwgcHJvcHMsIGF1dGhvcml6ZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVDaGF0RW5kcG9pbnRzKFxuICAgIHJlc291cmNlOiBhcGlnYXRld2F5LlJlc291cmNlLFxuICAgIHByb3BzOiBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzLFxuICAgIGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXJcbiAgKTogdm9pZCB7XG4gICAgLy8gUE9TVCAvdjEvY2hhdCAtIE1haW4gY2hhdCBpbnRlcmZhY2VcbiAgICByZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIFxuICAgICAgbmV3IGFwaWdhdGV3YXkuSHR0cEludGVncmF0aW9uKGBodHRwOi8vJHtwcm9wcy5pbnRlcm5hbExvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfS9hcGkvY2hhdGAsIHtcbiAgICAgICAgaHR0cE1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICB2cGNMaW5rOiB0aGlzLnZwY0xpbmssXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMjkpLFxuICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcImludGVncmF0aW9uLnJlcXVlc3QuaGVhZGVyLlgtTWVyY2hhbnQtSWRcIjogXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiLFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uXCI6IFwibWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb25cIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiOiB0cnVlLFxuICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb25cIjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcih0aGlzLCBcIkNoYXRSZXF1ZXN0VmFsaWRhdG9yXCIsIHtcbiAgICAgICAgICByZXN0QXBpOiBwcm9wcy5hcGlHYXRld2F5LFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3JOYW1lOiBcImNoYXQtcmVxdWVzdC12YWxpZGF0b3JcIixcbiAgICAgICAgICB2YWxpZGF0ZVJlcXVlc3RCb2R5OiB0cnVlLFxuICAgICAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICByZXF1ZXN0TW9kZWxzOiB7XG4gICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IG5ldyBhcGlnYXRld2F5Lk1vZGVsKHRoaXMsIFwiQ2hhdFJlcXVlc3RNb2RlbFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpOiBwcm9wcy5hcGlHYXRld2F5LFxuICAgICAgICAgICAgbW9kZWxOYW1lOiBcIkNoYXRSZXF1ZXN0XCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJDaGF0IHJlcXVlc3QgbW9kZWxcIixcbiAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HLFxuICAgICAgICAgICAgICAgICAgbWluTGVuZ3RoOiAxLFxuICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoOiA0MDAwLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLlNUUklORyxcbiAgICAgICAgICAgICAgICAgIHBhdHRlcm46IFwiXlthLXpBLVowLTktX117MSwxMDB9JFwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY29udGV4dDoge1xuICAgICAgICAgICAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5PQkpFQ1QsXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzTWVzc2FnZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLkFSUkFZLFxuICAgICAgICAgICAgICAgICAgICAgIG1heEl0ZW1zOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcmVxdWlyZWQ6IFtcIm1lc3NhZ2VcIl0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgICAgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IGFwaWdhdGV3YXkuTW9kZWwuRU1QVFlfTU9ERUwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiBcIjQwMFwiLFxuICAgICAgICAgICAgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IGFwaWdhdGV3YXkuTW9kZWwuRVJST1JfTU9ERUwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogXCI0MDFcIixcbiAgICAgICAgICAgIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiBhcGlnYXRld2F5Lk1vZGVsLkVSUk9SX01PREVMLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IFwiNDI5XCIsXG4gICAgICAgICAgICByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjogYXBpZ2F0ZXdheS5Nb2RlbC5FUlJPUl9NT0RFTCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC92MS9jaGF0L2hpc3RvcnkgLSBDaGF0IGhpc3RvcnlcbiAgICBjb25zdCBoaXN0b3J5ID0gcmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJoaXN0b3J5XCIpO1xuICAgIGhpc3RvcnkuYWRkTWV0aG9kKFwiR0VUXCIsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5IdHRwSW50ZWdyYXRpb24oYGh0dHA6Ly8ke3Byb3BzLmludGVybmFsTG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9jaGF0L2hpc3RvcnlgLCB7XG4gICAgICAgIGh0dHBNZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICB2cGNMaW5rOiB0aGlzLnZwY0xpbmssXG4gICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgIFwiaW50ZWdyYXRpb24ucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiOiBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCIsXG4gICAgICAgICAgICBcImludGVncmF0aW9uLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb25cIjogXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvblwiLFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlc3Npb25JZFwiOiBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlc3Npb25JZFwiLFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmxpbWl0XCI6IFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcubGltaXRcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiOiB0cnVlLFxuICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuc2Vzc2lvbklkXCI6IGZhbHNlLFxuICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcubGltaXRcIjogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRG9jdW1lbnRFbmRwb2ludHMoXG4gICAgcmVzb3VyY2U6IGFwaWdhdGV3YXkuUmVzb3VyY2UsXG4gICAgcHJvcHM6IEFwaUdhdGV3YXlJbnRlZ3JhdGlvblN0YWNrUHJvcHMsXG4gICAgYXV0aG9yaXplcjogYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplclxuICApOiB2b2lkIHtcbiAgICAvLyBQT1NUIC92MS9kb2N1bWVudHMvaW5nZXN0IC0gRG9jdW1lbnQgaW5nZXN0aW9uXG4gICAgcmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMuYmVkcm9ja1Rvb2xzRnVuY3Rpb24sIHtcbiAgICAgICAgcHJveHk6IGZhbHNlLFxuICAgICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IFwiMjAwXCIsXG4gICAgICAgICAgICByZXNwb25zZVRlbXBsYXRlczoge1xuICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHN0YXR1czogXCJTVUNDRVNTXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJEb2N1bWVudCBwcm9jZXNzaW5nIGNvbXBsZXRlZFwiLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgYXBpZ2F0ZXdheS5SZXF1ZXN0VmFsaWRhdG9yKHRoaXMsIFwiRG9jdW1lbnRJbmdlc3RWYWxpZGF0b3JcIiwge1xuICAgICAgICAgIHJlc3RBcGk6IHByb3BzLmFwaUdhdGV3YXksXG4gICAgICAgICAgcmVxdWVzdFZhbGlkYXRvck5hbWU6IFwiZG9jdW1lbnQtaW5nZXN0LXZhbGlkYXRvclwiLFxuICAgICAgICAgIHZhbGlkYXRlUmVxdWVzdEJvZHk6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICByZXF1ZXN0TW9kZWxzOiB7XG4gICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IG5ldyBhcGlnYXRld2F5Lk1vZGVsKHRoaXMsIFwiRG9jdW1lbnRJbmdlc3RNb2RlbFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpOiBwcm9wcy5hcGlHYXRld2F5LFxuICAgICAgICAgICAgbW9kZWxOYW1lOiBcIkRvY3VtZW50SW5nZXN0XCIsXG4gICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5PQkpFQ1QsXG4gICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBidWNrZXQ6IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HLFxuICAgICAgICAgICAgICAgICAgbWluTGVuZ3RoOiAzLFxuICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoOiA2MyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGtleToge1xuICAgICAgICAgICAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5TVFJJTkcsXG4gICAgICAgICAgICAgICAgICBtaW5MZW5ndGg6IDEsXG4gICAgICAgICAgICAgICAgICBtYXhMZW5ndGg6IDEwMjQsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcmVxdWlyZWQ6IFtcImJ1Y2tldFwiLCBcImtleVwiXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHsgc3RhdHVzQ29kZTogXCIyMDBcIiB9LFxuICAgICAgICAgIHsgc3RhdHVzQ29kZTogXCI0MDBcIiB9LFxuICAgICAgICAgIHsgc3RhdHVzQ29kZTogXCI0MDFcIiB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL3YxL2RvY3VtZW50cy97aWR9L3N0YXR1cyAtIERvY3VtZW50IHByb2Nlc3Npbmcgc3RhdHVzXG4gICAgY29uc3QgZG9jdW1lbnRJZCA9IHJlc291cmNlLmFkZFJlc291cmNlKFwie2lkfVwiKTtcbiAgICBjb25zdCBzdGF0dXMgPSBkb2N1bWVudElkLmFkZFJlc291cmNlKFwic3RhdHVzXCIpO1xuICAgIHN0YXR1cy5hZGRNZXRob2QoXCJHRVRcIixcbiAgICAgIG5ldyBhcGlnYXRld2F5Lkh0dHBJbnRlZ3JhdGlvbihgaHR0cDovLyR7cHJvcHMuaW50ZXJuYWxMb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL2RvY3VtZW50cy97aWR9L3N0YXR1c2AsIHtcbiAgICAgICAgaHR0cE1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHZwY0xpbms6IHRoaXMudnBjTGluayxcbiAgICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LnBhdGguaWRcIjogXCJtZXRob2QucmVxdWVzdC5wYXRoLmlkXCIsXG4gICAgICAgICAgICBcImludGVncmF0aW9uLnJlcXVlc3QuaGVhZGVyLlgtTWVyY2hhbnQtSWRcIjogXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnBhdGguaWRcIjogdHJ1ZSxcbiAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCI6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50RW5kcG9pbnRzKFxuICAgIHJlc291cmNlOiBhcGlnYXRld2F5LlJlc291cmNlLFxuICAgIHByb3BzOiBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzLFxuICAgIGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXJcbiAgKTogdm9pZCB7XG4gICAgLy8gUE9TVCAvdjEvYmVkcm9jay1hZ2VudC90b29scy9leGVjdXRlIC0gRXhlY3V0ZSBCZWRyb2NrIEFnZW50IHRvb2xzXG4gICAgY29uc3QgdG9vbHMgPSByZXNvdXJjZS5hZGRSZXNvdXJjZShcInRvb2xzXCIpO1xuICAgIHRvb2xzLmFkZE1ldGhvZChcIlBPU1RcIixcbiAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByb3BzLmJlZHJvY2tUb29sc0Z1bmN0aW9uLCB7XG4gICAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgdG9vbE5hbWU6IFwiJGlucHV0Lmpzb24oJyQudG9vbE5hbWUnKVwiLFxuICAgICAgICAgICAgaW5wdXQ6IFwiJGlucHV0Lmpzb24oJyQuaW5wdXQnKVwiLFxuICAgICAgICAgICAgY29udGV4dDoge1xuICAgICAgICAgICAgICBtZXJjaGFudElkOiBcIiRjb250ZXh0LmF1dGhvcml6ZXIuY2xhaW1zLm1lcmNoYW50X2lkXCIsXG4gICAgICAgICAgICAgIHVzZXJJZDogXCIkY29udGV4dC5hdXRob3JpemVyLmNsYWltcy5zdWJcIixcbiAgICAgICAgICAgICAgcmVxdWVzdElkOiBcIiRjb250ZXh0LnJlcXVlc3RJZFwiLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IFwiJGNvbnRleHQucmVxdWVzdFRpbWVFcG9jaFwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgICAgcmVzcG9uc2VUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IFwiJGlucHV0Lmpzb24oJyQnKVwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW3sgc3RhdHVzQ29kZTogXCIyMDBcIiB9XSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC92MS9iZWRyb2NrLWFnZW50L3Rvb2xzL29wZW5hcGkgLSBHZXQgT3BlbkFQSSBzcGVjaWZpY2F0aW9uXG4gICAgY29uc3Qgb3BlbmFwaSA9IHRvb2xzLmFkZFJlc291cmNlKFwib3BlbmFwaVwiKTtcbiAgICBvcGVuYXBpLmFkZE1ldGhvZChcIkdFVFwiLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuSHR0cEludGVncmF0aW9uKGBodHRwOi8vJHtwcm9wcy5pbnRlcm5hbExvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfS9hcGkvYmVkcm9jay1hZ2VudC90b29scy9vcGVuYXBpYCwge1xuICAgICAgICBodHRwTWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgdnBjTGluazogdGhpcy52cGNMaW5rLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsIC8vIFB1YmxpYyBlbmRwb2ludFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL3YxL2JlZHJvY2stYWdlbnQvY29uZmlnIC0gR2V0IEJlZHJvY2sgQWdlbnQgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGNvbmZpZyA9IHJlc291cmNlLmFkZFJlc291cmNlKFwiY29uZmlnXCIpO1xuICAgIGNvbmZpZy5hZGRNZXRob2QoXCJHRVRcIixcbiAgICAgIG5ldyBhcGlnYXRld2F5Lkh0dHBJbnRlZ3JhdGlvbihgaHR0cDovLyR7cHJvcHMuaW50ZXJuYWxMb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL2JlZHJvY2stYWdlbnQvY29uZmlnYCwge1xuICAgICAgICBodHRwTWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgdnBjTGluazogdGhpcy52cGNMaW5rLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsIC8vIFB1YmxpYyBlbmRwb2ludFxuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNoZWNrb3V0RW5kcG9pbnRzKFxuICAgIHJlc291cmNlOiBhcGlnYXRld2F5LlJlc291cmNlLFxuICAgIHByb3BzOiBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzLFxuICAgIGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXJcbiAgKTogdm9pZCB7XG4gICAgLy8gUE9TVCAvdjEvY2hlY2tvdXQvcHJvY2VzcyAtIFByb2Nlc3MgY2hlY2tvdXRcbiAgICByZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcm9wcy5jaGVja291dEZ1bmN0aW9uLCB7XG4gICAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgYWN0aW9uOiBcInByb2Nlc3NcIixcbiAgICAgICAgICAgIG1lcmNoYW50SWQ6IFwiJGNvbnRleHQuYXV0aG9yaXplci5jbGFpbXMubWVyY2hhbnRfaWRcIixcbiAgICAgICAgICAgIHVzZXJJZDogXCIkY29udGV4dC5hdXRob3JpemVyLmNsYWltcy5zdWJcIixcbiAgICAgICAgICAgIHJlcXVlc3RJZDogXCIkY29udGV4dC5yZXF1ZXN0SWRcIixcbiAgICAgICAgICAgIGl0ZW1zOiBcIiRpbnB1dC5qc29uKCckLml0ZW1zJylcIixcbiAgICAgICAgICAgIHBheW1lbnRNZXRob2Q6IFwiJGlucHV0Lmpzb24oJyQucGF5bWVudE1ldGhvZCcpXCIsXG4gICAgICAgICAgICBjdXN0b21lckluZm86IFwiJGlucHV0Lmpzb24oJyQuY3VzdG9tZXJJbmZvJylcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBQT1NUIC92MS9jaGVja291dC9jYW5jZWwgLSBDYW5jZWwgY2hlY2tvdXRcbiAgICBjb25zdCBjYW5jZWwgPSByZXNvdXJjZS5hZGRSZXNvdXJjZShcImNhbmNlbFwiKTtcbiAgICBjYW5jZWwuYWRkTWV0aG9kKFwiUE9TVFwiLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMuY2hlY2tvdXRGdW5jdGlvbiwge1xuICAgICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGFjdGlvbjogXCJjYW5jZWxcIixcbiAgICAgICAgICAgIG1lcmNoYW50SWQ6IFwiJGNvbnRleHQuYXV0aG9yaXplci5jbGFpbXMubWVyY2hhbnRfaWRcIixcbiAgICAgICAgICAgIHVzZXJJZDogXCIkY29udGV4dC5hdXRob3JpemVyLmNsYWltcy5zdWJcIixcbiAgICAgICAgICAgIHRyYW5zYWN0aW9uSWQ6IFwiJGlucHV0Lmpzb24oJyQudHJhbnNhY3Rpb25JZCcpXCIsXG4gICAgICAgICAgICByZWFzb246IFwiJGlucHV0Lmpzb24oJyQucmVhc29uJylcIixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHRVQgL3YxL2NoZWNrb3V0L3N0YXR1cy97dHJhbnNhY3Rpb25JZH0gLSBHZXQgY2hlY2tvdXQgc3RhdHVzXG4gICAgY29uc3QgdHJhbnNhY3Rpb25JZCA9IHJlc291cmNlLmFkZFJlc291cmNlKFwie3RyYW5zYWN0aW9uSWR9XCIpO1xuICAgIGNvbnN0IHN0YXR1cyA9IHRyYW5zYWN0aW9uSWQuYWRkUmVzb3VyY2UoXCJzdGF0dXNcIik7XG4gICAgc3RhdHVzLmFkZE1ldGhvZChcIkdFVFwiLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuSHR0cEludGVncmF0aW9uKGBodHRwOi8vJHtwcm9wcy5pbnRlcm5hbExvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfS9hcGkvY2hlY2tvdXQvc3RhdHVzL3t0cmFuc2FjdGlvbklkfWAsIHtcbiAgICAgICAgaHR0cE1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHZwY0xpbms6IHRoaXMudnBjTGluayxcbiAgICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LnBhdGgudHJhbnNhY3Rpb25JZFwiOiBcIm1ldGhvZC5yZXF1ZXN0LnBhdGgudHJhbnNhY3Rpb25JZFwiLFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCI6IFwibWV0aG9kLnJlcXVlc3QuaGVhZGVyLlgtTWVyY2hhbnQtSWRcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5wYXRoLnRyYW5zYWN0aW9uSWRcIjogdHJ1ZSxcbiAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCI6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlU2Vzc2lvbkVuZHBvaW50cyhcbiAgICByZXNvdXJjZTogYXBpZ2F0ZXdheS5SZXNvdXJjZSxcbiAgICBwcm9wczogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tQcm9wcyxcbiAgICBhdXRob3JpemVyOiBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyXG4gICk6IHZvaWQge1xuICAgIC8vIEdFVCAvdjEvc2Vzc2lvbnMve3Nlc3Npb25JZH0gLSBHZXQgc2Vzc2lvbiBkZXRhaWxzXG4gICAgY29uc3Qgc2Vzc2lvbklkID0gcmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7c2Vzc2lvbklkfVwiKTtcbiAgICBzZXNzaW9uSWQuYWRkTWV0aG9kKFwiR0VUXCIsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5IdHRwSW50ZWdyYXRpb24oYGh0dHA6Ly8ke3Byb3BzLmludGVybmFsTG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9zZXNzaW9ucy97c2Vzc2lvbklkfWAsIHtcbiAgICAgICAgaHR0cE1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHZwY0xpbms6IHRoaXMudnBjTGluayxcbiAgICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LnBhdGguc2Vzc2lvbklkXCI6IFwibWV0aG9kLnJlcXVlc3QucGF0aC5zZXNzaW9uSWRcIixcbiAgICAgICAgICAgIFwiaW50ZWdyYXRpb24ucmVxdWVzdC5oZWFkZXIuWC1NZXJjaGFudC1JZFwiOiBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucGF0aC5zZXNzaW9uSWRcIjogdHJ1ZSxcbiAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCI6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIERFTEVURSAvdjEvc2Vzc2lvbnMve3Nlc3Npb25JZH0gLSBEZWxldGUgc2Vzc2lvblxuICAgIHNlc3Npb25JZC5hZGRNZXRob2QoXCJERUxFVEVcIixcbiAgICAgIG5ldyBhcGlnYXRld2F5Lkh0dHBJbnRlZ3JhdGlvbihgaHR0cDovLyR7cHJvcHMuaW50ZXJuYWxMb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL3Nlc3Npb25zL3tzZXNzaW9uSWR9YCwge1xuICAgICAgICBodHRwTWV0aG9kOiBcIkRFTEVURVwiLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgdnBjTGluazogdGhpcy52cGNMaW5rLFxuICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcImludGVncmF0aW9uLnJlcXVlc3QucGF0aC5zZXNzaW9uSWRcIjogXCJtZXRob2QucmVxdWVzdC5wYXRoLnNlc3Npb25JZFwiLFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5YLU1lcmNoYW50LUlkXCI6IFwibWV0aG9kLnJlcXVlc3QuaGVhZGVyLlgtTWVyY2hhbnQtSWRcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB7XG4gICAgICAgIGF1dGhvcml6ZXIsXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5wYXRoLnNlc3Npb25JZFwiOiB0cnVlLFxuICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QuaGVhZGVyLlgtTWVyY2hhbnQtSWRcIjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVIZWFsdGhFbmRwb2ludChcbiAgICByZXNvdXJjZTogYXBpZ2F0ZXdheS5SZXNvdXJjZSxcbiAgICBwcm9wczogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tQcm9wc1xuICApOiB2b2lkIHtcbiAgICByZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIixcbiAgICAgIG5ldyBhcGlnYXRld2F5Lkh0dHBJbnRlZ3JhdGlvbihgaHR0cDovLyR7cHJvcHMuaW50ZXJuYWxMb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYXBpL2hlYWx0aGAsIHtcbiAgICAgICAgaHR0cE1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHZwY0xpbms6IHRoaXMudnBjTGluayxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFkbWluRW5kcG9pbnRzKFxuICAgIHJlc291cmNlOiBhcGlnYXRld2F5LlJlc291cmNlLFxuICAgIHByb3BzOiBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFja1Byb3BzLFxuICAgIGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXJcbiAgKTogdm9pZCB7XG4gICAgLy8gR0VUIC92MS9hZG1pbi9tZXRyaWNzIC0gUGxhdGZvcm0gbWV0cmljcyAocGxhdGZvcm0gYWRtaW4gb25seSlcbiAgICBjb25zdCBtZXRyaWNzID0gcmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJtZXRyaWNzXCIpO1xuICAgIG1ldHJpY3MuYWRkTWV0aG9kKFwiR0VUXCIsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5IdHRwSW50ZWdyYXRpb24oYGh0dHA6Ly8ke3Byb3BzLmludGVybmFsTG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9hZG1pbi9tZXRyaWNzYCwge1xuICAgICAgICBodHRwTWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgdnBjTGluazogdGhpcy52cGNMaW5rLFxuICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcImludGVncmF0aW9uLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb25cIjogXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvblwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgYXV0aG9yaXplcixcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgICAgLy8gTm90ZTogUm9sZS1iYXNlZCBhY2Nlc3MgY29udHJvbCB3b3VsZCBiZSBoYW5kbGVkIGJ5IHRoZSBiYWNrZW5kIHNlcnZpY2VcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR0VUIC92MS9hZG1pbi9tZXJjaGFudHMgLSBMaXN0IG1lcmNoYW50cyAocGxhdGZvcm0gYWRtaW4gb25seSlcbiAgICBjb25zdCBtZXJjaGFudHMgPSByZXNvdXJjZS5hZGRSZXNvdXJjZShcIm1lcmNoYW50c1wiKTtcbiAgICBtZXJjaGFudHMuYWRkTWV0aG9kKFwiR0VUXCIsXG4gICAgICBuZXcgYXBpZ2F0ZXdheS5IdHRwSW50ZWdyYXRpb24oYGh0dHA6Ly8ke3Byb3BzLmludGVybmFsTG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2FwaS9hZG1pbi9tZXJjaGFudHNgLCB7XG4gICAgICAgIGh0dHBNZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICB2cGNMaW5rOiB0aGlzLnZwY0xpbmssXG4gICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgIFwiaW50ZWdyYXRpb24ucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvblwiOiBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwaUtleUFuZFVzYWdlUGxhbihwcm9wczogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tQcm9wcyk6IHZvaWQge1xuICAgIC8vIENyZWF0ZSBBUEkga2V5IGZvciBwcm9ncmFtbWF0aWMgYWNjZXNzXG4gICAgdGhpcy5hcGlLZXkgPSBuZXcgYXBpZ2F0ZXdheS5BcGlLZXkodGhpcywgXCJNaW5kc0RCUkFHQXBpS2V5XCIsIHtcbiAgICAgIGFwaUtleU5hbWU6IGBtaW5kc2RiLXJhZy1hcGkta2V5LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFQSSBrZXkgZm9yIE1pbmRzREIgUkFHIEFzc2lzdGFudCBwcm9ncmFtbWF0aWMgYWNjZXNzXCIsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgdXNhZ2UgcGxhblxuICAgIHRoaXMudXNhZ2VQbGFuID0gbmV3IGFwaWdhdGV3YXkuVXNhZ2VQbGFuKHRoaXMsIFwiTWluZHNEQlJBR1VzYWdlUGxhblwiLCB7XG4gICAgICBuYW1lOiBgbWluZHNkYi1yYWctdXNhZ2UtcGxhbi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogXCJVc2FnZSBwbGFuIGZvciBNaW5kc0RCIFJBRyBBc3Npc3RhbnQgQVBJXCIsXG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IDEwMDAsIC8vIHJlcXVlc3RzIHBlciBzZWNvbmRcbiAgICAgICAgYnVyc3RMaW1pdDogMjAwMCwgLy8gYnVyc3QgY2FwYWNpdHlcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogMTAwMDAwMCwgLy8gcmVxdWVzdHMgcGVyIG1vbnRoXG4gICAgICAgIHBlcmlvZDogYXBpZ2F0ZXdheS5QZXJpb2QuTU9OVEgsXG4gICAgICB9LFxuICAgICAgYXBpU3RhZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhcGk6IHByb3BzLmFwaUdhdGV3YXksXG4gICAgICAgICAgc3RhZ2U6IHByb3BzLmFwaUdhdGV3YXkuZGVwbG95bWVudFN0YWdlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFzc29jaWF0ZSBBUEkga2V5IHdpdGggdXNhZ2UgcGxhblxuICAgIHRoaXMudXNhZ2VQbGFuLmFkZEFwaUtleSh0aGlzLmFwaUtleSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgLy8gVlBDIExpbmsgc2ltcGxpZmllZCBmb3Igbm93XG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJWcGNMaW5rSWRcIiwge1xuICAgIC8vICAgdmFsdWU6IHRoaXMudnBjTGluay52cGNMaW5rSWQsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogXCJWUEMgTGluayBJRCBmb3IgaW50ZXJuYWwgc2VydmljZSBpbnRlZ3JhdGlvblwiLFxuICAgIC8vIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBcGlLZXlJZFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlLZXkua2V5SWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUEkgS2V5IElEIGZvciBwcm9ncmFtbWF0aWMgYWNjZXNzXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzYWdlUGxhbklkXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzYWdlUGxhbi51c2FnZVBsYW5JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlVzYWdlIFBsYW4gSURcIixcbiAgICB9KTtcbiAgfVxufSJdfQ==