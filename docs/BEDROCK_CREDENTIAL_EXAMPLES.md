# Multi-Tenant AWS Bedrock Credential Management

This document explains how different merchants can use their own AWS accounts and credentials with the MindsDB RAG Assistant.

## 🏢 Multi-Tenant Architecture

The system supports three credential management approaches:

1. **Direct Credentials** - Merchants pass AWS credentials in API requests
2. **Stored Credentials** - Merchants store credentials securely and reference them
3. **Service Defaults** - Use shared service credentials (development/single-tenant)

## 📋 Credential Methods

### Method 1: Direct Credentials (Recommended for Production)

Merchants pass their AWS credentials directly in the API request:

```bash
curl -X POST http://localhost:3000/api/merchants/merchant-abc/bedrock/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer merchant-abc-token" \
  -d '{
    "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "awsSecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "awsRegion": "us-east-2",
    "modelId": "amazon.nova-micro-v1:0",
    "temperature": 0.7,
    "maxTokens": 4096
  }'
```

**Use Case**: Each merchant has their own AWS account and wants full control over their Bedrock usage and billing.

### Method 2: Stored Credentials (Most Secure)

#### Step 1: Store credentials securely
```bash
curl -X POST http://localhost:3000/api/merchants/merchant-abc/bedrock/credentials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer merchant-abc-token" \
  -d '{
    "credentialId": "primary-aws-account",
    "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "awsSecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "awsRegion": "us-east-2",
    "description": "Primary AWS account for Bedrock integration"
  }'
```

#### Step 2: Initialize using stored credentials
```bash
curl -X POST http://localhost:3000/api/merchants/merchant-abc/bedrock/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer merchant-abc-token" \
  -d '{
    "credentialId": "primary-aws-account",
    "modelId": "amazon.nova-micro-v1:0",
    "temperature": 0.7
  }'
```

**Use Case**: Enterprise merchants who want maximum security and don't want to pass credentials in every request.

### Method 3: Service Defaults (Development/Single-Tenant)

Use shared service credentials from environment variables:

```bash
curl -X POST http://localhost:3000/api/merchants/merchant-abc/bedrock/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer merchant-abc-token" \
  -d '{
    "useServiceDefaults": true,
    "modelId": "amazon.nova-micro-v1:0"
  }'
```

**Use Case**: Development environment or single-tenant deployments where all merchants share the same AWS account.

## 🔐 Security Considerations

### Direct Credentials
- ✅ **Pros**: Full merchant control, separate billing
- ❌ **Cons**: Credentials in transit, must be managed by merchant
- 🔒 **Security**: Use HTTPS, rotate credentials regularly

### Stored Credentials
- ✅ **Pros**: Maximum security, credentials encrypted at rest
- ✅ **Pros**: No credentials in API requests after initial storage
- ❌ **Cons**: More complex setup
- 🔒 **Security**: AWS Secrets Manager encryption, IAM access control

### Service Defaults
- ✅ **Pros**: Simple setup, good for development
- ❌ **Cons**: Shared billing, less isolation
- 🔒 **Security**: Server-side environment variables only

## 🏗️ Implementation Examples

### Example 1: E-commerce Platform with Multiple Merchants

```javascript
// Merchant A (has their own AWS account)
const merchantA = {
  merchantId: "ecommerce-store-a",
  credentials: {
    awsAccessKeyId: "AKIA...",
    awsSecretAccessKey: "...",
    awsRegion: "us-east-1"
  }
};

// Merchant B (uses stored credentials)
const merchantB = {
  merchantId: "ecommerce-store-b",
  credentialId: "store-b-production-aws"
};

// Merchant C (development/testing)
const merchantC = {
  merchantId: "ecommerce-store-c",
  useServiceDefaults: true
};
```

### Example 2: Enterprise Multi-Region Setup

```javascript
// Store credentials for different regions
await storeCredentials("enterprise-corp", "us-east-1-prod", {
  awsAccessKeyId: "AKIA...",
  awsSecretAccessKey: "...",
  awsRegion: "us-east-1"
});

await storeCredentials("enterprise-corp", "eu-west-1-prod", {
  awsAccessKeyId: "AKIA...",
  awsSecretAccessKey: "...",
  awsRegion: "eu-west-1"
});

// Use different credentials for different regions
await initializeBedrock("enterprise-corp", {
  credentialId: "us-east-1-prod",
  modelId: "amazon.nova-micro-v1:0"
});
```

## 🧪 Testing Different Credential Methods

### Test with Direct Credentials
```bash
curl -X POST http://localhost:3000/api/merchants/test-merchant-123/bedrock/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev_user_123:test-merchant-123" \
  -d '{
    "awsAccessKeyId": "'$AWS_ACCESS_KEY_ID'",
    "awsSecretAccessKey": "'$AWS_SECRET_ACCESS_KEY'",
    "awsRegion": "us-east-2",
    "modelId": "amazon.nova-micro-v1:0"
  }'
```

### Test with Service Defaults
```bash
curl -X POST http://localhost:3000/api/merchants/test-merchant-123/bedrock/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev_user_123:test-merchant-123" \
  -d '{
    "useServiceDefaults": true,
    "modelId": "amazon.nova-micro-v1:0"
  }'
```

## 📊 Credential Management Best Practices

### For SaaS Providers
1. **Use stored credentials** for enterprise customers
2. **Implement credential rotation** policies
3. **Monitor usage** per merchant for billing
4. **Audit access** to stored credentials

### For Enterprise Customers
1. **Use IAM roles** with minimal permissions
2. **Rotate credentials** regularly
3. **Monitor costs** in AWS Cost Explorer
4. **Set up billing alerts** for unexpected usage

### For Development
1. **Use service defaults** for local testing
2. **Never commit credentials** to version control
3. **Use separate AWS accounts** for dev/staging/prod
4. **Test credential rotation** procedures

## 🚀 Production Deployment

In production, the system will:

1. **Encrypt credentials** using AWS KMS
2. **Store in AWS Secrets Manager** with proper IAM policies
3. **Audit all access** via CloudTrail
4. **Monitor usage** and costs per merchant
5. **Support credential rotation** without downtime

This multi-tenant approach ensures that each merchant can:
- Use their own AWS account and billing
- Maintain complete control over their AI usage
- Scale independently based on their needs
- Meet their specific compliance requirements