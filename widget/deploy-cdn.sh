#!/bin/bash

# RAG Assistant Widget - CDN Deployment Script
# This script builds and deploys the widget to AWS CloudFront CDN

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_PROFILE=${AWS_PROFILE:-default}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RAG Assistant Widget - CDN Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "AWS Region: ${YELLOW}${AWS_REGION}${NC}"
echo -e "AWS Profile: ${YELLOW}${AWS_PROFILE}${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
  echo -e "${RED}Error: Invalid environment. Must be development, staging, or production${NC}"
  exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: AWS CLI is not installed${NC}"
  echo "Install it from: https://aws.amazon.com/cli/"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}Warning: jq is not installed. Some features may not work.${NC}"
  echo "Install it from: https://stedolan.github.io/jq/"
fi

# Step 1: Build the widget
echo -e "${GREEN}Step 1: Building widget...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Build failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 2: Get CloudFront distribution info from CDK outputs
echo -e "${GREEN}Step 2: Getting CDN configuration...${NC}"

STACK_NAME="rag-widget-cdn-${ENVIRONMENT}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" 2>/dev/null)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" 2>/dev/null)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
  echo -e "${RED}Error: CDN stack not found. Please deploy the infrastructure first:${NC}"
  echo ""
  echo "  cd infrastructure/cdk"
  echo "  npm run cdk deploy rag-widget-cdn-${ENVIRONMENT}"
  echo ""
  exit 1
fi

echo -e "Bucket: ${YELLOW}${BUCKET_NAME}${NC}"
echo -e "Distribution: ${YELLOW}${DISTRIBUTION_ID}${NC}"
echo ""

# Step 3: Upload files to S3
echo -e "${GREEN}Step 3: Uploading files to S3...${NC}"

# Create version directory
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +%Y%m%d%H%M%S)
VERSION_PATH="v${VERSION}"

echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo ""

# Upload versioned files
aws s3 sync dist/ "s3://${BUCKET_NAME}/${VERSION_PATH}/" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata "version=${VERSION},timestamp=${TIMESTAMP}"

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: S3 upload failed${NC}"
  exit 1
fi

# Upload to latest (for v1/widget.js)
aws s3 sync dist/ "s3://${BUCKET_NAME}/v1/" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --delete \
  --cache-control "public, max-age=3600" \
  --metadata "version=${VERSION},timestamp=${TIMESTAMP}"

# Upload to root (for backward compatibility)
aws s3 cp dist/widget.min.js "s3://${BUCKET_NAME}/widget.js" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --cache-control "public, max-age=3600" \
  --metadata "version=${VERSION},timestamp=${TIMESTAMP}"

echo -e "${GREEN}✓ Files uploaded to S3${NC}"
echo ""

# Step 4: Create invalidation
echo -e "${GREEN}Step 4: Creating CloudFront invalidation...${NC}"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/v1/*" "/widget.js" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Invalidation.Id' \
  --output text)

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: CloudFront invalidation failed${NC}"
  exit 1
fi

echo -e "Invalidation ID: ${YELLOW}${INVALIDATION_ID}${NC}"
echo -e "${GREEN}✓ Invalidation created${NC}"
echo ""

# Step 5: Get CDN URL
CDN_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CdnUrl'].OutputValue" \
  --output text \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE")

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Widget URLs:"
echo -e "  Latest:    ${YELLOW}${CDN_URL}/v1/widget.js${NC}"
echo -e "  Versioned: ${YELLOW}${CDN_URL}/${VERSION_PATH}/widget.min.js${NC}"
echo -e "  Legacy:    ${YELLOW}${CDN_URL}/widget.js${NC}"
echo ""
echo -e "Embed code:"
echo -e "${YELLOW}<script src=\"${CDN_URL}/v1/widget.js\"></script>${NC}"
echo ""
echo -e "Note: CloudFront invalidation may take 5-10 minutes to complete."
echo -e "Check status: aws cloudfront get-invalidation --distribution-id ${DISTRIBUTION_ID} --id ${INVALIDATION_ID}"
echo ""
