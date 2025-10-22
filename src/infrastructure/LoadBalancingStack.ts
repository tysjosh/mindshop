import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface LoadBalancingStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  environment: string;
  domainName?: string;
  certificateArn?: string;
}

/**
 * Load Balancing and Auto-Scaling Stack
 * 
 * Implements:
 * - Application Load Balancer for API Gateway
 * - Internal Load Balancer for MindsDB ECS services
 * - Auto-scaling policies for ECS tasks
 * - Cross-AZ deployment for high availability
 * - Health checks and monitoring
 */
export class LoadBalancingStack extends cdk.Stack {
  public readonly publicAlb: elbv2.ApplicationLoadBalancer;
  public readonly internalAlb: elbv2.ApplicationLoadBalancer;
  public readonly apiTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly mindsdbTargetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: LoadBalancingStackProps) {
    super(scope, id, props);

    // Create public Application Load Balancer for API Gateway
    this.publicAlb = new elbv2.ApplicationLoadBalancer(this, 'PublicALB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: `mindsdb-rag-api-alb-${props.environment}`,
      securityGroup: this.createPublicAlbSecurityGroup(props.vpc),
    });

    // Create internal Application Load Balancer for MindsDB services
    this.internalAlb = new elbv2.ApplicationLoadBalancer(this, 'InternalALB', {
      vpc: props.vpc,
      internetFacing: false,
      loadBalancerName: `mindsdb-rag-internal-alb-${props.environment}`,
      securityGroup: this.createInternalAlbSecurityGroup(props.vpc),
    });

    // Create target groups
    this.apiTargetGroup = this.createApiTargetGroup(props.vpc);
    this.mindsdbTargetGroup = this.createMindsDBTargetGroup(props.vpc);

    // Configure listeners
    this.configurePublicAlbListeners(props);
    this.configureInternalAlbListeners();

    // Set up DNS (if domain provided)
    if (props.domainName) {
      this.setupDns(props.domainName);
    }

    // Create CloudWatch alarms for load balancers
    this.createLoadBalancerAlarms();

    // Output important values
    new cdk.CfnOutput(this, 'PublicALBDnsName', {
      value: this.publicAlb.loadBalancerDnsName,
      description: 'Public ALB DNS name for API access',
    });

    new cdk.CfnOutput(this, 'InternalALBDnsName', {
      value: this.internalAlb.loadBalancerDnsName,
      description: 'Internal ALB DNS name for MindsDB access',
    });
  }

  /**
   * Create security group for public ALB
   */
  private createPublicAlbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'PublicAlbSecurityGroup', {
      vpc,
      description: 'Security group for public Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow HTTP and HTTPS from internet
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from internet');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS from internet');

    return sg;
  }

  /**
   * Create security group for internal ALB
   */
  private createInternalAlbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'InternalAlbSecurityGroup', {
      vpc,
      description: 'Security group for internal Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow access from VPC CIDR
    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(80), 'Allow HTTP from VPC');
    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080), 'Allow MindsDB from VPC');

    return sg;
  }

  /**
   * Create target group for API services
   */
  private createApiTargetGroup(vpc: ec2.Vpc): elbv2.ApplicationTargetGroup {
    return new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3000',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      targetGroupName: 'mindsdb-rag-api-tg',
    });
  }

  /**
   * Create target group for MindsDB services
   */
  private createMindsDBTargetGroup(vpc: ec2.Vpc): elbv2.ApplicationTargetGroup {
    return new elbv2.ApplicationTargetGroup(this, 'MindsDBTargetGroup', {
      vpc,
      port: 47334, // MindsDB default port
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/api/status',
        protocol: elbv2.Protocol.HTTP,
        port: '47334',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(15),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
      deregistrationDelay: cdk.Duration.seconds(60),
      targetGroupName: 'mindsdb-rag-mindsdb-tg',
    });
  }

  /**
   * Configure public ALB listeners
   */
  private configurePublicAlbListeners(props: LoadBalancingStackProps): void {
    // HTTP listener (redirect to HTTPS if certificate provided)
    const httpListener = this.publicAlb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    if (props.certificateArn) {
      // Redirect HTTP to HTTPS
      httpListener.addAction('HttpRedirect', {
        action: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });

      // HTTPS listener
      const httpsListener = this.publicAlb.addListener('HttpsListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [
          elbv2.ListenerCertificate.fromArn(props.certificateArn),
        ],
      });

      httpsListener.addAction('ApiTargets', {
        action: elbv2.ListenerAction.forward([this.apiTargetGroup]),
        conditions: [
          elbv2.ListenerCondition.pathPatterns(['/api/*', '/health', '/ready', '/live']),
        ],
        priority: 100,
      });
    } else {
      // HTTP only
      httpListener.addAction('ApiTargets', {
        action: elbv2.ListenerAction.forward([this.apiTargetGroup]),
      });
    }
  }

  /**
   * Configure internal ALB listeners
   */
  private configureInternalAlbListeners(): void {
    const listener = this.internalAlb.addListener('MindsDBListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    listener.addAction('MindsDBTargets', {
      action: elbv2.ListenerAction.forward([this.mindsdbTargetGroup]),
    });
  }

  /**
   * Setup DNS records
   */
  private setupDns(domainName: string): void {
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    new route53.ARecord(this, 'ApiAliasRecord', {
      zone: hostedZone,
      recordName: `api.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(this.publicAlb)
      ),
    });
  }

  /**
   * Create CloudWatch alarms for load balancers
   */
  private createLoadBalancerAlarms(): void {
    // Public ALB alarms
    new cloudwatch.Alarm(this, 'PublicAlbHighLatency', {
      metric: this.publicAlb.metricTargetResponseTime(),
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Public ALB high response time',
    });

    new cloudwatch.Alarm(this, 'PublicAlbHighErrorRate', {
      metric: this.publicAlb.metricHttpCodeTarget(
        elbv2.HttpCodeTarget.TARGET_5XX_COUNT
      ),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Public ALB high 5xx error rate',
    });

    // Internal ALB alarms
    new cloudwatch.Alarm(this, 'InternalAlbHighLatency', {
      metric: this.internalAlb.metricTargetResponseTime(),
      threshold: 500, // 500ms
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Internal ALB high response time',
    });

    new cloudwatch.Alarm(this, 'InternalAlbUnhealthyTargets', {
      metric: this.mindsdbTargetGroup.metricUnhealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Internal ALB has unhealthy targets',
    });
  }
}

/**
 * Auto Scaling Configuration for ECS Services
 */
export class AutoScalingConfig {
  /**
   * Configure auto-scaling for API service
   */
  static configureApiServiceAutoScaling(
    service: ecs.FargateService,
    environment: string
  ): ecs.ScalableTaskCount {
    const scaling = service.autoScaleTaskCount({
      minCapacity: environment === 'production' ? 2 : 1,
      maxCapacity: environment === 'production' ? 20 : 5,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on request count
    scaling.scaleOnMetric('RequestCountScaling', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'RequestCount',
        dimensionsMap: {
          LoadBalancer: 'app/mindsdb-rag-api-alb',
        },
        statistic: 'Sum',
      }),
      scalingSteps: [
        { upper: 100, change: -1 },
        { lower: 500, change: +1 },
        { lower: 1000, change: +2 },
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    return scaling;
  }

  /**
   * Configure auto-scaling for MindsDB service
   */
  static configureMindsDBServiceAutoScaling(
    service: ecs.FargateService,
    environment: string
  ): ecs.ScalableTaskCount {
    const scaling = service.autoScaleTaskCount({
      minCapacity: environment === 'production' ? 2 : 1,
      maxCapacity: environment === 'production' ? 10 : 3,
    });

    // Scale based on CPU utilization (higher threshold for MindsDB)
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(10), // Longer cooldown for ML workloads
      scaleOutCooldown: cdk.Duration.minutes(3),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 85,
      scaleInCooldown: cdk.Duration.minutes(10),
      scaleOutCooldown: cdk.Duration.minutes(3),
    });

    // Custom metric for MindsDB query queue length
    scaling.scaleOnMetric('QueryQueueScaling', {
      metric: new cloudwatch.Metric({
        namespace: 'MindsDB/RAGAssistant',
        metricName: 'QueryQueueLength',
        statistic: 'Average',
      }),
      scalingSteps: [
        { upper: 5, change: -1 },
        { lower: 20, change: +1 },
        { lower: 50, change: +2 },
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    return scaling;
  }
}

/**
 * Blue-Green Deployment Configuration
 */
export class BlueGreenDeployment {
  /**
   * Create blue-green deployment setup for ECS service
   * Note: This is a simplified implementation for demonstration purposes
   */
  static createBlueGreenSetup(
    scope: Construct,
    service: ecs.FargateService,
    targetGroup: elbv2.ApplicationTargetGroup,
    environment: string
  ): void {
    // Create CodeDeploy application for ECS
    const application = new cdk.aws_codedeploy.EcsApplication(scope, 'BlueGreenApp', {
      applicationName: `mindsdb-rag-${environment}-bg`,
    });

    // Note: Full blue-green deployment setup would require additional ALB listeners
    // and target groups. This is a placeholder for the complete implementation.
    console.log(`Blue-green deployment application created: ${application.applicationName}`);
    
    // In a complete implementation, you would:
    // 1. Create blue and green target groups
    // 2. Set up ALB listeners for traffic routing
    // 3. Configure the ECS deployment group with proper blue-green config
    // 4. Add CloudWatch alarms for monitoring
  }
}