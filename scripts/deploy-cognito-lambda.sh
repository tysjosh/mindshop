#!/bin/bash

# Deploy Cognito Lambda Functions
# This script packages and deploys Cognito Lambda functions to AWS
# Supports: post-confirmation, pre-token-generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for function type argument
if [ -z "$1" ]; then
  echo -e "${YELLOW}Usage: $0 [post-confirmation|pre-token-generation]${NC}"
  echo ""
  echo "Examples:"
  echo "  $0 post-confirmation     # Deploy Post-Confirmation Lambda"
  echo "  $0 pre-token-generation  # Deploy Pre-Token-Generation Lambda"
  exit 1
fi

LAMBDA_TYPE="$1"

# Configuration based on Lambda type
case "$LAMBDA_TYPE" in
  "post-confirmation")
    FUNCTION_NAME="cognito-post-confirmation"
    TIMEOUT=30
    MEMORY_SIZE=256
    REQUIRES_DB=true
    TRIGGER_NAME="PostConfirmation"
    ;;
  "pre-token-generation")
    FUNCTION_NAME="cognito-pre-token-generation"
    TIMEOUT=10
    MEMORY_SIZE=128
    REQUIRES_DB=false
    TRIGGER_NAME="PreTokenGeneration"
    ;;
  *)
    echo -e "${RED}Error: Invalid Lambda type: $LAMBDA_TYPE${NC}"
    echo -e "${YELLOW}Valid options: post-confirmation, pre-token-generation${NC}"
    exit 1
    ;;
esac

LAMBDA_DIR="lambda-functions/${FUNCTION_NAME}"
ZIP_FILE="${FUNCTION_NAME}.zip"
RUNTIME="nodejs18.x"
HANDLER="index.handler"

echo -e "${GREEN}=== Cognito ${LAMBDA_TYPE} Lambda Deployment ===${NC}"
echo ""

# Check if Lambda directory exists
if [ ! -d "$LAMBDA_DIR" ]; then
  echo -e "${RED}Error: Lambda directory not found: $LAMBDA_DIR${NC}"
  exit 1
fi

# Check for required environment variables
if [ -z "$AWS_REGION" ]; then
  echo -e "${YELLOW}Warning: AWS_REGION not set, using default: us-east-2${NC}"
  AWS_REGION="us-east-2"
fi

# Load environment variables from .env if it exists
if [ -f .env ]; then
  echo -e "${GREEN}Loading environment variables from .env${NC}"
  export $(grep -v '^#' .env | xargs)
fi

# Check for required database environment variables (only for post-confirmation)
if [ "$REQUIRES_DB" = true ]; then
  REQUIRED_VARS=("DB_HOST" "DB_NAME" "DB_USER" "DB_PASSWORD")
  MISSING_VARS=()

  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      MISSING_VARS+=("$var")
    fi
  done

  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
      echo -e "${RED}  - $var${NC}"
    done
    echo ""
    echo "Please set these variables in your .env file or environment"
    exit 1
  fi
fi

# Step 1: Install dependencies
echo -e "${GREEN}Step 1: Installing dependencies...${NC}"
cd "$LAMBDA_DIR"
npm install --production
cd - > /dev/null

# Step 2: Package Lambda function
echo -e "${GREEN}Step 2: Packaging Lambda function...${NC}"
cd "$LAMBDA_DIR"
rm -f "../${ZIP_FILE}"
zip -r "../${ZIP_FILE}" . -x "*.git*" "*.DS_Store" "README.md" "test-event.json"
cd - > /dev/null

echo -e "${GREEN}Package created: lambda-functions/${ZIP_FILE}${NC}"
echo ""

# Step 3: Check if Lambda function exists
echo -e "${GREEN}Step 3: Checking if Lambda function exists...${NC}"
FUNCTION_EXISTS=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$AWS_REGION" 2>&1 || true)

if echo "$FUNCTION_EXISTS" | grep -q "ResourceNotFoundException"; then
  echo -e "${YELLOW}Lambda function does not exist. Creating new function...${NC}"
  
  # Prompt for Lambda execution role ARN
  if [ -z "$LAMBDA_EXECUTION_ROLE_ARN" ]; then
    echo -e "${YELLOW}Please enter the Lambda execution role ARN:${NC}"
    read -r LAMBDA_EXECUTION_ROLE_ARN
  fi
  
  # Create Lambda function with environment variables based on type
  if [ "$REQUIRES_DB" = true ]; then
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime "$RUNTIME" \
      --role "$LAMBDA_EXECUTION_ROLE_ARN" \
      --handler "$HANDLER" \
      --zip-file "fileb://lambda-functions/${ZIP_FILE}" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY_SIZE" \
      --region "$AWS_REGION" \
      --environment "Variables={
        DB_HOST=${DB_HOST},
        DB_NAME=${DB_NAME},
        DB_USER=${DB_USER},
        DB_PASSWORD=${DB_PASSWORD},
        DB_PORT=${DB_PORT:-5432},
        DB_SSL=${DB_SSL:-true},
        AWS_REGION=${AWS_REGION}
      }" \
      --description "Cognito ${LAMBDA_TYPE} trigger"
  else
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime "$RUNTIME" \
      --role "$LAMBDA_EXECUTION_ROLE_ARN" \
      --handler "$HANDLER" \
      --zip-file "fileb://lambda-functions/${ZIP_FILE}" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY_SIZE" \
      --region "$AWS_REGION" \
      --description "Cognito ${LAMBDA_TYPE} trigger"
  fi
  
  echo -e "${GREEN}Lambda function created successfully!${NC}"
else
  echo -e "${YELLOW}Lambda function exists. Updating function code...${NC}"
  
  # Update Lambda function code
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://lambda-functions/${ZIP_FILE}" \
    --region "$AWS_REGION"
  
  echo -e "${GREEN}Waiting for function update to complete...${NC}"
  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region "$AWS_REGION"
  
  # Update Lambda function configuration based on type
  echo -e "${GREEN}Updating function configuration...${NC}"
  if [ "$REQUIRES_DB" = true ]; then
    aws lambda update-function-configuration \
      --function-name "$FUNCTION_NAME" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY_SIZE" \
      --region "$AWS_REGION" \
      --environment "Variables={
        DB_HOST=${DB_HOST},
        DB_NAME=${DB_NAME},
        DB_USER=${DB_USER},
        DB_PASSWORD=${DB_PASSWORD},
        DB_PORT=${DB_PORT:-5432},
        DB_SSL=${DB_SSL:-true},
        AWS_REGION=${AWS_REGION}
      }"
  else
    aws lambda update-function-configuration \
      --function-name "$FUNCTION_NAME" \
      --timeout "$TIMEOUT" \
      --memory-size "$MEMORY_SIZE" \
      --region "$AWS_REGION"
  fi
  
  echo -e "${GREEN}Lambda function updated successfully!${NC}"
fi

echo ""

# Step 4: Get Lambda function ARN
echo -e "${GREEN}Step 4: Getting Lambda function ARN...${NC}"
LAMBDA_ARN=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query 'Configuration.FunctionArn' \
  --output text)

echo -e "${GREEN}Lambda ARN: ${LAMBDA_ARN}${NC}"
echo ""

# Step 5: Attach to Cognito User Pool (optional)
echo -e "${YELLOW}Step 5: Attach Lambda to Cognito User Pool${NC}"
echo ""
echo "To attach this Lambda function to your Cognito User Pool, run:"
echo ""
echo -e "${GREEN}aws cognito-idp update-user-pool \\${NC}"
echo -e "${GREEN}  --user-pool-id YOUR_USER_POOL_ID \\${NC}"
echo -e "${GREEN}  --lambda-config ${TRIGGER_NAME}=${LAMBDA_ARN} \\${NC}"
echo -e "${GREEN}  --region ${AWS_REGION}${NC}"
echo ""
echo "Or use the AWS Console:"
echo "1. Go to Cognito User Pool"
echo "2. Navigate to 'Triggers' tab"
echo "3. Select '${LAMBDA_TYPE}' trigger"
echo "4. Choose the '${FUNCTION_NAME}' Lambda function"
echo ""

# Step 6: Test the Lambda function (optional)
echo -e "${YELLOW}Step 6: Test the Lambda function (optional)${NC}"
echo ""
echo "To test the Lambda function, create a test event and run:"
echo ""
echo -e "${GREEN}aws lambda invoke \\${NC}"
echo -e "${GREEN}  --function-name ${FUNCTION_NAME} \\${NC}"
echo -e "${GREEN}  --payload file://test-event.json \\${NC}"
echo -e "${GREEN}  --region ${AWS_REGION} \\${NC}"
echo -e "${GREEN}  response.json${NC}"
echo ""

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Lambda Function: ${FUNCTION_NAME}"
echo "Region: ${AWS_REGION}"
echo "ARN: ${LAMBDA_ARN}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Attach the Lambda function to your Cognito User Pool"
echo "2. Test the function with a sample user registration"
echo "3. Monitor CloudWatch logs for any errors"
echo ""
