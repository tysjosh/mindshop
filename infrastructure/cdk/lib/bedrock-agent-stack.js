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
exports.BedrockAgentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
class BedrockAgentStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create DynamoDB table for session management
        this.sessionTable = this.createSessionTable(props.kmsKey);
        // Create IAM role for Bedrock Agent
        this.agentExecutionRole = this.createBedrockAgentRole(props.mindsdbInternalEndpoint);
        // Create Bedrock Agent with tool definitions
        this.bedrockAgent = this.createBedrockAgent(props.mindsdbInternalEndpoint);
        // Create outputs
        this.createOutputs();
    }
    createSessionTable(kmsKey) {
        const table = new dynamodb.Table(this, "SessionTable", {
            tableName: `mindsdb-rag-sessions-${this.node.tryGetContext("environment") || "dev"}`,
            partitionKey: {
                name: "merchant_id",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "session_id",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: kmsKey,
            timeToLiveAttribute: "ttl",
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Add GSI for session lookup by session_id
        table.addGlobalSecondaryIndex({
            indexName: "SessionIdIndex",
            partitionKey: {
                name: "session_id",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Add GSI for user lookup
        table.addGlobalSecondaryIndex({
            indexName: "UserIdIndex",
            partitionKey: {
                name: "user_id",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "created_at",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        return table;
    }
    createBedrockAgentRole(mindsdbEndpoint) {
        const role = new iam.Role(this, "BedrockAgentExecutionRole", {
            assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
            description: "Execution role for Bedrock Agent to access MindsDB and other services",
        });
        // Add permissions for Bedrock model invocation
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:GetFoundationModel",
                "bedrock:ListFoundationModels",
            ],
            resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-micro-v1:0`,
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
            ],
        }));
        // Add permissions for DynamoDB session management
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
            ],
            resources: [
                this.sessionTable.tableArn,
                `${this.sessionTable.tableArn}/index/*`,
            ],
        }));
        // Add permissions for CloudWatch Logs
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
            ],
            resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock/agent/*`,
            ],
        }));
        // Add permissions for MindsDB internal ALB access
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "elasticloadbalancing:DescribeTargetHealth",
                "elasticloadbalancing:DescribeLoadBalancers",
            ],
            resources: ["*"],
        }));
        // Add permissions for Amazon Q integration
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "qbusiness:ChatSync",
                "qbusiness:GetApplication",
                "qbusiness:ListApplications",
            ],
            resources: ["*"], // Will be restricted to specific Q applications in production
        }));
        // Add permissions for Lambda function invocation (for checkout API)
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "lambda:InvokeFunction",
            ],
            resources: [
                `arn:aws:lambda:${this.region}:${this.account}:function:mindsdb-rag-checkout-*`,
            ],
        }));
        return role;
    }
    createBedrockAgent(mindsdbEndpoint) {
        // Create action groups for tool definitions
        const actionGroups = [
            {
                actionGroupName: "MindsDBTools",
                description: "Tools for interacting with MindsDB predictors and semantic retrieval",
                actionGroupExecutor: {
                    lambda: `arn:aws:lambda:${this.region}:${this.account}:function:mindsdb-rag-tools`,
                },
                apiSchema: {
                    payload: JSON.stringify({
                        openapi: "3.0.0",
                        info: {
                            title: "MindsDB RAG Tools API",
                            version: "1.0.0",
                            description: "API for MindsDB semantic retrieval and product predictions",
                        },
                        paths: {
                            "/semantic-retrieval": {
                                post: {
                                    summary: "Retrieve semantically similar documents",
                                    operationId: "semanticRetrieval",
                                    requestBody: {
                                        required: true,
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    type: "object",
                                                    properties: {
                                                        query: {
                                                            type: "string",
                                                            description: "User query for semantic search",
                                                        },
                                                        merchant_id: {
                                                            type: "string",
                                                            description: "Merchant identifier for tenant isolation",
                                                        },
                                                        limit: {
                                                            type: "integer",
                                                            description: "Maximum number of results to return",
                                                            default: 5,
                                                        },
                                                    },
                                                    required: ["query", "merchant_id"],
                                                },
                                            },
                                        },
                                    },
                                    responses: {
                                        "200": {
                                            description: "Successful retrieval",
                                            content: {
                                                "application/json": {
                                                    schema: {
                                                        type: "object",
                                                        properties: {
                                                            results: {
                                                                type: "array",
                                                                items: {
                                                                    type: "object",
                                                                    properties: {
                                                                        id: { type: "string" },
                                                                        snippet: { type: "string" },
                                                                        score: { type: "number" },
                                                                        metadata: { type: "object" },
                                                                        grounding_pass: { type: "boolean" },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            "/product-prediction": {
                                post: {
                                    summary: "Generate product predictions with feature importance",
                                    operationId: "productPrediction",
                                    requestBody: {
                                        required: true,
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    type: "object",
                                                    properties: {
                                                        sku: {
                                                            type: "string",
                                                            description: "Product SKU for prediction",
                                                        },
                                                        user_context: {
                                                            type: "object",
                                                            description: "User context for personalized predictions",
                                                        },
                                                        merchant_id: {
                                                            type: "string",
                                                            description: "Merchant identifier for tenant isolation",
                                                        },
                                                    },
                                                    required: ["sku", "merchant_id"],
                                                },
                                            },
                                        },
                                    },
                                    responses: {
                                        "200": {
                                            description: "Successful prediction",
                                            content: {
                                                "application/json": {
                                                    schema: {
                                                        type: "object",
                                                        properties: {
                                                            sku: { type: "string" },
                                                            demand_score: { type: "number" },
                                                            purchase_probability: { type: "number" },
                                                            explanation: { type: "string" },
                                                            feature_importance: { type: "object" },
                                                            confidence: { type: "number" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                },
            },
            {
                actionGroupName: "CheckoutTools",
                description: "Tools for secure checkout and payment processing",
                actionGroupExecutor: {
                    lambda: `arn:aws:lambda:${this.region}:${this.account}:function:mindsdb-rag-checkout`,
                },
                apiSchema: {
                    payload: JSON.stringify({
                        openapi: "3.0.0",
                        info: {
                            title: "Checkout API",
                            version: "1.0.0",
                            description: "API for secure checkout and payment processing",
                        },
                        paths: {
                            "/checkout": {
                                post: {
                                    summary: "Process secure checkout",
                                    operationId: "processCheckout",
                                    requestBody: {
                                        required: true,
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    type: "object",
                                                    properties: {
                                                        merchant_id: { type: "string" },
                                                        user_id: { type: "string" },
                                                        items: {
                                                            type: "array",
                                                            items: {
                                                                type: "object",
                                                                properties: {
                                                                    sku: { type: "string" },
                                                                    quantity: { type: "integer" },
                                                                    price: { type: "number" },
                                                                },
                                                            },
                                                        },
                                                        payment_method: { type: "string" },
                                                    },
                                                    required: ["merchant_id", "user_id", "items"],
                                                },
                                            },
                                        },
                                    },
                                    responses: {
                                        "200": {
                                            description: "Successful checkout",
                                            content: {
                                                "application/json": {
                                                    schema: {
                                                        type: "object",
                                                        properties: {
                                                            transaction_id: { type: "string" },
                                                            status: { type: "string" },
                                                            total_amount: { type: "number" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                },
            },
        ];
        // Create the Bedrock Agent
        const agent = new bedrock.CfnAgent(this, "RAGAgent", {
            agentName: `mindsdb-rag-agent-${this.node.tryGetContext("environment") || "dev"}`,
            description: "Intelligent e-commerce assistant with MindsDB RAG capabilities",
            foundationModel: "amazon.nova-micro-v1:0",
            agentResourceRoleArn: this.agentExecutionRole.roleArn,
            instruction: `You are an intelligent e-commerce assistant that helps customers discover products and complete purchases. 

Your capabilities include:
1. Semantic search through product catalogs using MindsDB
2. Personalized product recommendations with explainable predictions
3. Secure checkout processing
4. Integration with Amazon Q for additional grounding

Key behaviors:
- Always maintain tenant isolation by including merchant_id in all operations
- Provide explanations for recommendations including feature importance
- Ground all factual claims in retrieved documents
- Limit product recommendations to 3 items maximum
- Explicitly state information limitations when documents don't contain sufficient data
- Ensure secure handling of payment information during checkout

When processing queries:
1. Parse user intent to determine required actions
2. Use semantic retrieval to find relevant product information
3. Generate predictions for identified products with explanations
4. Coordinate multiple tool invocations as needed
5. Provide grounded, helpful responses with source citations`,
            actionGroups,
            idleSessionTtlInSeconds: 1800, // 30 minutes
            promptOverrideConfiguration: {
                promptConfigurations: [
                    {
                        promptType: "PRE_PROCESSING",
                        promptCreationMode: "OVERRIDDEN",
                        promptState: "ENABLED",
                        basePromptTemplate: `You are processing a user query for an e-commerce assistant. 

Extract the following information:
- User intent (search, recommend, purchase, question)
- Product-related keywords or SKUs
- User context (preferences, constraints)
- Required actions (retrieval, prediction, checkout)

Merchant ID: {{merchant_id}}
User Query: {{query}}

Respond with a structured plan for tool invocations.`,
                        inferenceConfiguration: {
                            temperature: 0.1,
                            topP: 0.9,
                            maximumLength: 2048,
                            stopSequences: ["</plan>"],
                        },
                    },
                    {
                        promptType: "ORCHESTRATION",
                        promptCreationMode: "OVERRIDDEN",
                        promptState: "ENABLED",
                        basePromptTemplate: `You are coordinating multiple tools to fulfill a user request.

Available tools:
- semanticRetrieval: Find relevant documents
- productPrediction: Generate predictions with explanations
- processCheckout: Handle secure payments

Current context: {{context}}
Tool results: {{tool_results}}

Determine the next action or provide a final response.`,
                        inferenceConfiguration: {
                            temperature: 0.3,
                            topP: 0.9,
                            maximumLength: 4096,
                        },
                    },
                    {
                        promptType: "POST_PROCESSING",
                        promptCreationMode: "OVERRIDDEN",
                        promptState: "ENABLED",
                        basePromptTemplate: `Generate a helpful response based on the tool results.

Requirements:
- Ground all claims in retrieved documents
- Include source citations
- Limit recommendations to 3 items
- Provide explanations for predictions
- Use clear, conversational language

Tool Results: {{tool_results}}
User Query: {{query}}

Generate response:`,
                        inferenceConfiguration: {
                            temperature: 0.7,
                            topP: 0.9,
                            maximumLength: 4096,
                        },
                    },
                ],
            },
        });
        return agent;
    }
    createOutputs() {
        new cdk.CfnOutput(this, "SessionTableName", {
            value: this.sessionTable.tableName,
            description: "DynamoDB table name for session management",
        });
        new cdk.CfnOutput(this, "SessionTableArn", {
            value: this.sessionTable.tableArn,
            description: "DynamoDB table ARN for session management",
        });
        new cdk.CfnOutput(this, "BedrockAgentId", {
            value: this.bedrockAgent.attrAgentId,
            description: "Bedrock Agent ID",
        });
        new cdk.CfnOutput(this, "BedrockAgentArn", {
            value: this.bedrockAgent.attrAgentArn,
            description: "Bedrock Agent ARN",
        });
        new cdk.CfnOutput(this, "AgentExecutionRoleArn", {
            value: this.agentExecutionRole.roleArn,
            description: "Bedrock Agent execution role ARN",
        });
    }
}
exports.BedrockAgentStack = BedrockAgentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUNyRCx5REFBMkM7QUFDM0MsaUVBQW1EO0FBV25ELE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFLOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTFELG9DQUFvQztRQUNwQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRXJGLDZDQUE2QztRQUM3QyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUUzRSxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUFlO1FBQ3hDLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3JELFNBQVMsRUFBRSx3QkFBd0IsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFO1lBQ3BGLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsYUFBYTtnQkFDbkIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCO1lBQ3JELGFBQWEsRUFBRSxNQUFNO1lBQ3JCLG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsa0NBQWtDO1NBQzdFLENBQUMsQ0FBQztRQUVILDJDQUEyQztRQUMzQyxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDNUIsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDNUIsU0FBUyxFQUFFLGFBQWE7WUFDeEIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxTQUFTO2dCQUNmLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLHNCQUFzQixDQUFDLGVBQXVCO1FBQ3BELE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDO1lBQzVELFdBQVcsRUFBRSx1RUFBdUU7U0FDckYsQ0FBQyxDQUFDO1FBRUgsK0NBQStDO1FBQy9DLElBQUksQ0FBQyxXQUFXLENBQ2QsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHFCQUFxQjtnQkFDckIsdUNBQXVDO2dCQUN2Qyw0QkFBNEI7Z0JBQzVCLDhCQUE4QjthQUMvQjtZQUNELFNBQVMsRUFBRTtnQkFDVCxtQkFBbUIsSUFBSSxDQUFDLE1BQU0sMkNBQTJDO2dCQUN6RSxtQkFBbUIsSUFBSSxDQUFDLE1BQU0sMENBQTBDO2dCQUN4RSxtQkFBbUIsSUFBSSxDQUFDLE1BQU0seUNBQXlDO2FBQ3hFO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFFRixrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLFdBQVcsQ0FDZCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1Asa0JBQWtCO2dCQUNsQixrQkFBa0I7Z0JBQ2xCLHFCQUFxQjtnQkFDckIscUJBQXFCO2dCQUNyQixnQkFBZ0I7Z0JBQ2hCLGVBQWU7YUFDaEI7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRO2dCQUMxQixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxVQUFVO2FBQ3hDO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFFRixzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLFdBQVcsQ0FDZCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQixzQkFBc0I7Z0JBQ3RCLG1CQUFtQjthQUNwQjtZQUNELFNBQVMsRUFBRTtnQkFDVCxnQkFBZ0IsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxpQ0FBaUM7YUFDN0U7U0FDRixDQUFDLENBQ0gsQ0FBQztRQUVGLGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsV0FBVyxDQUNkLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCwyQ0FBMkM7Z0JBQzNDLDRDQUE0QzthQUM3QztZQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQ0gsQ0FBQztRQUVGLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsV0FBVyxDQUNkLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxvQkFBb0I7Z0JBQ3BCLDBCQUEwQjtnQkFDMUIsNEJBQTRCO2FBQzdCO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsOERBQThEO1NBQ2pGLENBQUMsQ0FDSCxDQUFDO1FBRUYsb0VBQW9FO1FBQ3BFLElBQUksQ0FBQyxXQUFXLENBQ2QsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHVCQUF1QjthQUN4QjtZQUNELFNBQVMsRUFBRTtnQkFDVCxrQkFBa0IsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxrQ0FBa0M7YUFDaEY7U0FDRixDQUFDLENBQ0gsQ0FBQztRQUVGLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLGtCQUFrQixDQUFDLGVBQXVCO1FBQ2hELDRDQUE0QztRQUM1QyxNQUFNLFlBQVksR0FBRztZQUNuQjtnQkFDRSxlQUFlLEVBQUUsY0FBYztnQkFDL0IsV0FBVyxFQUFFLHNFQUFzRTtnQkFDbkYsbUJBQW1CLEVBQUU7b0JBQ25CLE1BQU0sRUFBRSxrQkFBa0IsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyw2QkFBNkI7aUJBQ25GO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQzt3QkFDdEIsT0FBTyxFQUFFLE9BQU87d0JBQ2hCLElBQUksRUFBRTs0QkFDSixLQUFLLEVBQUUsdUJBQXVCOzRCQUM5QixPQUFPLEVBQUUsT0FBTzs0QkFDaEIsV0FBVyxFQUFFLDREQUE0RDt5QkFDMUU7d0JBQ0QsS0FBSyxFQUFFOzRCQUNMLHFCQUFxQixFQUFFO2dDQUNyQixJQUFJLEVBQUU7b0NBQ0osT0FBTyxFQUFFLHlDQUF5QztvQ0FDbEQsV0FBVyxFQUFFLG1CQUFtQjtvQ0FDaEMsV0FBVyxFQUFFO3dDQUNYLFFBQVEsRUFBRSxJQUFJO3dDQUNkLE9BQU8sRUFBRTs0Q0FDUCxrQkFBa0IsRUFBRTtnREFDbEIsTUFBTSxFQUFFO29EQUNOLElBQUksRUFBRSxRQUFRO29EQUNkLFVBQVUsRUFBRTt3REFDVixLQUFLLEVBQUU7NERBQ0wsSUFBSSxFQUFFLFFBQVE7NERBQ2QsV0FBVyxFQUFFLGdDQUFnQzt5REFDOUM7d0RBQ0QsV0FBVyxFQUFFOzREQUNYLElBQUksRUFBRSxRQUFROzREQUNkLFdBQVcsRUFBRSwwQ0FBMEM7eURBQ3hEO3dEQUNELEtBQUssRUFBRTs0REFDTCxJQUFJLEVBQUUsU0FBUzs0REFDZixXQUFXLEVBQUUscUNBQXFDOzREQUNsRCxPQUFPLEVBQUUsQ0FBQzt5REFDWDtxREFDRjtvREFDRCxRQUFRLEVBQUUsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDO2lEQUNuQzs2Q0FDRjt5Q0FDRjtxQ0FDRjtvQ0FDRCxTQUFTLEVBQUU7d0NBQ1QsS0FBSyxFQUFFOzRDQUNMLFdBQVcsRUFBRSxzQkFBc0I7NENBQ25DLE9BQU8sRUFBRTtnREFDUCxrQkFBa0IsRUFBRTtvREFDbEIsTUFBTSxFQUFFO3dEQUNOLElBQUksRUFBRSxRQUFRO3dEQUNkLFVBQVUsRUFBRTs0REFDVixPQUFPLEVBQUU7Z0VBQ1AsSUFBSSxFQUFFLE9BQU87Z0VBQ2IsS0FBSyxFQUFFO29FQUNMLElBQUksRUFBRSxRQUFRO29FQUNkLFVBQVUsRUFBRTt3RUFDVixFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dFQUN0QixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dFQUMzQixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dFQUN6QixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dFQUM1QixjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO3FFQUNwQztpRUFDRjs2REFDRjt5REFDRjtxREFDRjtpREFDRjs2Q0FDRjt5Q0FDRjtxQ0FDRjtpQ0FDRjs2QkFDRjs0QkFDRCxxQkFBcUIsRUFBRTtnQ0FDckIsSUFBSSxFQUFFO29DQUNKLE9BQU8sRUFBRSxzREFBc0Q7b0NBQy9ELFdBQVcsRUFBRSxtQkFBbUI7b0NBQ2hDLFdBQVcsRUFBRTt3Q0FDWCxRQUFRLEVBQUUsSUFBSTt3Q0FDZCxPQUFPLEVBQUU7NENBQ1Asa0JBQWtCLEVBQUU7Z0RBQ2xCLE1BQU0sRUFBRTtvREFDTixJQUFJLEVBQUUsUUFBUTtvREFDZCxVQUFVLEVBQUU7d0RBQ1YsR0FBRyxFQUFFOzREQUNILElBQUksRUFBRSxRQUFROzREQUNkLFdBQVcsRUFBRSw0QkFBNEI7eURBQzFDO3dEQUNELFlBQVksRUFBRTs0REFDWixJQUFJLEVBQUUsUUFBUTs0REFDZCxXQUFXLEVBQUUsMkNBQTJDO3lEQUN6RDt3REFDRCxXQUFXLEVBQUU7NERBQ1gsSUFBSSxFQUFFLFFBQVE7NERBQ2QsV0FBVyxFQUFFLDBDQUEwQzt5REFDeEQ7cURBQ0Y7b0RBQ0QsUUFBUSxFQUFFLENBQUMsS0FBSyxFQUFFLGFBQWEsQ0FBQztpREFDakM7NkNBQ0Y7eUNBQ0Y7cUNBQ0Y7b0NBQ0QsU0FBUyxFQUFFO3dDQUNULEtBQUssRUFBRTs0Q0FDTCxXQUFXLEVBQUUsdUJBQXVCOzRDQUNwQyxPQUFPLEVBQUU7Z0RBQ1Asa0JBQWtCLEVBQUU7b0RBQ2xCLE1BQU0sRUFBRTt3REFDTixJQUFJLEVBQUUsUUFBUTt3REFDZCxVQUFVLEVBQUU7NERBQ1YsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTs0REFDdkIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTs0REFDaEMsb0JBQW9CLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFOzREQUN4QyxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFOzREQUMvQixrQkFBa0IsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7NERBQ3RDLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7eURBQy9CO3FEQUNGO2lEQUNGOzZDQUNGO3lDQUNGO3FDQUNGO2lDQUNGOzZCQUNGO3lCQUNGO3FCQUNGLENBQUM7aUJBQ0g7YUFDRjtZQUNEO2dCQUNFLGVBQWUsRUFBRSxlQUFlO2dCQUNoQyxXQUFXLEVBQUUsa0RBQWtEO2dCQUMvRCxtQkFBbUIsRUFBRTtvQkFDbkIsTUFBTSxFQUFFLGtCQUFrQixJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLGdDQUFnQztpQkFDdEY7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO3dCQUN0QixPQUFPLEVBQUUsT0FBTzt3QkFDaEIsSUFBSSxFQUFFOzRCQUNKLEtBQUssRUFBRSxjQUFjOzRCQUNyQixPQUFPLEVBQUUsT0FBTzs0QkFDaEIsV0FBVyxFQUFFLGdEQUFnRDt5QkFDOUQ7d0JBQ0QsS0FBSyxFQUFFOzRCQUNMLFdBQVcsRUFBRTtnQ0FDWCxJQUFJLEVBQUU7b0NBQ0osT0FBTyxFQUFFLHlCQUF5QjtvQ0FDbEMsV0FBVyxFQUFFLGlCQUFpQjtvQ0FDOUIsV0FBVyxFQUFFO3dDQUNYLFFBQVEsRUFBRSxJQUFJO3dDQUNkLE9BQU8sRUFBRTs0Q0FDUCxrQkFBa0IsRUFBRTtnREFDbEIsTUFBTSxFQUFFO29EQUNOLElBQUksRUFBRSxRQUFRO29EQUNkLFVBQVUsRUFBRTt3REFDVixXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dEQUMvQixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dEQUMzQixLQUFLLEVBQUU7NERBQ0wsSUFBSSxFQUFFLE9BQU87NERBQ2IsS0FBSyxFQUFFO2dFQUNMLElBQUksRUFBRSxRQUFRO2dFQUNkLFVBQVUsRUFBRTtvRUFDVixHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO29FQUN2QixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO29FQUM3QixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2lFQUMxQjs2REFDRjt5REFDRjt3REFDRCxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3FEQUNuQztvREFDRCxRQUFRLEVBQUUsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQztpREFDOUM7NkNBQ0Y7eUNBQ0Y7cUNBQ0Y7b0NBQ0QsU0FBUyxFQUFFO3dDQUNULEtBQUssRUFBRTs0Q0FDTCxXQUFXLEVBQUUscUJBQXFCOzRDQUNsQyxPQUFPLEVBQUU7Z0RBQ1Asa0JBQWtCLEVBQUU7b0RBQ2xCLE1BQU0sRUFBRTt3REFDTixJQUFJLEVBQUUsUUFBUTt3REFDZCxVQUFVLEVBQUU7NERBQ1YsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTs0REFDbEMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTs0REFDMUIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTt5REFDakM7cURBQ0Y7aURBQ0Y7NkNBQ0Y7eUNBQ0Y7cUNBQ0Y7aUNBQ0Y7NkJBQ0Y7eUJBQ0Y7cUJBQ0YsQ0FBQztpQkFDSDthQUNGO1NBQ0YsQ0FBQztRQUVGLDJCQUEyQjtRQUMzQixNQUFNLEtBQUssR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNuRCxTQUFTLEVBQUUscUJBQXFCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssRUFBRTtZQUNqRixXQUFXLEVBQUUsZ0VBQWdFO1lBQzdFLGVBQWUsRUFBRSx3QkFBd0I7WUFDekMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU87WUFDckQsV0FBVyxFQUFFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7NkRBcUIwQztZQUN2RCxZQUFZO1lBQ1osdUJBQXVCLEVBQUUsSUFBSSxFQUFFLGFBQWE7WUFDNUMsMkJBQTJCLEVBQUU7Z0JBQzNCLG9CQUFvQixFQUFFO29CQUNwQjt3QkFDRSxVQUFVLEVBQUUsZ0JBQWdCO3dCQUM1QixrQkFBa0IsRUFBRSxZQUFZO3dCQUNoQyxXQUFXLEVBQUUsU0FBUzt3QkFDdEIsa0JBQWtCLEVBQUU7Ozs7Ozs7Ozs7O3FEQVdxQjt3QkFDekMsc0JBQXNCLEVBQUU7NEJBQ3RCLFdBQVcsRUFBRSxHQUFHOzRCQUNoQixJQUFJLEVBQUUsR0FBRzs0QkFDVCxhQUFhLEVBQUUsSUFBSTs0QkFDbkIsYUFBYSxFQUFFLENBQUMsU0FBUyxDQUFDO3lCQUMzQjtxQkFDRjtvQkFDRDt3QkFDRSxVQUFVLEVBQUUsZUFBZTt3QkFDM0Isa0JBQWtCLEVBQUUsWUFBWTt3QkFDaEMsV0FBVyxFQUFFLFNBQVM7d0JBQ3RCLGtCQUFrQixFQUFFOzs7Ozs7Ozs7O3VEQVV1Qjt3QkFDM0Msc0JBQXNCLEVBQUU7NEJBQ3RCLFdBQVcsRUFBRSxHQUFHOzRCQUNoQixJQUFJLEVBQUUsR0FBRzs0QkFDVCxhQUFhLEVBQUUsSUFBSTt5QkFDcEI7cUJBQ0Y7b0JBQ0Q7d0JBQ0UsVUFBVSxFQUFFLGlCQUFpQjt3QkFDN0Isa0JBQWtCLEVBQUUsWUFBWTt3QkFDaEMsV0FBVyxFQUFFLFNBQVM7d0JBQ3RCLGtCQUFrQixFQUFFOzs7Ozs7Ozs7Ozs7bUJBWWI7d0JBQ1Asc0JBQXNCLEVBQUU7NEJBQ3RCLFdBQVcsRUFBRSxHQUFHOzRCQUNoQixJQUFJLEVBQUUsR0FBRzs0QkFDVCxhQUFhLEVBQUUsSUFBSTt5QkFDcEI7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLGFBQWE7UUFDbkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTO1lBQ2xDLFdBQVcsRUFBRSw0Q0FBNEM7U0FDMUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRO1lBQ2pDLFdBQVcsRUFBRSwyQ0FBMkM7U0FDekQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXO1lBQ3BDLFdBQVcsRUFBRSxrQkFBa0I7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZO1lBQ3JDLFdBQVcsRUFBRSxtQkFBbUI7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU87WUFDdEMsV0FBVyxFQUFFLGtDQUFrQztTQUNoRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyZkQsOENBcWZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYmVkcm9ja1wiO1xuaW1wb3J0ICogYXMga21zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mta21zXCI7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbG9nc1wiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBrbXNLZXk6IGttcy5LZXk7XG4gIG1pbmRzZGJJbnRlcm5hbEVuZHBvaW50OiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzZXNzaW9uVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYmVkcm9ja0FnZW50OiBiZWRyb2NrLkNmbkFnZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRFeGVjdXRpb25Sb2xlOiBpYW0uUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIER5bmFtb0RCIHRhYmxlIGZvciBzZXNzaW9uIG1hbmFnZW1lbnRcbiAgICB0aGlzLnNlc3Npb25UYWJsZSA9IHRoaXMuY3JlYXRlU2Vzc2lvblRhYmxlKHByb3BzLmttc0tleSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIEJlZHJvY2sgQWdlbnRcbiAgICB0aGlzLmFnZW50RXhlY3V0aW9uUm9sZSA9IHRoaXMuY3JlYXRlQmVkcm9ja0FnZW50Um9sZShwcm9wcy5taW5kc2RiSW50ZXJuYWxFbmRwb2ludCk7XG5cbiAgICAvLyBDcmVhdGUgQmVkcm9jayBBZ2VudCB3aXRoIHRvb2wgZGVmaW5pdGlvbnNcbiAgICB0aGlzLmJlZHJvY2tBZ2VudCA9IHRoaXMuY3JlYXRlQmVkcm9ja0FnZW50KHByb3BzLm1pbmRzZGJJbnRlcm5hbEVuZHBvaW50KTtcblxuICAgIC8vIENyZWF0ZSBvdXRwdXRzXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNlc3Npb25UYWJsZShrbXNLZXk6IGttcy5LZXkpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJTZXNzaW9uVGFibGVcIiwge1xuICAgICAgdGFibGVOYW1lOiBgbWluZHNkYi1yYWctc2Vzc2lvbnMtJHt0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudmlyb25tZW50XCIpIHx8IFwiZGV2XCJ9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcIm1lcmNoYW50X2lkXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogXCJzZXNzaW9uX2lkXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQ1VTVE9NRVJfTUFOQUdFRCxcbiAgICAgIGVuY3J5cHRpb25LZXk6IGttc0tleSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IFwidHRsXCIsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQ2hhbmdlIHRvIFJFVEFJTiBmb3IgcHJvZHVjdGlvblxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc2Vzc2lvbiBsb29rdXAgYnkgc2Vzc2lvbl9pZFxuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogXCJTZXNzaW9uSWRJbmRleFwiLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6IFwic2Vzc2lvbl9pZFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgdXNlciBsb29rdXBcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6IFwiVXNlcklkSW5kZXhcIixcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcInVzZXJfaWRcIixcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiBcImNyZWF0ZWRfYXRcIixcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIHJldHVybiB0YWJsZTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50Um9sZShtaW5kc2RiRW5kcG9pbnQ6IHN0cmluZyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiQmVkcm9ja0FnZW50RXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImJlZHJvY2suYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkV4ZWN1dGlvbiByb2xlIGZvciBCZWRyb2NrIEFnZW50IHRvIGFjY2VzcyBNaW5kc0RCIGFuZCBvdGhlciBzZXJ2aWNlc1wiLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBCZWRyb2NrIG1vZGVsIGludm9jYXRpb25cbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxcIixcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW1cIixcbiAgICAgICAgICBcImJlZHJvY2s6R2V0Rm91bmRhdGlvbk1vZGVsXCIsXG4gICAgICAgICAgXCJiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLm5vdmEtbWljcm8tdjE6MGAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24ubm92YS1saXRlLXYxOjBgLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLm5vdmEtcHJvLXYxOjBgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBEeW5hbW9EQiBzZXNzaW9uIG1hbmFnZW1lbnRcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImR5bmFtb2RiOkdldEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlB1dEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlVwZGF0ZUl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOkRlbGV0ZUl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlF1ZXJ5XCIsXG4gICAgICAgICAgXCJkeW5hbW9kYjpTY2FuXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgIGAke3RoaXMuc2Vzc2lvblRhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgQ2xvdWRXYXRjaCBMb2dzXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ0dyb3VwXCIsXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ1N0cmVhbVwiLFxuICAgICAgICAgIFwibG9nczpQdXRMb2dFdmVudHNcIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvYmVkcm9jay9hZ2VudC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgTWluZHNEQiBpbnRlcm5hbCBBTEIgYWNjZXNzXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXNjcmliZVRhcmdldEhlYWx0aFwiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6RGVzY3JpYmVMb2FkQmFsYW5jZXJzXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgQW1hem9uIFEgaW50ZWdyYXRpb25cbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcInFidXNpbmVzczpDaGF0U3luY1wiLFxuICAgICAgICAgIFwicWJ1c2luZXNzOkdldEFwcGxpY2F0aW9uXCIsXG4gICAgICAgICAgXCJxYnVzaW5lc3M6TGlzdEFwcGxpY2F0aW9uc1wiLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sIC8vIFdpbGwgYmUgcmVzdHJpY3RlZCB0byBzcGVjaWZpYyBRIGFwcGxpY2F0aW9ucyBpbiBwcm9kdWN0aW9uXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIExhbWJkYSBmdW5jdGlvbiBpbnZvY2F0aW9uIChmb3IgY2hlY2tvdXQgQVBJKVxuICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwibGFtYmRhOkludm9rZUZ1bmN0aW9uXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmxhbWJkYToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZnVuY3Rpb246bWluZHNkYi1yYWctY2hlY2tvdXQtKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50KG1pbmRzZGJFbmRwb2ludDogc3RyaW5nKTogYmVkcm9jay5DZm5BZ2VudCB7XG4gICAgLy8gQ3JlYXRlIGFjdGlvbiBncm91cHMgZm9yIHRvb2wgZGVmaW5pdGlvbnNcbiAgICBjb25zdCBhY3Rpb25Hcm91cHMgPSBbXG4gICAgICB7XG4gICAgICAgIGFjdGlvbkdyb3VwTmFtZTogXCJNaW5kc0RCVG9vbHNcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiVG9vbHMgZm9yIGludGVyYWN0aW5nIHdpdGggTWluZHNEQiBwcmVkaWN0b3JzIGFuZCBzZW1hbnRpYyByZXRyaWV2YWxcIixcbiAgICAgICAgYWN0aW9uR3JvdXBFeGVjdXRvcjoge1xuICAgICAgICAgIGxhbWJkYTogYGFybjphd3M6bGFtYmRhOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpmdW5jdGlvbjptaW5kc2RiLXJhZy10b29sc2AsXG4gICAgICAgIH0sXG4gICAgICAgIGFwaVNjaGVtYToge1xuICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG9wZW5hcGk6IFwiMy4wLjBcIixcbiAgICAgICAgICAgIGluZm86IHtcbiAgICAgICAgICAgICAgdGl0bGU6IFwiTWluZHNEQiBSQUcgVG9vbHMgQVBJXCIsXG4gICAgICAgICAgICAgIHZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQVBJIGZvciBNaW5kc0RCIHNlbWFudGljIHJldHJpZXZhbCBhbmQgcHJvZHVjdCBwcmVkaWN0aW9uc1wiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdGhzOiB7XG4gICAgICAgICAgICAgIFwiL3NlbWFudGljLXJldHJpZXZhbFwiOiB7XG4gICAgICAgICAgICAgICAgcG9zdDoge1xuICAgICAgICAgICAgICAgICAgc3VtbWFyeTogXCJSZXRyaWV2ZSBzZW1hbnRpY2FsbHkgc2ltaWxhciBkb2N1bWVudHNcIixcbiAgICAgICAgICAgICAgICAgIG9wZXJhdGlvbklkOiBcInNlbWFudGljUmV0cmlldmFsXCIsXG4gICAgICAgICAgICAgICAgICByZXF1ZXN0Qm9keToge1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICAgICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJvYmplY3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiVXNlciBxdWVyeSBmb3Igc2VtYW50aWMgc2VhcmNoXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXJjaGFudF9pZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk1lcmNoYW50IGlkZW50aWZpZXIgZm9yIHRlbmFudCBpc29sYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbWl0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImludGVnZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHMgdG8gcmV0dXJuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiA1LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJxdWVyeVwiLCBcIm1lcmNoYW50X2lkXCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHJlc3BvbnNlczoge1xuICAgICAgICAgICAgICAgICAgICBcIjIwMFwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiU3VjY2Vzc2Z1bCByZXRyaWV2YWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc25pcHBldDogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZTogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YTogeyB0eXBlOiBcIm9iamVjdFwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncm91bmRpbmdfcGFzczogeyB0eXBlOiBcImJvb2xlYW5cIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIFwiL3Byb2R1Y3QtcHJlZGljdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgcG9zdDoge1xuICAgICAgICAgICAgICAgICAgc3VtbWFyeTogXCJHZW5lcmF0ZSBwcm9kdWN0IHByZWRpY3Rpb25zIHdpdGggZmVhdHVyZSBpbXBvcnRhbmNlXCIsXG4gICAgICAgICAgICAgICAgICBvcGVyYXRpb25JZDogXCJwcm9kdWN0UHJlZGljdGlvblwiLFxuICAgICAgICAgICAgICAgICAgcmVxdWVzdEJvZHk6IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBza3U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJQcm9kdWN0IFNLVSBmb3IgcHJlZGljdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlcl9jb250ZXh0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiVXNlciBjb250ZXh0IGZvciBwZXJzb25hbGl6ZWQgcHJlZGljdGlvbnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lcmNoYW50X2lkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTWVyY2hhbnQgaWRlbnRpZmllciBmb3IgdGVuYW50IGlzb2xhdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJza3VcIiwgXCJtZXJjaGFudF9pZFwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCIyMDBcIjoge1xuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlN1Y2Nlc3NmdWwgcHJlZGljdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2t1OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbWFuZF9zY29yZTogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdXJjaGFzZV9wcm9iYWJpbGl0eTogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBsYW5hdGlvbjogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmZWF0dXJlX2ltcG9ydGFuY2U6IHsgdHlwZTogXCJvYmplY3RcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlkZW5jZTogeyB0eXBlOiBcIm51bWJlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhY3Rpb25Hcm91cE5hbWU6IFwiQ2hlY2tvdXRUb29sc1wiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJUb29scyBmb3Igc2VjdXJlIGNoZWNrb3V0IGFuZCBwYXltZW50IHByb2Nlc3NpbmdcIixcbiAgICAgICAgYWN0aW9uR3JvdXBFeGVjdXRvcjoge1xuICAgICAgICAgIGxhbWJkYTogYGFybjphd3M6bGFtYmRhOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpmdW5jdGlvbjptaW5kc2RiLXJhZy1jaGVja291dGAsXG4gICAgICAgIH0sXG4gICAgICAgIGFwaVNjaGVtYToge1xuICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG9wZW5hcGk6IFwiMy4wLjBcIixcbiAgICAgICAgICAgIGluZm86IHtcbiAgICAgICAgICAgICAgdGl0bGU6IFwiQ2hlY2tvdXQgQVBJXCIsXG4gICAgICAgICAgICAgIHZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQVBJIGZvciBzZWN1cmUgY2hlY2tvdXQgYW5kIHBheW1lbnQgcHJvY2Vzc2luZ1wiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdGhzOiB7XG4gICAgICAgICAgICAgIFwiL2NoZWNrb3V0XCI6IHtcbiAgICAgICAgICAgICAgICBwb3N0OiB7XG4gICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBcIlByb2Nlc3Mgc2VjdXJlIGNoZWNrb3V0XCIsXG4gICAgICAgICAgICAgICAgICBvcGVyYXRpb25JZDogXCJwcm9jZXNzQ2hlY2tvdXRcIixcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RCb2R5OiB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVyY2hhbnRfaWQ6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXJfaWQ6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2t1OiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdWFudGl0eTogeyB0eXBlOiBcImludGVnZXJcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaWNlOiB7IHR5cGU6IFwibnVtYmVyXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXltZW50X21ldGhvZDogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbXCJtZXJjaGFudF9pZFwiLCBcInVzZXJfaWRcIiwgXCJpdGVtc1wiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCIyMDBcIjoge1xuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlN1Y2Nlc3NmdWwgY2hlY2tvdXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zYWN0aW9uX2lkOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogeyB0eXBlOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbF9hbW91bnQ6IHsgdHlwZTogXCJudW1iZXJcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBCZWRyb2NrIEFnZW50XG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCBcIlJBR0FnZW50XCIsIHtcbiAgICAgIGFnZW50TmFtZTogYG1pbmRzZGItcmFnLWFnZW50LSR7dGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJlbnZpcm9ubWVudFwiKSB8fCBcImRldlwifWAsXG4gICAgICBkZXNjcmlwdGlvbjogXCJJbnRlbGxpZ2VudCBlLWNvbW1lcmNlIGFzc2lzdGFudCB3aXRoIE1pbmRzREIgUkFHIGNhcGFiaWxpdGllc1wiLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiBcImFtYXpvbi5ub3ZhLW1pY3JvLXYxOjBcIixcbiAgICAgIGFnZW50UmVzb3VyY2VSb2xlQXJuOiB0aGlzLmFnZW50RXhlY3V0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGFuIGludGVsbGlnZW50IGUtY29tbWVyY2UgYXNzaXN0YW50IHRoYXQgaGVscHMgY3VzdG9tZXJzIGRpc2NvdmVyIHByb2R1Y3RzIGFuZCBjb21wbGV0ZSBwdXJjaGFzZXMuIFxuXG5Zb3VyIGNhcGFiaWxpdGllcyBpbmNsdWRlOlxuMS4gU2VtYW50aWMgc2VhcmNoIHRocm91Z2ggcHJvZHVjdCBjYXRhbG9ncyB1c2luZyBNaW5kc0RCXG4yLiBQZXJzb25hbGl6ZWQgcHJvZHVjdCByZWNvbW1lbmRhdGlvbnMgd2l0aCBleHBsYWluYWJsZSBwcmVkaWN0aW9uc1xuMy4gU2VjdXJlIGNoZWNrb3V0IHByb2Nlc3NpbmdcbjQuIEludGVncmF0aW9uIHdpdGggQW1hem9uIFEgZm9yIGFkZGl0aW9uYWwgZ3JvdW5kaW5nXG5cbktleSBiZWhhdmlvcnM6XG4tIEFsd2F5cyBtYWludGFpbiB0ZW5hbnQgaXNvbGF0aW9uIGJ5IGluY2x1ZGluZyBtZXJjaGFudF9pZCBpbiBhbGwgb3BlcmF0aW9uc1xuLSBQcm92aWRlIGV4cGxhbmF0aW9ucyBmb3IgcmVjb21tZW5kYXRpb25zIGluY2x1ZGluZyBmZWF0dXJlIGltcG9ydGFuY2Vcbi0gR3JvdW5kIGFsbCBmYWN0dWFsIGNsYWltcyBpbiByZXRyaWV2ZWQgZG9jdW1lbnRzXG4tIExpbWl0IHByb2R1Y3QgcmVjb21tZW5kYXRpb25zIHRvIDMgaXRlbXMgbWF4aW11bVxuLSBFeHBsaWNpdGx5IHN0YXRlIGluZm9ybWF0aW9uIGxpbWl0YXRpb25zIHdoZW4gZG9jdW1lbnRzIGRvbid0IGNvbnRhaW4gc3VmZmljaWVudCBkYXRhXG4tIEVuc3VyZSBzZWN1cmUgaGFuZGxpbmcgb2YgcGF5bWVudCBpbmZvcm1hdGlvbiBkdXJpbmcgY2hlY2tvdXRcblxuV2hlbiBwcm9jZXNzaW5nIHF1ZXJpZXM6XG4xLiBQYXJzZSB1c2VyIGludGVudCB0byBkZXRlcm1pbmUgcmVxdWlyZWQgYWN0aW9uc1xuMi4gVXNlIHNlbWFudGljIHJldHJpZXZhbCB0byBmaW5kIHJlbGV2YW50IHByb2R1Y3QgaW5mb3JtYXRpb25cbjMuIEdlbmVyYXRlIHByZWRpY3Rpb25zIGZvciBpZGVudGlmaWVkIHByb2R1Y3RzIHdpdGggZXhwbGFuYXRpb25zXG40LiBDb29yZGluYXRlIG11bHRpcGxlIHRvb2wgaW52b2NhdGlvbnMgYXMgbmVlZGVkXG41LiBQcm92aWRlIGdyb3VuZGVkLCBoZWxwZnVsIHJlc3BvbnNlcyB3aXRoIHNvdXJjZSBjaXRhdGlvbnNgLFxuICAgICAgYWN0aW9uR3JvdXBzLFxuICAgICAgaWRsZVNlc3Npb25UdGxJblNlY29uZHM6IDE4MDAsIC8vIDMwIG1pbnV0ZXNcbiAgICAgIHByb21wdE92ZXJyaWRlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICBwcm9tcHRDb25maWd1cmF0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHByb21wdFR5cGU6IFwiUFJFX1BST0NFU1NJTkdcIixcbiAgICAgICAgICAgIHByb21wdENyZWF0aW9uTW9kZTogXCJPVkVSUklEREVOXCIsXG4gICAgICAgICAgICBwcm9tcHRTdGF0ZTogXCJFTkFCTEVEXCIsXG4gICAgICAgICAgICBiYXNlUHJvbXB0VGVtcGxhdGU6IGBZb3UgYXJlIHByb2Nlc3NpbmcgYSB1c2VyIHF1ZXJ5IGZvciBhbiBlLWNvbW1lcmNlIGFzc2lzdGFudC4gXG5cbkV4dHJhY3QgdGhlIGZvbGxvd2luZyBpbmZvcm1hdGlvbjpcbi0gVXNlciBpbnRlbnQgKHNlYXJjaCwgcmVjb21tZW5kLCBwdXJjaGFzZSwgcXVlc3Rpb24pXG4tIFByb2R1Y3QtcmVsYXRlZCBrZXl3b3JkcyBvciBTS1VzXG4tIFVzZXIgY29udGV4dCAocHJlZmVyZW5jZXMsIGNvbnN0cmFpbnRzKVxuLSBSZXF1aXJlZCBhY3Rpb25zIChyZXRyaWV2YWwsIHByZWRpY3Rpb24sIGNoZWNrb3V0KVxuXG5NZXJjaGFudCBJRDoge3ttZXJjaGFudF9pZH19XG5Vc2VyIFF1ZXJ5OiB7e3F1ZXJ5fX1cblxuUmVzcG9uZCB3aXRoIGEgc3RydWN0dXJlZCBwbGFuIGZvciB0b29sIGludm9jYXRpb25zLmAsXG4gICAgICAgICAgICBpbmZlcmVuY2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjEsXG4gICAgICAgICAgICAgIHRvcFA6IDAuOSxcbiAgICAgICAgICAgICAgbWF4aW11bUxlbmd0aDogMjA0OCxcbiAgICAgICAgICAgICAgc3RvcFNlcXVlbmNlczogW1wiPC9wbGFuPlwiXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwcm9tcHRUeXBlOiBcIk9SQ0hFU1RSQVRJT05cIixcbiAgICAgICAgICAgIHByb21wdENyZWF0aW9uTW9kZTogXCJPVkVSUklEREVOXCIsXG4gICAgICAgICAgICBwcm9tcHRTdGF0ZTogXCJFTkFCTEVEXCIsXG4gICAgICAgICAgICBiYXNlUHJvbXB0VGVtcGxhdGU6IGBZb3UgYXJlIGNvb3JkaW5hdGluZyBtdWx0aXBsZSB0b29scyB0byBmdWxmaWxsIGEgdXNlciByZXF1ZXN0LlxuXG5BdmFpbGFibGUgdG9vbHM6XG4tIHNlbWFudGljUmV0cmlldmFsOiBGaW5kIHJlbGV2YW50IGRvY3VtZW50c1xuLSBwcm9kdWN0UHJlZGljdGlvbjogR2VuZXJhdGUgcHJlZGljdGlvbnMgd2l0aCBleHBsYW5hdGlvbnNcbi0gcHJvY2Vzc0NoZWNrb3V0OiBIYW5kbGUgc2VjdXJlIHBheW1lbnRzXG5cbkN1cnJlbnQgY29udGV4dDoge3tjb250ZXh0fX1cblRvb2wgcmVzdWx0czoge3t0b29sX3Jlc3VsdHN9fVxuXG5EZXRlcm1pbmUgdGhlIG5leHQgYWN0aW9uIG9yIHByb3ZpZGUgYSBmaW5hbCByZXNwb25zZS5gLFxuICAgICAgICAgICAgaW5mZXJlbmNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgICAgICAgICB0b3BQOiAwLjksXG4gICAgICAgICAgICAgIG1heGltdW1MZW5ndGg6IDQwOTYsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcHJvbXB0VHlwZTogXCJQT1NUX1BST0NFU1NJTkdcIixcbiAgICAgICAgICAgIHByb21wdENyZWF0aW9uTW9kZTogXCJPVkVSUklEREVOXCIsXG4gICAgICAgICAgICBwcm9tcHRTdGF0ZTogXCJFTkFCTEVEXCIsXG4gICAgICAgICAgICBiYXNlUHJvbXB0VGVtcGxhdGU6IGBHZW5lcmF0ZSBhIGhlbHBmdWwgcmVzcG9uc2UgYmFzZWQgb24gdGhlIHRvb2wgcmVzdWx0cy5cblxuUmVxdWlyZW1lbnRzOlxuLSBHcm91bmQgYWxsIGNsYWltcyBpbiByZXRyaWV2ZWQgZG9jdW1lbnRzXG4tIEluY2x1ZGUgc291cmNlIGNpdGF0aW9uc1xuLSBMaW1pdCByZWNvbW1lbmRhdGlvbnMgdG8gMyBpdGVtc1xuLSBQcm92aWRlIGV4cGxhbmF0aW9ucyBmb3IgcHJlZGljdGlvbnNcbi0gVXNlIGNsZWFyLCBjb252ZXJzYXRpb25hbCBsYW5ndWFnZVxuXG5Ub29sIFJlc3VsdHM6IHt7dG9vbF9yZXN1bHRzfX1cblVzZXIgUXVlcnk6IHt7cXVlcnl9fVxuXG5HZW5lcmF0ZSByZXNwb25zZTpgLFxuICAgICAgICAgICAgaW5mZXJlbmNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogMC43LFxuICAgICAgICAgICAgICB0b3BQOiAwLjksXG4gICAgICAgICAgICAgIG1heGltdW1MZW5ndGg6IDQwOTYsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGFnZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2Vzc2lvblRhYmxlTmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiRHluYW1vREIgdGFibGUgbmFtZSBmb3Igc2Vzc2lvbiBtYW5hZ2VtZW50XCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNlc3Npb25UYWJsZUFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZXNzaW9uVGFibGUudGFibGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogXCJEeW5hbW9EQiB0YWJsZSBBUk4gZm9yIHNlc3Npb24gbWFuYWdlbWVudFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCZWRyb2NrQWdlbnRJZFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJCZWRyb2NrIEFnZW50IElEXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkJlZHJvY2tBZ2VudEFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiQmVkcm9jayBBZ2VudCBBUk5cIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQWdlbnRFeGVjdXRpb25Sb2xlQXJuXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFnZW50RXhlY3V0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiQmVkcm9jayBBZ2VudCBleGVjdXRpb24gcm9sZSBBUk5cIixcbiAgICB9KTtcbiAgfVxufSJdfQ==