#!/bin/bash

# Infrastructure Validation Script
# Validates that all infrastructure components are properly deployed and configured

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    ((FAILED_CHECKS++))
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check() {
    ((TOTAL_CHECKS++))
    echo -e "${BLUE}[CHECK]${NC} $1"
}

# Load CDK outputs
load_outputs() {
    if [ ! -f "infrastructure/cdk/outputs.json" ]; then
        error "CDK outputs file not found. Please deploy the infrastructure first."
        exit 1
    fi
    
    # Load outputs into variables
    VPC_ID=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].VpcId // empty' infrastructure/cdk/outputs.json)
    API_URL=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].ApiGatewayUrl // empty' infrastructure/cdk/outputs.json)
    DB_ENDPOINT=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].DatabaseEndpoint // empty' infrastructure/cdk/outputs.json)
    REDIS_ENDPOINT=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].RedisEndpoint // empty' infrastructure/cdk/outputs.json)
    ECS_CLUSTER=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].ECSClusterName // empty' infrastructure/cdk/outputs.json)
    MINDSDB_ENDPOINT=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].MindsDBInternalEndpoint // empty' infrastructure/cdk/outputs.json)
    KMS_KEY_ID=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].KMSKeyId // empty' infrastructure/cdk/outputs.json)
    
    log "Loaded CDK outputs for environment: $ENVIRONMENT"
}

# Validate VPC and networking
validate_vpc() {
    log "Validating VPC and networking..."
    
    check "VPC exists"
    if [ -n "$VPC_ID" ] && aws ec2 describe-vpcs --vpc-ids "$VPC_ID" &>/dev/null; then
        success "VPC $VPC_ID exists"
    else
        error "VPC not found or not accessible"
        return
    fi
    
    check "VPC has required subnets"
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text)
    SUBNET_COUNT=$(echo $SUBNETS | wc -w)
    if [ "$SUBNET_COUNT" -ge 6 ]; then
        success "VPC has $SUBNET_COUNT subnets (expected: 6+)"
    else
        error "VPC has insufficient subnets: $SUBNET_COUNT (expected: 6+)"
    fi
    
    check "NAT Gateways exist"
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID" --query 'NatGateways[?State==`available`].NatGatewayId' --output text)
    NAT_COUNT=$(echo $NAT_GATEWAYS | wc -w)
    if [ "$NAT_COUNT" -ge 2 ]; then
        success "Found $NAT_COUNT NAT Gateways"
    else
        warning "Found only $NAT_COUNT NAT Gateways (expected: 2 for HA)"
    fi
    
    check "Internet Gateway exists"
    IGW=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[0].InternetGatewayId' --output text)
    if [ "$IGW" != "None" ] && [ -n "$IGW" ]; then
        success "Internet Gateway $IGW exists"
    else
        error "Internet Gateway not found"
    fi
}

# Validate RDS Aurora cluster
validate_database() {
    log "Validating RDS Aurora cluster..."
    
    check "Aurora cluster exists"
    if [ -n "$DB_ENDPOINT" ]; then
        CLUSTER_ID=$(aws rds describe-db-clusters --query "DBClusters[?Endpoint=='$DB_ENDPOINT'].DBClusterIdentifier" --output text)
        if [ -n "$CLUSTER_ID" ] && [ "$CLUSTER_ID" != "None" ]; then
            success "Aurora cluster $CLUSTER_ID exists"
            
            check "Aurora cluster is available"
            CLUSTER_STATUS=$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --query 'DBClusters[0].Status' --output text)
            if [ "$CLUSTER_STATUS" = "available" ]; then
                success "Aurora cluster is available"
            else
                error "Aurora cluster status: $CLUSTER_STATUS (expected: available)"
            fi
            
            check "Aurora cluster has multiple instances"
            INSTANCE_COUNT=$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --query 'DBClusters[0].DBClusterMembers | length(@)' --output text)
            if [ "$INSTANCE_COUNT" -ge 2 ]; then
                success "Aurora cluster has $INSTANCE_COUNT instances"
            else
                warning "Aurora cluster has only $INSTANCE_COUNT instance (expected: 2+ for HA)"
            fi
            
            check "Aurora cluster encryption is enabled"
            ENCRYPTION=$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --query 'DBClusters[0].StorageEncrypted' --output text)
            if [ "$ENCRYPTION" = "True" ]; then
                success "Aurora cluster encryption is enabled"
            else
                error "Aurora cluster encryption is not enabled"
            fi
        else
            error "Aurora cluster not found"
        fi
    else
        error "Database endpoint not found in outputs"
    fi
}

# Validate ElastiCache Redis
validate_redis() {
    log "Validating ElastiCache Redis..."
    
    check "Redis cluster exists"
    if [ -n "$REDIS_ENDPOINT" ]; then
        # Extract cluster ID from endpoint
        REDIS_CLUSTER_ID=$(echo "$REDIS_ENDPOINT" | cut -d'.' -f1)
        
        REDIS_STATUS=$(aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" --query 'CacheClusters[0].CacheClusterStatus' --output text 2>/dev/null || echo "NotFound")
        
        if [ "$REDIS_STATUS" = "available" ]; then
            success "Redis cluster $REDIS_CLUSTER_ID is available"
            
            check "Redis encryption in transit"
            TRANSIT_ENCRYPTION=$(aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" --query 'CacheClusters[0].TransitEncryptionEnabled' --output text)
            if [ "$TRANSIT_ENCRYPTION" = "True" ]; then
                success "Redis transit encryption is enabled"
            else
                warning "Redis transit encryption is not enabled"
            fi
        else
            error "Redis cluster not found or not available (status: $REDIS_STATUS)"
        fi
    else
        error "Redis endpoint not found in outputs"
    fi
}

# Validate ECS cluster and service
validate_ecs() {
    log "Validating ECS cluster and services..."
    
    check "ECS cluster exists"
    if [ -n "$ECS_CLUSTER" ]; then
        CLUSTER_STATUS=$(aws ecs describe-clusters --clusters "$ECS_CLUSTER" --query 'clusters[0].status' --output text)
        if [ "$CLUSTER_STATUS" = "ACTIVE" ]; then
            success "ECS cluster $ECS_CLUSTER is active"
            
            check "ECS services are running"
            SERVICES=$(aws ecs list-services --cluster "$ECS_CLUSTER" --query 'serviceArns' --output text)
            SERVICE_COUNT=$(echo $SERVICES | wc -w)
            
            if [ "$SERVICE_COUNT" -gt 0 ]; then
                success "Found $SERVICE_COUNT ECS services"
                
                # Check service health
                for SERVICE_ARN in $SERVICES; do
                    SERVICE_NAME=$(echo $SERVICE_ARN | cut -d'/' -f3)
                    RUNNING_COUNT=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$SERVICE_NAME" --query 'services[0].runningCount' --output text)
                    DESIRED_COUNT=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$SERVICE_NAME" --query 'services[0].desiredCount' --output text)
                    
                    if [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ] && [ "$RUNNING_COUNT" -gt 0 ]; then
                        success "Service $SERVICE_NAME: $RUNNING_COUNT/$DESIRED_COUNT tasks running"
                    else
                        error "Service $SERVICE_NAME: $RUNNING_COUNT/$DESIRED_COUNT tasks running"
                    fi
                done
            else
                error "No ECS services found"
            fi
        else
            error "ECS cluster status: $CLUSTER_STATUS (expected: ACTIVE)"
        fi
    else
        error "ECS cluster name not found in outputs"
    fi
}

# Validate Lambda functions
validate_lambda() {
    log "Validating Lambda functions..."
    
    # List Lambda functions with our naming pattern
    LAMBDA_FUNCTIONS=$(aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'mindsdb-rag-')].FunctionName" --output text)
    
    check "Lambda functions exist"
    if [ -n "$LAMBDA_FUNCTIONS" ]; then
        FUNCTION_COUNT=$(echo $LAMBDA_FUNCTIONS | wc -w)
        success "Found $FUNCTION_COUNT Lambda functions"
        
        for FUNCTION in $LAMBDA_FUNCTIONS; do
            check "Lambda function $FUNCTION is active"
            STATE=$(aws lambda get-function --function-name "$FUNCTION" --query 'Configuration.State' --output text)
            if [ "$STATE" = "Active" ]; then
                success "Lambda function $FUNCTION is active"
            else
                error "Lambda function $FUNCTION state: $STATE (expected: Active)"
            fi
        done
    else
        error "No Lambda functions found"
    fi
}

# Validate API Gateway
validate_api_gateway() {
    log "Validating API Gateway..."
    
    check "API Gateway is accessible"
    if [ -n "$API_URL" ]; then
        # Test health endpoint
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}health" || echo "000")
        
        if [ "$HTTP_STATUS" = "200" ]; then
            success "API Gateway health endpoint is accessible"
        else
            error "API Gateway health endpoint returned status: $HTTP_STATUS"
        fi
        
        # Test CORS headers
        check "API Gateway CORS configuration"
        CORS_HEADER=$(curl -s -I "${API_URL}health" | grep -i "access-control-allow-origin" || echo "")
        if [ -n "$CORS_HEADER" ]; then
            success "CORS headers are configured"
        else
            warning "CORS headers not found"
        fi
    else
        error "API Gateway URL not found in outputs"
    fi
}

# Validate Step Functions
validate_step_functions() {
    log "Validating Step Functions..."
    
    # List Step Functions with our naming pattern
    STATE_MACHINES=$(aws stepfunctions list-state-machines --query "stateMachines[?contains(name, 'mindsdb-rag') || contains(name, 'document-processing') || contains(name, 'model-retraining')].name" --output text)
    
    check "Step Functions exist"
    if [ -n "$STATE_MACHINES" ]; then
        MACHINE_COUNT=$(echo $STATE_MACHINES | wc -w)
        success "Found $MACHINE_COUNT Step Functions"
        
        for MACHINE in $STATE_MACHINES; do
            check "Step Function $MACHINE is active"
            STATUS=$(aws stepfunctions describe-state-machine --state-machine-arn "arn:aws:states:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):stateMachine:${MACHINE}" --query 'status' --output text 2>/dev/null || echo "NotFound")
            
            if [ "$STATUS" = "ACTIVE" ]; then
                success "Step Function $MACHINE is active"
            else
                error "Step Function $MACHINE status: $STATUS"
            fi
        done
    else
        warning "No Step Functions found (may not be deployed yet)"
    fi
}

# Validate KMS encryption
validate_kms() {
    log "Validating KMS encryption..."
    
    check "KMS key exists"
    if [ -n "$KMS_KEY_ID" ]; then
        KEY_STATE=$(aws kms describe-key --key-id "$KMS_KEY_ID" --query 'KeyMetadata.KeyState' --output text)
        if [ "$KEY_STATE" = "Enabled" ]; then
            success "KMS key $KMS_KEY_ID is enabled"
            
            check "KMS key rotation is enabled"
            ROTATION=$(aws kms get-key-rotation-status --key-id "$KMS_KEY_ID" --query 'KeyRotationEnabled' --output text)
            if [ "$ROTATION" = "True" ]; then
                success "KMS key rotation is enabled"
            else
                warning "KMS key rotation is not enabled"
            fi
        else
            error "KMS key state: $KEY_STATE (expected: Enabled)"
        fi
    else
        error "KMS key ID not found in outputs"
    fi
}

# Validate S3 buckets
validate_s3() {
    log "Validating S3 buckets..."
    
    # List S3 buckets with our naming pattern
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    BUCKET_PATTERNS=(
        "mindsdb-rag-documents-${ACCOUNT_ID}-${AWS_REGION}"
        "mindsdb-rag-models-${ACCOUNT_ID}-${AWS_REGION}"
        "mindsdb-rag-audit-${ACCOUNT_ID}-${AWS_REGION}"
    )
    
    for BUCKET in "${BUCKET_PATTERNS[@]}"; do
        check "S3 bucket $BUCKET exists"
        if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
            success "S3 bucket $BUCKET exists"
            
            check "S3 bucket $BUCKET encryption"
            ENCRYPTION=$(aws s3api get-bucket-encryption --bucket "$BUCKET" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null || echo "None")
            if [ "$ENCRYPTION" = "aws:kms" ]; then
                success "S3 bucket $BUCKET has KMS encryption"
            else
                error "S3 bucket $BUCKET encryption: $ENCRYPTION (expected: aws:kms)"
            fi
            
            check "S3 bucket $BUCKET versioning"
            VERSIONING=$(aws s3api get-bucket-versioning --bucket "$BUCKET" --query 'Status' --output text)
            if [ "$VERSIONING" = "Enabled" ]; then
                success "S3 bucket $BUCKET versioning is enabled"
            else
                warning "S3 bucket $BUCKET versioning: $VERSIONING"
            fi
        else
            error "S3 bucket $BUCKET not found or not accessible"
        fi
    done
}

# Validate CloudWatch monitoring
validate_monitoring() {
    log "Validating CloudWatch monitoring..."
    
    check "CloudWatch dashboard exists"
    DASHBOARD_NAME="MindsDB-RAG-${ENVIRONMENT}"
    if aws cloudwatch get-dashboard --dashboard-name "$DASHBOARD_NAME" &>/dev/null; then
        success "CloudWatch dashboard $DASHBOARD_NAME exists"
    else
        warning "CloudWatch dashboard $DASHBOARD_NAME not found"
    fi
    
    check "CloudWatch alarms exist"
    ALARMS=$(aws cloudwatch describe-alarms --alarm-name-prefix "mindsdb-rag-" --query 'MetricAlarms[].AlarmName' --output text)
    ALARM_COUNT=$(echo $ALARMS | wc -w)
    
    if [ "$ALARM_COUNT" -gt 0 ]; then
        success "Found $ALARM_COUNT CloudWatch alarms"
    else
        warning "No CloudWatch alarms found"
    fi
    
    check "SNS topic for alerts exists"
    TOPICS=$(aws sns list-topics --query "Topics[?contains(TopicArn, 'mindsdb-rag-alerts')].TopicArn" --output text)
    if [ -n "$TOPICS" ]; then
        success "SNS alert topic exists"
    else
        warning "SNS alert topic not found"
    fi
}

# Validate security configuration
validate_security() {
    log "Validating security configuration..."
    
    check "WAF Web ACL exists"
    WEB_ACLS=$(aws wafv2 list-web-acls --scope REGIONAL --query "WebACLs[?contains(Name, 'mindsdb-rag')].Name" --output text)
    if [ -n "$WEB_ACLS" ]; then
        success "WAF Web ACL found"
    else
        warning "WAF Web ACL not found"
    fi
    
    check "Cognito User Pool exists"
    USER_POOLS=$(aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?contains(Name, 'mindsdb-rag')].Name" --output text)
    if [ -n "$USER_POOLS" ]; then
        success "Cognito User Pool found"
    else
        warning "Cognito User Pool not found"
    fi
    
    check "Secrets Manager secrets exist"
    SECRETS=$(aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'mindsdb-rag')].Name" --output text)
    SECRET_COUNT=$(echo $SECRETS | wc -w)
    
    if [ "$SECRET_COUNT" -gt 0 ]; then
        success "Found $SECRET_COUNT Secrets Manager secrets"
    else
        warning "No Secrets Manager secrets found"
    fi
}

# Generate validation report
generate_report() {
    log ""
    log "=== Infrastructure Validation Report ==="
    log "Environment: $ENVIRONMENT"
    log "Region: $AWS_REGION"
    log "Timestamp: $(date)"
    log ""
    log "Results:"
    log "  Total Checks: $TOTAL_CHECKS"
    log "  Passed: $PASSED_CHECKS"
    log "  Failed: $FAILED_CHECKS"
    log "  Success Rate: $(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%"
    log ""
    
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        success "🎉 All infrastructure validation checks passed!"
        return 0
    else
        error "❌ $FAILED_CHECKS validation checks failed"
        return 1
    fi
}

# Main validation function
main() {
    log "Starting infrastructure validation for MindsDB RAG Assistant"
    log "Environment: $ENVIRONMENT"
    log "Region: $AWS_REGION"
    log ""
    
    load_outputs
    
    validate_vpc
    validate_database
    validate_redis
    validate_ecs
    validate_lambda
    validate_api_gateway
    validate_step_functions
    validate_kms
    validate_s3
    validate_monitoring
    validate_security
    
    generate_report
}

# Run main function
main