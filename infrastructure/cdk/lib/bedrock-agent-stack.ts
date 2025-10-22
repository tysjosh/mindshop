import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface BedrockAgentStackProps {
  kmsKey: kms.Key;
  mindsdbInternalEndpoint: string;
  environment: string;
}

export class BedrockAgentStack extends Construct {
  public readonly sessionTable: dynamodb.Table;
  public readonly bedrockAgent: bedrock.CfnAgent;
  public readonly agentExecutionRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentStackProps) {
    super(scope, id);

    // Create DynamoDB table for session management
    this.sessionTable = this.createSessionTable(props.kmsKey);

    // Create IAM role for Bedrock Agent
    this.agentExecutionRole = this.createBedrockAgentRole(props.mindsdbInternalEndpoint);

    // Create Bedrock Agent with tool definitions
    this.bedrockAgent = this.createBedrockAgent(props.mindsdbInternalEndpoint);

    // Create outputs
    this.createOutputs();
  }

  private createSessionTable(kmsKey: kms.Key): dynamodb.Table {
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

  private createBedrockAgentRole(mindsdbEndpoint: string): iam.Role {
    const role = new iam.Role(this, "BedrockAgentExecutionRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      description: "Execution role for Bedrock Agent to access MindsDB and other services",
    });

    // Add permissions for Bedrock model invocation
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels",
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.nova-micro-v1:0`,
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.nova-lite-v1:0`,
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.nova-pro-v1:0`,
        ],
      })
    );

    // Add permissions for DynamoDB session management
    role.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    // Add permissions for CloudWatch Logs
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/bedrock/agent/*`,
        ],
      })
    );

    // Add permissions for MindsDB internal ALB access
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeLoadBalancers",
        ],
        resources: ["*"],
      })
    );

    // Add permissions for Amazon Q integration
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "qbusiness:ChatSync",
          "qbusiness:GetApplication",
          "qbusiness:ListApplications",
        ],
        resources: ["*"], // Will be restricted to specific Q applications in production
      })
    );

    // Add permissions for Lambda function invocation (for checkout API)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "lambda:InvokeFunction",
        ],
        resources: [
          `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:mindsdb-rag-checkout-*`,
        ],
      })
    );

    return role;
  }

  private createBedrockAgent(mindsdbEndpoint: string): bedrock.CfnAgent {
    // Create action groups for tool definitions
    const actionGroups = [
      {
        actionGroupName: "MindsDBTools",
        description: "Tools for interacting with MindsDB predictors and semantic retrieval",
        actionGroupExecutor: {
          lambda: `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:mindsdb-rag-tools`,
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
          lambda: `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:mindsdb-rag-checkout`,
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

Merchant ID: $merchant_id
User Query: $query

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

Current context: $context
Tool results: $tool_results

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

Tool Results: $tool_results
User Query: $query

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

  private createOutputs(): void {
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