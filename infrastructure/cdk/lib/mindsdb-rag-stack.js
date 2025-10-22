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
exports.MindsDBRAGStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const elasticache = __importStar(require("aws-cdk-lib/aws-elasticache"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const mindsdb_service_1 = require("./mindsdb-service");
const bedrock_agent_stack_1 = require("./bedrock-agent-stack");
const lambda_functions_stack_1 = require("./lambda-functions-stack");
const auth_security_stack_1 = require("./auth-security-stack");
const api_gateway_integration_stack_1 = require("./api-gateway-integration-stack");
const monitoring_alerting_stack_1 = require("./monitoring-alerting-stack");
class MindsDBRAGStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create KMS key for encryption
        this.kmsKey = new kms.Key(this, "RAGEncryptionKey", {
            description: "KMS key for MindsDB RAG Assistant encryption",
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Create VPC with private and public subnets
        this.vpc = new ec2.Vpc(this, "RAGVpc", {
            maxAzs: 3,
            natGateways: 2, // For high availability
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: "Public",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: "Private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 28,
                    name: "Database",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
            enableDnsHostnames: true,
            enableDnsSupport: true,
        });
        // Create VPC endpoints for AWS services
        this.createVpcEndpoints();
        // Create security groups
        const securityGroups = this.createSecurityGroups();
        // Create Aurora PostgreSQL cluster
        this.database = this.createAuroraCluster(securityGroups.database);
        // Create ElastiCache Redis cluster
        this.redis = this.createRedisCluster(securityGroups.redis);
        // Create ECS cluster
        this.cluster = this.createECSCluster();
        // Create S3 buckets
        const buckets = this.createS3Buckets();
        this.documentsBucket = buckets.documents;
        this.modelArtifactsBucket = buckets.models;
        this.auditLogsBucket = buckets.audit;
        // Create IAM roles
        this.createIAMRoles();
        // Create secrets in Secrets Manager
        const secrets = this.createSecrets();
        // Deploy MindsDB service
        this.mindsdbService = new mindsdb_service_1.MindsDBService(this, "MindsDBService", {
            vpc: this.vpc,
            cluster: this.cluster,
            databaseEndpoint: this.database.clusterEndpoint.hostname,
            databaseCredentialsSecret: secrets.databaseCredentials,
            kmsKeyArn: this.kmsKey.keyArn,
            environment: props.environment,
        });
        // Deploy Bedrock Agent infrastructure
        this.bedrockAgentStack = new bedrock_agent_stack_1.BedrockAgentStack(this, "BedrockAgentStack", {
            kmsKey: this.kmsKey,
            mindsdbInternalEndpoint: this.mindsdbService.getInternalEndpoint(),
            environment: props.environment,
        });
        // Deploy Lambda functions
        this.lambdaFunctionsStack = new lambda_functions_stack_1.LambdaFunctionsStack(this, "LambdaFunctionsStack", {
            vpc: this.vpc,
            kmsKeyArn: this.kmsKey.keyArn,
            sessionTableArn: this.bedrockAgentStack.sessionTable.tableArn,
            mindsdbInternalEndpoint: this.mindsdbService.getInternalEndpoint(),
            environment: props.environment,
        });
        // Deploy Authentication and Security infrastructure
        this.authSecurityStack = new auth_security_stack_1.AuthSecurityStack(this, "AuthSecurityStack", {
            kmsKey: this.kmsKey,
            environment: props.environment,
        });
        // Deploy API Gateway integration
        this.apiGatewayIntegrationStack = new api_gateway_integration_stack_1.ApiGatewayIntegrationStack(this, "ApiGatewayIntegrationStack", {
            vpc: this.vpc,
            apiGateway: this.authSecurityStack.apiGateway,
            cognitoAuthorizer: this.authSecurityStack.cognitoAuthorizer,
            internalLoadBalancer: this.mindsdbService.loadBalancer,
            bedrockToolsFunction: this.lambdaFunctionsStack.bedrockToolsFunction,
            checkoutFunction: this.lambdaFunctionsStack.checkoutFunction,
            environment: props.environment,
        });
        // Deploy monitoring and alerting
        this.monitoringAlertingStack = new monitoring_alerting_stack_1.MonitoringAlertingStack(this, "MonitoringAlertingStack", {
            ecsCluster: this.cluster,
            ecsService: this.mindsdbService.service,
            database: this.database,
            redis: this.redis,
            apiGateway: this.authSecurityStack.apiGateway,
            lambdaFunctions: [
                this.lambdaFunctionsStack.bedrockToolsFunction,
                this.lambdaFunctionsStack.checkoutFunction,
            ],
            alertEmail: process.env.ALERT_EMAIL,
            environment: props.environment,
        });
        // Output important values
        this.createOutputs();
    }
    createVpcEndpoints() {
        // S3 Gateway endpoint
        this.vpc.addGatewayEndpoint("S3Endpoint", {
            service: ec2.GatewayVpcEndpointAwsService.S3,
        });
        // Interface endpoints for other AWS services
        const services = [
            ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            ec2.InterfaceVpcEndpointAwsService.KMS,
            ec2.InterfaceVpcEndpointAwsService.BEDROCK,
            ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
            ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            ec2.InterfaceVpcEndpointAwsService.ECR,
            ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        ];
        services.forEach((service, index) => {
            this.vpc.addInterfaceEndpoint(`VpcEndpoint${index}`, {
                service,
                privateDnsEnabled: true,
            });
        });
    }
    createSecurityGroups() {
        // ALB Security Group
        const albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
            vpc: this.vpc,
            description: "Security group for Application Load Balancer",
            allowAllOutbound: true,
        });
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS traffic");
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP traffic");
        // ECS Security Group
        const ecsSecurityGroup = new ec2.SecurityGroup(this, "ECSSecurityGroup", {
            vpc: this.vpc,
            description: "Security group for ECS tasks",
            allowAllOutbound: true,
        });
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), "Allow traffic from ALB");
        // Database Security Group
        const databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
            vpc: this.vpc,
            description: "Security group for Aurora PostgreSQL",
            allowAllOutbound: false,
        });
        databaseSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), "Allow PostgreSQL access from ECS");
        // Redis Security Group
        const redisSecurityGroup = new ec2.SecurityGroup(this, "RedisSecurityGroup", {
            vpc: this.vpc,
            description: "Security group for ElastiCache Redis",
            allowAllOutbound: false,
        });
        redisSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(6379), "Allow Redis access from ECS");
        return {
            alb: albSecurityGroup,
            ecs: ecsSecurityGroup,
            database: databaseSecurityGroup,
            redis: redisSecurityGroup,
        };
    }
    createAuroraCluster(securityGroup) {
        // Create subnet group for database
        const subnetGroup = new rds.SubnetGroup(this, "DatabaseSubnetGroup", {
            vpc: this.vpc,
            description: "Subnet group for Aurora PostgreSQL",
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
        });
        // Create parameter group for pgvector
        const parameterGroup = new rds.ParameterGroup(this, "PostgreSQLParameterGroup", {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_15_4,
            }),
            description: "Parameter group for Aurora PostgreSQL with pgvector",
            parameters: {
                shared_preload_libraries: "vector",
                log_statement: "all",
                log_min_duration_statement: "1000",
            },
        });
        // Create Aurora cluster
        const cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_15_4,
            }),
            credentials: rds.Credentials.fromGeneratedSecret("postgres", {
                secretName: "mindsdb-rag/aurora-credentials",
                encryptionKey: this.kmsKey,
            }),
            instanceProps: {
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
                vpc: this.vpc,
                securityGroups: [securityGroup],
            },
            instances: 2, // Writer + Reader
            parameterGroup,
            subnetGroup,
            storageEncrypted: true,
            storageEncryptionKey: this.kmsKey,
            backup: {
                retention: cdk.Duration.days(7),
                preferredWindow: "03:00-04:00",
            },
            preferredMaintenanceWindow: "sun:04:00-sun:05:00",
            cloudwatchLogsExports: ["postgresql"],
            cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
            deletionProtection: false, // Set to true for production
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        return cluster;
    }
    createRedisCluster(securityGroup) {
        // Create subnet group for Redis
        const subnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
            description: "Subnet group for ElastiCache Redis",
            subnetIds: this.vpc.privateSubnets.map((subnet) => subnet.subnetId),
        });
        // Create parameter group for Redis
        const parameterGroup = new elasticache.CfnParameterGroup(this, "RedisParameterGroup", {
            cacheParameterGroupFamily: "redis7.x",
            description: "Parameter group for Redis 7.x",
            properties: {
                "maxmemory-policy": "allkeys-lru",
            },
        });
        // Create Redis cluster
        const redis = new elasticache.CfnCacheCluster(this, "RedisCluster", {
            cacheNodeType: "cache.r6g.large",
            engine: "redis",
            engineVersion: "7.0",
            numCacheNodes: 1,
            cacheParameterGroupName: parameterGroup.ref,
            cacheSubnetGroupName: subnetGroup.ref,
            vpcSecurityGroupIds: [securityGroup.securityGroupId],
            transitEncryptionEnabled: true,
            preferredMaintenanceWindow: "sun:05:00-sun:06:00",
            snapshotRetentionLimit: 5,
            snapshotWindow: "03:00-05:00",
        });
        redis.addDependency(subnetGroup);
        redis.addDependency(parameterGroup);
        return redis;
    }
    createECSCluster() {
        const cluster = new ecs.Cluster(this, "ECSCluster", {
            vpc: this.vpc,
            clusterName: `mindsdb-rag-${this.node.tryGetContext("environment") || "dev"}`,
            enableFargateCapacityProviders: true,
        });
        return cluster;
    }
    createS3Buckets() {
        // Document storage bucket
        const documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
            bucketName: `mindsdb-rag-documents-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.kmsKey,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            lifecycleRules: [
                {
                    id: "DeleteOldVersions",
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Model artifacts bucket
        const modelArtifactsBucket = new s3.Bucket(this, "ModelArtifactsBucket", {
            bucketName: `mindsdb-rag-models-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.kmsKey,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Audit logs bucket
        const auditLogsBucket = new s3.Bucket(this, "AuditLogsBucket", {
            bucketName: `mindsdb-rag-audit-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.kmsKey,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    id: "ArchiveOldLogs",
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                    expiration: cdk.Duration.days(2555), // 7 years
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        return {
            documents: documentsBucket,
            models: modelArtifactsBucket,
            audit: auditLogsBucket,
        };
    }
    createIAMRoles() {
        // ECS Task Execution Role
        const ecsTaskExecutionRole = new iam.Role(this, "ECSTaskExecutionRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
            ],
        });
        // Add permissions for Secrets Manager and KMS
        ecsTaskExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
            resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:mindsdb-rag/*`,
                this.kmsKey.keyArn,
            ],
        }));
        // ECS Task Role
        const ecsTaskRole = new iam.Role(this, "ECSTaskRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        // Add permissions for MindsDB service
        ecsTaskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "secretsmanager:GetSecretValue",
                "kms:Decrypt",
                "kms:GenerateDataKey",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
            ],
            resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/*`,
                `arn:aws:s3:::mindsdb-rag-*/*`,
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:mindsdb-rag/*`,
                this.kmsKey.keyArn,
                `arn:aws:logs:${this.region}:${this.account}:*`,
            ],
        }));
        // Lambda Execution Role (for future Lambda functions)
        new iam.Role(this, "LambdaExecutionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
            ],
        });
    }
    createSecrets() {
        // Database credentials (already created by Aurora cluster)
        const databaseCredentials = secretsmanager.Secret.fromSecretNameV2(this, "DatabaseCredentials", "mindsdb-rag/aurora-credentials");
        // MindsDB API credentials
        const mindsdbCredentials = new secretsmanager.Secret(this, "MindsDBCredentials", {
            secretName: "mindsdb-rag/mindsdb-api-key",
            description: "MindsDB API credentials",
            encryptionKey: this.kmsKey,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: "mindsdb" }),
                generateStringKey: "apiKey",
                excludeCharacters: '"@/\\',
            },
        });
        // Bedrock configuration
        const bedrockConfig = new secretsmanager.Secret(this, "BedrockConfig", {
            secretName: "mindsdb-rag/bedrock-config",
            description: "Bedrock model configuration",
            encryptionKey: this.kmsKey,
            secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
                modelId: "amazon.nova-micro-v1:0",
                region: this.region,
                maxTokens: 4096,
                temperature: 0.7,
            })),
        });
        // Redis connection string
        const redisConfig = new secretsmanager.Secret(this, "RedisConfig", {
            secretName: "mindsdb-rag/redis-config",
            description: "Redis connection configuration",
            encryptionKey: this.kmsKey,
            secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
                host: this.redis.attrRedisEndpointAddress,
                port: this.redis.attrRedisEndpointPort,
                ssl: true,
            })),
        });
        return {
            databaseCredentials,
            mindsdbCredentials,
            bedrockConfig,
            redisConfig,
        };
    }
    createOutputs() {
        new cdk.CfnOutput(this, "VpcId", {
            value: this.vpc.vpcId,
            description: "VPC ID",
        });
        new cdk.CfnOutput(this, "ECSClusterName", {
            value: this.cluster.clusterName,
            description: "ECS Cluster Name",
        });
        new cdk.CfnOutput(this, "DatabaseEndpoint", {
            value: this.database.clusterEndpoint.hostname,
            description: "Aurora PostgreSQL Cluster Endpoint",
        });
        new cdk.CfnOutput(this, "RedisEndpoint", {
            value: this.redis.attrRedisEndpointAddress,
            description: "ElastiCache Redis Endpoint",
        });
        new cdk.CfnOutput(this, "KMSKeyId", {
            value: this.kmsKey.keyId,
            description: "KMS Key ID for encryption",
        });
        new cdk.CfnOutput(this, "MindsDBInternalEndpoint", {
            value: this.mindsdbService.getInternalEndpoint(),
            description: "MindsDB Internal Load Balancer Endpoint",
        });
        new cdk.CfnOutput(this, "MindsDBServiceName", {
            value: this.mindsdbService.service.serviceName,
            description: "MindsDB ECS Service Name",
        });
    }
}
exports.MindsDBRAGStack = MindsDBRAGStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZHNkYi1yYWctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtaW5kc2RiLXJhZy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywrRUFBaUU7QUFDakUseUVBQTJEO0FBQzNELHVEQUF5QztBQUN6QywyREFBNkM7QUFFN0MsdURBQW1EO0FBQ25ELCtEQUEwRDtBQUMxRCxxRUFBZ0U7QUFDaEUsK0RBQTBEO0FBQzFELG1GQUE2RTtBQUM3RSwyRUFBc0U7QUFPdEUsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBZ0I1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGdDQUFnQztRQUNoQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDbEQsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxrQ0FBa0M7U0FDN0UsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDckMsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQyxFQUFFLHdCQUF3QjtZQUN4QyxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFB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SSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUM5QyxXQUFXLEVBQUUsMEJBQTBCO1NBQ3hDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVrQkQsMENBNGtCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGVjMiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjMlwiO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtcmRzXCI7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lY3NcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMga21zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mta21zXCI7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyXCI7XG5pbXBvcnQgKiBhcyBlbGFzdGljYWNoZSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVsYXN0aWNhY2hlXCI7XG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXMzXCI7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbG9nc1wiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCB7IE1pbmRzREJTZXJ2aWNlIH0gZnJvbSBcIi4vbWluZHNkYi1zZXJ2aWNlXCI7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRTdGFjayB9IGZyb20gXCIuL2JlZHJvY2stYWdlbnQtc3RhY2tcIjtcbmltcG9ydCB7IExhbWJkYUZ1bmN0aW9uc1N0YWNrIH0gZnJvbSBcIi4vbGFtYmRhLWZ1bmN0aW9ucy1zdGFja1wiO1xuaW1wb3J0IHsgQXV0aFNlY3VyaXR5U3RhY2sgfSBmcm9tIFwiLi9hdXRoLXNlY3VyaXR5LXN0YWNrXCI7XG5pbXBvcnQgeyBBcGlHYXRld2F5SW50ZWdyYXRpb25TdGFjayB9IGZyb20gXCIuL2FwaS1nYXRld2F5LWludGVncmF0aW9uLXN0YWNrXCI7XG5pbXBvcnQgeyBNb25pdG9yaW5nQWxlcnRpbmdTdGFjayB9IGZyb20gXCIuL21vbml0b3JpbmctYWxlcnRpbmctc3RhY2tcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNaW5kc0RCUkFHU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhY2tOYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBNaW5kc0RCUkFHU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBlYzIuVnBjO1xuICBwdWJsaWMgcmVhZG9ubHkgY2x1c3RlcjogZWNzLkNsdXN0ZXI7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhYmFzZTogcmRzLkRhdGFiYXNlQ2x1c3RlcjtcbiAgcHVibGljIHJlYWRvbmx5IHJlZGlzOiBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXI7XG4gIHB1YmxpYyByZWFkb25seSBrbXNLZXk6IGttcy5LZXk7XG4gIHB1YmxpYyByZWFkb25seSBtaW5kc2RiU2VydmljZTogTWluZHNEQlNlcnZpY2U7XG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrQWdlbnRTdGFjazogQmVkcm9ja0FnZW50U3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFGdW5jdGlvbnNTdGFjazogTGFtYmRhRnVuY3Rpb25zU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBhdXRoU2VjdXJpdHlTdGFjazogQXV0aFNlY3VyaXR5U3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBhcGlHYXRld2F5SW50ZWdyYXRpb25TdGFjazogQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBtb25pdG9yaW5nQWxlcnRpbmdTdGFjazogTW9uaXRvcmluZ0FsZXJ0aW5nU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBkb2N1bWVudHNCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IG1vZGVsQXJ0aWZhY3RzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBhdWRpdExvZ3NCdWNrZXQ6IHMzLkJ1Y2tldDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTWluZHNEQlJBR1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBLTVMga2V5IGZvciBlbmNyeXB0aW9uXG4gICAgdGhpcy5rbXNLZXkgPSBuZXcga21zLktleSh0aGlzLCBcIlJBR0VuY3J5cHRpb25LZXlcIiwge1xuICAgICAgZGVzY3JpcHRpb246IFwiS01TIGtleSBmb3IgTWluZHNEQiBSQUcgQXNzaXN0YW50IGVuY3J5cHRpb25cIixcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQ2hhbmdlIHRvIFJFVEFJTiBmb3IgcHJvZHVjdGlvblxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFZQQyB3aXRoIHByaXZhdGUgYW5kIHB1YmxpYyBzdWJuZXRzXG4gICAgdGhpcy52cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBcIlJBR1ZwY1wiLCB7XG4gICAgICBtYXhBenM6IDMsXG4gICAgICBuYXRHYXRld2F5czogMiwgLy8gRm9yIGhpZ2ggYXZhaWxhYmlsaXR5XG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogXCJQdWJsaWNcIixcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogXCJQcml2YXRlXCIsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyOCxcbiAgICAgICAgICBuYW1lOiBcIkRhdGFiYXNlXCIsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFZQQyBlbmRwb2ludHMgZm9yIEFXUyBzZXJ2aWNlc1xuICAgIHRoaXMuY3JlYXRlVnBjRW5kcG9pbnRzKCk7XG5cbiAgICAvLyBDcmVhdGUgc2VjdXJpdHkgZ3JvdXBzXG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cHMgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXBzKCk7XG5cbiAgICAvLyBDcmVhdGUgQXVyb3JhIFBvc3RncmVTUUwgY2x1c3RlclxuICAgIHRoaXMuZGF0YWJhc2UgPSB0aGlzLmNyZWF0ZUF1cm9yYUNsdXN0ZXIoc2VjdXJpdHlHcm91cHMuZGF0YWJhc2UpO1xuXG4gICAgLy8gQ3JlYXRlIEVsYXN0aUNhY2hlIFJlZGlzIGNsdXN0ZXJcbiAgICB0aGlzLnJlZGlzID0gdGhpcy5jcmVhdGVSZWRpc0NsdXN0ZXIoc2VjdXJpdHlHcm91cHMucmVkaXMpO1xuXG4gICAgLy8gQ3JlYXRlIEVDUyBjbHVzdGVyXG4gICAgdGhpcy5jbHVzdGVyID0gdGhpcy5jcmVhdGVFQ1NDbHVzdGVyKCk7XG5cbiAgICAvLyBDcmVhdGUgUzMgYnVja2V0c1xuICAgIGNvbnN0IGJ1Y2tldHMgPSB0aGlzLmNyZWF0ZVMzQnVja2V0cygpO1xuICAgIHRoaXMuZG9jdW1lbnRzQnVja2V0ID0gYnVja2V0cy5kb2N1bWVudHM7XG4gICAgdGhpcy5tb2RlbEFydGlmYWN0c0J1Y2tldCA9IGJ1Y2tldHMubW9kZWxzO1xuICAgIHRoaXMuYXVkaXRMb2dzQnVja2V0ID0gYnVja2V0cy5hdWRpdDtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZXNcbiAgICB0aGlzLmNyZWF0ZUlBTVJvbGVzKCk7XG5cbiAgICAvLyBDcmVhdGUgc2VjcmV0cyBpbiBTZWNyZXRzIE1hbmFnZXJcbiAgICBjb25zdCBzZWNyZXRzID0gdGhpcy5jcmVhdGVTZWNyZXRzKCk7XG5cbiAgICAvLyBEZXBsb3kgTWluZHNEQiBzZXJ2aWNlXG4gICAgdGhpcy5taW5kc2RiU2VydmljZSA9IG5ldyBNaW5kc0RCU2VydmljZSh0aGlzLCBcIk1pbmRzREJTZXJ2aWNlXCIsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBjbHVzdGVyOiB0aGlzLmNsdXN0ZXIsXG4gICAgICBkYXRhYmFzZUVuZHBvaW50OiB0aGlzLmRhdGFiYXNlLmNsdXN0ZXJFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRhdGFiYXNlQ3JlZGVudGlhbHNTZWNyZXQ6IHNlY3JldHMuZGF0YWJhc2VDcmVkZW50aWFscyxcbiAgICAgIGttc0tleUFybjogdGhpcy5rbXNLZXkua2V5QXJuLFxuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IEJlZHJvY2sgQWdlbnQgaW5mcmFzdHJ1Y3R1cmVcbiAgICB0aGlzLmJlZHJvY2tBZ2VudFN0YWNrID0gbmV3IEJlZHJvY2tBZ2VudFN0YWNrKHRoaXMsIFwiQmVkcm9ja0FnZW50U3RhY2tcIiwge1xuICAgICAga21zS2V5OiB0aGlzLmttc0tleSxcbiAgICAgIG1pbmRzZGJJbnRlcm5hbEVuZHBvaW50OiB0aGlzLm1pbmRzZGJTZXJ2aWNlLmdldEludGVybmFsRW5kcG9pbnQoKSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbnNTdGFjayA9IG5ldyBMYW1iZGFGdW5jdGlvbnNTdGFjayh0aGlzLCBcIkxhbWJkYUZ1bmN0aW9uc1N0YWNrXCIsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBrbXNLZXlBcm46IHRoaXMua21zS2V5LmtleUFybixcbiAgICAgIHNlc3Npb25UYWJsZUFybjogdGhpcy5iZWRyb2NrQWdlbnRTdGFjay5zZXNzaW9uVGFibGUudGFibGVBcm4sXG4gICAgICBtaW5kc2RiSW50ZXJuYWxFbmRwb2ludDogdGhpcy5taW5kc2RiU2VydmljZS5nZXRJbnRlcm5hbEVuZHBvaW50KCksXG4gICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgfSk7XG5cbiAgICAvLyBEZXBsb3kgQXV0aGVudGljYXRpb24gYW5kIFNlY3VyaXR5IGluZnJhc3RydWN0dXJlXG4gICAgdGhpcy5hdXRoU2VjdXJpdHlTdGFjayA9IG5ldyBBdXRoU2VjdXJpdHlTdGFjayh0aGlzLCBcIkF1dGhTZWN1cml0eVN0YWNrXCIsIHtcbiAgICAgIGttc0tleTogdGhpcy5rbXNLZXksXG4gICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgfSk7XG5cbiAgICAvLyBEZXBsb3kgQVBJIEdhdGV3YXkgaW50ZWdyYXRpb25cbiAgICB0aGlzLmFwaUdhdGV3YXlJbnRlZ3JhdGlvblN0YWNrID0gbmV3IEFwaUdhdGV3YXlJbnRlZ3JhdGlvblN0YWNrKHRoaXMsIFwiQXBpR2F0ZXdheUludGVncmF0aW9uU3RhY2tcIiwge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIGFwaUdhdGV3YXk6IHRoaXMuYXV0aFNlY3VyaXR5U3RhY2suYXBpR2F0ZXdheSxcbiAgICAgIGNvZ25pdG9BdXRob3JpemVyOiB0aGlzLmF1dGhTZWN1cml0eVN0YWNrLmNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgaW50ZXJuYWxMb2FkQmFsYW5jZXI6IHRoaXMubWluZHNkYlNlcnZpY2UubG9hZEJhbGFuY2VyLFxuICAgICAgYmVkcm9ja1Rvb2xzRnVuY3Rpb246IHRoaXMubGFtYmRhRnVuY3Rpb25zU3RhY2suYmVkcm9ja1Rvb2xzRnVuY3Rpb24sXG4gICAgICBjaGVja291dEZ1bmN0aW9uOiB0aGlzLmxhbWJkYUZ1bmN0aW9uc1N0YWNrLmNoZWNrb3V0RnVuY3Rpb24sXG5cbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBtb25pdG9yaW5nIGFuZCBhbGVydGluZ1xuICAgIHRoaXMubW9uaXRvcmluZ0FsZXJ0aW5nU3RhY2sgPSBuZXcgTW9uaXRvcmluZ0FsZXJ0aW5nU3RhY2sodGhpcywgXCJNb25pdG9yaW5nQWxlcnRpbmdTdGFja1wiLCB7XG4gICAgICBlY3NDbHVzdGVyOiB0aGlzLmNsdXN0ZXIsXG4gICAgICBlY3NTZXJ2aWNlOiB0aGlzLm1pbmRzZGJTZXJ2aWNlLnNlcnZpY2UsXG4gICAgICBkYXRhYmFzZTogdGhpcy5kYXRhYmFzZSxcbiAgICAgIHJlZGlzOiB0aGlzLnJlZGlzLFxuICAgICAgYXBpR2F0ZXdheTogdGhpcy5hdXRoU2VjdXJpdHlTdGFjay5hcGlHYXRld2F5LFxuICAgICAgbGFtYmRhRnVuY3Rpb25zOiBbXG4gICAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zU3RhY2suYmVkcm9ja1Rvb2xzRnVuY3Rpb24sXG4gICAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zU3RhY2suY2hlY2tvdXRGdW5jdGlvbixcbiAgICAgIF0sXG4gICAgICBhbGVydEVtYWlsOiBwcm9jZXNzLmVudi5BTEVSVF9FTUFJTCxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVZwY0VuZHBvaW50cygpOiB2b2lkIHtcbiAgICAvLyBTMyBHYXRld2F5IGVuZHBvaW50XG4gICAgdGhpcy52cGMuYWRkR2F0ZXdheUVuZHBvaW50KFwiUzNFbmRwb2ludFwiLCB7XG4gICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5TMyxcbiAgICB9KTtcblxuICAgIC8vIEludGVyZmFjZSBlbmRwb2ludHMgZm9yIG90aGVyIEFXUyBzZXJ2aWNlc1xuICAgIGNvbnN0IHNlcnZpY2VzID0gW1xuICAgICAgZWMyLkludGVyZmFjZVZwY0VuZHBvaW50QXdzU2VydmljZS5TRUNSRVRTX01BTkFHRVIsXG4gICAgICBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLktNUyxcbiAgICAgIGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuQkVEUk9DSyxcbiAgICAgIGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuQkVEUk9DS19SVU5USU1FLFxuICAgICAgZWMyLkludGVyZmFjZVZwY0VuZHBvaW50QXdzU2VydmljZS5DTE9VRFdBVENIX0xPR1MsXG4gICAgICBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLkVDUixcbiAgICAgIGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuRUNSX0RPQ0tFUixcbiAgICBdO1xuXG4gICAgc2VydmljZXMuZm9yRWFjaCgoc2VydmljZSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXMudnBjLmFkZEludGVyZmFjZUVuZHBvaW50KGBWcGNFbmRwb2ludCR7aW5kZXh9YCwge1xuICAgICAgICBzZXJ2aWNlLFxuICAgICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eUdyb3VwcygpIHtcbiAgICAvLyBBTEIgU2VjdXJpdHkgR3JvdXBcbiAgICBjb25zdCBhbGJTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsIFwiQUxCU2VjdXJpdHlHcm91cFwiLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJpdHkgZ3JvdXAgZm9yIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcIixcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICBcIkFsbG93IEhUVFBTIHRyYWZmaWNcIlxuICAgICk7XG5cbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDgwKSxcbiAgICAgIFwiQWxsb3cgSFRUUCB0cmFmZmljXCJcbiAgICApO1xuXG4gICAgLy8gRUNTIFNlY3VyaXR5IEdyb3VwXG4gICAgY29uc3QgZWNzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBcIkVDU1NlY3VyaXR5R3JvdXBcIiwge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyaXR5IGdyb3VwIGZvciBFQ1MgdGFza3NcIixcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBlY3NTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg4MDgwKSxcbiAgICAgIFwiQWxsb3cgdHJhZmZpYyBmcm9tIEFMQlwiXG4gICAgKTtcblxuICAgIC8vIERhdGFiYXNlIFNlY3VyaXR5IEdyb3VwXG4gICAgY29uc3QgZGF0YWJhc2VTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgIFwiRGF0YWJhc2VTZWN1cml0eUdyb3VwXCIsXG4gICAgICB7XG4gICAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlNlY3VyaXR5IGdyb3VwIGZvciBBdXJvcmEgUG9zdGdyZVNRTFwiLFxuICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZGF0YWJhc2VTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWNzU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgIFwiQWxsb3cgUG9zdGdyZVNRTCBhY2Nlc3MgZnJvbSBFQ1NcIlxuICAgICk7XG5cbiAgICAvLyBSZWRpcyBTZWN1cml0eSBHcm91cFxuICAgIGNvbnN0IHJlZGlzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICBcIlJlZGlzU2VjdXJpdHlHcm91cFwiLFxuICAgICAge1xuICAgICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cml0eSBncm91cCBmb3IgRWxhc3RpQ2FjaGUgUmVkaXNcIixcbiAgICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHJlZGlzU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjc1NlY3VyaXR5R3JvdXAsXG4gICAgICBlYzIuUG9ydC50Y3AoNjM3OSksXG4gICAgICBcIkFsbG93IFJlZGlzIGFjY2VzcyBmcm9tIEVDU1wiXG4gICAgKTtcblxuICAgIHJldHVybiB7XG4gICAgICBhbGI6IGFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICBlY3M6IGVjc1NlY3VyaXR5R3JvdXAsXG4gICAgICBkYXRhYmFzZTogZGF0YWJhc2VTZWN1cml0eUdyb3VwLFxuICAgICAgcmVkaXM6IHJlZGlzU2VjdXJpdHlHcm91cCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBdXJvcmFDbHVzdGVyKFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwXG4gICk6IHJkcy5EYXRhYmFzZUNsdXN0ZXIge1xuICAgIC8vIENyZWF0ZSBzdWJuZXQgZ3JvdXAgZm9yIGRhdGFiYXNlXG4gICAgY29uc3Qgc3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsIFwiRGF0YWJhc2VTdWJuZXRHcm91cFwiLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246IFwiU3VibmV0IGdyb3VwIGZvciBBdXJvcmEgUG9zdGdyZVNRTFwiLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBwYXJhbWV0ZXIgZ3JvdXAgZm9yIHBndmVjdG9yXG4gICAgY29uc3QgcGFyYW1ldGVyR3JvdXAgPSBuZXcgcmRzLlBhcmFtZXRlckdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgIFwiUG9zdGdyZVNRTFBhcmFtZXRlckdyb3VwXCIsXG4gICAgICB7XG4gICAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlQ2x1c3RlckVuZ2luZS5hdXJvcmFQb3N0Z3Jlcyh7XG4gICAgICAgICAgdmVyc2lvbjogcmRzLkF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTVfNCxcbiAgICAgICAgfSksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlBhcmFtZXRlciBncm91cCBmb3IgQXVyb3JhIFBvc3RncmVTUUwgd2l0aCBwZ3ZlY3RvclwiLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgc2hhcmVkX3ByZWxvYWRfbGlicmFyaWVzOiBcInZlY3RvclwiLFxuICAgICAgICAgIGxvZ19zdGF0ZW1lbnQ6IFwiYWxsXCIsXG4gICAgICAgICAgbG9nX21pbl9kdXJhdGlvbl9zdGF0ZW1lbnQ6IFwiMTAwMFwiLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQXVyb3JhIGNsdXN0ZXJcbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IHJkcy5EYXRhYmFzZUNsdXN0ZXIodGhpcywgXCJBdXJvcmFDbHVzdGVyXCIsIHtcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlQ2x1c3RlckVuZ2luZS5hdXJvcmFQb3N0Z3Jlcyh7XG4gICAgICAgIHZlcnNpb246IHJkcy5BdXJvcmFQb3N0Z3Jlc0VuZ2luZVZlcnNpb24uVkVSXzE1XzQsXG4gICAgICB9KSxcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbUdlbmVyYXRlZFNlY3JldChcInBvc3RncmVzXCIsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogXCJtaW5kc2RiLXJhZy9hdXJvcmEtY3JlZGVudGlhbHNcIixcbiAgICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXksXG4gICAgICB9KSxcbiAgICAgIGluc3RhbmNlUHJvcHM6IHtcbiAgICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKFxuICAgICAgICAgIGVjMi5JbnN0YW5jZUNsYXNzLlI2RyxcbiAgICAgICAgICBlYzIuSW5zdGFuY2VTaXplLkxBUkdFXG4gICAgICAgICksXG4gICAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICB9LFxuICAgICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxuICAgICAgfSxcbiAgICAgIGluc3RhbmNlczogMiwgLy8gV3JpdGVyICsgUmVhZGVyXG4gICAgICBwYXJhbWV0ZXJHcm91cCxcbiAgICAgIHN1Ym5ldEdyb3VwLFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIHN0b3JhZ2VFbmNyeXB0aW9uS2V5OiB0aGlzLmttc0tleSxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICByZXRlbnRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6IFwiMDM6MDAtMDQ6MDBcIixcbiAgICAgIH0sXG4gICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogXCJzdW46MDQ6MDAtc3VuOjA1OjAwXCIsXG4gICAgICBjbG91ZHdhdGNoTG9nc0V4cG9ydHM6IFtcInBvc3RncmVzcWxcIl0sXG4gICAgICBjbG91ZHdhdGNoTG9nc1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsIC8vIFNldCB0byB0cnVlIGZvciBwcm9kdWN0aW9uXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBDaGFuZ2UgdG8gUkVUQUlOIGZvciBwcm9kdWN0aW9uXG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2x1c3RlcjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUmVkaXNDbHVzdGVyKFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwXG4gICk6IGVsYXN0aWNhY2hlLkNmbkNhY2hlQ2x1c3RlciB7XG4gICAgLy8gQ3JlYXRlIHN1Ym5ldCBncm91cCBmb3IgUmVkaXNcbiAgICBjb25zdCBzdWJuZXRHcm91cCA9IG5ldyBlbGFzdGljYWNoZS5DZm5TdWJuZXRHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICBcIlJlZGlzU3VibmV0R3JvdXBcIixcbiAgICAgIHtcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU3VibmV0IGdyb3VwIGZvciBFbGFzdGlDYWNoZSBSZWRpc1wiLFxuICAgICAgICBzdWJuZXRJZHM6IHRoaXMudnBjLnByaXZhdGVTdWJuZXRzLm1hcCgoc3VibmV0KSA9PiBzdWJuZXQuc3VibmV0SWQpLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgcGFyYW1ldGVyIGdyb3VwIGZvciBSZWRpc1xuICAgIGNvbnN0IHBhcmFtZXRlckdyb3VwID0gbmV3IGVsYXN0aWNhY2hlLkNmblBhcmFtZXRlckdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgIFwiUmVkaXNQYXJhbWV0ZXJHcm91cFwiLFxuICAgICAge1xuICAgICAgICBjYWNoZVBhcmFtZXRlckdyb3VwRmFtaWx5OiBcInJlZGlzNy54XCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlBhcmFtZXRlciBncm91cCBmb3IgUmVkaXMgNy54XCIsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICBcIm1heG1lbW9yeS1wb2xpY3lcIjogXCJhbGxrZXlzLWxydVwiLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgUmVkaXMgY2x1c3RlclxuICAgIGNvbnN0IHJlZGlzID0gbmV3IGVsYXN0aWNhY2hlLkNmbkNhY2hlQ2x1c3Rlcih0aGlzLCBcIlJlZGlzQ2x1c3RlclwiLCB7XG4gICAgICBjYWNoZU5vZGVUeXBlOiBcImNhY2hlLnI2Zy5sYXJnZVwiLFxuICAgICAgZW5naW5lOiBcInJlZGlzXCIsXG4gICAgICBlbmdpbmVWZXJzaW9uOiBcIjcuMFwiLFxuICAgICAgbnVtQ2FjaGVOb2RlczogMSxcbiAgICAgIGNhY2hlUGFyYW1ldGVyR3JvdXBOYW1lOiBwYXJhbWV0ZXJHcm91cC5yZWYsXG4gICAgICBjYWNoZVN1Ym5ldEdyb3VwTmFtZTogc3VibmV0R3JvdXAucmVmLFxuICAgICAgdnBjU2VjdXJpdHlHcm91cElkczogW3NlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgIHRyYW5zaXRFbmNyeXB0aW9uRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHByZWZlcnJlZE1haW50ZW5hbmNlV2luZG93OiBcInN1bjowNTowMC1zdW46MDY6MDBcIixcbiAgICAgIHNuYXBzaG90UmV0ZW50aW9uTGltaXQ6IDUsXG4gICAgICBzbmFwc2hvdFdpbmRvdzogXCIwMzowMC0wNTowMFwiLFxuICAgIH0pO1xuXG4gICAgcmVkaXMuYWRkRGVwZW5kZW5jeShzdWJuZXRHcm91cCk7XG4gICAgcmVkaXMuYWRkRGVwZW5kZW5jeShwYXJhbWV0ZXJHcm91cCk7XG5cbiAgICByZXR1cm4gcmVkaXM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUVDU0NsdXN0ZXIoKTogZWNzLkNsdXN0ZXIge1xuICAgIGNvbnN0IGNsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgXCJFQ1NDbHVzdGVyXCIsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBjbHVzdGVyTmFtZTogYG1pbmRzZGItcmFnLSR7dGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJlbnZpcm9ubWVudFwiKSB8fCBcImRldlwifWAsXG4gICAgICBlbmFibGVGYXJnYXRlQ2FwYWNpdHlQcm92aWRlcnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2x1c3RlcjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUzNCdWNrZXRzKCk6IHsgZG9jdW1lbnRzOiBzMy5CdWNrZXQ7IG1vZGVsczogczMuQnVja2V0OyBhdWRpdDogczMuQnVja2V0IH0ge1xuICAgIC8vIERvY3VtZW50IHN0b3JhZ2UgYnVja2V0XG4gICAgY29uc3QgZG9jdW1lbnRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkRvY3VtZW50c0J1Y2tldFwiLCB7XG4gICAgICBidWNrZXROYW1lOiBgbWluZHNkYi1yYWctZG9jdW1lbnRzLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLktNUyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMua21zS2V5LFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJEZWxldGVPbGRWZXJzaW9uc1wiLFxuICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIENoYW5nZSB0byBSRVRBSU4gZm9yIHByb2R1Y3Rpb25cbiAgICB9KTtcblxuICAgIC8vIE1vZGVsIGFydGlmYWN0cyBidWNrZXRcbiAgICBjb25zdCBtb2RlbEFydGlmYWN0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJNb2RlbEFydGlmYWN0c0J1Y2tldFwiLCB7XG4gICAgICBidWNrZXROYW1lOiBgbWluZHNkYi1yYWctbW9kZWxzLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLktNUyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMua21zS2V5LFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIENoYW5nZSB0byBSRVRBSU4gZm9yIHByb2R1Y3Rpb25cbiAgICB9KTtcblxuICAgIC8vIEF1ZGl0IGxvZ3MgYnVja2V0XG4gICAgY29uc3QgYXVkaXRMb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkF1ZGl0TG9nc0J1Y2tldFwiLCB7XG4gICAgICBidWNrZXROYW1lOiBgbWluZHNkYi1yYWctYXVkaXQtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uS01TLFxuICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXksXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkFyY2hpdmVPbGRMb2dzXCIsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMjU1NSksIC8vIDcgeWVhcnNcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBDaGFuZ2UgdG8gUkVUQUlOIGZvciBwcm9kdWN0aW9uXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgZG9jdW1lbnRzOiBkb2N1bWVudHNCdWNrZXQsXG4gICAgICBtb2RlbHM6IG1vZGVsQXJ0aWZhY3RzQnVja2V0LFxuICAgICAgYXVkaXQ6IGF1ZGl0TG9nc0J1Y2tldCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJQU1Sb2xlcygpOiB2b2lkIHtcbiAgICAvLyBFQ1MgVGFzayBFeGVjdXRpb24gUm9sZVxuICAgIGNvbnN0IGVjc1Rhc2tFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiRUNTVGFza0V4ZWN1dGlvblJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJlY3MtdGFza3MuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgXCJzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3lcIlxuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgU2VjcmV0cyBNYW5hZ2VyIGFuZCBLTVNcbiAgICBlY3NUYXNrRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZVwiLCBcImttczpEZWNyeXB0XCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06c2VjcmV0Om1pbmRzZGItcmFnLypgLFxuICAgICAgICAgIHRoaXMua21zS2V5LmtleUFybixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEVDUyBUYXNrIFJvbGVcbiAgICBjb25zdCBlY3NUYXNrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIkVDU1Rhc2tSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiZWNzLXRhc2tzLmFtYXpvbmF3cy5jb21cIiksXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIE1pbmRzREIgc2VydmljZVxuICAgIGVjc1Rhc2tSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxcIixcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW1cIixcbiAgICAgICAgICBcInMzOkdldE9iamVjdFwiLFxuICAgICAgICAgIFwiczM6UHV0T2JqZWN0XCIsXG4gICAgICAgICAgXCJzMzpEZWxldGVPYmplY3RcIixcbiAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCIsXG4gICAgICAgICAgXCJrbXM6RGVjcnlwdFwiLFxuICAgICAgICAgIFwia21zOkdlbmVyYXRlRGF0YUtleVwiLFxuICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dHcm91cFwiLFxuICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIixcbiAgICAgICAgICBcImxvZ3M6UHV0TG9nRXZlbnRzXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgICAgYGFybjphd3M6czM6OjptaW5kc2RiLXJhZy0qLypgLFxuICAgICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzZWNyZXQ6bWluZHNkYi1yYWcvKmAsXG4gICAgICAgICAgdGhpcy5rbXNLZXkua2V5QXJuLFxuICAgICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OipgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gTGFtYmRhIEV4ZWN1dGlvbiBSb2xlIChmb3IgZnV0dXJlIExhbWJkYSBmdW5jdGlvbnMpXG4gICAgbmV3IGlhbS5Sb2xlKHRoaXMsIFwiTGFtYmRhRXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImxhbWJkYS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlXCJcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNlY3JldHMoKSB7XG4gICAgLy8gRGF0YWJhc2UgY3JlZGVudGlhbHMgKGFscmVhZHkgY3JlYXRlZCBieSBBdXJvcmEgY2x1c3RlcilcbiAgICBjb25zdCBkYXRhYmFzZUNyZWRlbnRpYWxzID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLFxuICAgICAgXCJEYXRhYmFzZUNyZWRlbnRpYWxzXCIsXG4gICAgICBcIm1pbmRzZGItcmFnL2F1cm9yYS1jcmVkZW50aWFsc1wiXG4gICAgKTtcblxuICAgIC8vIE1pbmRzREIgQVBJIGNyZWRlbnRpYWxzXG4gICAgY29uc3QgbWluZHNkYkNyZWRlbnRpYWxzID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldChcbiAgICAgIHRoaXMsXG4gICAgICBcIk1pbmRzREJDcmVkZW50aWFsc1wiLFxuICAgICAge1xuICAgICAgICBzZWNyZXROYW1lOiBcIm1pbmRzZGItcmFnL21pbmRzZGItYXBpLWtleVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJNaW5kc0RCIEFQSSBjcmVkZW50aWFsc1wiLFxuICAgICAgICBlbmNyeXB0aW9uS2V5OiB0aGlzLmttc0tleSxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogXCJtaW5kc2RiXCIgfSksXG4gICAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6IFwiYXBpS2V5XCIsXG4gICAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXCcsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEJlZHJvY2sgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGJlZHJvY2tDb25maWcgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIFwiQmVkcm9ja0NvbmZpZ1wiLCB7XG4gICAgICBzZWNyZXROYW1lOiBcIm1pbmRzZGItcmFnL2JlZHJvY2stY29uZmlnXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJCZWRyb2NrIG1vZGVsIGNvbmZpZ3VyYXRpb25cIixcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMua21zS2V5LFxuICAgICAgc2VjcmV0U3RyaW5nVmFsdWU6IGNkay5TZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQoXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBtb2RlbElkOiBcImFtYXpvbi5ub3ZhLW1pY3JvLXYxOjBcIixcbiAgICAgICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgICAgIG1heFRva2VuczogNDA5NixcbiAgICAgICAgICB0ZW1wZXJhdHVyZTogMC43LFxuICAgICAgICB9KVxuICAgICAgKSxcbiAgICB9KTtcblxuICAgIC8vIFJlZGlzIGNvbm5lY3Rpb24gc3RyaW5nXG4gICAgY29uc3QgcmVkaXNDb25maWcgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIFwiUmVkaXNDb25maWdcIiwge1xuICAgICAgc2VjcmV0TmFtZTogXCJtaW5kc2RiLXJhZy9yZWRpcy1jb25maWdcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlJlZGlzIGNvbm5lY3Rpb24gY29uZmlndXJhdGlvblwiLFxuICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXksXG4gICAgICBzZWNyZXRTdHJpbmdWYWx1ZTogY2RrLlNlY3JldFZhbHVlLnVuc2FmZVBsYWluVGV4dChcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGhvc3Q6IHRoaXMucmVkaXMuYXR0clJlZGlzRW5kcG9pbnRBZGRyZXNzLFxuICAgICAgICAgIHBvcnQ6IHRoaXMucmVkaXMuYXR0clJlZGlzRW5kcG9pbnRQb3J0LFxuICAgICAgICAgIHNzbDogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICksXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YWJhc2VDcmVkZW50aWFscyxcbiAgICAgIG1pbmRzZGJDcmVkZW50aWFscyxcbiAgICAgIGJlZHJvY2tDb25maWcsXG4gICAgICByZWRpc0NvbmZpZyxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVnBjSWRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnZwY0lkLFxuICAgICAgZGVzY3JpcHRpb246IFwiVlBDIElEXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkVDU0NsdXN0ZXJOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJFQ1MgQ2x1c3RlciBOYW1lXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkRhdGFiYXNlRW5kcG9pbnRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMuZGF0YWJhc2UuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiQXVyb3JhIFBvc3RncmVTUUwgQ2x1c3RlciBFbmRwb2ludFwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJSZWRpc0VuZHBvaW50XCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlZGlzLmF0dHJSZWRpc0VuZHBvaW50QWRkcmVzcyxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkVsYXN0aUNhY2hlIFJlZGlzIEVuZHBvaW50XCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIktNU0tleUlkXCIsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmttc0tleS5rZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIktNUyBLZXkgSUQgZm9yIGVuY3J5cHRpb25cIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiTWluZHNEQkludGVybmFsRW5kcG9pbnRcIiwge1xuICAgICAgdmFsdWU6IHRoaXMubWluZHNkYlNlcnZpY2UuZ2V0SW50ZXJuYWxFbmRwb2ludCgpLFxuICAgICAgZGVzY3JpcHRpb246IFwiTWluZHNEQiBJbnRlcm5hbCBMb2FkIEJhbGFuY2VyIEVuZHBvaW50XCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIk1pbmRzREJTZXJ2aWNlTmFtZVwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5taW5kc2RiU2VydmljZS5zZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiTWluZHNEQiBFQ1MgU2VydmljZSBOYW1lXCIsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==