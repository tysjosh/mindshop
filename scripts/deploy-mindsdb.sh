#!/bin/bash

# Deploy MindsDB RAG Assistant Infrastructure
# This script deploys the MindsDB service with ECS Fargate and auto-scaling

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="mindsdb-rag-${ENVIRONMENT}"

echo "🚀 Deploying MindsDB RAG Assistant Infrastructure"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "Stack: ${STACK_NAME}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK is not installed. Please install it first:"
    echo "npm install -g aws-cdk"
    exit 1
fi

# Navigate to CDK directory
cd infrastructure/cdk

# Install dependencies
echo "📦 Installing CDK dependencies..."
npm install

# Bootstrap CDK (if not already done)
echo "🔧 Bootstrapping CDK..."
cdk bootstrap aws://${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}/${AWS_REGION} || true

# Synthesize the stack
echo "🔨 Synthesizing CDK stack..."
cdk synth ${STACK_NAME} \
    --context environment=${ENVIRONMENT} \
    --context region=${AWS_REGION}

# Deploy the stack
echo "🚀 Deploying CDK stack..."
cdk deploy ${STACK_NAME} \
    --context environment=${ENVIRONMENT} \
    --context region=${AWS_REGION} \
    --require-approval never \
    --outputs-file outputs.json

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ MindsDB RAG Assistant infrastructure deployed successfully!"
    
    # Display important outputs
    echo ""
    echo "📋 Important Endpoints:"
    echo "VPC ID: $(cat outputs.json | jq -r '.["'${STACK_NAME}'"].VpcId')"
    echo "ECS Cluster: $(cat outputs.json | jq -r '.["'${STACK_NAME}'"].ECSClusterName')"
    echo "Database Endpoint: $(cat outputs.json | jq -r '.["'${STACK_NAME}'"].DatabaseEndpoint')"
    echo "Redis Endpoint: $(cat outputs.json | jq -r '.["'${STACK_NAME}'"].RedisEndpoint')"
    echo "MindsDB Internal Endpoint: $(cat outputs.json | jq -r '.["'${STACK_NAME}'"].MindsDBInternalEndpoint')"
    
    echo ""
    echo "🔍 Next Steps:"
    echo "1. Wait for MindsDB service to be healthy (check ECS console)"
    echo "2. Test MindsDB API endpoint: curl \${MindsDBInternalEndpoint}/api/status"
    echo "3. Configure predictors using MindsDB Studio or API"
    echo "4. Deploy application services that will consume MindsDB"
    
else
    echo "❌ Deployment failed!"
    exit 1
fi