#!/bin/bash

# Monitor MindsDB Service Health and Performance
# This script checks the health of the MindsDB ECS service and provides monitoring information

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="mindsdb-rag-${ENVIRONMENT}"
SERVICE_NAME="mindsdb-service"
CLUSTER_NAME="mindsdb-rag-${ENVIRONMENT}"

echo "🔍 Monitoring MindsDB Service"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "Cluster: ${CLUSTER_NAME}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Check ECS service status
echo "📊 ECS Service Status:"
aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --region ${AWS_REGION} \
    --query 'services[0].{
        ServiceName: serviceName,
        Status: status,
        RunningCount: runningCount,
        PendingCount: pendingCount,
        DesiredCount: desiredCount,
        TaskDefinition: taskDefinition
    }' \
    --output table

echo ""

# Check task health
echo "🏥 Task Health Status:"
TASK_ARNS=$(aws ecs list-tasks \
    --cluster ${CLUSTER_NAME} \
    --service-name ${SERVICE_NAME} \
    --region ${AWS_REGION} \
    --query 'taskArns' \
    --output text)

if [ -n "$TASK_ARNS" ]; then
    aws ecs describe-tasks \
        --cluster ${CLUSTER_NAME} \
        --tasks ${TASK_ARNS} \
        --region ${AWS_REGION} \
        --query 'tasks[].{
            TaskArn: taskArn,
            LastStatus: lastStatus,
            HealthStatus: healthStatus,
            CpuUtilization: "N/A",
            MemoryUtilization: "N/A",
            CreatedAt: createdAt
        }' \
        --output table
else
    echo "No running tasks found."
fi

echo ""

# Check ALB target health
echo "🎯 Load Balancer Target Health:"
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
    --names "mindsdb-tg" \
    --region ${AWS_REGION} \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || echo "")

if [ -n "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "None" ]; then
    aws elbv2 describe-target-health \
        --target-group-arn ${TARGET_GROUP_ARN} \
        --region ${AWS_REGION} \
        --query 'TargetHealthDescriptions[].{
            Target: Target.Id,
            Port: Target.Port,
            Health: TargetHealth.State,
            Reason: TargetHealth.Reason,
            Description: TargetHealth.Description
        }' \
        --output table
else
    echo "Target group not found or not accessible."
fi

echo ""

# Check CloudWatch metrics
echo "📈 Recent CloudWatch Metrics (Last 5 minutes):"
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -d '5 minutes ago' +"%Y-%m-%dT%H:%M:%S")

# CPU Utilization
echo "CPU Utilization:"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ServiceName,Value=${SERVICE_NAME} Name=ClusterName,Value=${CLUSTER_NAME} \
    --start-time ${START_TIME} \
    --end-time ${END_TIME} \
    --period 300 \
    --statistics Average \
    --region ${AWS_REGION} \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null || echo "No data available"

# Memory Utilization
echo "Memory Utilization:"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name MemoryUtilization \
    --dimensions Name=ServiceName,Value=${SERVICE_NAME} Name=ClusterName,Value=${CLUSTER_NAME} \
    --start-time ${START_TIME} \
    --end-time ${END_TIME} \
    --period 300 \
    --statistics Average \
    --region ${AWS_REGION} \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null || echo "No data available"

echo ""

# Check recent logs
echo "📝 Recent Service Logs (Last 10 entries):"
LOG_GROUP="/ecs/mindsdb-${ENVIRONMENT}"
aws logs describe-log-streams \
    --log-group-name ${LOG_GROUP} \
    --order-by LastEventTime \
    --descending \
    --max-items 1 \
    --region ${AWS_REGION} \
    --query 'logStreams[0].logStreamName' \
    --output text 2>/dev/null | \
while read LOG_STREAM; do
    if [ -n "$LOG_STREAM" ] && [ "$LOG_STREAM" != "None" ]; then
        aws logs get-log-events \
            --log-group-name ${LOG_GROUP} \
            --log-stream-name ${LOG_STREAM} \
            --limit 10 \
            --region ${AWS_REGION} \
            --query 'events[].message' \
            --output text 2>/dev/null || echo "No recent logs available"
    else
        echo "No log streams found"
    fi
done

echo ""

# Service endpoints
echo "🔗 Service Endpoints:"
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names "mindsdb-internal-alb" \
    --region ${AWS_REGION} \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "None" ]; then
    echo "MindsDB Internal Endpoint: http://${ALB_DNS}"
    echo "Health Check: http://${ALB_DNS}/api/status"
    echo "API Documentation: http://${ALB_DNS}/api/docs"
else
    echo "Load balancer not found or not accessible"
fi

echo ""
echo "✅ Monitoring complete!"
echo ""
echo "💡 Useful Commands:"
echo "- Scale service: aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --desired-count <count>"
echo "- View logs: aws logs tail ${LOG_GROUP} --follow"
echo "- Restart service: aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --force-new-deployment"