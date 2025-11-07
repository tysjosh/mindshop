# Widget CDN Deployment Guide

This guide covers deploying the RAG Assistant widget to AWS CloudFront CDN for global distribution.

## Overview

The widget is deployed to AWS CloudFront CDN with the following architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFront CDN                           │
│  - Global edge locations                                     │
│  - HTTPS only                                                │
│  - Gzip/Brotli compression                                   │
│  - CORS headers                                              │
│  - Cache optimization                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      S3 Bucket                               │
│  - Versioned storage                                         │
│  - Private (OAI access only)                                 │
│  - Lifecycle policies                                        │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js** 18+ and npm
4. **AWS CDK** installed globally: `npm install -g aws-cdk`

## Quick Start

### 1. Deploy Infrastructure

First, deploy the CDN infrastructure using AWS CDK:

```bash
cd infrastructure/cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the widget CDN stack
cdk deploy rag-widget-cdn-development
```

### 2. Build and Deploy Widget

```bash
cd widget

# Install dependencies
npm install

# Build and deploy to development
./deploy-cdn.sh development

# Or deploy to staging/production
./deploy-cdn.sh staging
./deploy-cdn.sh production
```

## Deployment Environments

### Development
- **Purpose**: Testing and development
- **Cache TTL**: 1 hour
- **Domain**: CloudFront default domain
- **Auto-delete**: Yes (on stack deletion)

### Staging
- **Purpose**: Pre-production testing
- **Cache TTL**: 24 hours
- **Domain**: cdn-staging.rag-assistant.com (optional)
- **Auto-delete**: No

### Production
- **Purpose**: Live merchant integrations
- **Cache TTL**: 7 days
- **Domain**: cdn.rag-assistant.com (optional)
- **Auto-delete**: No
- **Versioning**: Enabled with 30-day retention

## URL Structure

The widget is available at multiple URLs for different use cases:

### Latest Version (Recommended)
```
https://cdn.rag-assistant.com/v1/widget.js
```
- Always points to the latest stable version
- Cache TTL: 1 hour
- Automatically updated on deployment

### Specific Version
```
https://cdn.rag-assistant.com/v1.2.3/widget.min.js
```
- Immutable version-specific URL
- Cache TTL: 1 year
- Never changes once deployed

### Legacy (Backward Compatibility)
```
https://cdn.rag-assistant.com/widget.js
```
- For existing integrations
- Cache TTL: 1 hour
- Redirects to latest version

## Deployment Script

The `deploy-cdn.sh` script automates the entire deployment process:

```bash
./deploy-cdn.sh [environment]
```

### What it does:

1. **Builds the widget** using webpack
2. **Retrieves CDN configuration** from CloudFormation
3. **Uploads files to S3** with proper cache headers
4. **Creates CloudFront invalidation** to clear cache
5. **Displays deployment URLs** and embed code

### Example Output:

```
========================================
RAG Assistant Widget - CDN Deployment
========================================

Environment: production
AWS Region: us-east-1
AWS Profile: default

Step 1: Building widget...
✓ Build completed

Step 2: Getting CDN configuration...
Bucket: rag-assistant-widget-production-123456789
Distribution: E1234567890ABC

Step 3: Uploading files to S3...
✓ Files uploaded to S3

Step 4: Creating CloudFront invalidation...
Invalidation ID: I1234567890ABC
✓ Invalidation created

========================================
Deployment Complete!
========================================

Widget URLs:
  Latest:    https://cdn.rag-assistant.com/v1/widget.js
  Versioned: https://cdn.rag-assistant.com/v1.2.3/widget.min.js
  Legacy:    https://cdn.rag-assistant.com/widget.js

Embed code:
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
```

## Manual Deployment

If you prefer to deploy manually:

### 1. Build the widget

```bash
npm run build
```

### 2. Upload to S3

```bash
# Get bucket name from CloudFormation
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name rag-widget-cdn-production \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

# Upload versioned files
VERSION=$(node -p "require('./package.json').version")
aws s3 sync dist/ "s3://${BUCKET_NAME}/v${VERSION}/" \
  --cache-control "public, max-age=31536000, immutable"

# Upload to latest
aws s3 sync dist/ "s3://${BUCKET_NAME}/v1/" \
  --cache-control "public, max-age=3600"
```

### 3. Invalidate CloudFront cache

```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name rag-widget-cdn-production \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/v1/*" "/widget.js"
```

## Custom Domain Setup

To use a custom domain (e.g., cdn.rag-assistant.com):

### 1. Create ACM Certificate

```bash
# Certificate must be in us-east-1 for CloudFront
aws acm request-certificate \
  --domain-name cdn.rag-assistant.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Update CDN Configuration

Edit `widget/cdn-config.json`:

```json
{
  "environments": {
    "production": {
      "cdnDomain": "cdn.rag-assistant.com",
      "certificateArn": "arn:aws:acm:us-east-1:123456789:certificate/abc-123"
    }
  }
}
```

### 3. Redeploy Infrastructure

```bash
cd infrastructure/cdk
cdk deploy rag-widget-cdn-production
```

### 4. Update DNS

Add a CNAME record pointing to the CloudFront distribution:

```
cdn.rag-assistant.com  CNAME  d1234567890abc.cloudfront.net
```

## Cache Strategy

### File Types and Cache TTL

| File Type | Path | Cache TTL | Immutable |
|-----------|------|-----------|-----------|
| Versioned widget | `/v1.2.3/widget.min.js` | 1 year | Yes |
| Latest widget | `/v1/widget.js` | 1 hour | No |
| Legacy widget | `/widget.js` | 1 hour | No |
| Source maps | `*.map` | 1 year | Yes |

### Cache Headers

```
Cache-Control: public, max-age=31536000, immutable  # Versioned files
Cache-Control: public, max-age=3600                 # Latest files
```

### Invalidation

Cache invalidation is automatic on deployment, but you can manually invalidate:

```bash
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/v1/*" "/widget.js"
```

## Monitoring

### CloudWatch Metrics

The CDN automatically tracks:
- **Requests**: Total number of requests
- **BytesDownloaded**: Total bandwidth used
- **ErrorRate**: Percentage of 4xx/5xx errors
- **CacheHitRate**: Percentage of cached responses

### View Metrics

```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name rag-widget-cdn-production \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

# View metrics in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Access Logs

Enable access logs in `cdn-config.json`:

```json
{
  "cdn": {
    "enableLogging": true,
    "logBucket": "rag-assistant-cdn-logs",
    "logPrefix": "widget-cdn-logs/"
  }
}
```

## Rollback

To rollback to a previous version:

### 1. List available versions

```bash
aws s3 ls s3://${BUCKET_NAME}/ --recursive | grep widget.min.js
```

### 2. Copy old version to latest

```bash
# Copy v1.2.2 to v1
aws s3 cp "s3://${BUCKET_NAME}/v1.2.2/widget.min.js" \
  "s3://${BUCKET_NAME}/v1/widget.js" \
  --cache-control "public, max-age=3600"
```

### 3. Invalidate cache

```bash
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/v1/*"
```

## Troubleshooting

### Issue: Files not updating

**Solution**: Create a CloudFront invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*"
```

### Issue: CORS errors

**Solution**: Check CORS configuration in S3 bucket and CloudFront response headers policy

```bash
aws s3api get-bucket-cors --bucket "$BUCKET_NAME"
```

### Issue: 403 Forbidden errors

**Solution**: Verify Origin Access Identity has read permissions

```bash
aws s3api get-bucket-policy --bucket "$BUCKET_NAME"
```

### Issue: Slow deployment

**Solution**: CloudFront invalidations can take 5-10 minutes. Check status:

```bash
aws cloudfront get-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"
```

## Cost Optimization

### Estimated Costs (per month)

| Component | Usage | Cost |
|-----------|-------|------|
| S3 Storage | 10 MB | $0.02 |
| S3 Requests | 1M requests | $0.40 |
| CloudFront | 100 GB transfer | $8.50 |
| CloudFront Requests | 1M requests | $1.00 |
| **Total** | | **~$10/month** |

### Tips to Reduce Costs

1. **Use versioned URLs** - Better cache hit rates
2. **Enable compression** - Reduces bandwidth
3. **Set appropriate TTLs** - Reduces origin requests
4. **Use Price Class 100** - Only US/Europe edge locations
5. **Monitor usage** - Set up billing alerts

## Security

### Best Practices

1. **HTTPS Only** - Enforced by CloudFront
2. **Private S3 Bucket** - Only CloudFront can access
3. **Origin Access Identity** - Secure S3 access
4. **Security Headers** - XSS, frame options, etc.
5. **Versioned Bucket** - Protect against accidental deletion

### Security Headers

The CDN automatically adds:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy Widget to CDN

on:
  push:
    branches: [main]
    paths:
      - 'widget/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd widget
          npm ci
      
      - name: Build widget
        run: |
          cd widget
          npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to CDN
        run: |
          cd widget
          ./deploy-cdn.sh production
```

## Support

For issues or questions:
- **Documentation**: https://docs.rag-assistant.com
- **Email**: support@rag-assistant.com
- **GitHub**: https://github.com/rag-assistant/widget

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFront Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/best-practices.html)
