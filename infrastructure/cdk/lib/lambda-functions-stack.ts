import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface LambdaFunctionsStackProps {
  vpc: ec2.Vpc;
  kmsKeyArn: string;
  sessionTableArn: string;
  mindsdbInternalEndpoint: string;
  environment: string;
}

export class LambdaFunctionsStack extends Construct {
  public readonly bedrockToolsFunction: lambda.Function;
  public readonly checkoutFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionsStackProps) {
    super(scope, id);

    // Create execution role for Lambda functions
    const lambdaExecutionRole = this.createLambdaExecutionRole(props);

    // Create Bedrock Tools Lambda function
    this.bedrockToolsFunction = this.createBedrockToolsFunction(props, lambdaExecutionRole);

    // Create Checkout Lambda function
    this.checkoutFunction = this.createCheckoutFunction(props, lambdaExecutionRole);

    // Create outputs
    this.createOutputs();
  }

  private createLambdaExecutionRole(props: LambdaFunctionsStackProps): iam.Role {
    const role = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
      ],
    });

    // Add permissions for DynamoDB
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
          props.sessionTableArn,
          `${props.sessionTableArn}/index/*`,
        ],
      })
    );

    // Add permissions for Secrets Manager
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
        ],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:mindsdb-rag/*`,
        ],
      })
    );

    // Add permissions for KMS
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "kms:Decrypt",
          "kms:GenerateDataKey",
        ],
        resources: [props.kmsKeyArn],
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
          `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/*`,
        ],
      })
    );

    // Add permissions for S3 (for audit logs)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ],
        resources: [
          `arn:aws:s3:::mindsdb-rag-audit-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}/*`,
        ],
      })
    );

    return role;
  }

  private createBedrockToolsFunction(
    props: LambdaFunctionsStackProps,
    executionRole: iam.Role
  ): lambda.Function {
    const func = new lambda.Function(this, "BedrockToolsFunction", {
      functionName: `mindsdb-rag-tools-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "bedrockToolsHandler.handler",
      code: lambda.Code.fromAsset("../../dist/lambda"),
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        NODE_ENV: props.environment,
        SESSION_TABLE_NAME: props.sessionTableArn.split('/')[1],
        MINDSDB_ENDPOINT: props.mindsdbInternalEndpoint,
        LOG_LEVEL: "info",
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      deadLetterQueueEnabled: true,
      // reservedConcurrentExecutions: 100, // Removed to avoid account limits
    });

    // Create health check function
    new lambda.Function(this, "BedrockToolsHealthFunction", {
      functionName: `mindsdb-rag-tools-health-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "bedrockToolsHandler.healthHandler",
      code: lambda.Code.fromAsset("../../dist/lambda"),
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        NODE_ENV: props.environment,
        MINDSDB_ENDPOINT: props.mindsdbInternalEndpoint,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    return func;
  }

  private createCheckoutFunction(
    props: LambdaFunctionsStackProps,
    executionRole: iam.Role
  ): lambda.Function {
    const func = new lambda.Function(this, "CheckoutFunction", {
      functionName: `mindsdb-rag-checkout-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "checkoutHandler.handler",
      code: lambda.Code.fromAsset("../../dist/lambda"),
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        NODE_ENV: props.environment,
        SESSION_TABLE_NAME: props.sessionTableArn.split('/')[1],
        LOG_LEVEL: "info",
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      deadLetterQueueEnabled: true,
      // reservedConcurrentExecutions: 50, // Removed to avoid account limits
    });

    // Create health check function
    new lambda.Function(this, "CheckoutHealthFunction", {
      functionName: `mindsdb-rag-checkout-health-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "checkoutHandler.healthHandler",
      code: lambda.Code.fromAsset("../../dist/lambda"),
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        NODE_ENV: props.environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    return func;
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, "BedrockToolsFunctionArn", {
      value: this.bedrockToolsFunction.functionArn,
      description: "Bedrock Tools Lambda Function ARN",
    });

    new cdk.CfnOutput(this, "BedrockToolsFunctionName", {
      value: this.bedrockToolsFunction.functionName,
      description: "Bedrock Tools Lambda Function Name",
    });

    new cdk.CfnOutput(this, "CheckoutFunctionArn", {
      value: this.checkoutFunction.functionArn,
      description: "Checkout Lambda Function ARN",
    });

    new cdk.CfnOutput(this, "CheckoutFunctionName", {
      value: this.checkoutFunction.functionName,
      description: "Checkout Lambda Function Name",
    });
  }
}