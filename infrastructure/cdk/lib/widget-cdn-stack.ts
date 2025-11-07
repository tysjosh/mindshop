import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface WidgetCdnStackProps extends cdk.StackProps {
  environment: 'development' | 'staging' | 'production';
  domainName?: string;
  certificateArn?: string;
}

export class WidgetCdnStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly cdnUrl: string;

  constructor(scope: Construct, id: string, props: WidgetCdnStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // S3 Bucket for widget files
    this.bucket = new s3.Bucket(this, 'WidgetBucket', {
      bucketName: `rag-assistant-widget-${environment}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'production',
      lifecycleRules: [
        {
          // Keep old versions for 30 days
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'WidgetOAI',
      {
        comment: `OAI for RAG Assistant Widget ${environment}`,
      }
    );

    // Grant CloudFront read access to S3 bucket
    this.bucket.grantRead(originAccessIdentity);

    // Cache Policy for widget files
    const widgetCachePolicy = new cloudfront.CachePolicy(this, 'WidgetCachePolicy', {
      cachePolicyName: `rag-widget-cache-${environment}`,
      comment: 'Cache policy for RAG Assistant widget files',
      defaultTtl: cdk.Duration.days(7),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Response Headers Policy for CORS
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'WidgetResponseHeadersPolicy',
      {
        responseHeadersPolicyName: `rag-widget-headers-${environment}`,
        comment: 'Response headers for RAG Assistant widget',
        corsBehavior: {
          accessControlAllowOrigins: ['*'],
          accessControlAllowHeaders: ['*'],
          accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
          accessControlAllowCredentials: false,
          accessControlMaxAge: cdk.Duration.hours(1),
          originOverride: true,
        },
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
      }
    );

    // CloudFront Distribution
    const distributionProps: cloudfront.DistributionProps = {
      comment: `RAG Assistant Widget CDN - ${environment}`,
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: widgetCachePolicy,
        responseHeadersPolicy: responseHeadersPolicy,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    };

    // Add custom domain if provided
    if (props.domainName && props.certificateArn) {
      const certificate = cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );
      distributionProps.domainNames = [props.domainName];
      distributionProps.certificate = certificate;
    }

    this.distribution = new cloudfront.Distribution(this, 'WidgetDistribution', distributionProps);

    // Set CDN URL
    this.cdnUrl = props.domainName || this.distribution.distributionDomainName;

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket for widget files',
      exportName: `rag-widget-bucket-${environment}`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `rag-widget-distribution-${environment}`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `rag-widget-domain-${environment}`,
    });

    new cdk.CfnOutput(this, 'CdnUrl', {
      value: `https://${this.cdnUrl}`,
      description: 'Widget CDN URL',
      exportName: `rag-widget-cdn-url-${environment}`,
    });

    // Tags
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Service', 'RAG-Assistant-Widget');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
