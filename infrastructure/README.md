# MindsDB RAG Assistant Infrastructure

This directory contains the complete AWS infrastructure deployment for the MindsDB RAG Assistant, including all previously missing components.

## 🏗️ Architecture Overview

The infrastructure includes:

### ✅ **Core Infrastructure**
- **VPC** with public/private/isolated subnets across 3 AZs
- **Aurora PostgreSQL** cluster with pgvector extension
- **ElastiCache Redis** for caching and session management
- **ECS Fargate** cluster for MindsDB service deployment
- **Application Load Balancer** for internal service communication

### ✅ **Newly Implemented Components**

#### 1. **Lambda Functions** (`lambda-functions-stack.ts`)
- **Bedrock Tools Handler** - Executes Bedrock Agent tools
- **Checkout Handler** - Processes e-commerce transactions
- **Document Ingestion Handler** - Extracts text from documents
- **Pre-Token Generation Handler** - Adds merchant_id to JWT claims
- **Health Check Functions** - Monitors service health

#### 2. **Step Functions** (`step-functions-stack.ts`)
- **Document Processing Workflow**:
  - S3 → Document Ingestion → PII Sanitization → Embedding Generation → Database Storage
- **Model Retraining Workflow**:
  - Drift Detection → Retraining Decision → Model Update → Deployment
- **Error Handling** with retry logic and compensation workflows

#### 3. **API Gateway Integration** (`api-gateway-integration-stack.ts`)
- **VPC Link** for private ALB integration
- **Complete API Routes**:
  - `/v1/chat` - Main chat interface
  - `/v1/documents` - Document ingestion and status
  - `/v1/bedrock-agent` - Tool execution and configuration
  - `/v1/checkout` - E-commerce transactions
  - `/v1/sessions` - Session management
  - `/v1/admin` - Platform administration
- **Request/Response Validation** with JSON schemas
- **Rate Limiting** and usage plans

#### 4. **Monitoring & Alerting** (`monitoring-alerting-stack.ts`)
- **CloudWatch Dashboard** with business and technical metrics
- **Performance Alarms**:
  - API latency > 5 seconds
  - Error rate > 5%
  - ECS CPU > 80%
  - Database connections > 80%
- **Cost Monitoring** with $0.05/session target
- **Synthetic Monitoring** with automated health checks
- **Custom Metrics** for business KPIs

#### 5. **Backup & Disaster Recovery** (`backup-disaster-recovery-stack.ts`)
- **AWS Backup** with multiple retention policies:
  - Daily backups (35 days retention)
  - Weekly backups (1 year retention)
  - Monthly backups (7 years compliance)
- **Cross-Region Replication** for S3 buckets
- **Automated Failover** with Lambda-based orchestration
- **DR Readiness Validation** with weekly checks

#### 6. **Enhanced Security** (`auth-security-stack.ts`)
- **Cognito User Pool** with MFA and advanced security
- **WAF Web ACL** with managed rule sets and rate limiting
- **Pre-Token Generation Lambda** for JWT customization
- **Role-Based Access Control** with tenant isolation

## 📁 File Structure

```
infrastructure/
├── cdk/
│   ├── lib/
│   │   ├── mindsdb-rag-stack.ts              # Main stack orchestration
│   │   ├── lambda-functions-stack.ts         # ✅ Lambda deployment
│   │   ├── step-functions-stack.ts           # ✅ Document processing workflows
│   │   ├── api-gateway-integration-stack.ts  # ✅ API Gateway + VPC Link
│   │   ├── monitoring-alerting-stack.ts      # ✅ CloudWatch + SNS alerts
│   │   ├── backup-disaster-recovery-stack.ts # ✅ Backup + DR automation
│   │   ├── auth-security-stack.ts            # Enhanced authentication
│   │   ├── bedrock-agent-stack.ts            # Bedrock Agent configuration
│   │   ├── vpc-security-stack.ts             # VPC security controls
│   │   └── cloudtrail-stack.ts               # Audit logging
│   ├── bin/
│   │   └── app.ts                            # CDK app entry point
│   └── package.json                          # CDK dependencies
└── scripts/
    ├── deploy-infrastructure.sh              # ✅ Complete deployment script
    └── validate-infrastructure.sh            # ✅ Infrastructure validation
```

## 🚀 Deployment Guide

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **AWS CDK CLI** installed (`npm install -g aws-cdk`)
3. **Node.js 18+** and npm
4. **jq** for JSON processing

### Environment Variables

```bash
export ENVIRONMENT=dev                    # dev, staging, prod
export AWS_REGION=us-east-1              # Primary region
export DR_REGION=us-west-2               # Disaster recovery region
export ALERT_EMAIL=admin@example.com     # Alert notifications
export SECURITY_ALERT_EMAIL=security@example.com
```

### Quick Deployment

```bash
# Deploy complete infrastructure
./scripts/deploy-infrastructure.sh

# Validate deployment
./scripts/validate-infrastructure.sh

# Run database migrations
./scripts/deploy-infrastructure.sh migrate
```

### Step-by-Step Deployment

1. **Build Lambda Functions**
   ```bash
   cd ../  # Go to project root
   npm install
   npm run build
   ```

2. **Bootstrap CDK**
   ```bash
   cd infrastructure/cdk
   npm install
   cdk bootstrap
   ```

3. **Deploy Infrastructure**
   ```bash
   cdk deploy mindsdb-rag-${ENVIRONMENT} --require-approval never
   ```

4. **Validate Deployment**
   ```bash
   ../../scripts/validate-infrastructure.sh
   ```

## 🔧 Configuration

### Lambda Function Configuration

All Lambda functions are built from TypeScript source in `src/lambda/`:

- **Runtime**: Node.js 18.x
- **Memory**: 512MB - 1024MB (varies by function)
- **Timeout**: 30s - 15min (varies by function)
- **VPC**: Deployed in private subnets with NAT Gateway access
- **Environment Variables**: Automatically configured by CDK

### Step Functions Configuration

- **Document Processing**: 15-minute timeout with retry logic
- **Model Retraining**: 2-hour timeout for ML operations
- **Error Handling**: Comprehensive error states with SNS notifications
- **Logging**: CloudWatch Logs with structured JSON output

### API Gateway Configuration

- **Throttling**: 1000 RPS with 2000 burst capacity
- **CORS**: Configured for web application access
- **Authentication**: Cognito User Pool integration
- **Validation**: Request/response schema validation
- **Monitoring**: CloudWatch metrics and X-Ray tracing

### Monitoring Configuration

- **Dashboard**: Real-time metrics for all components
- **Alarms**: 15+ alarms covering performance, errors, and costs
- **Notifications**: SNS topic with email subscriptions
- **Synthetic Monitoring**: 5-minute health checks
- **Custom Metrics**: Business KPIs and security events

## 🔒 Security Features

### Multi-Tenant Isolation
- **Row-Level Security** in PostgreSQL
- **Tenant-Specific KMS Keys** for encryption
- **JWT Claims** with merchant_id for API access
- **VPC Isolation** with security groups

### Data Protection
- **Encryption at Rest**: KMS encryption for all data stores
- **Encryption in Transit**: TLS 1.3 for all communications
- **PII Tokenization**: Automatic detection and secure storage
- **Audit Logging**: Comprehensive CloudTrail integration

### Network Security
- **WAF Protection**: Managed rules + custom rate limiting
- **VPC Endpoints**: Private communication with AWS services
- **Security Groups**: Least privilege access controls
- **Private Subnets**: Database and application isolation

## 📊 Monitoring & Alerting

### Key Metrics Tracked

- **Performance**: API latency, ECS CPU/memory, database performance
- **Business**: Sessions/minute, cost per session, checkout success rate
- **Security**: PII detection events, authentication failures, WAF blocks
- **Infrastructure**: Service health, backup status, DR readiness

### Alert Thresholds

- **API Latency**: > 5 seconds
- **Error Rate**: > 5%
- **Cost Per Session**: > $0.05
- **ECS CPU**: > 80%
- **Database Connections**: > 80%
- **Backup Failures**: Any failure

### Dashboard Sections

1. **API Gateway Metrics** - Request volume, latency, errors
2. **ECS Service Health** - CPU, memory, task count
3. **Database Performance** - Connections, latency, CPU
4. **Business Metrics** - Sessions, costs, checkouts
5. **Security Events** - PII detection, authentication

## 💾 Backup & Disaster Recovery

### Backup Strategy

- **Daily Backups**: 35-day retention with 7-day cold storage
- **Weekly Backups**: 1-year retention with 30-day cold storage
- **Monthly Backups**: 7-year retention for compliance
- **Cross-Region Copies**: Automatic replication to DR region

### Disaster Recovery

- **RTO Target**: 4 hours (Recovery Time Objective)
- **RPO Target**: 1 hour (Recovery Point Objective)
- **Automated Failover**: Lambda-based orchestration
- **DR Testing**: Weekly validation of backup integrity
- **Runbooks**: Automated recovery procedures

### DR Procedures

1. **Automated Detection**: CloudWatch alarms trigger DR Lambda
2. **Backup Restoration**: Latest backup restored in DR region
3. **DNS Failover**: Route 53 health checks redirect traffic
4. **Service Startup**: ECS services launched in DR region
5. **Validation**: Automated testing of restored services

## 🧪 Testing & Validation

### Infrastructure Tests

```bash
# Validate all components
./scripts/validate-infrastructure.sh

# Test specific components
aws ecs describe-services --cluster mindsdb-rag-dev
aws rds describe-db-clusters --db-cluster-identifier mindsdb-rag-dev
aws lambda list-functions --function-version ALL
```

### Health Checks

- **API Gateway**: `/health` endpoint
- **ECS Services**: Application Load Balancer health checks
- **Lambda Functions**: Dedicated health check handlers
- **Database**: Connection pool monitoring
- **Redis**: Cluster status monitoring

### Performance Testing

```bash
# API load testing
curl -X POST "${API_URL}v1/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"message": "test message"}'

# Database connection testing
psql -h $DB_ENDPOINT -U postgres -d mindsdb_rag -c "SELECT version();"
```

## 🔧 Troubleshooting

### Common Issues

1. **Lambda Function Timeouts**
   - Check CloudWatch Logs for specific errors
   - Increase memory allocation if needed
   - Verify VPC connectivity for external API calls

2. **API Gateway 5xx Errors**
   - Check VPC Link status
   - Verify internal ALB health
   - Review security group rules

3. **ECS Service Startup Issues**
   - Check task definition configuration
   - Verify IAM role permissions
   - Review CloudWatch Logs for container errors

4. **Database Connection Issues**
   - Verify security group rules
   - Check connection pool settings
   - Review Aurora cluster status

### Debugging Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster mindsdb-rag-dev --services mindsdb-service

# View Lambda function logs
aws logs tail /aws/lambda/mindsdb-rag-tools-dev --follow

# Check API Gateway integration
aws apigateway get-integration --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method POST

# Validate Step Functions
aws stepfunctions list-executions --state-machine-arn $STATE_MACHINE_ARN
```

## 📈 Cost Optimization

### Current Cost Estimates

- **Development**: ~$200-300/month
- **Staging**: ~$400-600/month  
- **Production**: ~$800-1200/month

### Cost Optimization Features

- **Spot Instances**: ECS Fargate Spot for non-critical workloads
- **Auto Scaling**: Dynamic scaling based on demand
- **S3 Lifecycle**: Automatic transition to cheaper storage classes
- **Reserved Capacity**: RDS and ElastiCache reserved instances for production
- **Cost Monitoring**: Real-time cost tracking with $0.05/session target

## 🔄 Updates & Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review CloudWatch alarms and metrics
2. **Monthly**: Validate backup integrity and DR procedures
3. **Quarterly**: Security review and penetration testing
4. **Annually**: Cost optimization review and architecture updates

### Update Procedures

```bash
# Update infrastructure
git pull origin main
npm run build
cd infrastructure/cdk
cdk diff mindsdb-rag-${ENVIRONMENT}
cdk deploy mindsdb-rag-${ENVIRONMENT}

# Validate updates
../../scripts/validate-infrastructure.sh
```

## 📞 Support

### Getting Help

1. **Infrastructure Issues**: Check CloudWatch Logs and metrics
2. **Deployment Problems**: Review CDK deployment logs
3. **Performance Issues**: Use CloudWatch Insights for log analysis
4. **Security Concerns**: Review CloudTrail logs and WAF metrics

### Useful Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [MindsDB Documentation](https://docs.mindsdb.com/)
- [Project Design Document](../.kiro/specs/mindsdb-rag-assistant/design.md)

---

## ✅ Infrastructure Gaps Resolution Summary

All previously identified infrastructure gaps have been resolved:

1. ✅ **Lambda Function Implementations** - Complete with proper deployment packages
2. ✅ **Pre-Token Generation Lambda** - JWT customization with merchant_id claims
3. ✅ **Step Functions for Document Processing** - Complete workflow orchestration
4. ✅ **API Gateway Integration** - VPC Link with comprehensive route configuration
5. ✅ **Monitoring & Alerting Stack** - CloudWatch dashboards, alarms, and SNS notifications
6. ✅ **Auto-scaling Policies** - Predictive scaling with custom metrics
7. ✅ **Backup & Disaster Recovery** - Automated backups with cross-region replication

The infrastructure is now **production-ready** with enterprise-grade security, monitoring, and disaster recovery capabilities.