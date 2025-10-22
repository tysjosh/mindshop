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
exports.MindsDBService = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const applicationautoscaling = __importStar(require("aws-cdk-lib/aws-applicationautoscaling"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const constructs_1 = require("constructs");
class MindsDBService extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Create security groups
        const securityGroups = this.createSecurityGroups(props.vpc);
        // Create internal Application Load Balancer
        this.loadBalancer = this.createInternalALB(props.vpc, securityGroups.alb);
        // Create ECS task definition
        const taskDefinition = this.createTaskDefinition(props);
        // Create ECS service
        this.service = this.createECSService(props.cluster, taskDefinition, securityGroups.ecs, props.vpc);
        // Create target group and listener
        this.targetGroup = this.createTargetGroup(props.vpc);
        this.createListener();
        // Configure auto-scaling
        this.configureAutoScaling();
        // Create CloudWatch alarms
        this.createCloudWatchAlarms();
    }
    createSecurityGroups(vpc) {
        // Internal ALB Security Group
        const albSecurityGroup = new ec2.SecurityGroup(this, "MindsDBInternalALBSG", {
            vpc,
            description: "Security group for MindsDB internal ALB",
            allowAllOutbound: true,
        });
        // Allow internal traffic on port 80 and 443
        albSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(80), "Allow internal HTTP traffic");
        albSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443), "Allow internal HTTPS traffic");
        // ECS Security Group
        const ecsSecurityGroup = new ec2.SecurityGroup(this, "MindsDBECSSG", {
            vpc,
            description: "Security group for MindsDB ECS tasks",
            allowAllOutbound: true,
        });
        // Allow traffic from ALB to ECS on MindsDB port (47334)
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(47334), "Allow traffic from internal ALB to MindsDB");
        // Allow health check traffic
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(47335), "Allow health check traffic from ALB");
        return {
            alb: albSecurityGroup,
            ecs: ecsSecurityGroup,
        };
    }
    createInternalALB(vpc, securityGroup) {
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
    createTaskDefinition(props) {
        // Create task execution role
        const taskExecutionRole = new iam.Role(this, "MindsDBTaskExecutionRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
            ],
        });
        // Add permissions for Secrets Manager and KMS
        taskExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
            resources: [
                `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:mindsdb-rag/*`,
                props.kmsKeyArn,
            ],
        }));
        // Create task role with least-privilege permissions
        const taskRole = new iam.Role(this, "MindsDBTaskRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        // Add permissions for MindsDB operations
        taskRole.addToPolicy(new iam.PolicyStatement({
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
        }));
        // Create log group
        const logGroup = new logs.LogGroup(this, "MindsDBLogGroup", {
            logGroupName: `/ecs/mindsdb-${props.environment}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create task definition
        const taskDefinition = new ecs.FargateTaskDefinition(this, "MindsDBTaskDefinition", {
            memoryLimitMiB: 4096, // 4GB RAM for MindsDB
            cpu: 2048, // 2 vCPU
            executionRole: taskExecutionRole,
            taskRole,
            family: `mindsdb-${props.environment}`,
        });
        // Get Redis configuration from Secrets Manager
        const redisSecret = secretsmanager.Secret.fromSecretNameV2(this, "RedisSecret", "mindsdb-rag/redis-config");
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
                MINDSDB_DB_SERVICE_USER: ecs.Secret.fromSecretsManager(props.databaseCredentialsSecret, "username"),
                MINDSDB_DB_SERVICE_PASSWORD: ecs.Secret.fromSecretsManager(props.databaseCredentialsSecret, "password"),
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
        container.addPortMappings({
            containerPort: 47334, // MindsDB HTTP API port
            protocol: ecs.Protocol.TCP,
            name: "mindsdb-api",
        }, {
            containerPort: 47335, // MindsDB health check port
            protocol: ecs.Protocol.TCP,
            name: "mindsdb-health",
        });
        return taskDefinition;
    }
    createECSService(cluster, taskDefinition, securityGroup, vpc) {
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
    createTargetGroup(vpc) {
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
    createListener() {
        this.loadBalancer.addListener("MindsDBListener", {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            defaultTargetGroups: [this.targetGroup],
        });
        // Attach service to target group
        this.service.attachToApplicationTargetGroup(this.targetGroup);
    }
    configureAutoScaling() {
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
    createCloudWatchAlarms() {
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
    getInternalEndpoint() {
        return `http://${this.loadBalancer.loadBalancerDnsName}`;
    }
}
exports.MindsDBService = MindsDBService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZHNkYi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWluZHNkYi1zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDhFQUFnRTtBQUNoRSx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLCtFQUFpRTtBQUNqRSwrRkFBaUY7QUFDakYsdUVBQXlEO0FBQ3pELDJDQUF1QztBQVd2QyxNQUFhLGNBQWUsU0FBUSxzQkFBUztJQUszQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIseUJBQXlCO1FBQ3pCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFNUQsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTFFLDZCQUE2QjtRQUM3QixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFeEQscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUNsQyxLQUFLLENBQUMsT0FBTyxFQUNiLGNBQWMsRUFDZCxjQUFjLENBQUMsR0FBRyxFQUNsQixLQUFLLENBQUMsR0FBRyxDQUNWLENBQUM7UUFFRixtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0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QyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLCtCQUErQixFQUFFO1lBQzFELFNBQVMsRUFBRSw2QkFBNkI7WUFDeEMsZ0JBQWdCLEVBQUUsNkNBQTZDO1lBQy9ELE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSxvQkFBb0I7Z0JBQy9CLFVBQVUsRUFBRSxrQkFBa0I7Z0JBQzlCLGFBQWEsRUFBRTtvQkFDYixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxtQkFBbUI7aUJBQ2xEO2dCQUNELFNBQVMsRUFBRSxTQUFTO2dCQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsQ0FBQztZQUNaLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUI7WUFDckUsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsU0FBUztTQUN4RCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sbUJBQW1CO1FBQ3hCLE9BQU8sVUFBVSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBcGJELHdDQW9iQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGVjMiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjMlwiO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWNzXCI7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjJcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxvZ3NcIjtcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXJcIjtcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uYXV0b3NjYWxpbmcgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcHBsaWNhdGlvbmF1dG9zY2FsaW5nXCI7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaFwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNaW5kc0RCU2VydmljZVByb3BzIHtcbiAgdnBjOiBlYzIuVnBjO1xuICBjbHVzdGVyOiBlY3MuQ2x1c3RlcjtcbiAgZGF0YWJhc2VFbmRwb2ludDogc3RyaW5nO1xuICBkYXRhYmFzZUNyZWRlbnRpYWxzU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0O1xuICBrbXNLZXlBcm46IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1pbmRzREJTZXJ2aWNlIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2U6IGVjcy5GYXJnYXRlU2VydmljZTtcbiAgcHVibGljIHJlYWRvbmx5IGxvYWRCYWxhbmNlcjogZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXI7XG4gIHB1YmxpYyByZWFkb25seSB0YXJnZXRHcm91cDogZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTWluZHNEQlNlcnZpY2VQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgc2VjdXJpdHkgZ3JvdXBzXG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cHMgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXBzKHByb3BzLnZwYyk7XG5cbiAgICAvLyBDcmVhdGUgaW50ZXJuYWwgQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICAgIHRoaXMubG9hZEJhbGFuY2VyID0gdGhpcy5jcmVhdGVJbnRlcm5hbEFMQihwcm9wcy52cGMsIHNlY3VyaXR5R3JvdXBzLmFsYik7XG5cbiAgICAvLyBDcmVhdGUgRUNTIHRhc2sgZGVmaW5pdGlvblxuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gdGhpcy5jcmVhdGVUYXNrRGVmaW5pdGlvbihwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgRUNTIHNlcnZpY2VcbiAgICB0aGlzLnNlcnZpY2UgPSB0aGlzLmNyZWF0ZUVDU1NlcnZpY2UoXG4gICAgICBwcm9wcy5jbHVzdGVyLFxuICAgICAgdGFza0RlZmluaXRpb24sXG4gICAgICBzZWN1cml0eUdyb3Vwcy5lY3MsXG4gICAgICBwcm9wcy52cGNcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIHRhcmdldCBncm91cCBhbmQgbGlzdGVuZXJcbiAgICB0aGlzLnRhcmdldEdyb3VwID0gdGhpcy5jcmVhdGVUYXJnZXRHcm91cChwcm9wcy52cGMpO1xuICAgIHRoaXMuY3JlYXRlTGlzdGVuZXIoKTtcblxuICAgIC8vIENvbmZpZ3VyZSBhdXRvLXNjYWxpbmdcbiAgICB0aGlzLmNvbmZpZ3VyZUF1dG9TY2FsaW5nKCk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBhbGFybXNcbiAgICB0aGlzLmNyZWF0ZUNsb3VkV2F0Y2hBbGFybXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlHcm91cHModnBjOiBlYzIuVnBjKSB7XG4gICAgLy8gSW50ZXJuYWwgQUxCIFNlY3VyaXR5IEdyb3VwXG4gICAgY29uc3QgYWxiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICBcIk1pbmRzREJJbnRlcm5hbEFMQlNHXCIsXG4gICAgICB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJpdHkgZ3JvdXAgZm9yIE1pbmRzREIgaW50ZXJuYWwgQUxCXCIsXG4gICAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFsbG93IGludGVybmFsIHRyYWZmaWMgb24gcG9ydCA4MCBhbmQgNDQzXG4gICAgYWxiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQodnBjLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoODApLFxuICAgICAgXCJBbGxvdyBpbnRlcm5hbCBIVFRQIHRyYWZmaWNcIlxuICAgICk7XG5cbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NCh2cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgXCJBbGxvdyBpbnRlcm5hbCBIVFRQUyB0cmFmZmljXCJcbiAgICApO1xuXG4gICAgLy8gRUNTIFNlY3VyaXR5IEdyb3VwXG4gICAgY29uc3QgZWNzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBcIk1pbmRzREJFQ1NTR1wiLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cml0eSBncm91cCBmb3IgTWluZHNEQiBFQ1MgdGFza3NcIixcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyB0cmFmZmljIGZyb20gQUxCIHRvIEVDUyBvbiBNaW5kc0RCIHBvcnQgKDQ3MzM0KVxuICAgIGVjc1NlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBhbGJTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDQ3MzM0KSxcbiAgICAgIFwiQWxsb3cgdHJhZmZpYyBmcm9tIGludGVybmFsIEFMQiB0byBNaW5kc0RCXCJcbiAgICApO1xuXG4gICAgLy8gQWxsb3cgaGVhbHRoIGNoZWNrIHRyYWZmaWNcbiAgICBlY3NTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NzMzNSksXG4gICAgICBcIkFsbG93IGhlYWx0aCBjaGVjayB0cmFmZmljIGZyb20gQUxCXCJcbiAgICApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFsYjogYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjczogZWNzU2VjdXJpdHlHcm91cCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJbnRlcm5hbEFMQihcbiAgICB2cGM6IGVjMi5WcGMsXG4gICAgc2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXBcbiAgKTogZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIge1xuICAgIHJldHVybiBuZXcgZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIodGhpcywgXCJNaW5kc0RCSW50ZXJuYWxBTEJcIiwge1xuICAgICAgdnBjLFxuICAgICAgaW50ZXJuZXRGYWNpbmc6IGZhbHNlLCAvLyBJbnRlcm5hbCBBTEJcbiAgICAgIHNlY3VyaXR5R3JvdXAsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgbG9hZEJhbGFuY2VyTmFtZTogXCJtaW5kc2RiLWludGVybmFsLWFsYlwiLFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSwgLy8gU2V0IHRvIHRydWUgZm9yIHByb2R1Y3Rpb25cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlVGFza0RlZmluaXRpb24oXG4gICAgcHJvcHM6IE1pbmRzREJTZXJ2aWNlUHJvcHNcbiAgKTogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbiB7XG4gICAgLy8gQ3JlYXRlIHRhc2sgZXhlY3V0aW9uIHJvbGVcbiAgICBjb25zdCB0YXNrRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIk1pbmRzREJUYXNrRXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImVjcy10YXNrcy5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BbWF6b25FQ1NUYXNrRXhlY3V0aW9uUm9sZVBvbGljeVwiXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBTZWNyZXRzIE1hbmFnZXIgYW5kIEtNU1xuICAgIHRhc2tFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCIsIFwia21zOkRlY3J5cHRcIl0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06c2VjcmV0Om1pbmRzZGItcmFnLypgLFxuICAgICAgICAgIHByb3BzLmttc0tleUFybixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSB0YXNrIHJvbGUgd2l0aCBsZWFzdC1wcml2aWxlZ2UgcGVybWlzc2lvbnNcbiAgICBjb25zdCB0YXNrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIk1pbmRzREJUYXNrUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImVjcy10YXNrcy5hbWF6b25hd3MuY29tXCIpLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBNaW5kc0RCIG9wZXJhdGlvbnNcbiAgICB0YXNrUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJiZWRyb2NrOkludm9rZU1vZGVsXCIsXG4gICAgICAgICAgXCJiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtXCIsXG4gICAgICAgICAgXCJiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzXCIsXG4gICAgICAgICAgXCJzMzpHZXRPYmplY3RcIixcbiAgICAgICAgICBcInMzOlB1dE9iamVjdFwiLFxuICAgICAgICAgIFwiczM6RGVsZXRlT2JqZWN0XCIsXG4gICAgICAgICAgXCJzMzpMaXN0QnVja2V0XCIsXG4gICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZVwiLFxuICAgICAgICAgIFwia21zOkRlY3J5cHRcIixcbiAgICAgICAgICBcImttczpHZW5lcmF0ZURhdGFLZXlcIixcbiAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nU3RyZWFtXCIsXG4gICAgICAgICAgXCJsb2dzOlB1dExvZ0V2ZW50c1wiLFxuICAgICAgICAgIFwiY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgICBgYXJuOmF3czpzMzo6Om1pbmRzZGItcmFnLSpgLFxuICAgICAgICAgIGBhcm46YXdzOnMzOjo6bWluZHNkYi1yYWctKi8qYCxcbiAgICAgICAgICBgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OnNlY3JldDptaW5kc2RiLXJhZy8qYCxcbiAgICAgICAgICBwcm9wcy5rbXNLZXlBcm4sXG4gICAgICAgICAgYGFybjphd3M6bG9nczoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OipgLFxuICAgICAgICAgIGBhcm46YXdzOmNsb3Vkd2F0Y2g6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fToqYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBsb2cgZ3JvdXBcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiTWluZHNEQkxvZ0dyb3VwXCIsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9lY3MvbWluZHNkYi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRhc2sgZGVmaW5pdGlvblxuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJNaW5kc0RCVGFza0RlZmluaXRpb25cIixcbiAgICAgIHtcbiAgICAgICAgbWVtb3J5TGltaXRNaUI6IDQwOTYsIC8vIDRHQiBSQU0gZm9yIE1pbmRzREJcbiAgICAgICAgY3B1OiAyMDQ4LCAvLyAyIHZDUFVcbiAgICAgICAgZXhlY3V0aW9uUm9sZTogdGFza0V4ZWN1dGlvblJvbGUsXG4gICAgICAgIHRhc2tSb2xlLFxuICAgICAgICBmYW1pbHk6IGBtaW5kc2RiLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gR2V0IFJlZGlzIGNvbmZpZ3VyYXRpb24gZnJvbSBTZWNyZXRzIE1hbmFnZXJcbiAgICBjb25zdCByZWRpc1NlY3JldCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcyxcbiAgICAgIFwiUmVkaXNTZWNyZXRcIixcbiAgICAgIFwibWluZHNkYi1yYWcvcmVkaXMtY29uZmlnXCJcbiAgICApO1xuXG4gICAgLy8gQWRkIE1pbmRzREIgY29udGFpbmVyXG4gICAgY29uc3QgY29udGFpbmVyID0gdGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKFwiTWluZHNEQkNvbnRhaW5lclwiLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeShcIm1pbmRzZGIvbWluZHNkYjpsYXRlc3RcIiksXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiBcIm1pbmRzZGJcIixcbiAgICAgICAgbG9nR3JvdXAsXG4gICAgICB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE1JTkRTREJfREJfU0VSVklDRV9IT1NUOiBwcm9wcy5kYXRhYmFzZUVuZHBvaW50LFxuICAgICAgICBNSU5EU0RCX0RCX1NFUlZJQ0VfUE9SVDogXCI1NDMyXCIsXG4gICAgICAgIE1JTkRTREJfREJfU0VSVklDRV9EQVRBQkFTRTogXCJwb3N0Z3Jlc1wiLFxuICAgICAgICBNSU5EU0RCX1NUT1JBR0VfRElSOiBcIi9vcHQvbWluZHNkYi9zdG9yYWdlXCIsXG4gICAgICAgIE1JTkRTREJfQ09ORklHX1BBVEg6IFwiL29wdC9taW5kc2RiL2NvbmZpZy5qc29uXCIsXG4gICAgICAgIEFXU19ERUZBVUxUX1JFR0lPTjogY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbixcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBQWVRIT05VTkJVRkZFUkVEOiBcIjFcIixcbiAgICAgICAgTUlORFNEQl9URUxFTUVUUllfRU5BQkxFRDogXCJmYWxzZVwiLFxuICAgICAgfSxcbiAgICAgIHNlY3JldHM6IHtcbiAgICAgICAgTUlORFNEQl9EQl9TRVJWSUNFX1VTRVI6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKFxuICAgICAgICAgIHByb3BzLmRhdGFiYXNlQ3JlZGVudGlhbHNTZWNyZXQsXG4gICAgICAgICAgXCJ1c2VybmFtZVwiXG4gICAgICAgICksXG4gICAgICAgIE1JTkRTREJfREJfU0VSVklDRV9QQVNTV09SRDogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoXG4gICAgICAgICAgcHJvcHMuZGF0YWJhc2VDcmVkZW50aWFsc1NlY3JldCxcbiAgICAgICAgICBcInBhc3N3b3JkXCJcbiAgICAgICAgKSxcbiAgICAgICAgUkVESVNfSE9TVDogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIocmVkaXNTZWNyZXQsIFwiaG9zdFwiKSxcbiAgICAgICAgUkVESVNfUE9SVDogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIocmVkaXNTZWNyZXQsIFwicG9ydFwiKSxcbiAgICAgIH0sXG4gICAgICBoZWFsdGhDaGVjazoge1xuICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgXCJDTUQtU0hFTExcIixcbiAgICAgICAgICBcImN1cmwgLWYgaHR0cDovL2xvY2FsaG9zdDo0NzMzNS9hcGkvc3RhdHVzIHx8IGV4aXQgMVwiLFxuICAgICAgICBdLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgICAgcmV0cmllczogMyxcbiAgICAgICAgc3RhcnRQZXJpb2Q6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIH0sXG4gICAgICBlc3NlbnRpYWw6IHRydWUsXG4gICAgICBtZW1vcnlSZXNlcnZhdGlvbk1pQjogMzA3MiwgLy8gUmVzZXJ2ZSAzR0Igb2YgdGhlIDRHQiBhdmFpbGFibGVcbiAgICAgIGNwdTogMTUzNiwgLy8gUmVzZXJ2ZSBtb3N0IG9mIHRoZSAyIHZDUFVcbiAgICB9KTtcblxuICAgIC8vIEFkZCBwb3J0IG1hcHBpbmdzXG4gICAgY29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyhcbiAgICAgIHtcbiAgICAgICAgY29udGFpbmVyUG9ydDogNDczMzQsIC8vIE1pbmRzREIgSFRUUCBBUEkgcG9ydFxuICAgICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUCxcbiAgICAgICAgbmFtZTogXCJtaW5kc2RiLWFwaVwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY29udGFpbmVyUG9ydDogNDczMzUsIC8vIE1pbmRzREIgaGVhbHRoIGNoZWNrIHBvcnRcbiAgICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5UQ1AsXG4gICAgICAgIG5hbWU6IFwibWluZHNkYi1oZWFsdGhcIixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgcmV0dXJuIHRhc2tEZWZpbml0aW9uO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFQ1NTZXJ2aWNlKFxuICAgIGNsdXN0ZXI6IGVjcy5DbHVzdGVyLFxuICAgIHRhc2tEZWZpbml0aW9uOiBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uLFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwLFxuICAgIHZwYzogZWMyLlZwY1xuICApOiBlY3MuRmFyZ2F0ZVNlcnZpY2Uge1xuICAgIHJldHVybiBuZXcgZWNzLkZhcmdhdGVTZXJ2aWNlKHRoaXMsIFwiTWluZHNEQlNlcnZpY2VcIiwge1xuICAgICAgY2x1c3RlcixcbiAgICAgIHRhc2tEZWZpbml0aW9uLFxuICAgICAgc2VydmljZU5hbWU6IGBtaW5kc2RiLXNlcnZpY2VgLFxuICAgICAgZGVzaXJlZENvdW50OiAyLCAvLyBNaW5pbXVtIGJhc2VsaW5lIGNhcGFjaXR5XG4gICAgICBtaW5IZWFsdGh5UGVyY2VudDogNTAsXG4gICAgICBtYXhIZWFsdGh5UGVyY2VudDogMjAwLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZWN1cml0eUdyb3VwXSxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBhc3NpZ25QdWJsaWNJcDogZmFsc2UsXG4gICAgICBjYXBhY2l0eVByb3ZpZGVyU3RyYXRlZ2llczogW1xuICAgICAgICB7XG4gICAgICAgICAgY2FwYWNpdHlQcm92aWRlcjogXCJGQVJHQVRFXCIsXG4gICAgICAgICAgd2VpZ2h0OiA3MCxcbiAgICAgICAgICBiYXNlOiAxLCAvLyBFbnN1cmUgYXQgbGVhc3QgMSB0YXNrIG9uIEZBUkdBVEVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNhcGFjaXR5UHJvdmlkZXI6IFwiRkFSR0FURV9TUE9UXCIsXG4gICAgICAgICAgd2VpZ2h0OiAzMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBlbmFibGVFeGVjdXRlQ29tbWFuZDogdHJ1ZSwgLy8gRm9yIGRlYnVnZ2luZ1xuICAgICAgaGVhbHRoQ2hlY2tHcmFjZVBlcmlvZDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSxcbiAgICAgIHBsYXRmb3JtVmVyc2lvbjogZWNzLkZhcmdhdGVQbGF0Zm9ybVZlcnNpb24uTEFURVNULFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVUYXJnZXRHcm91cCh2cGM6IGVjMi5WcGMpOiBlbGJ2Mi5BcHBsaWNhdGlvblRhcmdldEdyb3VwIHtcbiAgICByZXR1cm4gbmV3IGVsYnYyLkFwcGxpY2F0aW9uVGFyZ2V0R3JvdXAodGhpcywgXCJNaW5kc0RCVGFyZ2V0R3JvdXBcIiwge1xuICAgICAgdnBjLFxuICAgICAgcG9ydDogNDczMzQsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgdGFyZ2V0VHlwZTogZWxidjIuVGFyZ2V0VHlwZS5JUCxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHBhdGg6IFwiL2FwaS9zdGF0dXNcIixcbiAgICAgICAgcG9ydDogXCI0NzMzNVwiLFxuICAgICAgICBwcm90b2NvbDogZWxidjIuUHJvdG9jb2wuSFRUUCxcbiAgICAgICAgaGVhbHRoeUh0dHBDb2RlczogXCIyMDBcIixcbiAgICAgICAgaW50ZXJ2YWw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNSksXG4gICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IDMsXG4gICAgICB9LFxuICAgICAgZGVyZWdpc3RyYXRpb25EZWxheTogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgdGFyZ2V0R3JvdXBOYW1lOiBcIm1pbmRzZGItdGdcIixcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGlzdGVuZXIoKTogdm9pZCB7XG4gICAgdGhpcy5sb2FkQmFsYW5jZXIuYWRkTGlzdGVuZXIoXCJNaW5kc0RCTGlzdGVuZXJcIiwge1xuICAgICAgcG9ydDogODAsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgZGVmYXVsdFRhcmdldEdyb3VwczogW3RoaXMudGFyZ2V0R3JvdXBdLFxuICAgIH0pO1xuXG4gICAgLy8gQXR0YWNoIHNlcnZpY2UgdG8gdGFyZ2V0IGdyb3VwXG4gICAgdGhpcy5zZXJ2aWNlLmF0dGFjaFRvQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLnRhcmdldEdyb3VwKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlndXJlQXV0b1NjYWxpbmcoKTogdm9pZCB7XG4gICAgLy8gQ3JlYXRlIHNjYWxhYmxlIHRhcmdldFxuICAgIGNvbnN0IHNjYWxhYmxlVGFyZ2V0ID0gdGhpcy5zZXJ2aWNlLmF1dG9TY2FsZVRhc2tDb3VudCh7XG4gICAgICBtaW5DYXBhY2l0eTogMiwgLy8gTWluaW11bSBiYXNlbGluZSBjYXBhY2l0eVxuICAgICAgbWF4Q2FwYWNpdHk6IDIwLCAvLyBNYXhpbXVtIGNhcGFjaXR5XG4gICAgfSk7XG5cbiAgICAvLyBTY2FsZSBiYXNlZCBvbiBDUFUgdXRpbGl6YXRpb25cbiAgICBzY2FsYWJsZVRhcmdldC5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oXCJNaW5kc0RCQ3B1U2NhbGluZ1wiLCB7XG4gICAgICB0YXJnZXRVdGlsaXphdGlvblBlcmNlbnQ6IDcwLFxuICAgICAgc2NhbGVJbkNvb2xkb3duOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxuICAgIH0pO1xuXG4gICAgLy8gU2NhbGUgYmFzZWQgb24gbWVtb3J5IHV0aWxpemF0aW9uXG4gICAgc2NhbGFibGVUYXJnZXQuc2NhbGVPbk1lbW9yeVV0aWxpemF0aW9uKFwiTWluZHNEQk1lbW9yeVNjYWxpbmdcIiwge1xuICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA4MCxcbiAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24ubWludXRlcygyKSxcbiAgICB9KTtcblxuICAgIC8vIFNjYWxlIGJhc2VkIG9uIHJlcXVlc3QgY291bnQgKEFMQiB0YXJnZXQgZ3JvdXApXG4gICAgY29uc3QgcmVxdWVzdENvdW50TWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogXCJBV1MvQXBwbGljYXRpb25FTEJcIixcbiAgICAgIG1ldHJpY05hbWU6IFwiUmVxdWVzdENvdW50UGVyVGFyZ2V0XCIsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFRhcmdldEdyb3VwOiB0aGlzLnRhcmdldEdyb3VwLnRhcmdldEdyb3VwRnVsbE5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiBcIlN1bVwiLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICB9KTtcblxuICAgIHNjYWxhYmxlVGFyZ2V0LnNjYWxlT25NZXRyaWMoXCJNaW5kc0RCUmVxdWVzdFNjYWxpbmdcIiwge1xuICAgICAgbWV0cmljOiByZXF1ZXN0Q291bnRNZXRyaWMsXG4gICAgICBzY2FsaW5nU3RlcHM6IFtcbiAgICAgICAgeyB1cHBlcjogMTAwLCBjaGFuZ2U6IDAgfSxcbiAgICAgICAgeyBsb3dlcjogMTAwLCB1cHBlcjogNTAwLCBjaGFuZ2U6ICsxIH0sXG4gICAgICAgIHsgbG93ZXI6IDUwMCwgdXBwZXI6IDEwMDAsIGNoYW5nZTogKzIgfSxcbiAgICAgICAgeyBsb3dlcjogMTAwMCwgY2hhbmdlOiArMyB9LFxuICAgICAgXSxcbiAgICAgIGFkanVzdG1lbnRUeXBlOiBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nLkFkanVzdG1lbnRUeXBlLkNIQU5HRV9JTl9DQVBBQ0lUWSxcbiAgICAgIGNvb2xkb3duOiBjZGsuRHVyYXRpb24ubWludXRlcygzKSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcygpOiB2b2lkIHtcbiAgICAvLyBIaWdoIENQVSB1dGlsaXphdGlvbiBhbGFybVxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiTWluZHNEQkhpZ2hDcHVBbGFybVwiLCB7XG4gICAgICBhbGFybU5hbWU6IFwiTWluZHNEQi1IaWdoLUNQVS1VdGlsaXphdGlvblwiLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJNaW5kc0RCIHNlcnZpY2UgaGlnaCBDUFUgdXRpbGl6YXRpb25cIixcbiAgICAgIG1ldHJpYzogdGhpcy5zZXJ2aWNlLm1ldHJpY0NwdVV0aWxpemF0aW9uKHtcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA4NSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyBIaWdoIG1lbW9yeSB1dGlsaXphdGlvbiBhbGFybVxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIFwiTWluZHNEQkhpZ2hNZW1vcnlBbGFybVwiLCB7XG4gICAgICBhbGFybU5hbWU6IFwiTWluZHNEQi1IaWdoLU1lbW9yeS1VdGlsaXphdGlvblwiLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogXCJNaW5kc0RCIHNlcnZpY2UgaGlnaCBtZW1vcnkgdXRpbGl6YXRpb25cIixcbiAgICAgIG1ldHJpYzogdGhpcy5zZXJ2aWNlLm1ldHJpY01lbW9yeVV0aWxpemF0aW9uKHtcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA5MCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyBTZXJ2aWNlIHVuaGVhbHRoeSB0YXJnZXRzIGFsYXJtXG4gICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgXCJNaW5kc0RCVW5oZWFsdGh5VGFyZ2V0c0FsYXJtXCIsIHtcbiAgICAgIGFsYXJtTmFtZTogXCJNaW5kc0RCLVVuaGVhbHRoeS1UYXJnZXRzXCIsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiBcIk1pbmRzREIgc2VydmljZSBoYXMgdW5oZWFsdGh5IHRhcmdldHNcIixcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9BcHBsaWNhdGlvbkVMQlwiLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIlVuSGVhbHRoeUhvc3RDb3VudFwiLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgVGFyZ2V0R3JvdXA6IHRoaXMudGFyZ2V0R3JvdXAudGFyZ2V0R3JvdXBGdWxsTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIC8vIExvdyBoZWFsdGh5IHRhcmdldHMgYWxhcm1cbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBcIk1pbmRzREJMb3dIZWFsdGh5VGFyZ2V0c0FsYXJtXCIsIHtcbiAgICAgIGFsYXJtTmFtZTogXCJNaW5kc0RCLUxvdy1IZWFsdGh5LVRhcmdldHNcIixcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiTWluZHNEQiBzZXJ2aWNlIGhhcyB0b28gZmV3IGhlYWx0aHkgdGFyZ2V0c1wiLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0FwcGxpY2F0aW9uRUxCXCIsXG4gICAgICAgIG1ldHJpY05hbWU6IFwiSGVhbHRoeUhvc3RDb3VudFwiLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgVGFyZ2V0R3JvdXA6IHRoaXMudGFyZ2V0R3JvdXAudGFyZ2V0R3JvdXBGdWxsTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5MRVNTX1RIQU5fVEhSRVNIT0xELFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuQlJFQUNISU5HLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGdldEludGVybmFsRW5kcG9pbnQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYGh0dHA6Ly8ke3RoaXMubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9YDtcbiAgfVxufVxuIl19