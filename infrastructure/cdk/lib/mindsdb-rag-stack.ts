import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { MindsDBService } from "./mindsdb-service";
import { BedrockAgentStack } from "./bedrock-agent-stack";
import { LambdaFunctionsStack } from "./lambda-functions-stack";
import { AuthSecurityStack } from "./auth-security-stack";
import { ApiGatewayIntegrationStack } from "./api-gateway-integration-stack";
import { MonitoringAlertingStack } from "./monitoring-alerting-stack";

export interface MindsDBRAGStackProps extends cdk.StackProps {
  stackName: string;
  environment: string;
}

export class MindsDBRAGStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly database: rds.DatabaseCluster;
  public readonly redis: elasticache.CfnCacheCluster;
  public readonly kmsKey: kms.Key;
  public readonly mindsdbService: MindsDBService;
  // public readonly bedrockAgentStack: BedrockAgentStack; // Temporarily disabled
  public readonly lambdaFunctionsStack: LambdaFunctionsStack;
  public readonly authSecurityStack: AuthSecurityStack;
  public readonly apiGatewayIntegrationStack: ApiGatewayIntegrationStack;
  public readonly monitoringAlertingStack: MonitoringAlertingStack;
  public readonly documentsBucket: s3.Bucket;
  public readonly modelArtifactsBucket: s3.Bucket;
  public readonly auditLogsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: MindsDBRAGStackProps) {
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
    this.mindsdbService = new MindsDBService(this, "MindsDBService", {
      vpc: this.vpc,
      cluster: this.cluster,
      databaseEndpoint: this.database.clusterEndpoint.hostname,
      databaseCredentialsSecret: secrets.databaseCredentials,
      kmsKeyArn: this.kmsKey.keyArn,
      environment: props.environment,
    });

    // Deploy Bedrock Agent infrastructure
    // TODO: Fix Bedrock Agent prompt template issues - temporarily disabled
    // this.bedrockAgentStack = new BedrockAgentStack(this, "BedrockAgentStack", {
    //   kmsKey: this.kmsKey,
    //   mindsdbInternalEndpoint: this.mindsdbService.getInternalEndpoint(),
    //   environment: props.environment,
    // });

    // Create temporary session table for Lambda functions
    const sessionTable = new dynamodb.Table(this, "SessionTable", {
      tableName: `mindsdb-rag-sessions-${props.environment}`,
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
      encryptionKey: this.kmsKey,
      timeToLiveAttribute: "ttl",
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Deploy Lambda functions
    this.lambdaFunctionsStack = new LambdaFunctionsStack(this, "LambdaFunctionsStack", {
      vpc: this.vpc,
      kmsKeyArn: this.kmsKey.keyArn,
      sessionTableArn: sessionTable.tableArn,
      mindsdbInternalEndpoint: this.mindsdbService.getInternalEndpoint(),
      environment: props.environment,
    });

    // Deploy Authentication and Security infrastructure
    this.authSecurityStack = new AuthSecurityStack(this, "AuthSecurityStack", {
      kmsKey: this.kmsKey,
      environment: props.environment,
    });

    // Deploy API Gateway integration
    this.apiGatewayIntegrationStack = new ApiGatewayIntegrationStack(this, "ApiGatewayIntegrationStack", {
      vpc: this.vpc,
      apiGateway: this.authSecurityStack.apiGateway,
      cognitoAuthorizer: this.authSecurityStack.cognitoAuthorizer,
      internalLoadBalancer: this.mindsdbService.loadBalancer,
      bedrockToolsFunction: this.lambdaFunctionsStack.bedrockToolsFunction,
      checkoutFunction: this.lambdaFunctionsStack.checkoutFunction,

      environment: props.environment,
    });

    // Deploy monitoring and alerting
    this.monitoringAlertingStack = new MonitoringAlertingStack(this, "MonitoringAlertingStack", {
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

  private createVpcEndpoints(): void {
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

  private createSecurityGroups() {
    // ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Application Load Balancer",
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );

    // ECS Security Group
    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ECSSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for ECS tasks",
      allowAllOutbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8080),
      "Allow traffic from ALB"
    );

    // Database Security Group
    const databaseSecurityGroup = new ec2.SecurityGroup(
      this,
      "DatabaseSecurityGroup",
      {
        vpc: this.vpc,
        description: "Security group for Aurora PostgreSQL",
        allowAllOutbound: false,
      }
    );

    databaseSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow PostgreSQL access from ECS"
    );

    // Redis Security Group
    const redisSecurityGroup = new ec2.SecurityGroup(
      this,
      "RedisSecurityGroup",
      {
        vpc: this.vpc,
        description: "Security group for ElastiCache Redis",
        allowAllOutbound: false,
      }
    );

    redisSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow Redis access from ECS"
    );

    return {
      alb: albSecurityGroup,
      ecs: ecsSecurityGroup,
      database: databaseSecurityGroup,
      redis: redisSecurityGroup,
    };
  }

  private createAuroraCluster(
    securityGroup: ec2.SecurityGroup
  ): rds.DatabaseCluster {
    // Create subnet group for database
    const subnetGroup = new rds.SubnetGroup(this, "DatabaseSubnetGroup", {
      vpc: this.vpc,
      description: "Subnet group for Aurora PostgreSQL",
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create parameter group for pgvector
    const parameterGroup = new rds.ParameterGroup(
      this,
      "PostgreSQLParameterGroup",
      {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_4,
        }),
        description: "Parameter group for Aurora PostgreSQL",
        parameters: {
          log_statement: "all",
          log_min_duration_statement: "1000",
        },
      }
    );

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
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.R6G,
          ec2.InstanceSize.LARGE
        ),
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

  private createRedisCluster(
    securityGroup: ec2.SecurityGroup
  ): elasticache.CfnCacheCluster {
    // Create subnet group for Redis
    const subnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "RedisSubnetGroup",
      {
        description: "Subnet group for ElastiCache Redis",
        subnetIds: this.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      }
    );

    // Create parameter group for Redis
    const parameterGroup = new elasticache.CfnParameterGroup(
      this,
      "RedisParameterGroup",
      {
        cacheParameterGroupFamily: "redis7",
        description: "Parameter group for Redis 7.x",
        properties: {
          "maxmemory-policy": "allkeys-lru",
        },
      }
    );

    // Create Redis cluster
    const redis = new elasticache.CfnCacheCluster(this, "RedisCluster", {
      cacheNodeType: "cache.r6g.large",
      engine: "redis",
      engineVersion: "7.0",
      numCacheNodes: 1,
      cacheParameterGroupName: parameterGroup.ref,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [securityGroup.securityGroupId],
      // transitEncryptionEnabled: true, // Disabled for single-node cluster compatibility
      preferredMaintenanceWindow: "sun:05:00-sun:06:00",
      snapshotRetentionLimit: 5,
      snapshotWindow: "03:00-05:00",
    });

    redis.addDependency(subnetGroup);
    redis.addDependency(parameterGroup);

    return redis;
  }

  private createECSCluster(): ecs.Cluster {
    const cluster = new ecs.Cluster(this, "ECSCluster", {
      vpc: this.vpc,
      clusterName: `mindsdb-rag-${this.node.tryGetContext("environment") || "dev"}`,
      enableFargateCapacityProviders: true,
    });

    return cluster;
  }

  private createS3Buckets(): { documents: s3.Bucket; models: s3.Bucket; audit: s3.Bucket } {
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

  private createIAMRoles(): void {
    // ECS Task Execution Role
    const ecsTaskExecutionRole = new iam.Role(this, "ECSTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // Add permissions for Secrets Manager and KMS
    ecsTaskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:mindsdb-rag/*`,
          this.kmsKey.keyArn,
        ],
      })
    );

    // ECS Task Role
    const ecsTaskRole = new iam.Role(this, "ECSTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Add permissions for MindsDB service
    ecsTaskRole.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    // Lambda Execution Role (for future Lambda functions)
    new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
      ],
    });
  }

  private createSecrets() {
    // Database credentials (already created by Aurora cluster)
    const databaseCredentials = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DatabaseCredentials",
      "mindsdb-rag/aurora-credentials"
    );

    // MindsDB API credentials
    const mindsdbCredentials = new secretsmanager.Secret(
      this,
      "MindsDBCredentials",
      {
        secretName: "mindsdb-rag/mindsdb-api-key",
        description: "MindsDB API credentials",
        encryptionKey: this.kmsKey,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "mindsdb" }),
          generateStringKey: "apiKey",
          excludeCharacters: '"@/\\',
        },
      }
    );

    // Bedrock configuration
    const bedrockConfig = new secretsmanager.Secret(this, "BedrockConfig", {
      secretName: "mindsdb-rag/bedrock-config",
      description: "Bedrock model configuration",
      encryptionKey: this.kmsKey,
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          modelId: "amazon.nova-micro-v1:0",
          region: this.region,
          maxTokens: 4096,
          temperature: 0.7,
        })
      ),
    });

    // Redis connection string
    const redisConfig = new secretsmanager.Secret(this, "RedisConfig", {
      secretName: "mindsdb-rag/redis-config",
      description: "Redis connection configuration",
      encryptionKey: this.kmsKey,
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          host: this.redis.attrRedisEndpointAddress,
          port: this.redis.attrRedisEndpointPort,
          ssl: true,
        })
      ),
    });

    return {
      databaseCredentials,
      mindsdbCredentials,
      bedrockConfig,
      redisConfig,
    };
  }

  private createOutputs(): void {
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
