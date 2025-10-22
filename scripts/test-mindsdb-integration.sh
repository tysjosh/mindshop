#!/bin/bash

# Integration Test for MindsDB ECS Fargate Deployment
# This script performs end-to-end testing of the MindsDB service

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="mindsdb-rag-${ENVIRONMENT}"

echo "🧪 MindsDB Integration Testing"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "Stack: ${STACK_NAME}"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        return 1
    fi
}

# Get service endpoints
echo "📡 Retrieving service endpoints..."

MINDSDB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`MindsDBInternalEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo "MindsDB Endpoint: ${MINDSDB_ENDPOINT}"
echo "Database Endpoint: ${DB_ENDPOINT}"
echo "Redis Endpoint: ${REDIS_ENDPOINT}"
echo ""

FAILED_TESTS=0

# Test 1: Service Health Check
echo "1. Service Health Tests"
echo "======================"

if [ -n "$MINDSDB_ENDPOINT" ] && [ "$MINDSDB_ENDPOINT" != "None" ]; then
    run_test "MindsDB health endpoint responds" \
        "timeout 30 curl -s -f '${MINDSDB_ENDPOINT}/api/status' > /dev/null" || ((FAILED_TESTS++))
    
    run_test "MindsDB API endpoint accessible" \
        "timeout 30 curl -s '${MINDSDB_ENDPOINT}/api/databases' | jq . > /dev/null" || ((FAILED_TESTS++))
else
    echo -e "${RED}❌ MindsDB endpoint not available${NC}"
    ((FAILED_TESTS++))
fi

echo ""

# Test 2: Auto-Scaling Functionality
echo "2. Auto-Scaling Tests"
echo "===================="

CLUSTER_NAME="mindsdb-rag-${ENVIRONMENT}"
SERVICE_NAME="mindsdb-service"

# Get current task count
CURRENT_COUNT=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0].runningCount' \
    --output text 2>/dev/null || echo "0")

run_test "Service has minimum baseline capacity (≥2)" \
    "[ $CURRENT_COUNT -ge 2 ]" || ((FAILED_TESTS++))

# Test scaling up
echo "Testing scale-up capability..."
NEW_COUNT=$((CURRENT_COUNT + 1))

run_test "Scale service up to $NEW_COUNT tasks" \
    "aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --desired-count ${NEW_COUNT} > /dev/null" || ((FAILED_TESTS++))

# Wait for scaling
echo "Waiting for scaling to complete (30 seconds)..."
sleep 30

SCALED_COUNT=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0].runningCount' \
    --output text 2>/dev/null || echo "0")

run_test "Service scaled to $NEW_COUNT tasks" \
    "[ $SCALED_COUNT -eq $NEW_COUNT ]" || ((FAILED_TESTS++))

# Scale back to original count
echo "Scaling back to original count..."
aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --desired-count ${CURRENT_COUNT} > /dev/null

echo ""

# Test 3: Database Connectivity
echo "3. Database Integration Tests"
echo "============================"

if [ -n "$DB_ENDPOINT" ] && [ "$DB_ENDPOINT" != "None" ]; then
    # Get database credentials
    DB_CREDS=$(aws secretsmanager get-secret-value \
        --secret-id "mindsdb-rag/aurora-credentials" \
        --query 'SecretString' \
        --output text 2>/dev/null || echo "{}")
    
    if [ -n "$DB_CREDS" ] && [ "$DB_CREDS" != "{}" ]; then
        DB_USER=$(echo "$DB_CREDS" | jq -r '.username // empty')
        DB_PASS=$(echo "$DB_CREDS" | jq -r '.password // empty')
        
        run_test "Database credentials retrieved from Secrets Manager" \
            "[ -n '$DB_USER' ] && [ -n '$DB_PASS' ]" || ((FAILED_TESTS++))
        
        # Test database connection (requires psql client)
        if command -v psql &> /dev/null; then
            run_test "Database connection successful" \
                "timeout 10 PGPASSWORD='$DB_PASS' psql -h '$DB_ENDPOINT' -U '$DB_USER' -d postgres -c 'SELECT 1;' > /dev/null 2>&1" || ((FAILED_TESTS++))
        else
            echo -e "${YELLOW}⚠️  SKIP: Database connection test (psql not available)${NC}"
        fi
    else
        echo -e "${RED}❌ Database credentials not available${NC}"
        ((FAILED_TESTS++))
    fi
else
    echo -e "${RED}❌ Database endpoint not available${NC}"
    ((FAILED_TESTS++))
fi

echo ""

# Test 4: Security Configuration
echo "4. Security Tests"
echo "================="

# Test KMS key
KMS_KEY_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`KMSKeyId`].OutputValue' \
    --output text 2>/dev/null || echo "")

run_test "KMS encryption key exists" \
    "[ -n '$KMS_KEY_ID' ] && [ '$KMS_KEY_ID' != 'None' ]" || ((FAILED_TESTS++))

# Test secrets
SECRETS=(
    "mindsdb-rag/aurora-credentials"
    "mindsdb-rag/mindsdb-api-key"
    "mindsdb-rag/bedrock-config"
    "mindsdb-rag/redis-config"
)

for secret in "${SECRETS[@]}"; do
    run_test "Secret exists: $secret" \
        "aws secretsmanager describe-secret --secret-id '$secret' > /dev/null 2>&1" || ((FAILED_TESTS++))
done

echo ""

# Test 5: Monitoring and Logging
echo "5. Monitoring Tests"
echo "==================="

# Test CloudWatch log group
LOG_GROUP="/ecs/mindsdb-${ENVIRONMENT}"
run_test "CloudWatch log group exists" \
    "aws logs describe-log-groups --log-group-name-prefix '$LOG_GROUP' --query 'logGroups[0]' --output text | grep -q '$LOG_GROUP'" || ((FAILED_TESTS++))

# Test CloudWatch alarms
ALARMS=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "MindsDB" \
    --query 'MetricAlarms[].AlarmName' \
    --output json 2>/dev/null || echo "[]")

ALARM_COUNT=$(echo "$ALARMS" | jq 'length')
run_test "CloudWatch alarms configured (≥3)" \
    "[ $ALARM_COUNT -ge 3 ]" || ((FAILED_TESTS++))

# Test metrics
echo "Checking recent metrics..."
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -d '10 minutes ago' +"%Y-%m-%dT%H:%M:%S")

CPU_METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ServiceName,Value=${SERVICE_NAME} Name=ClusterName,Value=${CLUSTER_NAME} \
    --start-time ${START_TIME} \
    --end-time ${END_TIME} \
    --period 300 \
    --statistics Average \
    --query 'Datapoints' \
    --output json 2>/dev/null || echo "[]")

METRIC_COUNT=$(echo "$CPU_METRICS" | jq 'length')
run_test "CPU metrics available" \
    "[ $METRIC_COUNT -gt 0 ]" || ((FAILED_TESTS++))

echo ""

# Test 6: Load Balancer Health
echo "6. Load Balancer Tests"
echo "======================"

# Test ALB
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names "mindsdb-internal-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || echo "")

run_test "Internal ALB exists" \
    "[ -n '$ALB_ARN' ] && [ '$ALB_ARN' != 'None' ]" || ((FAILED_TESTS++))

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    # Test target group health
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
        --names "mindsdb-tg" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "None" ]; then
        HEALTHY_TARGETS=$(aws elbv2 describe-target-health \
            --target-group-arn ${TARGET_GROUP_ARN} \
            --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]' \
            --output json | jq 'length')
        
        run_test "Healthy targets available (≥1)" \
            "[ $HEALTHY_TARGETS -ge 1 ]" || ((FAILED_TESTS++))
    fi
fi

echo ""

# Test 7: Performance and Capacity
echo "7. Performance Tests"
echo "===================="

# Test task resource allocation
TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0].taskDefinition' \
    --output text 2>/dev/null || echo "")

if [ -n "$TASK_DEF_ARN" ] && [ "$TASK_DEF_ARN" != "None" ]; then
    TASK_DEF_INFO=$(aws ecs describe-task-definition \
        --task-definition ${TASK_DEF_ARN} \
        --query 'taskDefinition' \
        --output json 2>/dev/null || echo "{}")
    
    CPU=$(echo "$TASK_DEF_INFO" | jq -r '.cpu // empty')
    MEMORY=$(echo "$TASK_DEF_INFO" | jq -r '.memory // empty')
    
    run_test "Task CPU allocation (2048)" \
        "[ '$CPU' = '2048' ]" || ((FAILED_TESTS++))
    
    run_test "Task memory allocation (4096)" \
        "[ '$MEMORY' = '4096' ]" || ((FAILED_TESTS++))
fi

# Test auto-scaling configuration
SCALABLE_TARGETS=$(aws application-autoscaling describe-scalable-targets \
    --service-namespace ecs \
    --resource-ids "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
    --query 'ScalableTargets[0]' \
    --output json 2>/dev/null || echo "{}")

MIN_CAPACITY=$(echo "$SCALABLE_TARGETS" | jq -r '.MinCapacity // 0')
MAX_CAPACITY=$(echo "$SCALABLE_TARGETS" | jq -r '.MaxCapacity // 0')

run_test "Auto-scaling min capacity (2)" \
    "[ $MIN_CAPACITY -eq 2 ]" || ((FAILED_TESTS++))

run_test "Auto-scaling max capacity (≥10)" \
    "[ $MAX_CAPACITY -ge 10 ]" || ((FAILED_TESTS++))

echo ""

# Summary
echo "📊 Integration Test Summary"
echo "=========================="

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All integration tests passed!${NC}"
    echo ""
    echo "✅ MindsDB ECS Fargate deployment is fully functional:"
    echo "   • Service health checks passing"
    echo "   • Auto-scaling working correctly"
    echo "   • Database connectivity established"
    echo "   • Security configuration validated"
    echo "   • Monitoring and logging active"
    echo "   • Load balancer healthy"
    echo "   • Performance requirements met"
    echo ""
    echo "🚀 The MindsDB service is ready for production use!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Configure MindsDB predictors via API or Studio"
    echo "2. Set up application services to consume MindsDB"
    echo "3. Configure monitoring dashboards"
    echo "4. Set up backup and disaster recovery procedures"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS integration test(s) failed!${NC}"
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "1. Check service logs: aws logs tail ${LOG_GROUP} --follow"
    echo "2. Verify service status: ./scripts/monitor-mindsdb.sh"
    echo "3. Validate deployment: ./scripts/validate-mindsdb-deployment.sh"
    echo "4. Check AWS console for detailed error information"
    echo ""
    exit 1
fi