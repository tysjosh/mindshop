import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as applicationautoscaling from "aws-cdk-lib/aws-applicationautoscaling";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

export interface MindsDBServiceProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  databaseEndpoint: string;
  databaseCredentialsSecret: secretsmanager.ISecret;
  kmsKeyArn: string;
  environment: string;
}

export class MindsDBService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: MindsDBServiceProps) {
    super(scope, id);

    // Create security groups
    const securityGroups = this.createSecurityGroups(props.vpc);

    // Create internal Application Load Balancer
    this.loadBalancer = this.createInternalALB(props.vpc, securityGroups.alb);

    // Create ECS task definition
    const taskDefinition = this.createTaskDefinition(props);

    // Create ECS service
    this.service = this.createECSService(
      props.cluster,
      taskDefinition,
      securityGroups.ecs,
      props.vpc
    );

    // Create target group and listener
    this.targetGroup = this.createTargetGroup(props.vpc);
    this.createListener();

    // Configure auto-scaling
    this.configureAutoScaling();

    // Create CloudWatch alarms
    this.createCloudWatchAlarms();
  }

  private createSecurityGroups(vpc: ec2.Vpc) {
    // Internal ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(
      this,
      "MindsDBInternalALBSG",
      {
        vpc,
        description: "Security group for MindsDB internal ALB",
        allowAllOutbound: true,
      }
    );

    // Allow internal traffic on port 80 and 443
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      "Allow internal HTTP traffic"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      "Allow internal HTTPS traffic"
    );

    // ECS Security Group
    const ecsSecurityGroup = new ec2.SecurityGroup(this, "MindsDBECSSG", {
      vpc,
      description: "Security group for MindsDB ECS tasks",
      allowAllOutbound: true,
    });

    // Allow traffic from ALB to ECS on MindsDB port (47334)
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(47334),
      "Allow traffic from internal ALB to MindsDB"
    );

    // Allow health check traffic
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(47335),
      "Allow health check traffic from ALB"
    );

    return {
      alb: albSecurityGroup,
      ecs: ecsSecurityGroup,
    };
  }

  private createInternalALB(
    vpc: ec2.Vpc,
    securityGroup: ec2.SecurityGroup
  ): elbv2.ApplicationLoadBalancer {
    return new elbv2.ApplicationLoadBalancer(this, "MindsDBInternalALB", {
      vpc,
      internetFacing: false, // Internal ALB
      securityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      loadBalancerName: "mindsdb-internal-alb",
      deletionProtection: false, // Set to true for production
    });
  }

  private createTaskDefinition(
    props: MindsDBServiceProps
  ): ecs.FargateTaskDefinition {
    // Create task execution role
    const taskExecutionRole = new iam.Role(this, "MindsDBTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // Add permissions for Secrets Manager and KMS
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:mindsdb-rag/*`,
          props.kmsKeyArn,
        ],
      })
    );

    // Create task role with least-privilege permissions
    const taskRole = new iam.Role(this, "MindsDBTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Add permissions for MindsDB operations
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListFoundationModels",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "cloudwatch:PutMetricData",
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`,
          `arn:aws:s3:::mindsdb-rag-*`,
          `arn:aws:s3:::mindsdb-rag-*/*`,
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:mindsdb-rag/*`,
          props.kmsKeyArn,
          `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
          `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
        ],
      })
    );

    // Create log group
    const logGroup = new logs.LogGroup(this, "MindsDBLogGroup", {
      logGroupName: `/ecs/mindsdb-${props.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create task definition
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "MindsDBTaskDefinition",
      {
        memoryLimitMiB: 4096, // 4GB RAM for MindsDB
        cpu: 2048, // 2 vCPU
        executionRole: taskExecutionRole,
        taskRole,
        family: `mindsdb-${props.environment}`,
      }
    );

    // Get Redis configuration from Secrets Manager
    const redisSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "RedisSecret",
      "mindsdb-rag/redis-config"
    );

    // Add MindsDB container
    const container = taskDefinition.addContainer("MindsDBContainer", {
      image: ecs.ContainerImage.fromRegistry("mindsdb/mindsdb:latest"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "mindsdb",
        logGroup,
      }),
      environment: {
        MINDSDB_DB_SERVICE_HOST: props.databaseEndpoint,
        MINDSDB_DB_SERVICE_PORT: "5432",
        MINDSDB_DB_SERVICE_DATABASE: "postgres",
        MINDSDB_STORAGE_DIR: "/opt/mindsdb/storage",
        MINDSDB_CONFIG_PATH: "/opt/mindsdb/config.json",
        AWS_DEFAULT_REGION: cdk.Stack.of(this).region,
        ENVIRONMENT: props.environment,
        PYTHONUNBUFFERED: "1",
        MINDSDB_TELEMETRY_ENABLED: "false",
      },
      secrets: {
        MINDSDB_DB_SERVICE_USER: ecs.Secret.fromSecretsManager(
          props.databaseCredentialsSecret,
          "username"
        ),
        MINDSDB_DB_SERVICE_PASSWORD: ecs.Secret.fromSecretsManager(
          props.databaseCredentialsSecret,
          "password"
        ),
        REDIS_HOST: ecs.Secret.fromSecretsManager(redisSecret, "host"),
        REDIS_PORT: ecs.Secret.fromSecretsManager(redisSecret, "port"),
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:47335/api/status || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      essential: true,
      memoryReservationMiB: 3072, // Reserve 3GB of the 4GB available
      cpu: 1536, // Reserve most of the 2 vCPU
    });

    // Add port mappings
    container.addPortMappings(
      {
        containerPort: 47334, // MindsDB HTTP API port
        protocol: ecs.Protocol.TCP,
        name: "mindsdb-api",
      },
      {
        containerPort: 47335, // MindsDB health check port
        protocol: ecs.Protocol.TCP,
        name: "mindsdb-health",
      }
    );

    return taskDefinition;
  }

  private createECSService(
    cluster: ecs.Cluster,
    taskDefinition: ecs.FargateTaskDefinition,
    securityGroup: ec2.SecurityGroup,
    vpc: ec2.Vpc
  ): ecs.FargateService {
    return new ecs.FargateService(this, "MindsDBService", {
      cluster,
      taskDefinition,
      serviceName: `mindsdb-service`,
      desiredCount: 2, // Minimum baseline capacity
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      securityGroups: [securityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE",
          weight: 70,
          base: 1, // Ensure at least 1 task on FARGATE
        },
        {
          capacityProvider: "FARGATE_SPOT",
          weight: 30,
        },
      ],
      enableExecuteCommand: true, // For debugging
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      platformVersion: ecs.FargatePlatformVersion.LATEST,
    });
  }

  private createTargetGroup(vpc: ec2.Vpc): elbv2.ApplicationTargetGroup {
    return new elbv2.ApplicationTargetGroup(this, "MindsDBTargetGroup", {
      vpc,
      port: 47334,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: "/api/status",
        port: "47335",
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      targetGroupName: "mindsdb-tg",
    });
  }

  private createListener(): void {
    this.loadBalancer.addListener("MindsDBListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [this.targetGroup],
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(this.targetGroup);
  }

  private configureAutoScaling(): void {
    // Create scalable target
    const scalableTarget = this.service.autoScaleTaskCount({
      minCapacity: 2, // Minimum baseline capacity
      maxCapacity: 20, // Maximum capacity
    });

    // Scale based on CPU utilization
    scalableTarget.scaleOnCpuUtilization("MindsDBCpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on memory utilization
    scalableTarget.scaleOnMemoryUtilization("MindsDBMemoryScaling", {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on request count (ALB target group)
    const requestCountMetric = new cloudwatch.Metric({
      namespace: "AWS/ApplicationELB",
      metricName: "RequestCountPerTarget",
      dimensionsMap: {
        TargetGroup: this.targetGroup.targetGroupFullName,
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(1),
    });

    scalableTarget.scaleOnMetric("MindsDBRequestScaling", {
      metric: requestCountMetric,
      scalingSteps: [
        { upper: 100, change: 0 },
        { lower: 100, upper: 500, change: +1 },
        { lower: 500, upper: 1000, change: +2 },
        { lower: 1000, change: +3 },
      ],
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.minutes(3),
    });
  }

  private createCloudWatchAlarms(): void {
    // High CPU utilization alarm
    new cloudwatch.Alarm(this, "MindsDBHighCpuAlarm", {
      alarmName: "MindsDB-High-CPU-Utilization",
      alarmDescription: "MindsDB service high CPU utilization",
      metric: this.service.metricCpuUtilization({
        period: cdk.Duration.minutes(5),
        statistic: "Average",
      }),
      threshold: 85,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High memory utilization alarm
    new cloudwatch.Alarm(this, "MindsDBHighMemoryAlarm", {
      alarmName: "MindsDB-High-Memory-Utilization",
      alarmDescription: "MindsDB service high memory utilization",
      metric: this.service.metricMemoryUtilization({
        period: cdk.Duration.minutes(5),
        statistic: "Average",
      }),
      threshold: 90,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Service unhealthy targets alarm
    new cloudwatch.Alarm(this, "MindsDBUnhealthyTargetsAlarm", {
      alarmName: "MindsDB-Unhealthy-Targets",
      alarmDescription: "MindsDB service has unhealthy targets",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "UnHealthyHostCount",
        dimensionsMap: {
          TargetGroup: this.targetGroup.targetGroupFullName,
        },
        statistic: "Average",
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Low healthy targets alarm
    new cloudwatch.Alarm(this, "MindsDBLowHealthyTargetsAlarm", {
      alarmName: "MindsDB-Low-Healthy-Targets",
      alarmDescription: "MindsDB service has too few healthy targets",
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApplicationELB",
        metricName: "HealthyHostCount",
        dimensionsMap: {
          TargetGroup: this.targetGroup.targetGroupFullName,
        },
        statistic: "Average",
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
  }

  public getInternalEndpoint(): string {
    return `http://${this.loadBalancer.loadBalancerDnsName}`;
  }
}
