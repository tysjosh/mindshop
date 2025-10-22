#!/bin/bash

# Deploy Document Ingestion Pipeline Infrastructure
# This script deploys the S3 bucket, Lambda functions, and Step Functions state machine

set -e

# Configuration
ENVIRONMENT=${1:-dev}
MERCHANT_ID=${2:-default}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="DocumentIngestionStack-${ENVIRONMENT}"

echo "Deploying Document Ingestion Pipeline for environment: ${ENVIRONMENT}"
echo "Merchant ID: ${MERCHANT_ID}"
echo "AWS Region: ${AWS_REGION}"
echo "Stack Name: ${STACK_NAME}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "Error: AWS CDK is not installed"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured"
    echo "Configure with: aws configure"
    exit 1
fi

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

# Bootstrap CDK if needed
echo "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region ${AWS_REGION} &> /dev/null; then
    echo "Bootstrapping CDK..."
    cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/${AWS_REGION}
fi

# Deploy the infrastructure
echo "Deploying infrastructure..."
cd infrastructure

# Install CDK dependencies
npm install

# Deploy the stack
cdk deploy ${STACK_NAME} \
    --context environment=${ENVIRONMENT} \
    --context merchantId=${MERCHANT_ID} \
    --require-approval never \
    --outputs-file ../outputs-${ENVIRONMENT}.json

cd ..

# Extract outputs
if [ -f "outputs-${ENVIRONMENT}.json" ]; then
    echo "Deployment outputs:"
    cat "outputs-${ENVIRONMENT}.json"
    
    # Extract key values for environment variables
    DOCUMENT_BUCKET=$(jq -r ".\"${STACK_NAME}\".DocumentBucketName" "outputs-${ENVIRONMENT}.json")
    INGESTION_LAMBDA_ARN=$(jq -r ".\"${STACK_NAME}\".IngestionLambdaArn" "outputs-${ENVIRONMENT}.json")
    STATE_MACHINE_ARN=$(jq -r ".\"${STACK_NAME}\".StateMachineArn" "outputs-${ENVIRONMENT}.json")
    SUCCESS_TOPIC_ARN=$(jq -r ".\"${STACK_NAME}\".SuccessTopicArn" "outputs-${ENVIRONMENT}.json")
    
    # Create environment file
    cat > ".env.${ENVIRONMENT}" << EOF
# Document Ingestion Pipeline Configuration
DOCUMENT_BUCKET=${DOCUMENT_BUCKET}
DOCUMENT_INGESTION_LAMBDA_ARN=${INGESTION_LAMBDA_ARN}
DOCUMENT_INGESTION_STATE_MACHINE_ARN=${STATE_MACHINE_ARN}
SUCCESS_TOPIC_ARN=${SUCCESS_TOPIC_ARN}
AWS_REGION=${AWS_REGION}
ENVIRONMENT=${ENVIRONMENT}
MERCHANT_ID=${MERCHANT_ID}
EOF
    
    echo "Environment configuration saved to .env.${ENVIRONMENT}"
fi

# Test the deployment
echo "Testing deployment..."

# Test S3 bucket access
if aws s3 ls "s3://${DOCUMENT_BUCKET}" &> /dev/null; then
    echo "✓ S3 bucket accessible"
else
    echo "✗ S3 bucket not accessible"
fi

# Test Lambda function
if aws lambda get-function --function-name "document-ingestion-${ENVIRONMENT}" --region ${AWS_REGION} &> /dev/null; then
    echo "✓ Lambda function deployed"
else
    echo "✗ Lambda function not found"
fi

# Test Step Functions state machine
if aws stepfunctions describe-state-machine --state-machine-arn "${STATE_MACHINE_ARN}" --region ${AWS_REGION} &> /dev/null; then
    echo "✓ Step Functions state machine deployed"
else
    echo "✗ Step Functions state machine not found"
fi

echo "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your application configuration with the new environment variables"
echo "2. Test document upload to S3 bucket: ${DOCUMENT_BUCKET}"
echo "3. Monitor CloudWatch logs for processing status"
echo ""
echo "To upload a test document:"
echo "aws s3 cp test-document.json s3://${DOCUMENT_BUCKET}/documents/${MERCHANT_ID}/products/test-document.json"