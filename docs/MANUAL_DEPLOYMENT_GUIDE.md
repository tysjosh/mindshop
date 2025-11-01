# MindsDB RAG Assistant - Manual Deployment Guide

This guide provides step-by-step instructions for manually deploying all AWS resources for the MindsDB RAG Assistant platform. This is intended for users with basic AWS familiarity who want to understand the complete architecture or deploy without CDK.

## Prerequisites

### Required AWS Services Access

- VPC and EC2 (for networking and compute)
- RDS Aurora PostgreSQL (for database)
- ElastiCache Redis (for caching)
- ECS Fargate (for container orchestration)
- Lambda (for serverless functions)
- API Gateway (for REST API)
- Cognito (for authentication)
- Bedrock (for AI/ML models)
- DynamoDB (for session storage)
- S3 (for file storage)
- KMS (for encryption)
- CloudWatch (for monitoring)
- WAF (for security)
- Secrets Manager (for credential storage)

### Required Permissions

Your AWS user/role needs administrative permissions or specific permissions for all the above services.

### Tools Required

- AWS CLI configured with your credentials
- Basic understanding of AWS Console navigation
- Text editor for configuration files

## Architecture Overview

The MindsDB RAG Assistant consists of these main components:

1. **Networking Layer**: VPC with public/private subnets
2. **Database Layer**: Aurora PostgreSQL + ElastiCache Redis
3. **Compute Layer**: ECS Fargate for MindsDB service
4. **API Layer**: API Gateway + Lambda functions (with database access)
5. **AI/ML Layer**: Bedrock Agent with tools
6. **Security Layer**: Cognito + WAF + KMS encryption
7. **Storage Layer**: S3 buckets for documents and artifacts
8. **Monitoring Layer**: CloudWatch dashboards and alarms

## Lambda Functions Architecture

**Important**: Lambda functions in this architecture have direct access to:
- ✅ **Aurora PostgreSQL** - For application data, sessions, and metadata
- ✅ **ElastiCache Redis** - For caching and performance optimization
- ✅ **MindsDB Service** - For ML/AI operations via internal ALB
- ✅ **AWS Services** - Bedrock, S3, Secrets Manager, DynamoDB

**Data Flow**:
```
External Client → API Gateway → Lambda Functions → {
  ├── Aurora PostgreSQL (application data)
  ├── Redis (caching)
  ├── MindsDB Service (ML/AI)
  └── AWS Services (Bedrock, S3, etc.)
}
```

## Step-by-Step Deployment

### Phase 1: Core Infrastructure Setup

#### Step 1: Create KMS Key for Encryption1. Go

to AWS KMS Console 2. Click "Create key" 3. Select "Symmetric" key type 4. Key usage: "Encrypt and decrypt" 5. Key spec: "SYMMETRIC_DEFAULT" 6. Key material origin: "KMS" 7. Regionality: "Single-Region key" 8. Add key details:

- Alias: `mindsdb-rag-encryption-key-dev`
- Description: "KMS key for MindsDB RAG Assistant encryption"

9. Define key administrative permissions (select your user/role)
10. Define key usage permissions (select your user/role + add these service principals):
    - `ecs-tasks.amazonaws.com`
    - `lambda.amazonaws.com`
    - `secretsmanager.amazonaws.com`
11. Review and create key
12. **Save the Key ID** - you'll need it for other resources

#### Step 2: Create VPC and Networking

1. Go to VPC Console
2. Click "Create VPC"
3. Select "VPC and more"
4. Configure:
   - Name tag: `mindsdb-rag-vpc-dev`
   - IPv4 CIDR: `10.0.0.0/16`
   - IPv6 CIDR: No IPv6 CIDR block
   - Tenancy: Default
   
   **For Demo/Development (Cost-Optimized):**
   - Number of AZs: **2** (minimum required for Aurora)
   - Number of public subnets: 2
   - Number of private subnets: 2
   - Number of isolated subnets: 2 (for database)
   - NAT gateways: **In 1 AZ** (single NAT gateway for cost savings)
   
   **For Production (High Availability):**
   - Number of AZs: 3
   - Number of public subnets: 3
   - Number of private subnets: 3
   - Number of isolated subnets: 3 (for database)
   - NAT gateways: **1 per AZ** (for high availability)
   - VPC endpoints: S3 Gateway
5. Click "Create VPC"
6. **Save the VPC ID and subnet IDs** - you'll need them later

#### Step 3: Create Additional VPC Endpoints

**Important**: VPC endpoints require proper security group configuration to avoid "context deadline exceeded" errors.

**First, create a security group for VPC endpoints:**

1. Go to **EC2 Console** → **Security Groups**
2. Click **"Create security group"**
3. **Configuration**:
   - **Name**: `mindsdb-rag-vpc-endpoint-sg-dev`
   - **Description**: "Security group for VPC endpoints"
   - **VPC**: Select your MindsDB VPC
4. **Inbound rules**:
   - **Type**: HTTPS, **Protocol**: TCP, **Port**: 443, **Source**: `10.0.0.0/16` (your VPC CIDR)
5. **Outbound rules**: Leave default (All traffic to 0.0.0.0/0)
6. Click **"Create security group"**

**Now create interface endpoints for these services (one by one):**

7. Go to **VPC Console** → **Endpoints**
8. Click **"Create endpoint"**
9. For each service, create an endpoint:
   - `com.amazonaws.us-east-2.secretsmanager` ⭐ **Critical for ECS tasks and Lambda functions**
   - `com.amazonaws.us-east-2.kms` ⭐ **Required for Lambda functions accessing encrypted secrets**
   - `com.amazonaws.us-east-2.bedrock` ⭐ **Required for Lambda functions using Bedrock**
   - `com.amazonaws.us-east-2.bedrock-runtime` ⭐ **Required for Lambda functions using Bedrock**
   - `com.amazonaws.us-east-2.logs` ⭐ **Required for Lambda CloudWatch logging**
   - `com.amazonaws.us-east-2.ecr.dkr`
   - `com.amazonaws.us-east-2.ecr.api`
   - `com.amazonaws.us-east-2.dynamodb` ⭐ **Required for Lambda functions accessing DynamoDB**

**For each endpoint, configure:**

- **VPC**: Select your MindsDB VPC
- **Subnets**: Select your **private subnets** (not route tables)
- **Security groups**: Select `mindsdb-rag-vpc-endpoint-sg-dev` (the one you just created)
- **Policy**: Full access
- **Private DNS names**: **Enable** (this is critical)

**⚠️ Common Issue Prevention:**
- **Never use the default VPC security group** for endpoints without adding proper inbound rules
- **Always select private subnets** where your ECS tasks will run
- **Ensure Private DNS is enabled** for seamless service discovery

#### Step 4: Create Security Groups

Create these security groups in your VPC:

**ALB Security Group:**

1. Name: `mindsdb-rag-alb-sg-dev`
2. Description: "Security group for Application Load Balancer"
3. VPC: Your MindsDB VPC
4. Inbound rules:
   - HTTP (80) from 0.0.0.0/0
   - HTTPS (443) from 0.0.0.0/0
5. Outbound rules: All traffic to 0.0.0.0/0

**ECS Security Group:**

1. Name: `mindsdb-rag-ecs-sg-dev`
2. Description: "Security group for ECS tasks"
3. VPC: Your MindsDB VPC
4. Inbound rules:
   - **Custom TCP (47334)** from ALB Security Group ⭐ **MindsDB HTTP API**
   - Custom TCP (47335) from ALB Security Group (MindsDB MySQL API - optional)
5. Outbound rules: All traffic to 0.0.0.0/0

**Database Security Group:**

1. Name: `mindsdb-rag-db-sg-dev`
2. Description: "Security group for Aurora PostgreSQL"
3. VPC: Your MindsDB VPC
4. Inbound rules:
   - PostgreSQL (5432) from ECS Security Group
   - PostgreSQL (5432) from Lambda Security Group ⭐ **Lambda functions need database access**
5. Outbound rules: None

**Redis Security Group:**

1. Name: `mindsdb-rag-redis-sg-dev`
2. Description: "Security group for ElastiCache Redis"
3. VPC: Your MindsDB VPC
4. Inbound rules:
   - Custom TCP (6379) from ECS Security Group
   - Custom TCP (6379) from Lambda Security Group ⭐ **Lambda functions need Redis access**
5. Outbound rules: None

### Phase 2: Database Setup

#### Step 5: Create Aurora PostgreSQL Cluster

1. Go to RDS Console
2. Click "Create database"

**Database Creation Method:**
3. Choose creation method: **"Standard create"**

**Engine Options:**
4. Engine type: **"Aurora (PostgreSQL Compatible)"**
5. Engine version: **"Aurora PostgreSQL (Compatible with PostgreSQL 17.4) - default for major version 17"**
6. RDS Extended Support: Leave **unchecked**

**Templates:**
7. Choose: **"Dev/Test"** (for demo) or **"Production"** (for production use)

**Settings:**
8. DB cluster identifier: `mindsdb-rag-aurora-dev`
9. Credentials Settings:
   - Master username: `postgres`
   - Credentials management: **"Managed in AWS Secrets Manager - most secure"**
   - Select the encryption key: **"mindsdb-rag-encryption-key-dev"** (your KMS key)

**Cluster Storage Configuration:**
10. Configuration options: **"Aurora Standard"** (cost-effective for demo)

**Instance Configuration:**
11. DB instance class: **"Serverless v2"** (for demo cost optimization)
12. Capacity range:
    - Minimum capacity (ACUs): **0.5** (1 GiB)
    - Maximum capacity (ACUs): **4** (8 GiB) - adjust based on your needs
    - Pause after inactivity: **5 minutes** (to save costs during demo)

**Availability & Durability:**
13. Multi-AZ deployment: 
    - **Note**: AWS now requires Aurora clusters to span at least 2 availability zones
    - **"Create an Aurora Replica"** (this is now required, not optional)
    - This actually provides better high availability than the original single-AZ approach

**Connectivity:**
14. Compute resource: **"Don't connect to an EC2 compute resource"**
15. Network type: **"IPv4"**
16. Virtual private cloud (VPC): **Select your MindsDB VPC** (should show as `mindsdb-rag-encryption-key-dev-vpc`)
17. DB subnet group: **"Create new DB Subnet Group"**
18. Public access: **"No"**
19. VPC security group (firewall): **"Choose existing"**
    - Select your Database Security Group (created in Step 4)
20. Availability Zone: **"No preference"**
21. Certificate authority: **"rds-ca-rsa2048-g1 (default)"**

**Additional Configuration:**
22. RDS Data API: **Leave unchecked** (not needed for this setup)
23. Read replica write forwarding: **Leave unchecked**

**Database Authentication:**
24. Keep **"Password authentication"** checked
25. IAM database authentication: **Leave unchecked** (for simplicity)
26. Kerberos authentication: **Leave unchecked**

**Monitoring:**
27. Database Insights: **"Database Insights - Standard"** (7 days retention)
28. Performance Insights: **"Enable Performance Insights"**
    - Retention period: **"7 days"**
    - AWS KMS key: **"(default) aws/rds"**
29. Enhanced Monitoring: **"Enable Enhanced monitoring"**
    - OS metrics granularity: **"60 seconds"**
    - Monitoring role: **"default"**
30. Log exports: Check **"PostgreSQL log"**

**Additional Configuration (Expand this section):**
31. Database options:
    - Initial database name: `mindsdb_rag`
32. Backup:
    - Backup retention period: **7 days**
    - Backup window: **"03:00-04:00 UTC"** (or your preferred time)
33. Encryption: **Should already be enabled** (using your KMS key)
34. Maintenance:
    - Maintenance window: **"sun:04:00-sun:05:00 UTC"** (or your preferred time)
35. Deletion protection: **Leave unchecked** (for demo - easier to clean up)

36. Click **"Create database"**
37. **Save the cluster endpoint** - you'll need it later (it will appear after creation)

#### Step 6: Create ElastiCache Redis Cluster

1. Go to ElastiCache Console
2. Click "Create" → "Redis cluster"
3. Cluster mode: "Disabled"
4. Location: "AWS Cloud"
5. Cluster info:
   - Name: `mindsdb-rag-redis-dev`
   - Description: "Redis cluster for MindsDB RAG Assistant"
6. Cluster settings:
   - Engine version: "7.0"
   - Port: 6379
   - Parameter group: Create new
   - Node type: `cache.r6g.large`
   - Number of replicas: 0 (for dev)
7. Subnet group settings:
   - Create new subnet group
   - Name: `mindsdb-rag-redis-subnet-group`
   - VPC: Your MindsDB VPC
   - Subnets: Select private subnets
8. Security:
   - Security groups: Select Redis Security Group
   - Encryption at rest: Enable
   - Encryption in transit: Enable
9. Backup:
   - Enable automatic backups
   - Backup retention: 5 days
   - Backup window: 03:00-05:00 UTC
10. Maintenance:
    - Maintenance window: sun:05:00-sun:06:00 UTC
11. Click "Create"
12. **Save the Redis endpoint** - you'll need it later

### Phase 3: Container Infrastructure

#### Step 7: Create ECS Cluster

1. Go to ECS Console
2. Click "Create cluster"
3. Cluster configuration:
   - Cluster name: `mindsdb-rag-cluster-dev`
   - Infrastructure: "AWS Fargate (serverless)"
4. Monitoring: Enable Container Insights
5. Tags:
   - Environment: dev
   - Project: MindsDB-RAG-Assistant
6. Click "Create"

#### Step 8: Create IAM Roles for ECS

**ECS Task Execution Role:**

1. Go to IAM Console → Roles
2. Click "Create role"
3. Trusted entity: "AWS service" → "Elastic Container Service" → "Elastic Container Service Task"
4. Permissions policies:
   - Search for and select: `AmazonECSTaskExecutionRolePolicy`
5. Role name: `mindsdb-rag-ecs-execution-role-dev`
6. Click "Create role"

**Add inline policy for Secrets Manager and KMS:**
7. After the role is created, click on the role name to open it
8. Go to the "Permissions" tab
9. Click "Add permissions" → "Create inline policy"
10. Click the "JSON" tab
11. Replace the default policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "kms:Decrypt"],
      "Resource": [
        "arn:aws:secretsmanager:us-east-2:123456789012:secret:mindsdb-rag/*",
        "arn:aws:secretsmanager:us-east-2:123456789012:secret:rds!cluster-*",
        "arn:aws:kms:us-east-2:123456789012:key/*"
      ]
    }
  ]
}
```

12. **Replace the placeholders** with your actual values:
    - `123456789012` → Your AWS Account ID
    - **Note**: The policy now includes `rds!cluster-*` to cover Aurora auto-generated secrets
13. Click "Next"
14. Policy name: `SecretsManagerKMSAccess`
15. Click "Create policy"

**ECS Task Role:**

1. Go back to IAM Console → Roles
2. Click "Create role" again
3. Trusted entity: "AWS service" → "Elastic Container Service" → "Elastic Container Service Task"
4. Permissions policies: **Don't select any** (we'll add inline policy)
5. Role name: `mindsdb-rag-ecs-task-role-dev`
6. Click "Create role"

**Add inline policy for application permissions:**
7. Click on the newly created role name
8. Go to "Permissions" tab
9. Click "Add permissions" → "Create inline policy"
10. Click the "JSON" tab
11. Replace the default policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
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
        "cloudwatch:PutMetricData"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-2::foundation-model/*",
        "arn:aws:s3:::mindsdb-rag-*",
        "arn:aws:s3:::mindsdb-rag-*/*",
        "arn:aws:secretsmanager:us-east-2:123456789012:secret:mindsdb-rag/*",
        "arn:aws:kms:us-east-2:123456789012:key/abcd1234-a123-456a-a12b-a123b4cd56ef",
        "arn:aws:logs:us-east-2:123456789012:*",
        "arn:aws:cloudwatch:us-east-2:123456789012:*"
      ]
    }
  ]
}
```

12. **Replace the placeholders** with your actual values:
    - `123456789012` → Your AWS Account ID  
    - `abcd1234-a123-456a-a12b-a123b4cd56ef` → Your KMS Key ID (from Step 1)
13. Click "Next"
14. Policy name: `MindsDBApplicationAccess`
15. Click "Create policy"

### Phase 4: Storage Setup

#### Step 9: Create S3 Buckets

Create three S3 buckets:

**Documents Bucket:**

1. Go to S3 Console
2. Click "Create bucket"
3. Bucket name: `mindsdb-rag-documents-123456789012-us-east-2`
4. Region: us-east-2
5. Block all public access: Enable
6. Bucket versioning: Enable
7. Default encryption:
   - Encryption type: SSE-KMS
   - KMS key: Your MindsDB KMS key
8. Advanced settings:
   - Object lock: Disable
9. Click "Create bucket"

**Model Artifacts Bucket:**

1. Bucket name: `mindsdb-rag-models-123456789012-us-east-2`
2. Same settings as documents bucket

**Audit Logs Bucket:**

1. Bucket name: `mindsdb-rag-audit-123456789012-us-east-2`
2. Same settings as documents bucket
3. Add lifecycle policy (after bucket is created):
   - Go to the bucket → "Management" tab
   - Click "Create lifecycle rule"
   - Rule name: `AuditLogLifecycle`
   - Rule scope: "Apply to all objects in the bucket"
   - Lifecycle rule actions:
     - ✅ Transition current versions of objects between storage classes
     - ✅ Delete current versions of objects
   - Transition current versions:
     - Transition to Standard-IA after: **30 days**
     - Transition to Glacier Flexible Retrieval after: **90 days**
   - Delete current versions of objects after: **2555 days** (7 years)
   - Click "Create rule"

#### Step 10: Create Secrets in Secrets Manager

**MindsDB API Credentials:**

1. Go to Secrets Manager Console
2. Click "Store a new secret"
3. Secret type: "Other type of secret"
4. Key/value pairs:
   - username: `mindsdb`
   - apiKey: `mindsdb-demo-api-key-2024` (or generate your own secure key)
5. Encryption key: Your MindsDB KMS key
6. Secret name: `mindsdb-rag/mindsdb-api-key`
7. Description: "MindsDB API credentials"
8. Automatic rotation: Disable
9. Click "Store"

**Bedrock Configuration:**

1. Create another secret
2. Key/value pairs:
   - modelId: `amazon.nova-micro-v1:0`
   - region: `us-east-2`
   - maxTokens: `4096`
   - temperature: `0.7`
3. Secret name: `mindsdb-rag/bedrock-config`
4. Same encryption settings

**Redis Configuration:**

1. Create another secret
2. Key/value pairs:
   - host: `YOUR_REDIS_ENDPOINT`
   - port: `6379`
   - ssl: `true`
3. Secret name: `mindsdb-rag/redis-config`

### Phase 5: Authentication and Security

#### Step 11: Create Cognito User Pool

1. Go to Cognito Console
2. Click "Create user pool"

**Define your application:**
3. Application type: **"Traditional web application"** (select this option)
4. Name your application: `mindsdb-rag-client-dev`

**Configure options:**
5. Options for sign-in identifiers:
   - Check **"Email"** (this is what we want for our application)
   - Leave "Phone number" and "Username" unchecked
6. Self-registration: **Check "Enable self-registration"** (allows users to sign up)
7. Required attributes for sign-up:
   - Click **"Select attributes"**
   - Select **"email"** and **"name"** from the list
   - Click "Confirm" or "Done"
8. Add a return URL (optional):
   - Return URL: `https://localhost:3000/callback`
   - (You can change this later when you deploy your actual application)

9. Click **"Create user directory"**

**After creation, you'll need to configure additional settings:**

10. Once the user pool is created, go to the **"App integration"** tab
11. Under **"Domain"**, click **"Create Cognito domain"**
    - Domain prefix: `mindsdb-rag-dev-123456789012` (replace with your account ID)
    - Click **"Create domain"**

12. Go to **"App clients and analytics"** tab
13. Click on your app client name (`mindsdb-rag-client-dev`)
14. Click **"Edit"** in the "Hosted UI" section
15. Configure:
    - Allowed callback URLs: `https://localhost:3000/callback`
    - Allowed sign-out URLs: `https://localhost:3000/`
    - Identity providers: **"Cognito user pool"**
    - OAuth 2.0 grant types: **"Authorization code grant"**
    - OpenID Connect scopes: **"OpenID"**, **"Email"**, **"Profile"**
16. Click **"Save changes"**

17. **Save these important values** (found in the app client details):
    - **User Pool ID** (found in "User pool overview")
    - **App Client ID** (found in "App clients and analytics")
    - **Cognito Domain** (found in "App integration" → "Domain")

#### Step 12: Create Cognito Identity Pool

1. In Cognito Console, click **"Identity pools"** in the left sidebar
2. Click **"Create identity pool"**

**Configure properties:**
3. Identity pool name: `mindsdb-rag-identity-dev`
4. Basic (classic) authentication: **Leave unchecked** (we'll use the enhanced flow which is recommended)

5. Click **"Next"**

**Connect identity providers:**
6. You'll see **"Amazon Cognito user pool"** section - click to configure it (don't click "Skip for now")

**User pool details:**
7. Configure the user pool connection:
   - User pool ID: **Enter your User Pool ID from Step 11** (format: `us-east-2_xxxxxxxxx`)
   - App client ID: **Enter your App Client ID from Step 11**

**Role settings:**
8. Role selection: **"Use default authenticated role"** (keep this selected - it's the simplest option)

**Attributes for access control:**
9. Claim mapping: **"Inactive"** (keep this setting - we don't need custom attribute mapping for this demo)
10. Use default mappings: **Keep selected** (this is fine for our use case)

11. Click **"Next"**

**Configure permissions:**
10. Authenticated role:
    - **"Create a new role"** (should be selected by default)
    - Role name: `Cognito_mindsdbragidentitydev_Auth_Role`
11. Unauthenticated role: **"Don't allow unauthenticated identities"** (leave this unchecked for security)
12. Click **"Next"**

**Review and create:**
13. Review all your settings:
    - Identity pool name: `mindsdb-rag-identity-dev`
    - Authentication providers: Amazon Cognito user pool (your pool)
    - Authenticated role: New role will be created
    - Unauthenticated access: Disabled
14. Click **"Create identity pool"**

**After creation:**
15. **Save the Identity Pool ID** - you'll find this in the identity pool details page
16. Note down these important values for your application configuration:
    - **User Pool ID** (from Step 11): `us-east-2_xxxxxxxxx`
    - **App Client ID** (from Step 11): `xxxxxxxxxxxxxxxxxxxxxxxxxx`
    - **Identity Pool ID** (from this step): `us-east-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
    - **Cognito Domain** (from Step 11): `mindsdb-rag-dev-123456789012.auth.us-east-2.amazoncognito.com`

#### Step 13: Create WAF Web ACL

1. Go to WAF Console
2. Click "Create web ACL"
3. Web ACL details:
   - Name: `mindsdb-rag-waf-dev`
   - Description: "WAF for MindsDB RAG Assistant"
   - CloudWatch metric name: `mindsdbragwafdev`
   - Resource type: "Regional resources"
   - Region: us-east-2
4. Associated AWS resources: Skip for now
5. Add rules:
   - AWS managed rule groups:
     - Core rule set
     - Known bad inputs
     - SQL database
   - Rate limiting rule:
     - Name: `RateLimitRule`
     - Rate limit: 2000 requests per 5 minutes
6. Default action: Allow
7. CloudWatch metrics: Enable
8. Sampled requests: Enable
9. Click "Create web ACL"
10. **Save Web ACL ARN**

### Phase 6: API and Lambda Functions

#### Step 14: Create Lambda Execution Role

1. Go to IAM Console → Roles
2. Create role for Lambda service
3. Role name: `mindsdb-rag-lambda-execution-role-dev`
4. Attach policies:
   - `AWSLambdaVPCAccessExecutionRole`
5. Add inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "secretsmanager:GetSecretValue",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "rds:DescribeDBClusters",
        "rds:DescribeDBInstances",
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-2:123456789012:table/mindsdb-rag-sessions-dev*",
        "arn:aws:secretsmanager:us-east-2:123456789012:secret:mindsdb-rag/*",
        "arn:aws:secretsmanager:us-east-2:123456789012:secret:rds!cluster-*",
        "arn:aws:kms:us-east-2:123456789012:key/abcd1234-a123-456a-a12b-a123b4cd56ef",
        "arn:aws:s3:::mindsdb-rag-*",
        "arn:aws:s3:::mindsdb-rag-*/*",
        "arn:aws:rds:us-east-2:123456789012:cluster:mindsdb-rag-aurora-dev",
        "arn:aws:bedrock:us-east-2::foundation-model/*",
        "arn:aws:logs:us-east-2:123456789012:*"
      ]
    }
  ]
}
```

6. **Replace the placeholders** with your actual values:
   - `123456789012` → Your AWS Account ID
   - `abcd1234-a123-456a-a12b-a123b4cd56ef` → Your KMS Key ID (from Step 1)
7. Click "Next"
8. Policy name: `LambdaApplicationAccess`
9. Click "Create policy"

#### Step 15: Create API Gateway

1. Go to API Gateway Console
2. Click "Create API"
3. Choose "REST API" (not private)
4. API details:
   - API name: `mindsdb-rag-api-dev`
   - Description: "MindsDB RAG Assistant API"
   - Endpoint type: Regional
5. Click "Create API"
6. **Save API ID**

**Create Cognito Authorizer:**

1. In your API, go to "Authorizers"
2. Click "Create New Authorizer"
3. Name: `CognitoAuthorizer`
4. Type: "Cognito"
5. Cognito User Pool: Select your user pool
6. Token Source: `Authorization`
7. Click "Create"

### Phase 7: AI/ML Components

#### Step 16: Create DynamoDB Table for Sessions

1. Go to DynamoDB Console
2. Click "Create table"
3. Table details:
   - Table name: `mindsdb-rag-sessions-dev`
   - Partition key: `merchant_id` (String)
   - Sort key: `session_id` (String)
4. Settings:
   - Table class: Standard
   - Capacity mode: On-demand
5. Encryption:
   - Encryption at rest: Enable
   - KMS key: Your MindsDB KMS key
6. Point-in-time recovery: Enable
7. Click "Create table"

**Add Global Secondary Indexes:**

1. Go to your table → Indexes tab
2. Create index:
   - Index name: `SessionIdIndex`
   - Partition key: `session_id` (String)
   - Projected attributes: All
3. Create another index:
   - Index name: `UserIdIndex`
   - Partition key: `user_id` (String)
   - Sort key: `created_at` (String)
   - Projected attributes: All

#### Step 17: Create Bedrock Agent Execution Role

**Create the IAM Role:**

1. Go to **IAM Console** → **Roles**
2. Click **"Create role"**
3. **Trusted entity type**: Select **"AWS service"**
4. **Use case**: 
   - In the search box, type **"bedrock"**
   - Select **"Bedrock"** from the list
   - Choose **"Bedrock - Agent"** (this allows Bedrock agents to assume this role)
5. Click **"Next"**

**Attach Permissions Policies:**

6. **Don't select any managed policies** - we'll add a custom inline policy instead
7. Click **"Next"**

**Name and Review:**

8. **Role name**: `mindsdb-rag-bedrock-agent-role-dev`
9. **Description**: "Execution role for MindsDB RAG Assistant Bedrock Agent"
10. **Tags** (optional):
    - Key: `Environment`, Value: `dev`
    - Key: `Project`, Value: `MindsDB-RAG-Assistant`
11. Click **"Create role"**

**Configure Trust Policy:**

12. After the role is created, click on the role name to open it
13. Go to the **"Trust relationships"** tab
14. Click **"Edit trust policy"**
15. Replace the existing policy with this JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

16. Click **"Update policy"**

**Add Inline Permissions Policy:**

17. Go to the **"Permissions"** tab
18. Click **"Add permissions"** → **"Create inline policy"**
19. Click the **"JSON"** tab
20. Replace the default policy with this JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:GetFoundationModel",
        "bedrock:ListFoundationModels",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "lambda:InvokeFunction",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-*",
        "arn:aws:dynamodb:us-east-2:123456789012:table/mindsdb-rag-sessions-dev*",
        "arn:aws:lambda:us-east-2:123456789012:function:mindsdb-rag-*",
        "arn:aws:logs:us-east-2:123456789012:log-group:/aws/bedrock/agent/*"
      ]
    }
  ]
}
```

21. **Replace the placeholders** with your actual values:
    - `123456789012` → Your AWS Account ID
22. Click **"Next"**
23. **Policy name**: `BedrockAgentApplicationAccess`
24. **Description**: "Allows Bedrock agent to access required AWS services"
25. Click **"Create policy"**

**Verify Role Creation:**

26. **Save the Role ARN** - you'll need this when creating the Bedrock agent
    - The ARN format will be: `arn:aws:iam::123456789012:role/mindsdb-rag-bedrock-agent-role-dev`
27. Verify the role has:
    - ✅ Trust relationship with `bedrock.amazonaws.com`
    - ✅ Inline policy `BedrockAgentApplicationAccess`
    - ✅ Permissions to invoke models, access DynamoDB, and call Lambda functions

### Phase 8: Monitoring and Alerting

#### Step 18: Create CloudWatch Dashboard

**Create the Dashboard:**

1. Go to **CloudWatch Console** (https://console.aws.amazon.com/cloudwatch/)
2. In the left sidebar, click **"Dashboards"**
3. Click **"Create dashboard"**
4. **Dashboard name**: `MindsDB-RAG-Dashboard-dev`
5. Click **"Create dashboard"**

**Add ECS Service Metrics Widget:**

6. Click **"Add widget"**
7. Select **"Line"** chart type
8. Click **"Configure"**
9. **Metrics tab**:
   - **Namespace**: `AWS/ECS`
   - **Metric name**: Select these metrics:
     - `CPUUtilization`
     - `MemoryUtilization`
   - **Dimensions**: 
     - ServiceName: `mindsdb-rag-service-dev`
     - ClusterName: `mindsdb-rag-cluster-dev`
10. **Graphed metrics tab**:
    - **Period**: 5 minutes
    - **Statistic**: Average
11. **Options tab**:
    - **Widget title**: `ECS Service - CPU & Memory`
    - **Y-axis**: Left Y-axis (0-100)
12. Click **"Create widget"**

**Add ECS Task Count Widget:**

13. Click **"Add widget"**
14. Select **"Number"** chart type
15. Click **"Configure"**
16. **Metrics**:
    - **Namespace**: `AWS/ECS`
    - **Metric name**: `RunningTaskCount`
    - **Dimensions**: Same as above
17. **Options**:
    - **Widget title**: `ECS Running Tasks`
18. Click **"Create widget"**

**Add RDS Database Metrics Widget:**

19. Click **"Add widget"**
20. Select **"Line"** chart type
21. **Metrics**:
    - **Namespace**: `AWS/RDS`
    - **Metric names**:
      - `CPUUtilization`
      - `DatabaseConnections`
      - `ReadIOPS`
      - `WriteIOPS`
    - **Dimensions**:
      - DBClusterIdentifier: `mindsdb-rag-aurora-dev`
22. **Options**:
    - **Widget title**: `Aurora Database Metrics`
    - **Period**: 5 minutes
23. Click **"Create widget"**

**Add API Gateway Metrics Widget:**

24. Click **"Add widget"**
25. Select **"Line"** chart type
26. **Metrics**:
    - **Namespace**: `AWS/ApiGateway`
    - **Metric names**:
      - `Count` (Total requests)
      - `Latency` (Response time)
      - `4XXError` (Client errors)
      - `5XXError` (Server errors)
    - **Dimensions**:
      - ApiName: `mindsdb-rag-api-dev`
      - Stage: `dev`
27. **Options**:
    - **Widget title**: `API Gateway Performance`
    - **Period**: 5 minutes
28. Click **"Create widget"**

**Add Lambda Functions Metrics Widget:**

29. Click **"Add widget"**
30. Select **"Line"** chart type
31. **Metrics**:
    - **Namespace**: `AWS/Lambda`
    - **Metric names**:
      - `Invocations`
      - `Duration`
      - `Errors`
      - `Throttles`
    - **Dimensions**: Select all your Lambda functions:
      - `mindsdb-rag-bedrock-tools-dev`
      - `mindsdb-rag-checkout-dev`
      - `mindsdb-rag-health-dev`
32. **Options**:
    - **Widget title**: `Lambda Functions Performance`
    - **Period**: 5 minutes
33. Click **"Create widget"**

**Add ElastiCache Redis Metrics Widget:**

34. Click **"Add widget"**
35. Select **"Line"** chart type
36. **Metrics**:
    - **Namespace**: `AWS/ElastiCache`
    - **Metric names**:
      - `CPUUtilization`
      - `CurrConnections`
      - `CacheHits`
      - `CacheMisses`
    - **Dimensions**:
      - CacheClusterId: `mindsdb-rag-redis-dev`
37. **Options**:
    - **Widget title**: `Redis Cache Performance`
38. Click **"Create widget"**

**Add Custom Application Metrics Widget (Optional):**

39. Click **"Add widget"**
40. Select **"Line"** chart type
41. **Metrics**:
    - **Namespace**: `MindsDB/RAG` (custom namespace for your app)
    - **Metric names** (these would be published by your application):
      - `DocumentsProcessed`
      - `QueriesProcessed`
      - `ResponseTime`
42. **Options**:
    - **Widget title**: `Application Metrics`
43. Click **"Create widget"**

**Organize and Save Dashboard:**

44. **Arrange widgets**: Drag and drop widgets to organize them logically
45. **Resize widgets**: Drag the corners to make them larger or smaller
46. **Recommended layout**:
    ```
    [ECS CPU & Memory]    [ECS Tasks]       [API Gateway]
    [RDS Metrics]         [Lambda Metrics]  [Redis Cache]
    [Application Metrics - Full Width]
    ```
47. Click **"Save dashboard"** in the top-right corner

**Configure Dashboard Settings:**

48. Click the **gear icon** (Dashboard settings)
49. **Auto refresh**: Set to **1 minute** for real-time monitoring
50. **Time range**: Set to **Last 1 hour** as default
51. **Timezone**: Select your preferred timezone
52. Click **"Save"**

**Create Dashboard URL for Sharing:**

53. Click **"Share dashboard"** 
54. **Copy the dashboard URL** - you can bookmark this or share with your team
55. **Save the dashboard URL** for quick access

**Verify Dashboard:**

56. Ensure all widgets are displaying data (may take a few minutes for metrics to appear)
57. Check that time ranges and refresh rates are working correctly
58. Test the dashboard on different screen sizes if needed

Your CloudWatch dashboard is now ready and will provide comprehensive monitoring of your MindsDB RAG Assistant infrastructure!

#### Step 19: Create CloudWatch Alarms

Create alarms for:

1. **High API Latency**
   - Metric: API Gateway latency > 5000ms
   - Action: SNS notification

2. **High Error Rate**
   - Metric: API Gateway 4XX/5XX errors > 10%
   - Action: SNS notification

3. **ECS High CPU**
   - Metric: ECS CPU utilization > 80%
   - Action: SNS notification

4. **Database Connection Issues**
   - Metric: RDS connection count > 80% of max
   - Action: SNS notification

### Phase 9: Application Deployment

#### Step 20: Create ECS Task Definition

**Important: Aurora Endpoint Selection**

Before creating the task definition, you need to choose the correct Aurora endpoint. Aurora provides multiple endpoints:

- **Writer Endpoint** (Recommended): `mindsdb-rag-aurora-dev.cluster-xxxxxxxxx.us-east-2.rds.amazonaws.com`
  - ✅ **Use this one** - Handles both reads and writes
  - ✅ Provides automatic failover capability
  - ✅ Required for MindsDB operations

- **Reader Endpoint**: `mindsdb-rag-aurora-dev.cluster-ro-xxxxxxxxx.us-east-2.rds.amazonaws.com`
  - ❌ Don't use for MindsDB - Read-only, cannot create tables or insert data
  - ✅ Good for analytics or reporting applications (separate use case)

- **Individual Instance Endpoints**: `mindsdb-rag-aurora-dev-instance-1.xxxxxxxxx.us-east-2.rds.amazonaws.com`
  - ❌ Don't use - Points to specific instances, no automatic failover

**To find your Writer Endpoint:**
1. Go to RDS Console → Databases
2. Click on your Aurora cluster name (`mindsdb-rag-aurora-dev`)
3. In the "Connectivity & security" tab, you'll see two cluster endpoints:
   - **Writer endpoint**: `mindsdb-rag-aurora-dev.cluster-xxxxxxxxx.us-east-2.rds.amazonaws.com`
   - **Reader endpoint**: `mindsdb-rag-aurora-dev.cluster-ro-xxxxxxxxx.us-east-2.rds.amazonaws.com`
4. **Copy the Writer endpoint** (the one WITHOUT "ro" in the name)

**Why You Have Both Endpoints with 2-AZ Setup:**

Your Aurora cluster now spans 2 availability zones (as required by AWS), which means:
- ✅ **Better High Availability**: Automatic failover between AZs
- ✅ **Writer Endpoint**: Always points to the current primary instance
- ✅ **Reader Endpoint**: Can distribute read queries across replicas
- ✅ **Cost-Effective**: Still using Serverless v2 with auto-scaling
- ✅ **Production-Ready**: More robust than single-AZ deployments

**Create CloudWatch Log Group (First):**

1. Go to **CloudWatch Console** → **Logs** → **Log groups**
2. Click **"Create log group"**
3. **Log group name**: `/ecs/mindsdb-rag-task-dev`
4. **Retention setting**: 7 days (for demo) or 30 days (for production)
5. Click **"Create"**

**Create the Task Definition:**

6. Go to ECS Console → Task definitions
7. Click **"Create new task definition"**

**Task Definition Configuration:**
8. **Task definition family**: `mindsdb-rag-task-dev`

**Infrastructure Requirements:**
9. **Launch type**: Select **"AWS Fargate"** (Serverless compute for containers)
10. **Operating system/Architecture**: **"Linux/X86_64"** (should be selected by default)
11. **Network mode**: **"awsvpc"** (should be selected automatically)

**Task Size:**
12. **CPU**: Select **"1 vCPU"** from the dropdown
13. **Memory**: Select **"2 GB"** from the dropdown

**Task Roles:**
14. **Task role**: Select **"mindsdb-rag-ecs-task-role-dev"** from the dropdown
15. **Task execution role**: Select **"mindsdb-rag-ecs-execution-role-dev"** from the dropdown
**Configure Container - 1:**

16. In the **"Container - 1"** section (this is automatically created):

**Container Details:**
17. **Name**: `mindsdb-service`
18. **Essential container**: **"Yes"** (keep checked)
19. **Image URI**: `mindsdb/mindsdb:latest`
20. **Private registry authentication**: Leave unchecked (using public Docker Hub)

**Port Mappings:**
21. You'll see default port mappings - **remove them** and add these:
    - **Container port**: `47334`, **Protocol**: `TCP`, **Port name**: `mindsdb-http`, **App protocol**: `HTTP`
    - Click **"Add port mapping"**
    - **Container port**: `47335`, **Protocol**: `TCP`, **Port name**: `mindsdb-mysql`, **App protocol**: `HTTP`

**Resource Allocation Limits:**
22. **CPU**: Leave blank (will use task-level CPU)
23. **Memory hard limit**: Leave blank (will use task-level memory)
24. **Memory soft limit**: Leave blank

**Environment Variables:**

25. In the **"Environment variables - optional"** section:
26. Click **"Add environment variable"** for each of these:
    - **Key**: `MINDSDB_DB_SERVICE_HOST`, **Value type**: `Value`, **Value**: Your Aurora writer endpoint (e.g., `mindsdb-rag-aurora-dev.cluster-xxxxxxxxx.us-east-2.rds.amazonaws.com`)
    - **Key**: `MINDSDB_DB_SERVICE_PORT`, **Value type**: `Value`, **Value**: `5432`
    - **Key**: `MINDSDB_DB_SERVICE_DATABASE`, **Value type**: `Value`, **Value**: `mindsdb_rag`
    - **Key**: `REDIS_HOST`, **Value type**: `Value`, **Value**: Your Redis endpoint without port (e.g., `mindsdb-rag-redis-dev.xxxxxx.cache.amazonaws.com`)
    - **Key**: `REDIS_PORT`, **Value type**: `Value`, **Value**: `6379`

27. **For database credentials**, you have two options:

**Option A: Use Complete Aurora Secret (Recommended):**
- **Key**: `DB_CREDENTIALS_SECRET_ARN`, **Value type**: `ValueFrom`, **Value**: Your complete Aurora secret ARN (without `:username` or `:password`)

**Option B: Create Separate Username/Password Secrets:**
- First create individual secrets in Secrets Manager for username and password
- Then add: **Key**: `MINDSDB_DB_SERVICE_USER`, **Value type**: `ValueFrom`, **Value**: `arn:aws:secretsmanager:us-east-2:123456789012:secret:mindsdb-rag/db-username-XXXXXX`
- And: **Key**: `MINDSDB_DB_SERVICE_PASSWORD`, **Value type**: `ValueFrom`, **Value**: `arn:aws:secretsmanager:us-east-2:123456789012:secret:mindsdb-rag/db-password-XXXXXX`

**To Find Your Aurora Secret ARN:**
- Go to **AWS Secrets Manager Console**
- Look for a secret named like `rds!cluster-XXXXXXXXXXXXXXXXXX`
- Click on the secret name
- Copy the **complete Secret ARN** from the secret details page
- **Important**: Do NOT add `:username` or `:password` to Aurora auto-generated secret ARNs

**Configure Logging:**

28. In the **"Logging - optional"** section:
29. **Use log collection**: Check this box
30. **Log collection**: Select **"Amazon CloudWatch"**
31. The system will automatically configure CloudWatch logging with these settings:
    - **Log group**: `/aws/ecs/mindsdb-rag-task-dev` (auto-created)
    - **Log stream prefix**: `ecs`
    - **Region**: `us-east-2`

**Optional Sections (you can skip these for basic setup):**
- **Restart policy**: Leave as default
- **HealthCheck**: Skip for now
- **Startup dependency ordering**: Skip
- **Container timeouts**: Skip
- **Container network settings**: Skip
- **Docker configuration**: Skip
- **Resource limits (Ulimits)**: Skip
- **Docker labels**: Skip

**Finalize Task Definition:**

32. **Storage**: Skip (no additional storage needed)
33. **Monitoring**: Skip (basic monitoring is enabled by default)
34. **Tags**: Optionally add tags:
    - **Key**: `Environment`, **Value**: `dev`
    - **Key**: `Project`, **Value**: `MindsDB-RAG-Assistant`

35. Click **"Create"** to create the task definition

#### Step 21: Create ECS Service

**Navigate to Your ECS Cluster:**

1. Go to **ECS Console** → **Clusters**
2. Click on your cluster name: `mindsdb-rag-cluster-dev`
3. In the **Services** tab, click **"Create"**

**Environment Configuration:**

4. **Compute configuration (Launch type)**: Select **"Launch type"**
5. **Launch type**: Select **"FARGATE"**

**Deployment Configuration:**

6. **Application type**: Select **"Service"** (should be selected by default)
7. **Task definition**:
   - **Family**: Select `mindsdb-rag-task-dev` from dropdown
   - **Revision**: Select **"LATEST"** (or the specific revision number)

**Service Configuration:**

8. **Service name**: `mindsdb-rag-service-dev`
9. **Service type**: **"REPLICA"** (should be selected by default)
10. **Desired tasks**: `2` (for high availability)

**Deployment Options:**

11. **Deployment type**: **"Rolling update"**
12. **Deployment configuration**:
    - **Minimum healthy percent**: `50`
    - **Maximum percent**: `200`

**Networking:**

13. **VPC**: Select your MindsDB VPC (`mindsdb-rag-vpc-dev`)
14. **Subnets**: Select your **private subnets** (not public subnets)
    - Choose subnets in different AZs for high availability
    - Example: `mindsdb-rag-vpc-dev-subnet-private1-us-east-2a` and `mindsdb-rag-vpc-dev-subnet-private2-us-east-2b`
15. **Security groups**: 
    - **Create new security group**: Uncheck this
    - **Use existing security group**: Select `mindsdb-rag-ecs-sg-dev` (created in Step 4)
16. **Auto-assign public IP**: **"DISABLED"** (since we're using private subnets)

**Load Balancing (Internal Access Only):**

**Important Architecture Note**: The MindsDB service should be internal-only. External access will be provided through API Gateway → Lambda → Internal ALB → MindsDB.

17. **Container**: You'll see a dropdown showing your container and ports:
    - Select **"mindsdb-service 47334:47334"** (MindsDB HTTP API port)
    - **Important**: MindsDB runs on port 47334, not port 80

18. **Use an existing load balancer**: Leave **unchecked** (we're creating a new one)

19. **Load balancer name**: `mindsdb-rag-alb-dev`
20. **Load balancer scheme**: Select **"Internal"** ⭐ **MindsDB should only be accessible within VPC**
21. **Load balancer subnets**: Select your **private subnets** (same as ECS tasks)

**Listener Configuration:**

22. **Listener**: Select **"Create new listener"** (should be selected by default)
23. **Port**: `80` (ALB will listen on port 80)
24. **Protocol**: Select **"HTTP"** from dropdown

**Target Group Configuration:**

25. **Target group**: Select **"Create new target group"** (should be selected by default)
26. **Target group name**: `mindsdb-rag-tg-dev`
27. **Protocol**: Select **"HTTP"** from dropdown
28. **Port**: `47334` ⭐ **Critical: Must match MindsDB's port**
29. **Deregistration delay**: `300` seconds (default is fine)

**Health Check Configuration:**

30. **Health check protocol**: Select **"HTTP"** from dropdown
31. **Health check path**: `/` (MindsDB responds to root path)
32. **Health check port**: `Traffic port` (uses port 47334)
33. **Advanced health check settings**:
    - **Healthy threshold**: 3 consecutive successful checks
    - **Unhealthy threshold**: 3 consecutive failed checks
    - **Timeout**: 10 seconds (MindsDB may take time to respond)
    - **Interval**: 30 seconds
    - **Success codes**: 200

**Service Auto Scaling:**

34. **Service auto scaling**: Check **"Use service auto scaling"**
35. **Minimum number of tasks**: `1`
36. **Maximum number of tasks**: `10`
37. **Scaling policy**:
    - **Policy name**: `mindsdb-rag-cpu-scaling`
    - **ECS service metric**: **"ECSServiceAverageCPUUtilization"**
    - **Target value**: `70`
    - **Scale-out cooldown**: `300` seconds
    - **Scale-in cooldown**: `300` seconds

**Service Discovery (Optional - Skip for Demo):**

38. **Service discovery**: Leave **unchecked** (not needed for this setup)

**Service Tags:**

39. **Tags** (optional but recommended):
    - **Key**: `Environment`, **Value**: `dev`
    - **Key**: `Project`, **Value**: `MindsDB-RAG-Assistant`
    - **Key**: `Service`, **Value**: `MindsDB`

**Review and Create:**

40. **Review all settings**:
    - ✅ Task definition: `mindsdb-rag-task-dev:LATEST`
    - ✅ Service name: `mindsdb-rag-service-dev`
    - ✅ Desired tasks: 2
    - ✅ Launch type: FARGATE
    - ✅ VPC: Your MindsDB VPC
    - ✅ Subnets: Private subnets
    - ✅ Security group: ECS security group
    - ✅ Load balancer: Internal ALB
    - ✅ Auto scaling: Enabled (1-10 tasks)

41. Click **"Create"**

**Monitor Service Creation:**

42. **Wait for service creation** (this may take 5-10 minutes)
43. **Monitor the Events tab** for any errors or issues
44. **Check the Tasks tab** to see when tasks are running
45. **Verify Load Balancer** is created and healthy in EC2 Console → Load Balancers

**Verify Service is Running:**

46. In the **Tasks** tab, you should see 2 tasks in **"RUNNING"** status
47. In the **Health and metrics** tab, check that tasks are healthy
48. **Save the Load Balancer DNS name** - you'll need this for API Gateway integration

**Troubleshooting Common Issues:**

- **"Context deadline exceeded" error**: 
  - ✅ Check VPC endpoints are created (especially Secrets Manager)
  - ✅ Verify VPC endpoint security groups allow HTTPS (443) from ECS security group
  - ✅ Ensure Private DNS is enabled on VPC endpoints
  - ✅ Confirm ECS execution role has permissions for Aurora secrets (`rds!cluster-*`)
- **"AccessDeniedException" for secrets**: Update ECS execution role policy to include `rds!cluster-*` pattern
- **ELB Health Check Failures ("Request timed out")**:
  - ✅ **Most Common**: Target group port mismatch - ensure target group uses port **47334**, not 80
  - ✅ Check ECS task logs: MindsDB should show "http API: started on 47334"
  - ✅ Update ECS security group: Allow inbound port 47334 from ALB security group
  - ✅ Verify health check path is `/` (MindsDB responds to root)
  - ✅ Increase health check timeout to 10 seconds (MindsDB startup time)
- **Tasks stuck in PENDING**: Check IAM roles and VPC endpoints
- **Service not starting**: Check CloudWatch logs for container errors
- **No internet access**: Ensure NAT Gateway is configured for private subnets
- **Cannot curl ALB directly**: This is expected - internal ALB is only accessible within VPC
  - Test from Lambda functions or EC2 instances within the VPC
  - External access should go through API Gateway → Lambda → Internal ALB

**MindsDB-Specific Notes:**
- MindsDB HTTP API runs on port **47334** (not 80)
- MindsDB MySQL API runs on port **47335** (if needed)
- Health check endpoint: `/` returns 200 OK when ready
- Startup time: Allow 30-60 seconds for MindsDB to fully initialize
- **ALB is internal-only**: Direct internet access not intended - use API Gateway for external access

### Phase 10: Final Configuration

#### Step 22: Configure API Gateway Resources

**Important**: Complete this step AFTER Step 24 (creating Lambda functions). This creates the public API that external clients will use.

**Navigate to Your API:**

1. Go to **API Gateway Console** (https://console.aws.amazon.com/apigateway/)
2. In the left sidebar, click **"REST APIs"**
3. **Find and click** on your API: `mindsdb-rag-api-dev`
4. You should see the API dashboard with the root resource `/`

**Verify Cognito Authorizer Exists:**

5. **Check existing authorizers**:
   - In your API, click **"Authorizers"** in the left sidebar
   - You should see `CognitoAuthorizer` created in Step 15
   - If not, create it:
     - Click **"Create New Authorizer"**
     - **Name**: `CognitoAuthorizer`
     - **Type**: **"Cognito"**
     - **Cognito User Pool**: Select your user pool (`mindsdb-rag-user-pool-dev`)
     - **Token Source**: `Authorization`
     - **Token Validation**: Leave blank (uses default regex)
     - Click **"Create"**

**Create /health Endpoint (Public Health Check):**

6. **Create the health resource**:
   - **Right-click** on the root `/` resource in the Resources tree
   - Select **"Create Resource"**
   - **Resource Name**: `health`
   - **Resource Path**: `/health` (should auto-populate)
   - **Enable API Gateway CORS**: **Check this box**
   - **Configure as proxy resource**: **Leave unchecked**
   - Click **"Create Resource"**

7. **Create the GET method**:
   - **Click** on the `/health` resource you just created (it should be highlighted)
   - Click **"Actions"** → **"Create Method"**
   - **Method dropdown**: Select **"GET"**
   - Click the **checkmark** to confirm

8. **Configure method integration**:
   - **Integration type**: Select **"Lambda Function"**
   - **Use Lambda Proxy integration**: **Check this box** ⭐ **Critical for proper request/response handling**
   - **Lambda Region**: `us-east-2`
   - **Lambda Function**: Type `mindsdb-rag-health-api-dev` (should auto-complete)
   - **Use Default Timeout**: **Check this box**
   - Click **"Save"**

9. **Grant API Gateway permission** (popup will appear):
   - Click **"OK"** to allow API Gateway to invoke your Lambda function
   - This automatically creates the necessary resource-based policy

10. **Configure method settings**:
    - **Method Request** (click to expand):
      - **Authorization**: **"NONE"** (public endpoint)
      - **API Key Required**: **"false"**
      - **Request Validator**: **"None"**
    - **Integration Request**: Leave defaults
    - **Method Response**: Leave defaults (200 response should be there)
    - **Integration Response**: Leave defaults

**Create /v1 Resource Structure:**

11. **Create /v1 parent resource**:
    - **Right-click** on root `/` resource
    - Select **"Create Resource"**
    - **Resource Name**: `v1`
    - **Resource Path**: `/v1`
    - **Enable API Gateway CORS**: **Check this box**
    - Click **"Create Resource"**

**Create /v1/chat Endpoint:**

12. **Create chat resource**:
    - **Right-click** on `/v1` resource
    - Select **"Create Resource"**
    - **Resource Name**: `chat`
    - **Resource Path**: `/v1/chat`
    - **Enable API Gateway CORS**: **Check this box**
    - Click **"Create Resource"**

13. **Create POST method for chat**:
    - **Click** on `/v1/chat` resource
    - Click **"Actions"** → **"Create Method"**
    - **Method dropdown**: Select **"POST"**
    - Click the **checkmark**

14. **Configure chat integration**:
    - **Integration type**: **"Lambda Function"**
    - **Use Lambda Proxy integration**: **Check this box**
    - **Lambda Region**: `us-east-2`
    - **Lambda Function**: `mindsdb-rag-chat-api-dev`
    - Click **"Save"**
    - Click **"OK"** to grant permissions

15. **Configure chat authorization**:
    - **Method Request** → **Authorization**: Select **"CognitoAuthorizer"**
    - **API Key Required**: **"false"**
    - Click **"Save"** (if there's a save button, otherwise changes are auto-saved)

**Create /v1/documents Endpoint:**

16. **Create documents resource**:
    - **Right-click** on `/v1` resource
    - Select **"Create Resource"**
    - **Resource Name**: `documents`
    - **Resource Path**: `/v1/documents`
    - **Enable CORS**: **Check**
    - Click **"Create Resource"**

17. **Create POST method for documents**:
    - **Click** on `/v1/documents` resource
    - **Actions** → **"Create Method"**
    - **Method**: **"POST"**
    - Click **checkmark**

18. **Configure documents integration**:
    - **Integration type**: **"Lambda Function"**
    - **Lambda proxy integration**: **Check**
    - **Lambda Function**: `mindsdb-rag-documents-api-dev`
    - Click **"Save"** → **"OK"**

19. **Configure documents authorization**:
    - **Method Request** → **Authorization**: **"CognitoAuthorizer"**

**Create /v1/bedrock-agent/tools Endpoint:**

20. **Create bedrock-agent resource**:
    - **Right-click** on `/v1` resource
    - **Resource Name**: `bedrock-agent`
    - **Enable CORS**: **Check**
    - Click **"Create Resource"**

21. **Create tools sub-resource**:
    - **Right-click** on `/v1/bedrock-agent` resource
    - **Resource Name**: `tools`
    - **Resource Path**: `/v1/bedrock-agent/tools`
    - **Enable CORS**: **Check**
    - Click **"Create Resource"**

22. **Create POST method for tools**:
    - **Click** on `/v1/bedrock-agent/tools` resource
    - **Actions** → **"Create Method"**
    - **Method**: **"POST"**
    - Click **checkmark**

23. **Configure tools integration**:
    - **Integration type**: **"Lambda Function"**
    - **Lambda proxy integration**: **Check**
    - **Lambda Function**: `mindsdb-rag-bedrock-api-dev`
    - Click **"Save"** → **"OK"**

24. **Configure tools authorization**:
    - **Method Request** → **Authorization**: **"CognitoAuthorizer"**

**Create /v1/checkout Endpoint:**

25. **Create checkout resource**:
    - **Right-click** on `/v1` resource
    - **Resource Name**: `checkout`
    - **Enable CORS**: **Check**
    - Click **"Create Resource"**

26. **Create POST method for checkout**:
    - **Click** on `/v1/checkout` resource
    - **Actions** → **"Create Method"**
    - **Method**: **"POST"**
    - Click **checkmark**

27. **Configure checkout integration**:
    - **Integration type**: **"Lambda Function"**
    - **Lambda proxy integration**: **Check**
    - **Lambda Function**: `mindsdb-rag-checkout-api-dev`
    - Click **"Save"** → **"OK"**

28. **Configure checkout authorization**:
    - **Method Request** → **Authorization**: **"CognitoAuthorizer"**

**Configure CORS for All Endpoints:**

**Important**: CORS must be configured for each resource that will be called from a web browser.

29. **Configure CORS for /health**:
    - **Click** on `/health` resource
    - **Actions** → **"Enable CORS"**
    - **Access-Control-Allow-Origin**: `*`
    - **Access-Control-Allow-Headers**: `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`
    - **Access-Control-Allow-Methods**: **Check "GET"** and **"OPTIONS"**
    - Click **"Enable CORS and replace existing CORS headers"**

30. **Configure CORS for /v1/chat**:
    - **Click** on `/v1/chat` resource
    - **Actions** → **"Enable CORS"**
    - **Access-Control-Allow-Origin**: `*`
    - **Access-Control-Allow-Headers**: `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`
    - **Access-Control-Allow-Methods**: **Check "POST"** and **"OPTIONS"**
    - Click **"Enable CORS and replace existing CORS headers"**

31. **Repeat CORS configuration** for:
    - `/v1/documents` (POST, OPTIONS)
    - `/v1/bedrock-agent/tools` (POST, OPTIONS)
    - `/v1/checkout` (POST, OPTIONS)

**Deploy the API:**

32. **Deploy API to stage**:
    - Click **"Actions"** → **"Deploy API"**
    - **Deployment stage**: Select **"[New Stage]"**
    - **Stage name**: `dev`
    - **Stage description**: `Development environment for MindsDB RAG Assistant`
    - **Deployment description**: `Initial API deployment with all endpoints`
    - Click **"Deploy"**

33. **Save important URLs** (found in the stage editor):
    - **Invoke URL**: `https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev`
    - **Health endpoint**: `https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev/health`
    - **Chat endpoint**: `https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev/v1/chat`

**Configure Stage Settings:**

34. **Click on the "dev" stage** (in the left sidebar under "Stages")
35. **Stage Editor settings**:
    - **Settings** tab:
      - **Enable CloudWatch Logs**: **Check**
      - **Log level**: **"INFO"**
      - **Log full requests/responses data**: **Check** (for debugging)
      - **Enable CloudWatch metrics**: **Check**
      - **Enable X-Ray Tracing**: **Check** (optional, for detailed tracing)
    - **SDK Generation** tab: Leave defaults
    - **Documentation** tab: Leave defaults
36. Click **"Save Changes"**

**Test API Gateway Endpoints:**

37. **Test the health endpoint**:
    - **Click** on `/health` resource → **GET** method
    - Click **"TEST"** button (lightning bolt icon)
    - **Request Body**: Leave empty (GET request)
    - **Headers**: Leave empty
    - **Query Strings**: Leave empty
    - Click **"Test"** (blue button)
    - **Expected result**: 
      - **Status**: 200
      - **Response Body**: JSON with health status
      - **Logs**: Should show successful Lambda execution

38. **Test authenticated endpoints** (optional, requires Cognito token):
    - For authenticated endpoints, you'll need a valid JWT token from Cognito
    - Add `Authorization: Bearer YOUR_JWT_TOKEN` in headers
    - For now, just verify the endpoints are created correctly

**Verify API Structure:**

39. **Final API structure should look like**:
    ```
    / (root)
    ├── /health
    │   └── GET (no auth) → mindsdb-rag-health-api-dev
    └── /v1
        ├── /chat
        │   └── POST (Cognito auth) → mindsdb-rag-chat-api-dev
        ├── /documents
        │   └── POST (Cognito auth) → mindsdb-rag-documents-api-dev
        ├── /bedrock-agent
        │   └── /tools
        │       └── POST (Cognito auth) → mindsdb-rag-bedrock-api-dev
        └── /checkout
            └── POST (Cognito auth) → mindsdb-rag-checkout-api-dev
    ```

**Get API Documentation:**

40. **Export API documentation**:
    - Go to your API → **Stages** → **dev**
    - **Export** tab → **Export as OpenAPI 3 + API Gateway Extensions**
    - **Export format**: JSON or YAML
    - Click **"Export"** to download the API specification

**Common Issues and Solutions:**

- **"Internal server error" when testing**: Check Lambda function logs in CloudWatch
- **CORS errors in browser**: Ensure CORS is enabled for all resources and methods
- **Authorization errors**: Verify Cognito authorizer is properly configured
- **Lambda not found**: Ensure Lambda functions exist and have correct names
- **Timeout errors**: Check Lambda function timeout settings and VPC configuration

#### Step 23: Associate WAF with API Gateway

**Important**: Complete this step AFTER Step 22 (API Gateway deployment). This adds security protection to your public API.

**Navigate to WAF Console:**

1. Go to **AWS WAF Console** (https://console.aws.amazon.com/wafv2/)
2. In the left sidebar, click **"Web ACLs"**
3. **Find and click** on your Web ACL: `mindsdb-rag-waf-dev`

**Associate API Gateway with WAF:**

4. **Click on the "Associated AWS resources" tab**
5. Click **"Add AWS resources"**

**Select API Gateway Resource:**

6. **Resource type**: Select **"API Gateway"** from the dropdown
7. **Region**: Should show `us-east-2` (your current region)
8. **Available resources**: You should see your API Gateway stage listed as:
   - `mindsdb-rag-api-dev/dev` (API Name/Stage Name)
9. **Select your API Gateway stage** by checking the box next to it
10. Click **"Add"**

**Verify Association:**

11. **Confirm the association**:
    - You should see your API Gateway stage listed in the "Associated AWS resources" section
    - **Status**: Should show "Associated" or "Associating" (may take a few minutes)
    - **Resource ARN**: Should show the full ARN of your API Gateway stage

**Test WAF Protection:**

12. **Verify WAF is working**:
    - Go to **CloudWatch Console** → **Metrics** → **AWS/WAFV2**
    - Look for metrics related to your Web ACL
    - **Test a request** to your API Gateway health endpoint:
      ```bash
      curl -X GET https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev/health
      ```
    - Check WAF metrics to see if requests are being processed

**Configure WAF Logging (Optional but Recommended):**

13. **Enable WAF logging**:
    - In your Web ACL, go to the **"Logging and metrics"** tab
    - Click **"Enable logging"**
    - **Logging destination**: 
      - **Amazon CloudWatch Logs**: Create a new log group `/aws/wafv2/mindsdb-rag-waf-dev`
      - **Amazon S3**: Use your audit logs bucket `mindsdb-rag-audit-123456789012-us-east-2`
      - **Amazon Kinesis Data Firehose**: Skip for demo
    - **Recommended**: Choose **CloudWatch Logs** for easier debugging
14. Click **"Save"**

**Monitor WAF Activity:**

15. **Check WAF dashboard**:
    - Go to your Web ACL → **"Overview"** tab
    - You should see:
      - **Requests**: Total requests processed
      - **Allowed requests**: Requests that passed all rules
      - **Blocked requests**: Requests blocked by rules
      - **Rate-limited requests**: Requests blocked by rate limiting

**Common WAF Rules Verification:**

16. **Verify your WAF rules are active**:
    - **Core rule set**: Protects against OWASP Top 10 vulnerabilities
    - **Known bad inputs**: Blocks requests with malicious patterns
    - **SQL database**: Prevents SQL injection attacks
    - **Rate limiting rule**: Limits requests to 2000 per 5 minutes per IP

**Test WAF Rate Limiting (Optional):**

17. **Test rate limiting** (be careful not to block yourself):
    ```bash
    # Send multiple rapid requests to test rate limiting
    for i in {1..10}; do
      curl -X GET https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev/health
      sleep 0.1
    done
    ```
    - **Note**: Don't run this too aggressively or you might trigger the rate limit

**Troubleshooting WAF Issues:**

- **"Resource not found" error**: Ensure API Gateway is deployed and stage exists
- **Association fails**: Check that WAF and API Gateway are in the same region
- **No metrics showing**: Wait 5-10 minutes for metrics to appear in CloudWatch
- **Legitimate requests blocked**: Review WAF rules and add exceptions if needed

**WAF Security Benefits:**

✅ **DDoS Protection**: Rate limiting prevents abuse
✅ **OWASP Top 10 Protection**: Core rule set blocks common attacks
✅ **SQL Injection Prevention**: Database rule set protects against SQL attacks
✅ **Malicious Input Filtering**: Known bad inputs rule blocks suspicious patterns
✅ **Request Logging**: Full visibility into blocked and allowed requests
✅ **Real-time Monitoring**: CloudWatch integration for alerts and dashboards

**Next Steps:**

Your API Gateway is now protected by AWS WAF. The WAF will:
- Monitor all incoming requests to your API
- Block malicious traffic automatically
- Rate limit excessive requests from single IPs
- Log all security events for analysis
- Provide metrics for monitoring and alerting

Continue to Step 25 for testing and validation of your complete deployment.

#### Step 24: Deploy Your API as Lambda Functions

**Important**: Complete this step BEFORE Step 22 (API Gateway configuration). These Lambda functions will handle your API requests and connect to the internal MindsDB service.

**Prepare Your Development Environment:**

1. **Ensure you have Node.js and npm installed**:
   ```bash
   node --version  # Should be 18.x or higher
   npm --version
   ```

2. **Navigate to your project directory**:
   ```bash
   cd /path/to/your/mindsdb-rag-assistant
   ```

3. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

**Create Lambda Security Group First:**

4. Go to **EC2 Console** → **Security Groups**
5. Click **"Create security group"**
6. **Configuration**:
   - **Security group name**: `mindsdb-rag-lambda-sg-dev`
   - **Description**: "Security group for Lambda functions"
   - **VPC**: Select your MindsDB VPC (`mindsdb-rag-vpc-dev`)
7. **Inbound rules**: None needed (Lambda functions don't receive inbound traffic)
8. **Outbound rules**: 
   - **Type**: All traffic, **Protocol**: All, **Port range**: All, **Destination**: 0.0.0.0/0
   - **Type**: PostgreSQL, **Protocol**: TCP, **Port**: 5432, **Destination**: Database Security Group
   - **Type**: Custom TCP, **Protocol**: TCP, **Port**: 6379, **Destination**: Redis Security Group
   - **Type**: HTTP, **Protocol**: TCP, **Port**: 80, **Destination**: ALB Security Group
9. Click **"Create security group"**

**Choose Your Deployment Approach:**

You have two options for deploying Lambda functions:

**Option A: Deploy Your Own Application Code**
- Use this if you have built the complete MindsDB RAG Assistant application
- Requires TypeScript compilation and packaging

**Option B: Deploy Sample/Test Functions** 
- Use this for testing the infrastructure without the full application
- Provides working Lambda functions with mock responses
- Good for validating the deployment process

---

**OPTION A: Deploy Your Own Application Code**

10. **Build your TypeScript code**:
    ```bash
    npm run build
    ```

11. **Create deployment package**:
    ```bash
    cd dist
    zip -r ../mindsdb-rag-api.zip .
    cd ..
    ```

12. **Upload your code to Lambda functions**:
    - When creating each Lambda function below, choose **"Upload from .zip file"**
    - Upload your `mindsdb-rag-api.zip` file
    - Set the appropriate handler for each function

**Skip to Step 13 to start creating Lambda functions**

---

**OPTION B: Deploy Sample/Test Functions**

10. **Use inline code for testing**:
    - When creating each Lambda function below, use the provided sample code
    - Copy and paste the JavaScript code directly into the Lambda console
    - No zip file upload needed

**Continue to Step 13 to start creating Lambda functions**

---

**Create Lambda Functions (All 8 Required Functions):**

**Function 1: Health Check Function (Simple, No VPC):**

13. Go to **Lambda Console** (https://console.aws.amazon.com/lambda/)
14. Click **"Create function"**
15. **Function configuration**:
    - **Author from scratch**: Selected
    - **Function name**: `mindsdb-rag-health-api-dev`
    - **Runtime**: `Node.js 18.x`
    - **Architecture**: `x86_64`
    - **Permissions**: **"Create a new role with basic Lambda permissions"**
16. Click **"Create function"**

17. **Add your code**:

    **If using Option A (Your Own Code):**
    - **ISSUE**: Your current `healthHandler.ts` has complex dependencies that require proper Lambda packaging
    - **Quick Fix**: Use the Option B sample code below for now, or see "Fixing Option A Dependencies" section
    - **Alternative**: Create a simple health handler without database dependencies

    **If using Option B (Sample Code):**
    - In the **"Code source"** section, replace the default code with:
    ```javascript
    exports.handler = async (event) => {
        console.log('Health check request:', JSON.stringify(event, null, 2));
        
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'MindsDB RAG Assistant',
                version: '1.0.0',
                environment: 'development'
            })
        };
        
        console.log('Health check response:', JSON.stringify(response, null, 2));
        return response;
    };
    ```

18. Click **"Deploy"** to save the code

**Function 2: Chat API Function (VPC-enabled):**

19. **Create function**:
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-chat-api-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

20. **Configure function settings**:
    - Go to **"Configuration"** tab → **"General configuration"**
    - Click **"Edit"**
    - **Timeout**: `30 seconds`
    - **Memory**: `512 MB`
    - **Ephemeral storage**: `512 MB` (default)
    - Click **"Save"**

21. **Configure VPC settings**:
    - Go to **"Configuration"** tab → **"VPC"**
    - Click **"Edit"**
    - **VPC**: Select your MindsDB VPC (`mindsdb-rag-vpc-dev`)
    - **Subnets**: Select your **private subnets** (both AZs)
      - `mindsdb-rag-vpc-dev-subnet-private1-us-east-2a`
      - `mindsdb-rag-vpc-dev-subnet-private2-us-east-2b`
    - **Security groups**: Select `mindsdb-rag-lambda-sg-dev`
    - Click **"Save"**

22. **Configure environment variables** (Required for all VPC functions):
    - Go to **"Configuration"** tab → **"Environment variables"**
    - Click **"Edit"**
    - Add these variables (replace with your actual values):
      - **Key**: `MINDSDB_ENDPOINT`, **Value**: `http://YOUR_ALB_DNS_NAME` (from Step 21 - ECS service ALB)
      - **Key**: `DATABASE_HOST`, **Value**: `YOUR_AURORA_WRITER_ENDPOINT` (from Step 5 - Aurora cluster)
      - **Key**: `DATABASE_PORT`, **Value**: `5432`
      - **Key**: `DATABASE_NAME`, **Value**: `mindsdb_rag`
      - **Key**: `DATABASE_SSL`, **Value**: `true`
      - **Key**: `REDIS_HOST`, **Value**: `YOUR_REDIS_ENDPOINT` (from Step 6 - ElastiCache, without port)
      - **Key**: `REDIS_PORT`, **Value**: `6379`
      - **Key**: `BEDROCK_REGION`, **Value**: `us-east-2` (or your AWS region)
      - **Key**: `AWS_REGION`, **Value**: `us-east-2` (or your AWS region)
      - **Key**: `NODE_ENV`, **Value**: `development`
    
    **For database credentials (same as ECS approach):**
    - **Key**: `DB_CREDENTIALS_SECRET_ARN`, **Value type**: `ValueFrom`, **Value**: `arn:aws:secretsmanager:us-east-2:123456789012:secret:rds!cluster-XXXXXXXXXXXXXXXXXX`
    
    **Important**: Use the **complete Aurora secret ARN** (same as ECS), not individual username/password secrets.
    
    **To find your Aurora Secret ARN:**
    - Go to **AWS Secrets Manager Console**
    - Look for a secret named like `rds!cluster-XXXXXXXXXXXXXXXXXX`
    - Click on the secret name
    - Copy the **complete Secret ARN** from the secret details page
    - **Do NOT add** `:username` or `:password` to the ARN
    
    - Click **"Save"**

23. **Add your code**:

    **If using Option A (Your Own Code):**
    - **Code source**: Click **"Upload from"** → **".zip file"**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/chatHandler.handler`

    **If using Option B (Real MindsDB Integration Test):**
    - Replace the default code with:
    ```javascript
    const https = require('https');
    const http = require('http');
    
    exports.handler = async (event) => {
        console.log('Chat API request:', JSON.stringify(event, null, 2));
        
        try {
            // Parse request body
            const body = JSON.parse(event.body || '{}');
            const { message, query, merchantId, sessionId } = body;
            const userQuery = message || query;
            
            if (!userQuery) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Message or query is required' })
                };
            }
            
            const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
            console.log('Testing MindsDB endpoint:', mindsdbEndpoint);
            
            // Test MindsDB connectivity with real API call
            let mindsdbStatus = 'unknown';
            let mindsdbResponse = null;
            let testResults = {};
            
            if (mindsdbEndpoint) {
                try {
                    // Test 1: Health check
                    console.log('Testing MindsDB health endpoint...');
                    const healthResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/status`, 'GET');
                    testResults.health_check = {
                        status: 'success',
                        response: healthResponse
                    };
                    mindsdbStatus = 'healthy';
                    
                    // Test 2: Simple SQL query
                    console.log('Testing MindsDB SQL query...');
                    const sqlQuery = 'SHOW DATABASES;';
                    const queryResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                        query: sqlQuery
                    });
                    testResults.sql_query = {
                        status: 'success',
                        query: sqlQuery,
                        response: queryResponse
                    };
                    
                    // Test 3: List predictors (if any exist)
                    console.log('Testing MindsDB predictors list...');
                    const predictorsQuery = 'SHOW MODELS;';
                    const predictorsResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                        query: predictorsQuery
                    });
                    testResults.predictors_list = {
                        status: 'success',
                        query: predictorsQuery,
                        response: predictorsResponse
                    };
                    
                    // Test 4: Check for merchant-specific resources
                    if (merchantId) {
                        console.log(`Testing merchant-specific resources for: ${merchantId}`);
                        const merchantQuery = `SELECT * FROM information_schema.tables WHERE table_name LIKE '%${merchantId}%' LIMIT 5;`;
                        try {
                            const merchantResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                                query: merchantQuery
                            });
                            testResults.merchant_resources = {
                                status: 'success',
                                query: merchantQuery,
                                response: merchantResponse
                            };
                        } catch (merchantError) {
                            testResults.merchant_resources = {
                                status: 'no_resources',
                                error: merchantError.message
                            };
                        }
                    }
                    
                    mindsdbResponse = `MindsDB is operational! Successfully executed ${Object.keys(testResults).length} tests.`;
                    
                } catch (mindsdbError) {
                    console.error('MindsDB connection failed:', mindsdbError);
                    mindsdbStatus = 'unhealthy';
                    testResults.connection_error = {
                        status: 'failed',
                        error: mindsdbError.message
                    };
                    mindsdbResponse = `MindsDB connection failed: ${mindsdbError.message}`;
                }
            } else {
                mindsdbStatus = 'not_configured';
                mindsdbResponse = 'MindsDB endpoint not configured';
            }
            
            // Generate intelligent response based on test results
            let aiResponse;
            if (mindsdbStatus === 'healthy') {
                aiResponse = `I've successfully connected to MindsDB and can help you with: ${userQuery}. 
                
The system is operational with the following capabilities:
- Database connectivity: ✅ Working
- SQL query execution: ✅ Working  
- Model management: ✅ Available
${merchantId ? `- Merchant resources (${merchantId}): ${testResults.merchant_resources?.status === 'success' ? '✅ Found' : '⚠️ None found'}` : ''}

How can I assist you further?`;
            } else {
                aiResponse = `I received your query: "${userQuery}", but I'm currently experiencing connectivity issues with MindsDB (${mindsdbStatus}). Please try again later or contact support.`;
            }
            
            const response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    data: {
                        response: aiResponse,
                        query: userQuery,
                        merchantId: merchantId || 'not_specified',
                        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        mindsdb_status: mindsdbStatus,
                        mindsdb_endpoint: mindsdbEndpoint,
                        test_results: testResults,
                        confidence: mindsdbStatus === 'healthy' ? 0.9 : 0.3,
                        sources: mindsdbStatus === 'healthy' ? ['MindsDB System Status', 'Real-time Connectivity Test'] : [],
                        reasoning: [
                            'Performed real MindsDB connectivity test',
                            `MindsDB status: ${mindsdbStatus}`,
                            'Generated response based on system availability'
                        ]
                    },
                    timestamp: new Date().toISOString()
                })
            };
            
            console.log('Chat response generated:', JSON.stringify(response.body, null, 2));
            return response;
            
        } catch (error) {
            console.error('Chat API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false,
                    error: 'Internal server error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    };
    
    // Helper function to make HTTP requests to MindsDB
    function makeHttpRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'MindsDB-Lambda-Test/1.0'
                },
                timeout: 10000 // 10 second timeout
            };
            
            if (data) {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }
            
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
                        }
                    } catch (parseError) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(responseData); // Return raw response if not JSON
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                        }
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }
    ```
                })
            };
            
            return response;
            
        } catch (error) {
            console.error('Chat API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    };
    ```

24. Click **"Deploy"**

**Function 3: Documents API Function:**

25. **Create function**: 
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-documents-api-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

26. **Configuration**:
    - **Memory**: `1024 MB` (for document processing)
    - **Timeout**: `60 seconds`
    - **VPC settings**: Same as chat function (private subnets, Lambda security group)
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

27. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/documentsHandler.handler`

    **If using Option B (Real Document Processing Test):**
    ```javascript
    const https = require('https');
    const http = require('http');
    
    exports.handler = async (event) => {
        console.log('Documents API request:', JSON.stringify(event, null, 2));
        
        try {
            const body = JSON.parse(event.body || '{}');
            const { content, title, merchantId, action = 'create' } = body;
            
            if (!merchantId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'merchantId is required' })
                };
            }
            
            const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
            console.log('Testing document processing with MindsDB endpoint:', mindsdbEndpoint);
            
            let testResults = {};
            let documentId = `doc_${merchantId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            if (mindsdbEndpoint) {
                try {
                    // Test 1: Check if knowledge base exists for merchant
                    console.log(`Checking knowledge base for merchant: ${merchantId}`);
                    const kbCheckQuery = `SHOW TABLES LIKE 'rag_kb_${merchantId}';`;
                    const kbResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                        query: kbCheckQuery
                    });
                    
                    testResults.knowledge_base_check = {
                        status: 'success',
                        exists: kbResponse.data && kbResponse.data.length > 0,
                        response: kbResponse
                    };
                    
                    // Test 2: Create knowledge base if it doesn't exist
                    if (!testResults.knowledge_base_check.exists) {
                        console.log(`Creating knowledge base for merchant: ${merchantId}`);
                        const createKBQuery = `
                            CREATE OR REPLACE MODEL rag_kb_${merchantId}
                            PREDICT answer
                            USING
                                engine = 'langchain',
                                mode = 'conversational',
                                user_column = 'question',
                                assistant_column = 'answer',
                                max_tokens = 1000,
                                model_name = 'gpt-3.5-turbo',
                                prompt_template = 'Answer the user question based on the context: {{context}}. Question: {{question}}';
                        `;
                        
                        try {
                            const createResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                                query: createKBQuery
                            });
                            testResults.knowledge_base_creation = {
                                status: 'success',
                                response: createResponse
                            };
                        } catch (createError) {
                            testResults.knowledge_base_creation = {
                                status: 'failed',
                                error: createError.message
                            };
                        }
                    }
                    
                    // Test 3: Process document content if provided
                    if (content && action === 'create') {
                        console.log('Processing document content...');
                        
                        // Create a documents table for the merchant if it doesn't exist
                        const createTableQuery = `
                            CREATE TABLE IF NOT EXISTS documents_${merchantId} (
                                document_id VARCHAR(255) PRIMARY KEY,
                                title VARCHAR(500),
                                content TEXT,
                                document_type VARCHAR(100),
                                source VARCHAR(255),
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                metadata JSON
                            );
                        `;
                        
                        try {
                            const tableResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                                query: createTableQuery
                            });
                            testResults.table_creation = {
                                status: 'success',
                                response: tableResponse
                            };
                            
                            // Insert document into table
                            const insertQuery = `
                                INSERT INTO documents_${merchantId} 
                                (document_id, title, content, document_type, source, metadata)
                                VALUES (
                                    '${documentId}',
                                    '${title || 'Untitled Document'}',
                                    '${content.replace(/'/g, "''")}',
                                    'text',
                                    'api',
                                    '{"processed_by": "lambda", "test_mode": true}'
                                );
                            `;
                            
                            const insertResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                                query: insertQuery
                            });
                            testResults.document_insertion = {
                                status: 'success',
                                document_id: documentId,
                                response: insertResponse
                            };
                            
                        } catch (tableError) {
                            testResults.table_creation = {
                                status: 'failed',
                                error: tableError.message
                            };
                        }
                    }
                    
                    // Test 4: Query existing documents for the merchant
                    console.log(`Querying existing documents for merchant: ${merchantId}`);
                    const queryDocsQuery = `SELECT COUNT(*) as document_count FROM documents_${merchantId};`;
                    try {
                        const docsResponse = await makeHttpRequest(`${mindsdbEndpoint}/api/sql/query`, 'POST', {
                            query: queryDocsQuery
                        });
                        testResults.document_query = {
                            status: 'success',
                            response: docsResponse
                        };
                    } catch (queryError) {
                        testResults.document_query = {
                            status: 'no_table',
                            error: queryError.message
                        };
                    }
                    
                } catch (mindsdbError) {
                    console.error('MindsDB document processing failed:', mindsdbError);
                    testResults.connection_error = {
                        status: 'failed',
                        error: mindsdbError.message
                    };
                }
            }
            
            // Generate response based on test results
            const successfulTests = Object.values(testResults).filter(test => test.status === 'success').length;
            const totalTests = Object.keys(testResults).length;
            
            let message;
            let processingStatus;
            
            if (successfulTests === totalTests && totalTests > 0) {
                message = `Document processed successfully! All ${totalTests} MindsDB integration tests passed.`;
                processingStatus = 'completed';
            } else if (successfulTests > 0) {
                message = `Document partially processed. ${successfulTests}/${totalTests} tests passed.`;
                processingStatus = 'partial';
            } else {
                message = 'Document received but MindsDB integration tests failed.';
                processingStatus = 'failed';
            }
            
            const response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: successfulTests > 0,
                    data: {
                        message,
                        documentId,
                        merchantId,
                        title: title || 'Untitled Document',
                        action,
                        processing_status: processingStatus,
                        mindsdb_endpoint: mindsdbEndpoint,
                        test_results: testResults,
                        tests_passed: `${successfulTests}/${totalTests}`,
                        content_preview: content ? content.substring(0, 100) + '...' : 'No content provided'
                    },
                    timestamp: new Date().toISOString()
                })
            };
            
            return response;
            
        } catch (error) {
            console.error('Documents API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false,
                    error: 'Internal server error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    };
    
    // Helper function to make HTTP requests to MindsDB
    function makeHttpRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'MindsDB-Lambda-Test/1.0'
                },
                timeout: 15000 // 15 second timeout for document operations
            };
            
            if (data) {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }
            
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
                        }
                    } catch (parseError) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(responseData);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                        }
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }
    ```

**Function 4: Bedrock Agent Function:**

28. **Create function**: 
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-bedrock-api-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

29. **Configuration**:
    - **Memory**: `512 MB`
    - **Timeout**: `60 seconds` (AI processing can take time)
    - **VPC settings**: Same as chat function
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

30. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/bedrockHandler.handler`

    **If using Option B (Real Bedrock Integration Test):**
    ```javascript
    const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    
    exports.handler = async (event) => {
        console.log('Bedrock Agent API request:', JSON.stringify(event, null, 2));
        
        try {
            const body = JSON.parse(event.body || '{}');
            const { query, prompt, merchantId, sessionId, modelId } = body;
            const userQuery = query || prompt || 'Test Bedrock connectivity';
            
            const bedrockRegion = process.env.BEDROCK_REGION || 'us-east-2';
            const defaultModelId = modelId || 'amazon.nova-micro-v1:0';
            
            console.log(`Testing Bedrock in region: ${bedrockRegion} with model: ${defaultModelId}`);
            
            let testResults = {};
            let bedrockResponse = null;
            
            try {
                // Initialize Bedrock Runtime client
                const bedrockClient = new BedrockRuntimeClient({ 
                    region: bedrockRegion,
                    maxAttempts: 3
                });
                
                // Test 1: List available models (using Bedrock client)
                console.log('Testing Bedrock model availability...');
                
                // Test 2: Invoke model with a simple prompt
                console.log(`Invoking Bedrock model: ${defaultModelId}`);
                
                const promptText = `Human: You are a helpful AI assistant for an e-commerce platform. 
                
User Query: ${userQuery}
${merchantId ? `Merchant Context: This query is from merchant ${merchantId}` : ''}

Please provide a helpful response. Keep it concise and professional.
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

32. **Configuration**: 
    - **Memory**: `512 MB`
    - **Timeout**: `30 seconds`
    - **VPC settings**: Same as chat function
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

33. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/semanticRetrievalHandler.handler`

    **If using Option B (Sample Code):**
    ```javascript
    exports.handler = async (event) => {
        console.log('Semantic Retrieval API request:', JSON.stringify(event, null, 2));
        
        try {
            const body = JSON.parse(event.body || '{}');
            const { query, merchantId, action } = body;
            
            // Mock semantic search response
            const response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    action: action || 'search',
                    query: query || 'test query',
                    merchantId: merchantId || 'unknown',
                    results: [
                        {
                            id: 'doc1',
                            title: 'Sample Document',
                            relevance: 0.95,
                            content: 'This is a sample search result'
                        }
                    ],
                    timestamp: new Date().toISOString()
                })
            };
            
            return response;
            
        } catch (error) {
            console.error('Semantic Retrieval API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    };
    ```

**Function 6: Checkout Function:**

34. **Create function**: 
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-checkout-api-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

35. **Configuration**: 
    - **Memory**: `512 MB`
    - **Timeout**: `30 seconds`
    - **VPC settings**: Same as chat function
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

36. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/checkoutHandler.handler` (this exists in your code!)
    - **Note**: You have a dedicated checkout Lambda handler already

    **If using Option B (Sample Code):**
    ```javascript
    exports.handler = async (event) => {
        console.log('Checkout API request:', JSON.stringify(event, null, 2));
        
        try {
            const body = JSON.parse(event.body || '{}');
            const { items, total, paymentMethod } = body;
            
            // Mock checkout processing
            const response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    orderId: 'order-' + Date.now(),
                    status: 'processed',
                    total: total || 0,
                    items: items || [],
                    paymentMethod: paymentMethod || 'unknown',
                    timestamp: new Date().toISOString()
                })
            };
            
            return response;
            
        } catch (error) {
            console.error('Checkout API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    };
    ```

**Function 7: Bedrock Tools Function (Specialized):**

37. **Create function**: 
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-bedrock-tools-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

38. **Configuration**: 
    - **Memory**: `512 MB`
    - **Timeout**: `60 seconds`
    - **VPC settings**: Same as chat function
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

39. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/bedrockToolsHandler.handler`
    - **Note**: This handles specific Bedrock Agent tool calls (different from general Bedrock operations)

    **If using Option B (Sample Code):**
    ```javascript
    exports.handler = async (event) => {
        console.log('Bedrock Tools API request:', JSON.stringify(event, null, 2));
        
        try {
            const body = JSON.parse(event.body || '{}');
            const { actionGroup, function: toolFunction, parameters } = body;
            
            // Mock Bedrock tool execution
            const response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    data: {
                        actionGroup: actionGroup || 'unknown',
                        function: toolFunction || 'unknown',
                        result: 'Tool executed successfully',
                        parameters: parameters || {},
                        executionTime: Math.floor(Math.random() * 1000) + 100
                    },
                    timestamp: new Date().toISOString()
                })
            };
            
            return response;
            
        } catch (error) {
            console.error('Bedrock Tools API error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    };
    ```

**Function 8: Document Ingestion Function (Specialized):**

40. **Create function**: 
    - Click **"Create function"** (create a new function)
    - **Function name**: `mindsdb-rag-doc-ingestion-dev`
    - **Runtime**: `Node.js 18.x`
    - **Permissions**: **"Use an existing role"** → Select `mindsdb-rag-lambda-execution-role-dev`
    - Click **"Create function"**

41. **Configuration**: 
    - **Memory**: `1024 MB` (for document processing)
    - **Timeout**: `300 seconds` (5 minutes for large documents)
    - **VPC settings**: Same as chat function
    - **Environment variables**: **Copy the same environment variables from the chat function** (Step 22)

42. **Add your code**:

    **If using Option A (Your Own Code):**
    - Upload your `mindsdb-rag-api.zip`
    - **Handler**: `lambda/documentIngestionHandler.handler`
    - **Note**: This handles S3-triggered document processing for Step Functions workflows

    **If using Option B (Sample Code):**
    ```javascript
    exports.handler = async (event) => {
        console.log('Document Ingestion request:', JSON.stringify(event, null, 2));
        
        try {
            // Handle both Step Functions and direct invocation
            const { bucket, key, merchantId, userId, executionId } = event;
            
            if (!bucket || !key || !merchantId) {
                throw new Error('Missing required parameters: bucket, key, or merchantId');
            }
            
            // Mock document processing
            const documentId = `doc_${merchantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const response = {
                documentId,
                content: 'Extracted text content from document',
                metadata: {
                    fileName: key.split('/').pop() || 'unknown',
                    fileSize: Math.floor(Math.random() * 10000) + 1000,
                    contentType: 'application/pdf',
                    uploadedAt: new Date().toISOString(),
                    extractedAt: new Date().toISOString()
                }
            };
            
            console.log('Document processing completed:', documentId);
            return response;
            
        } catch (error) {
            console.error('Document Ingestion error:', error);
            throw error; // Re-throw for Step Functions error handling
        }
    };
    ```

**Test Lambda Functions:**

43. **Test each function**:
    - Go to each Lambda function
    - Click **"Test"** tab
    - **Create new test event**:
      - **Event name**: `test-event`
      - **Template**: Choose appropriate template:
        - **API Gateway functions**: `API Gateway AWS Proxy`
        - **Document Ingestion**: `Step Functions` or custom event
      - **Modify the test event** as needed for each function
    - Click **"Test"**
    - **Verify**: Function executes successfully and returns expected response

**Test Event Examples:**

44. **API Gateway Test Event** (for most functions):
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/chat",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"message\":\"Hello, test message\"}"
    }
    ```

45. **Document Ingestion Test Event**:
    ```json
    {
      "bucket": "test-bucket",
      "key": "documents/test-merchant/test-doc.pdf",
      "merchantId": "test-merchant-123",
      "userId": "test-user-456",
      "executionId": "test-execution-789"
    }
    ```

**Detailed Testing Instructions:**

46. **Test Health Function**:
    - **Function**: `mindsdb-rag-health-api-dev`
    - **Test Event**: Use `API Gateway AWS Proxy` template
    - **Modify**: Change `httpMethod` to `"GET"` and remove `body`
    - **Expected Result**: Status 200 with health information
    - **Verify**: Response includes `status: "healthy"` and timestamp

47. **Test Chat Function**:
    - **Function**: `mindsdb-rag-chat-api-dev`
    - **Test Event**: Use the API Gateway test event above
    - **Expected Result**: Status 200 with echo response
    - **Verify**: Response includes the original message and MindsDB endpoint
    - **Check Logs**: Should show environment variables are loaded

48. **Test Documents Function**:
    - **Function**: `mindsdb-rag-documents-api-dev`
    - **Test Event**: 
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/documents",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"document\":\"test-doc.pdf\",\"type\":\"pdf\"}"
    }
    ```
    - **Expected Result**: Status 200 with document processing confirmation
    - **Verify**: Response includes generated `documentId`

49. **Test Bedrock Function**:
    - **Function**: `mindsdb-rag-bedrock-api-dev`
    - **Test Event**:
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/bedrock-agent",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"query\":\"What is MindsDB?\",\"agentId\":\"test-agent\"}"
    }
    ```
    - **Expected Result**: Status 200 with Bedrock agent response
    - **Verify**: Response includes query and region information

50. **Test Semantic Retrieval Function**:
    - **Function**: `mindsdb-rag-semantic-api-dev`
    - **Test Event**:
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/semantic",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"query\":\"search documents\",\"merchantId\":\"test-merchant\"}"
    }
    ```
    - **Expected Result**: Status 200 with search results
    - **Verify**: Response includes mock search results array

51. **Test Checkout Function**:
    - **Function**: `mindsdb-rag-checkout-api-dev`
    - **Test Event**:
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/checkout",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"items\":[{\"id\":\"item1\",\"price\":10}],\"total\":10,\"paymentMethod\":\"credit_card\"}"
    }
    ```
    - **Expected Result**: Status 200 with order confirmation
    - **Verify**: Response includes generated `orderId` and order details

52. **Test Bedrock Tools Function**:
    - **Function**: `mindsdb-rag-bedrock-tools-dev`
    - **Test Event**:
    ```json
    {
      "httpMethod": "POST",
      "path": "/v1/bedrock-tools",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"actionGroup\":\"DocumentSearch\",\"function\":\"searchDocuments\",\"parameters\":{\"query\":\"test\"}}"
    }
    ```
    - **Expected Result**: Status 200 with tool execution result
    - **Verify**: Response includes execution time and success status

53. **Test Document Ingestion Function**:
    - **Function**: `mindsdb-rag-doc-ingestion-dev`
    - **Test Event**: Use the Document Ingestion test event from step 45
    - **Expected Result**: Document processing response (not HTTP response)
    - **Verify**: Response includes `documentId` and metadata
    - **Note**: This function is designed for Step Functions, not API Gateway

**Verify Lambda Function Status:**

54. **Check function status**:
    - All functions should show **"Active"** status
    - No configuration errors
    - VPC-enabled functions should show VPC configuration
    - Environment variables should be set correctly

**Monitor Lambda Logs:**

55. **Check CloudWatch logs**:
    - Go to **CloudWatch Console** → **Log groups**
    - Look for log groups like `/aws/lambda/mindsdb-rag-chat-api-dev`
    - **Verify**: Functions are logging correctly and no errors

**Common Testing Issues and Solutions:**

56. **"Task timed out" errors**:
    - **Cause**: VPC configuration issues or missing VPC endpoints
    - **Solution**: Verify VPC endpoints for Secrets Manager, KMS are created
    - **Check**: Security groups allow HTTPS (443) traffic

57. **"Cannot resolve hostname" errors**:
    - **Cause**: DNS resolution issues in VPC
    - **Solution**: Ensure VPC has DNS resolution and DNS hostnames enabled
    - **Check**: VPC endpoints have "Private DNS names enabled"

58. **Database connection errors**:
    - **Cause**: Lambda security group doesn't allow database access or incorrect Aurora secret
    - **Solution**: Verify `DB_CREDENTIALS_SECRET_ARN` points to the correct Aurora secret (same as ECS)
    - **Check**: Lambda execution role has `secretsmanager:GetSecretValue` permission for `rds!cluster-*`
    - **Verify**: `DATABASE_HOST` uses Aurora **writer endpoint** (not reader endpoint)

59. **Environment variable not found**:
    - **Cause**: Environment variables not set or incorrect names
    - **Solution**: Copy environment variables from chat function to all VPC functions
    - **Verify**: Variable names match exactly (case-sensitive)

60. **"Internal server error" in sample code**:
    - **Expected**: This is normal for sample code - it's designed to test infrastructure
    - **Solution**: Check logs to see if the function executed and returned the mock response
    - **Note**: Sample code doesn't connect to real services, just tests the Lambda setup

**Summary of Created Functions:**

✅ `mindsdb-rag-health-api-dev` - Public health check (no VPC)
✅ `mindsdb-rag-chat-api-dev` - Chat functionality (VPC-enabled)
✅ `mindsdb-rag-documents-api-dev` - Document processing (VPC-enabled)
✅ `mindsdb-rag-bedrock-api-dev` - Bedrock AI agent (VPC-enabled)
✅ `mindsdb-rag-semantic-api-dev` - ML semantic search (VPC-enabled)
✅ `mindsdb-rag-checkout-api-dev` - E-commerce checkout (VPC-enabled)
✅ `mindsdb-rag-bedrock-tools-dev` - Bedrock Agent tools (VPC-enabled)
✅ `mindsdb-rag-doc-ingestion-dev` - S3 document ingestion (VPC-enabled)

**Handler Path Reference:**
```bash
# Core API Handlers (6)
mindsdb-rag-health-api-dev        → lambda/healthHandler.handler
mindsdb-rag-chat-api-dev          → lambda/chatHandler.handler  
mindsdb-rag-documents-api-dev     → lambda/documentsHandler.handler
mindsdb-rag-bedrock-api-dev       → lambda/bedrockHandler.handler
mindsdb-rag-semantic-api-dev      → lambda/semanticRetrievalHandler.handler
mindsdb-rag-checkout-api-dev      → lambda/checkoutHandler.handler

# Specialized Handlers (2)
mindsdb-rag-bedrock-tools-dev     → lambda/bedrockToolsHandler.handler
mindsdb-rag-doc-ingestion-dev     → lambda/documentIngestionHandler.handler
```

**Handler Functionality Overview:**

**Core API Handlers:**
- **Health**: Public health checks and system monitoring
- **Chat**: Bedrock Agent chat integration with RAG
- **Documents**: Document CRUD operations and management
- **Bedrock**: General AI model integration and management
- **Semantic**: ML-powered semantic search and model deployment
- **Checkout**: E-commerce checkout and payment processing

**Specialized Handlers:**
- **Bedrock Tools**: Specific tool execution for Bedrock Agent (handles tool calls from AI agent)
- **Document Ingestion**: S3-triggered document processing for Step Functions workflows

**Why Both Bedrock Handlers?**
- `bedrockHandler`: General AI operations (model management, credentials, queries)
- `bedrockToolsHandler`: Specific tool calls from Bedrock Agent (your codebase uses BedrockAgentToolRegistry)

**Why Both Document Handlers?**
- `documentsHandler`: Direct API document operations (upload, search, CRUD)
- `documentIngestionHandler`: Automated S3 processing (your codebase has Step Functions workflows)

**Recommendation for Beginners:**
- Use **Option B (Sample Code)** for testing the infrastructure
- **All 8 handlers are needed** for full functionality based on your codebase
- Start with core 6 handlers, add specialized 2 handlers when ready

**Fixing Option A Dependencies (Advanced Users):**

If you want to use your actual TypeScript code, you have several options for handling large packages:

**Option A1: Reduce Package Size**

60. **Create minimal Lambda package**:
    ```bash
    # In your project root
    npm run build
    
    # Create minimal package (handler only)
    mkdir lambda-minimal
    cp -r dist/lambda lambda-minimal/
    cp -r dist/database lambda-minimal/
    cp -r dist/services lambda-minimal/
    
    # Create minimal package.json with only essential dependencies
    cat > lambda-minimal/package.json << 'EOF'
    {
      "name": "mindsdb-lambda",
      "version": "1.0.0",
      "dependencies": {
        "@aws-sdk/client-secrets-manager": "^3.400.0",
        "pg": "8.16.3",
        "redis": "^4.6.0"
      }
    }
    EOF
    
    cd lambda-minimal
    npm install --omit=dev
    zip -r ../mindsdb-lambda-minimal.zip .
    cd ..
    rm -rf lambda-minimal
    ```

**Option A2: Use Lambda Layers (Recommended)**

61. **Create Lambda Layer for dependencies**:
    ```bash
    # Create layer structure
    mkdir lambda-layer
    mkdir lambda-layer/nodejs
    
    # Copy only package.json to layer
    cp package.json lambda-layer/nodejs/
    cd lambda-layer/nodejs
    
    # Install dependencies in layer
    npm install --omit=dev
    cd ../..
    
    # Create layer zip
    zip -r node-modules-layer.zip lambda-layer/
    
    # Create application zip (without node_modules)
    mkdir lambda-app
    cp -r dist/* lambda-app/
    cd lambda-app
    zip -r ../mindsdb-app-only.zip .
    cd ..
    rm -rf lambda-app lambda-layer
    ```

62. **Upload Layer to AWS**:
    - Go to **Lambda Console** → **Layers**
    - Click **"Create layer"**
    - **Name**: `mindsdb-dependencies-layer`
    - **Upload**: `node-modules-layer.zip`
    - **Runtime**: Node.js 18.x
    - Click **"Create"**

63. **Attach Layer to Function**:
    - Go to your Lambda function
    - **Layers** section → **"Add a layer"**
    - **Custom layers** → Select your layer
    - **Version**: Latest
    - Click **"Add"**

61. **Option A3: Use S3 for Large Packages**

64. **Upload large package to S3**:
    ```bash
    # Upload your large zip to S3
    aws s3 cp mindsdb-rag-api-complete.zip s3://YOUR-BUCKET-NAME/lambda-packages/
    ```

65. **Deploy from S3**:
    - In Lambda Console, instead of uploading file
    - Choose **"Upload from Amazon S3"**
    - **S3 link URL**: `s3://YOUR-BUCKET-NAME/lambda-packages/mindsdb-rag-api-complete.zip`

**Option A4: Containerized Lambda (Advanced)**

66. **Use Container Images** (for very large applications):
    - Create Dockerfile for Lambda
    - Push to Amazon ECR
    - Deploy as container image
    - No size limits (up to 10GB)

62. **Simplify Health Handler** (Recommended):
    Create a simple health handler that doesn't require database connections:
    ```typescript
    // src/lambda/simpleHealthHandler.ts
    import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

    export const handler = async (
      event: APIGatewayProxyEvent,
      context: Context
    ): Promise<APIGatewayProxyResult> => {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'healthy',
          service: 'MindsDB RAG Assistant',
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
          environment: process.env.NODE_ENV || 'development'
        })
      };
    };
    ```

**Common Lambda Packaging Issues:**

- **Missing Dependencies**: Lambda runtime doesn't include your `node_modules`
- **Large Package Size**: Lambda has 50MB zipped / 250MB unzipped limits
- **AWS SDK Bloat**: AWS SDK packages are large - use specific clients only
- **Native Dependencies**: Some packages require compilation for Lambda environment
- **Dev Dependencies**: Make sure to use `--omit=dev` to exclude development packages

**Package Size Solutions:**
- ✅ **Use Lambda Layers** for dependencies (recommended)
- ✅ **Upload to S3** for packages > 50MB
- ✅ **Minimize dependencies** - only include what you need
- ✅ **Use Container Images** for very large applications
- ✅ **Tree shaking** - remove unused code

**Recommended Approach for Beginners:**
- Use **Option B (Sample Code)** for initial testing and infrastructure validation
- Once infrastructure is working, gradually migrate to your actual code
- Start with simple handlers, add complexity incrementally

## Lambda Database Access Configuration

**Important**: Lambda and ECS use the **same Aurora secret approach** for consistency.

### Database Credentials Handling (Consistent with ECS)

**Both ECS and Lambda use the same Aurora secret:**

```typescript
// In your database connection code (same pattern for ECS and Lambda)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const getAuroraCredentials = async () => {
  const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });
  
  const response = await secretsManager.send(new GetSecretValueCommand({
    SecretId: process.env.DB_CREDENTIALS_SECRET_ARN  // Same secret as ECS
  }));
  
  const credentials = JSON.parse(response.SecretString);
  
  return {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    username: credentials.username,  // From Aurora auto-generated secret
    password: credentials.password,  // From Aurora auto-generated secret
    ssl: process.env.DATABASE_SSL === 'true'
  };
};
```

### Environment Variables (Consistent with ECS)

Each VPC-enabled Lambda function uses these environment variables:
- `DATABASE_HOST` - Aurora writer endpoint
- `DATABASE_PORT` - 5432
- `DATABASE_NAME` - mindsdb_rag
- `DATABASE_SSL` - true
- `DB_CREDENTIALS_SECRET_ARN` - **Complete Aurora secret ARN (same as ECS)**
- `REDIS_HOST` - ElastiCache endpoint
- `REDIS_PORT` - 6379

**Key Point**: Lambda uses the **same `DB_CREDENTIALS_SECRET_ARN`** as ECS, ensuring both services access the database with identical credentials.

### Why This Approach Works

1. **Consistency**: ECS and Lambda use the same Aurora secret
2. **Security**: Aurora manages password rotation automatically
3. **Simplicity**: One secret for both ECS and Lambda
4. **Reliability**: No manual password management needed

**Next Step**: Proceed to Step 22 to configure API Gateway to route requests to these Lambda functions.

### Phase 11: Testing and Validation

#### Step 25: Test the Deployment

1. **Test API Gateway endpoints:**

   ```bash
   curl -X GET https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/dev/health
   ```

2. **Test Cognito authentication:**
   - Create a test user in Cognito User Pool
   - Verify email and set password
   - Test login flow

3. **Test MindsDB service:**
   - Check ECS service is running
   - Verify database connectivity
   - Test Redis connectivity

4. **Test Bedrock integration:**
   - Verify Bedrock agent is created
   - Test model invocation permissions

#### Step 26: Monitor and Troubleshoot

1. Check CloudWatch logs for all services
2. Monitor CloudWatch metrics and alarms
3. Verify all security groups allow necessary traffic
4. Test end-to-end API flows
5. Validate data encryption at rest and in transit

## Post-Deployment Configuration

### Environment Variables and Secrets

Update your application configuration with:

- Database endpoints and credentials
- Redis endpoint and configuration
- API Gateway URLs
- Cognito User Pool and Identity Pool IDs
- S3 bucket names
- KMS key IDs

### DNS and SSL (Optional)

If you want custom domains:

1. Create Route 53 hosted zone
2. Request SSL certificate in ACM
3. Configure custom domain in API Gateway
4. Update DNS records

### Backup and Disaster Recovery

1. Enable automated backups for RDS
2. Configure S3 cross-region replication
3. Set up CloudFormation templates for infrastructure as code
4. Document recovery procedures

## Security Checklist

- [ ] All data encrypted at rest and in transit
- [ ] Least privilege IAM policies applied
- [ ] VPC endpoints configured for AWS services
- [ ] WAF rules protecting API Gateway
- [ ] Security groups following principle of least access
- [ ] Secrets stored in AWS Secrets Manager
- [ ] CloudTrail logging enabled
- [ ] GuardDuty enabled for threat detection

## Cost Optimization

1. Use Reserved Instances for predictable workloads
2. Configure auto-scaling for ECS services
3. Set up S3 lifecycle policies
4. Monitor and optimize Lambda function duration
5. Use CloudWatch cost anomaly detection

## Maintenance Tasks

1. Regular security updates for container images
2. Database maintenance windows
3. Log retention policy management
4. Performance monitoring and optimization
5. Backup testing and validation

This completes the manual deployment of the MindsDB RAG Assistant platform. The deployment creates a production-ready, scalable, and secure infrastructure for running AI-powered e-commerce assistance with proper monitoring, security, and high availability.

## NAT Gateway Configuration Note

When creating the VPC in Step 2, you'll see these NAT gateway options:

- **None**: No NAT gateways (private subnets won't have internet access)
- **In 1 AZ**: Single NAT gateway in one availability zone (cheaper but single point of failure)  
- **1 per AZ**: One NAT gateway per availability zone (recommended for high availability)

**For your demo deployment, select "In 1 AZ"** to use a single availability zone with one NAT gateway. This provides:

✅ **Lower Cost**: Only one NAT gateway to pay for  
✅ **Simpler Setup**: Fewer resources to manage  
✅ **Perfect for Demo**: All functionality works the same  
❌ **No High Availability**: Single point of failure

**If you later want production-level high availability**, you can select "1 per AZ" with 3 availability zones, but for demo purposes, the single AZ setup is perfect and much more cost-effective.
## How 
to Find Your AWS Account ID and KMS Key ID

### AWS Account ID
You can find your AWS Account ID in several ways:

1. **AWS Console (Top Right):** Click on your username in the top-right corner - your Account ID is displayed
2. **AWS CLI:** Run `aws sts get-caller-identity` - look for the "Account" field
3. **IAM Console:** Go to IAM → Dashboard - your Account ID is shown at the top

Your AWS Account ID is a 12-digit number like `123456789012`.

### KMS Key ID (from Step 1)
To find your KMS Key ID that you created in Step 1:

1. **Go to AWS KMS Console** (https://console.aws.amazon.com/kms/)
2. **Click "Customer managed keys"** in the left sidebar
3. **Find your key:** Look for `mindsdb-rag-encryption-key-dev`
4. **Click on the key name** to open its details
5. **Copy the Key ID:** It's shown at the top and looks like `abcd1234-a123-456a-a12b-a123b4cd56ef`

**Alternative:** You can also use the Key ARN, but you'll need to extract just the Key ID part (the part after the last `/`).

**Important:** Throughout this guide, replace all instances of:
- `123456789012` → Your actual 12-digit AWS Account ID
- `abcd1234-a123-456a-a12b-a123b4cd56ef` → Your actual KMS Key ID from Step 1
- `us-east-2` → Your preferred AWS region (if different)
## 
Generating Secure API Keys

For the MindsDB API key in Step 10, you can:

**Option 1: Use a simple demo key** (for testing only):
- `mindsdb-demo-api-key-2024`

**Option 2: Generate a secure random key:**
- **Online generator:** Use a tool like https://www.uuidgenerator.net/ or https://randomkeygen.com/
- **Command line (Mac/Linux):** `openssl rand -base64 32`
- **Command line (Windows PowerShell):** `[System.Web.Security.Membership]::GeneratePassword(32, 0)`

**Example secure key:** `Kx9mP2vR8nQ4wE7tY1uI5oP3aS6dF9gH2jK4lM7nB0vC5xZ8`

**Important:** For production use, always generate a strong, unique API key and store it securely.