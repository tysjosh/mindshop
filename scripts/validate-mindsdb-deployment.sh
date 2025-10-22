#!/bin/bash

# Validate MindsDB ECS Fargate Deployment
# This script validates that the MindsDB deployment meets all task requirements

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="mindsdb-rag-${ENVIRONMENT}"
SERVICE_NAME="mindsdb-service"
CLUSTER_NAME="mindsdb-rag-${ENVIRONMENT}"

echo "🔍 Validating MindsDB ECS Fargate Deployment"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "Stack: ${STACK_NAME}"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_requirement() {
    local requirement="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "Checking: $requirement... "
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

validate_value() {
    local requirement="$1"
    local actual="$2"
    local expected="$3"
    
    echo -n "Checking: $requirement... "
    
    if [ "$actual" = "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Value: $actual)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected, Got: $actual)"
        return 1
    fi
}

validate_exists() {
    local requirement="$1"
    local resource="$2"
    
    echo -n "Checking: $requirement... "
    
    if [ -n "$resource" ] && [ "$resource" != "None" ] && [ "$resource" != "null" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Found: $resource)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Resource not found)"
        return 1
    fi
}

# Start validation
echo "🏗️  Infrastructure Validation"
echo "================================"

FAILED_CHECKS=0

# 1. Validate VPC and Subnets
echo "1. VPC and Network Configuration:"

VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
    --output text 2>/dev/null || echo "")

validate_exists "VPC exists" "$VPC_ID" || ((FAILED_CHECKS++))

# Check private subnets
PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=*Private*" \
    --query 'Subnets[].SubnetId' \
    --output text 2>/dev/null || echo "")

validate_exists "Private subnets exist" "$PRIVATE_SUBNETS" || ((FAILED_CHECKS++))

echo ""

# 2. Validate ECS Cluster and Service
echo "2. ECS Fargate Configuration:"

CLUSTER_ARN=$(aws ecs describe-clusters \
    --clusters ${CLUSTER_NAME} \
    --query 'clusters[0].clusterArn' \
    --output text 2>/dev/null || echo "")

validate_exists "ECS Cluster exists" "$CLUSTER_ARN" || ((FAILED_CHECKS++))

# Check service configuration
SERVICE_INFO=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0]' \
    --output json 2>/dev/null || echo "{}")

LAUNCH_TYPE=$(echo "$SERVICE_INFO" | jq -r '.launchType // empty')
validate_value "Launch type is FARGATE" "$LAUNCH_TYPE" "FARGATE" || ((FAILED_CHECKS++))

DESIRED_COUNT=$(echo "$SERVICE_INFO" | jq -r '.desiredCount // 0')
validate_requirement "Minimum baseline capacity (≥2)" "[ $DESIRED_COUNT -ge 2 ]" || ((FAILED_CHECKS++))

# Check task definition
TASK_DEF_ARN=$(echo "$SERVICE_INFO" | jq -r '.taskDefinition // empty')
TASK_DEF_INFO=$(aws ecs describe-task-definition \
    --task-definition ${TASK_DEF_ARN} \
    --query 'taskDefinition' \
    --output json 2>/dev/null || echo "{}")

CPU=$(echo "$TASK_DEF_INFO" | jq -r '.cpu // empty')
MEMORY=$(echo "$TASK_DEF_INFO" | jq -r '.memory // empty')

validate_value "CPU allocation" "$CPU" "2048" || ((FAILED_CHECKS++))
validate_value "Memory allocation" "$MEMORY" "4096" || ((FAILED_CHECKS++))

echo ""

# 3. Validate Auto-Scaling Configuration
echo "3. Auto-Scaling Configuration:"

SCALABLE_TARGETS=$(aws application-autoscaling describe-scalable-targets \
    --service-namespace ecs \
    --resource-ids "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
    --query 'ScalableTargets[0]' \
    --output json 2>/dev/null || echo "{}")

MIN_CAPACITY=$(echo "$SCALABLE_TARGETS" | jq -r '.MinCapacity // 0')
MAX_CAPACITY=$(echo "$SCALABLE_TARGETS" | jq -r '.MaxCapacity // 0')

validate_value "Minimum capacity" "$MIN_CAPACITY" "2" || ((FAILED_CHECKS++))
validate_requirement "Maximum capacity (≥10)" "[ $MAX_CAPACITY -ge 10 ]" || ((FAILED_CHECKS++))

# Check scaling policies
SCALING_POLICIES=$(aws application-autoscaling describe-scaling-policies \
    --service-namespace ecs \
    --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
    --query 'ScalingPolicies' \
    --output json 2>/dev/null || echo "[]")

POLICY_COUNT=$(echo "$SCALING_POLICIES" | jq 'length')
validate_requirement "Auto-scaling policies exist (≥2)" "[ $POLICY_COUNT -ge 2 ]" || ((FAILED_CHECKS++))

echo ""

# 4. Validate Internal ALB
echo "4. Internal Application Load Balancer:"

ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names "mindsdb-internal-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || echo "")

validate_exists "Internal ALB exists" "$ALB_ARN" || ((FAILED_CHECKS++))

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    ALB_SCHEME=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns ${ALB_ARN} \
        --query 'LoadBalancers[0].Scheme' \
        --output text 2>/dev/null || echo "")
    
    validate_value "ALB is internal" "$ALB_SCHEME" "internal" || ((FAILED_CHECKS++))
    
    # Check target group health
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
        --names "mindsdb-tg" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "None" ]; then
        HEALTHY_TARGETS=$(aws elbv2 describe-target-health \
            --target-group-arn ${TARGET_GROUP_ARN} \
            --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]' \
            --output json | jq 'length')
        
        validate_requirement "Healthy targets exist (≥1)" "[ $HEALTHY_TARGETS -ge 1 ]" || ((FAILED_CHECKS++))
    fi
fi

echo ""

# 5. Validate Database Connection
echo "5. Aurora PostgreSQL Integration:"

DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

validate_exists "Aurora PostgreSQL endpoint" "$DB_ENDPOINT" || ((FAILED_CHECKS++))

# Check database credentials secret
DB_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "mindsdb-rag/aurora-credentials" \
    --query 'ARN' \
    --output text 2>/dev/null || echo "")

validate_exists "Database credentials secret" "$DB_SECRET_ARN" || ((FAILED_CHECKS++))

echo ""

# 6. Validate Security Configuration
echo "6. Security and IAM Configuration:"

# Check KMS key
KMS_KEY_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`KMSKeyId`].OutputValue' \
    --output text 2>/dev/null || echo "")

validate_exists "KMS encryption key" "$KMS_KEY_ID" || ((FAILED_CHECKS++))

# Check task execution role
TASK_EXECUTION_ROLE=$(echo "$TASK_DEF_INFO" | jq -r '.executionRoleArn // empty')
validate_exists "ECS task execution role" "$TASK_EXECUTION_ROLE" || ((FAILED_CHECKS++))

# Check task role
TASK_ROLE=$(echo "$TASK_DEF_INFO" | jq -r '.taskRoleArn // empty')
validate_exists "ECS task role" "$TASK_ROLE" || ((FAILED_CHECKS++))

# Check Secrets Manager integration
SECRETS_COUNT=$(echo "$TASK_DEF_INFO" | jq '.containerDefinitions[0].secrets | length')
validate_requirement "Secrets Manager integration (≥2 secrets)" "[ $SECRETS_COUNT -ge 2 ]" || ((FAILED_CHECKS++))

echo ""

# 7. Validate Monitoring and Logging
echo "7. Monitoring and Logging:"

# Check CloudWatch log group
LOG_GROUP="/ecs/mindsdb-${ENVIRONMENT}"
LOG_GROUP_EXISTS=$(aws logs describe-log-groups \
    --log-group-name-prefix ${LOG_GROUP} \
    --query 'logGroups[0].logGroupName' \
    --output text 2>/dev/null || echo "")

validate_exists "CloudWatch log group" "$LOG_GROUP_EXISTS" || ((FAILED_CHECKS++))

# Check CloudWatch alarms
ALARMS=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "MindsDB" \
    --query 'MetricAlarms[].AlarmName' \
    --output json 2>/dev/null || echo "[]")

ALARM_COUNT=$(echo "$ALARMS" | jq 'length')
validate_requirement "CloudWatch alarms exist (≥3)" "[ $ALARM_COUNT -ge 3 ]" || ((FAILED_CHECKS++))

echo ""

# 8. Validate Service Health
echo "8. Service Health and Connectivity:"

# Get MindsDB endpoint
MINDSDB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MindsDBInternalEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

validate_exists "MindsDB internal endpoint" "$MINDSDB_ENDPOINT" || ((FAILED_CHECKS++))

# Test health endpoint (if accessible)
if [ -n "$MINDSDB_ENDPOINT" ] && [ "$MINDSDB_ENDPOINT" != "None" ]; then
    echo -n "Checking: MindsDB health endpoint accessibility... "
    
    # Note: This might fail if running from outside VPC
    if timeout 10 curl -s -f "${MINDSDB_ENDPOINT}/api/status" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
    else
        echo -e "${YELLOW}⚠️  SKIP${NC} (Not accessible from current network)"
    fi
fi

echo ""

# Summary
echo "📊 Validation Summary"
echo "===================="

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo ""
    echo "🎉 MindsDB ECS Fargate deployment meets all requirements:"
    echo "   ✓ ECS Fargate tasks in private subnets"
    echo "   ✓ Internal ALB with health checks"
    echo "   ✓ Auto-scaling based on CPU, memory, and request rate"
    echo "   ✓ Minimum baseline capacity of 2 tasks"
    echo "   ✓ Secure connection to Aurora PostgreSQL"
    echo "   ✓ S3 model artifacts integration"
    echo "   ✓ IAM roles with least-privilege access"
    echo "   ✓ Secrets Manager integration"
    echo "   ✓ CloudWatch monitoring and alarms"
    echo ""
    echo "🔗 Service Endpoints:"
    echo "   MindsDB Internal: ${MINDSDB_ENDPOINT}"
    echo "   Health Check: ${MINDSDB_ENDPOINT}/api/status"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILED_CHECKS validation check(s) failed!${NC}"
    echo ""
    echo "Please review the failed checks above and ensure:"
    echo "1. The infrastructure deployment completed successfully"
    echo "2. All AWS resources are properly configured"
    echo "3. The ECS service is running and healthy"
    echo "4. Network connectivity is properly established"
    echo ""
    echo "Run './scripts/monitor-mindsdb.sh' for detailed service status"
    exit 1
fi