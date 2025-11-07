# Widget CDN Infrastructure Setup

This guide covers setting up the AWS infrastructure for the RAG Assistant widget CDN.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI configured with credentials
3. Node.js 18+ and npm
4. AWS CDK CLI: `npm install -g aws-cdk`

## Quick Setup

### 1. Install Dependencies

```bash
cd infrastructure/cdk
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
# Bootstrap for your AWS account and region
cdk bootstrap aws://ACCOUNT-ID/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

### 3. Deploy Widget CDN Stack

```bash
# Deploy development environment
cdk deploy rag-widget-cdn-development

# Deploy staging environment
cdk deploy rag-widget-cdn-staging -c widgetEnvironment=staging

# Deploy production environment
cdk deploy rag-widget-cdn-production -c widgetEnvironment=production
```

## Stack Components

The Widget CDN stack creates:

1. **S3 Bucket**
   - Private bucket for widget files
   - Versioning enabled
   - Lifecycle policies for old versions
   - CORS configuration

2. **CloudFront Distribution**
   - Global CDN with edge locations
   - HTTPS only (TLS 1.2+)
   - Gzip/Brotli compression
   - Custom cache policies
   - CORS response headers

3. **Origin Access Identity (OAI)**
   - Secure access from CloudFront to S3
   - Prevents direct S3 access

4. **IAM Policies**
   - CloudFront read access to S3
   - Deployment permissions

## Configuration

### Environment-Specific Settings

Edit `widget/cdn-config.json` to customize settings for each environment:

```json
{
  "environments": {
    "development": {
      "stackName": "rag-widget-cdn-development",
      "region": "us-east-1",
      "cacheMaxAge": 3600
    },
    "staging": {
      "stackName": "rag-widget-cdn-staging",
      "region": "us-east-1",
      "cacheMaxAge": 86400
    },
    "production": {
      "stackName": "rag-widget-cdn-production",
      "region": "us-east-1",
      "cacheMaxAge": 604800
    }
  }
}
```

### Custom Domain Setup

To use a custom domain (e.g., cdn.rag-assistant.com):

#### 1. Create ACM Certificate

```bash
# Certificate MUST be in us-east-1 for CloudFront
aws acm request-certificate \
  --domain-name cdn.rag-assistant.com \
  --validation-method DNS \
  --region us-east-1
```

#### 2. Validate Certificate

Add the DNS validation records provided by ACM to your domain's DNS.

#### 3. Deploy with Custom Domain

```bash
cdk deploy rag-widget-cdn-production \
  -c widgetEnvironment=production \
  -c cdnDomain=cdn.rag-assistant.com \
  -c certificateArn=arn:aws:acm:us-east-1:123456789:certificate/abc-123
```

#### 4. Update DNS

Add a CNAME record pointing to the CloudFront distribution:

```
cdn.rag-assistant.com  CNAME  d1234567890abc.cloudfront.net
```

## Stack Outputs

After deployment, the stack outputs:

- **BucketName**: S3 bucket name for uploads
- **DistributionId**: CloudFront distribution ID
- **DistributionDomainName**: CloudFront domain name
- **CdnUrl**: Full HTTPS URL for the widget

View outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name rag-widget-cdn-production \
  --query 'Stacks[0].Outputs'
```

## Deployment Commands

### Deploy All Environments

```bash
# Development
cdk deploy rag-widget-cdn-development

# Staging
cdk deploy rag-widget-cdn-staging -c widgetEnvironment=staging

# Production
cdk deploy rag-widget-cdn-production -c widgetEnvironment=production
```

### Update Existing Stack

```bash
# Make changes to widget-cdn-stack.ts, then:
cdk deploy rag-widget-cdn-production -c widgetEnvironment=production
```

### View Stack Diff

```bash
cdk diff rag-widget-cdn-production -c widgetEnvironment=production
```

### Destroy Stack

```bash
# WARNING: This will delete all widget files!
cdk destroy rag-widget-cdn-development
```

## Monitoring

### CloudWatch Metrics

The CDN automatically tracks:
- Requests
- Bytes downloaded
- Error rates (4xx, 5xx)
- Cache hit rate

View in AWS Console:
1. Go to CloudWatch
2. Select "CloudFront" namespace
3. Filter by Distribution ID

### CloudWatch Alarms

Set up alarms for:
- High error rate (>5%)
- Low cache hit rate (<80%)
- Unusual traffic spikes

Example alarm:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name widget-cdn-high-error-rate \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=E1234567890ABC
```

## Cost Estimation

### Monthly Costs (Approximate)

| Component | Usage | Cost |
|-----------|-------|------|
| S3 Storage | 10 MB | $0.02 |
| S3 Requests | 1M GET | $0.40 |
| CloudFront Data Transfer | 100 GB | $8.50 |
| CloudFront Requests | 1M | $1.00 |
| **Total** | | **~$10/month** |

Costs scale with usage. Monitor in AWS Cost Explorer.

## Security

### Best Practices

1. **Private S3 Bucket**: Only CloudFront can access
2. **HTTPS Only**: TLS 1.2+ enforced
3. **Origin Access Identity**: Secure CloudFront-to-S3 access
4. **Security Headers**: XSS protection, frame options, etc.
5. **Versioned Bucket**: Protection against accidental deletion

### IAM Permissions Required

For deployment, you need:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "cloudfront:*",
        "iam:*",
        "acm:DescribeCertificate"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Issue: CDK Bootstrap Failed

**Solution**: Ensure you have the correct AWS credentials and permissions

```bash
aws sts get-caller-identity
```

### Issue: Certificate Not Found

**Solution**: Ensure the ACM certificate is in us-east-1 region

```bash
aws acm list-certificates --region us-east-1
```

### Issue: Stack Deployment Failed

**Solution**: Check CloudFormation events for details

```bash
aws cloudformation describe-stack-events \
  --stack-name rag-widget-cdn-production \
  --max-items 10
```

### Issue: Cannot Delete Stack

**Solution**: Empty the S3 bucket first

```bash
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name rag-widget-cdn-production \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

aws s3 rm "s3://${BUCKET_NAME}" --recursive
```

## Updating the Stack

### Add New Features

1. Edit `infrastructure/cdk/lib/widget-cdn-stack.ts`
2. Test changes: `cdk diff rag-widget-cdn-development`
3. Deploy: `cdk deploy rag-widget-cdn-development`
4. Verify in development
5. Deploy to staging and production

### Update CDK Version

```bash
cd infrastructure/cdk
npm update aws-cdk-lib
cdk deploy rag-widget-cdn-development
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Widget CDN Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure/cdk/lib/widget-cdn-stack.ts'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install CDK
        run: npm install -g aws-cdk
      
      - name: Install dependencies
        run: |
          cd infrastructure/cdk
          npm ci
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to production
        run: |
          cd infrastructure/cdk
          cdk deploy rag-widget-cdn-production \
            -c widgetEnvironment=production \
            --require-approval never
```

## Support

For issues or questions:
- **Documentation**: https://docs.rag-assistant.com
- **Email**: support@rag-assistant.com
- **AWS CDK Docs**: https://docs.aws.amazon.com/cdk/

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/)
- [S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)
