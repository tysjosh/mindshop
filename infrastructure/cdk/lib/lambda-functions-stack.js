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
exports.LambdaFunctionsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class LambdaFunctionsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create execution role for Lambda functions
        const lambdaExecutionRole = this.createLambdaExecutionRole(props);
        // Create Bedrock Tools Lambda function
        this.bedrockToolsFunction = this.createBedrockToolsFunction(props, lambdaExecutionRole);
        // Create Checkout Lambda function
        this.checkoutFunction = this.createCheckoutFunction(props, lambdaExecutionRole);
        // Create outputs
        this.createOutputs();
    }
    createLambdaExecutionRole(props) {
        const role = new iam.Role(this, "LambdaExecutionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
            ],
        });
        // Add permissions for DynamoDB
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
                props.sessionTableArn,
                `${props.sessionTableArn}/index/*`,
            ],
        }));
        // Add permissions for Secrets Manager
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "secretsmanager:GetSecretValue",
            ],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:mindsdb-rag/*`,
            ],
        }));
        // Add permissions for KMS
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "kms:Decrypt",
                "kms:GenerateDataKey",
            ],
            resources: [props.kmsKeyArn],
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
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`,
            ],
        }));
        // Add permissions for S3 (for audit logs)
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
            ],
            resources: [
                `arn:aws:s3:::mindsdb-rag-audit-${this.account}-${this.region}/*`,
            ],
        }));
        return role;
    }
    createBedrockToolsFunction(props, executionRole) {
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
            reservedConcurrentExecutions: 100,
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
    createCheckoutFunction(props, executionRole) {
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
            reservedConcurrentExecutions: 50,
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
    createOutputs() {
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
exports.LambdaFunctionsStack = LambdaFunctionsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWZ1bmN0aW9ucy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxhbWJkYS1mdW5jdGlvbnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDJEQUE2QztBQVc3QyxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNkNBQTZDO1FBQzdDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRWxFLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRXhGLGtDQUFrQztRQUNsQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRWhGLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVPLHlCQUF5QixDQUFDLEtBQWdDO1FBQ2hFLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDckQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDhDQUE4QyxDQUFDO2FBQzNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgs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aW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIGVjMiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjMlwiO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxvZ3NcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFtYmRhRnVuY3Rpb25zU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgdnBjOiBlYzIuVnBjO1xuICBrbXNLZXlBcm46IHN0cmluZztcbiAgc2Vzc2lvblRhYmxlQXJuOiBzdHJpbmc7XG4gIG1pbmRzZGJJbnRlcm5hbEVuZHBvaW50OiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFGdW5jdGlvbnNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrVG9vbHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgY2hlY2tvdXRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBMYW1iZGFGdW5jdGlvbnNTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgZXhlY3V0aW9uIHJvbGUgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBsYW1iZGFFeGVjdXRpb25Sb2xlID0gdGhpcy5jcmVhdGVMYW1iZGFFeGVjdXRpb25Sb2xlKHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBCZWRyb2NrIFRvb2xzIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMuYmVkcm9ja1Rvb2xzRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUJlZHJvY2tUb29sc0Z1bmN0aW9uKHByb3BzLCBsYW1iZGFFeGVjdXRpb25Sb2xlKTtcblxuICAgIC8vIENyZWF0ZSBDaGVja291dCBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLmNoZWNrb3V0RnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUNoZWNrb3V0RnVuY3Rpb24ocHJvcHMsIGxhbWJkYUV4ZWN1dGlvblJvbGUpO1xuXG4gICAgLy8gQ3JlYXRlIG91dHB1dHNcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRXhlY3V0aW9uUm9sZShwcm9wczogTGFtYmRhRnVuY3Rpb25zU3RhY2tQcm9wcyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiTGFtYmRhRXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImxhbWJkYS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlXCIpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgRHluYW1vREJcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImR5bmFtb2RiOkdldEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlB1dEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlVwZGF0ZUl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOkRlbGV0ZUl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlF1ZXJ5XCIsXG4gICAgICAgICAgXCJkeW5hbW9kYjpTY2FuXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHByb3BzLnNlc3Npb25UYWJsZUFybixcbiAgICAgICAgICBgJHtwcm9wcy5zZXNzaW9uVGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBTZWNyZXRzIE1hbmFnZXJcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzZWNyZXQ6bWluZHNkYi1yYWcvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIEtNU1xuICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwia21zOkRlY3J5cHRcIixcbiAgICAgICAgICBcImttczpHZW5lcmF0ZURhdGFLZXlcIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbcHJvcHMua21zS2V5QXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgQ2xvdWRXYXRjaCBMb2dzXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ0dyb3VwXCIsXG4gICAgICAgICAgXCJsb2dzOkNyZWF0ZUxvZ1N0cmVhbVwiLFxuICAgICAgICAgIFwibG9nczpQdXRMb2dFdmVudHNcIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBTMyAoZm9yIGF1ZGl0IGxvZ3MpXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJzMzpHZXRPYmplY3RcIixcbiAgICAgICAgICBcInMzOlB1dE9iamVjdFwiLFxuICAgICAgICAgIFwiczM6RGVsZXRlT2JqZWN0XCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOnMzOjo6bWluZHNkYi1yYWctYXVkaXQtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tUb29sc0Z1bmN0aW9uKFxuICAgIHByb3BzOiBMYW1iZGFGdW5jdGlvbnNTdGFja1Byb3BzLFxuICAgIGV4ZWN1dGlvblJvbGU6IGlhbS5Sb2xlXG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgY29uc3QgZnVuYyA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJCZWRyb2NrVG9vbHNGdW5jdGlvblwiLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBtaW5kc2RiLXJhZy10b29scy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6IFwiYmVkcm9ja1Rvb2xzSGFuZGxlci5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi8uLi9kaXN0L2xhbWJkYVwiKSxcbiAgICAgIHJvbGU6IGV4ZWN1dGlvblJvbGUsXG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIFNFU1NJT05fVEFCTEVfTkFNRTogcHJvcHMuc2Vzc2lvblRhYmxlQXJuLnNwbGl0KCcvJylbMV0sXG4gICAgICAgIE1JTkRTREJfRU5EUE9JTlQ6IHByb3BzLm1pbmRzZGJJbnRlcm5hbEVuZHBvaW50LFxuICAgICAgICBMT0dfTEVWRUw6IFwiaW5mb1wiLFxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZUVuYWJsZWQ6IHRydWUsXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMDAsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgaGVhbHRoIGNoZWNrIGZ1bmN0aW9uXG4gICAgbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkJlZHJvY2tUb29sc0hlYWx0aEZ1bmN0aW9uXCIsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYG1pbmRzZGItcmFnLXRvb2xzLWhlYWx0aC0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6IFwiYmVkcm9ja1Rvb2xzSGFuZGxlci5oZWFsdGhIYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi8uLi9kaXN0L2xhbWJkYVwiKSxcbiAgICAgIHJvbGU6IGV4ZWN1dGlvblJvbGUsXG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIE1JTkRTREJfRU5EUE9JTlQ6IHByb3BzLm1pbmRzZGJJbnRlcm5hbEVuZHBvaW50LFxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNoZWNrb3V0RnVuY3Rpb24oXG4gICAgcHJvcHM6IExhbWJkYUZ1bmN0aW9uc1N0YWNrUHJvcHMsXG4gICAgZXhlY3V0aW9uUm9sZTogaWFtLlJvbGVcbiAgKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBjb25zdCBmdW5jID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkNoZWNrb3V0RnVuY3Rpb25cIiwge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgbWluZHNkYi1yYWctY2hlY2tvdXQtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiBcImNoZWNrb3V0SGFuZGxlci5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi8uLi9kaXN0L2xhbWJkYVwiKSxcbiAgICAgIHJvbGU6IGV4ZWN1dGlvblJvbGUsXG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygyKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfRU5WOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiBwcm9wcy5zZXNzaW9uVGFibGVBcm4uc3BsaXQoJy8nKVsxXSxcbiAgICAgICAgTE9HX0xFVkVMOiBcImluZm9cIixcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICBkZWFkTGV0dGVyUXVldWVFbmFibGVkOiB0cnVlLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogNTAsXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgaGVhbHRoIGNoZWNrIGZ1bmN0aW9uXG4gICAgbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkNoZWNrb3V0SGVhbHRoRnVuY3Rpb25cIiwge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgbWluZHNkYi1yYWctY2hlY2tvdXQtaGVhbHRoLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogXCJjaGVja291dEhhbmRsZXIuaGVhbHRoSGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwiLi4vLi4vZGlzdC9sYW1iZGFcIiksXG4gICAgICByb2xlOiBleGVjdXRpb25Sb2xlLFxuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCZWRyb2NrVG9vbHNGdW5jdGlvbkFyblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrVG9vbHNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkJlZHJvY2sgVG9vbHMgTGFtYmRhIEZ1bmN0aW9uIEFSTlwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCZWRyb2NrVG9vbHNGdW5jdGlvbk5hbWVcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja1Rvb2xzRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiQmVkcm9jayBUb29scyBMYW1iZGEgRnVuY3Rpb24gTmFtZVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJDaGVja291dEZ1bmN0aW9uQXJuXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNoZWNrb3V0RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogXCJDaGVja291dCBMYW1iZGEgRnVuY3Rpb24gQVJOXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkNoZWNrb3V0RnVuY3Rpb25OYW1lXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNoZWNrb3V0RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2hlY2tvdXQgTGFtYmRhIEZ1bmN0aW9uIE5hbWVcIixcbiAgICB9KTtcbiAgfVxufSJdfQ==