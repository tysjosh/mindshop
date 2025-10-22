#!/bin/bash

# Create Lambda packages script
echo "Creating minimal Lambda packages..."

# Function to create a Lambda package
create_package() {
    local handler_name=$1
    local source_file=$2
    local dependencies=$3
    
    echo "Creating package for $handler_name..."
    
    # Create directory
    mkdir -p "lambda-functions/$handler_name"
    
    # Create package.json
    cat > "lambda-functions/$handler_name/package.json" << EOF
{
  "name": "$handler_name",
  "version": "1.0.0",
  "dependencies": $dependencies
}
EOF
    
    # Copy handler file
    cp "dist/lambda/$source_file" "lambda-functions/$handler_name/index.js"
    
    # Install dependencies
    cd "lambda-functions/$handler_name"
    npm install --omit=dev --silent
    cd ../..
    
    # Create zip
    zip -r "lambda-functions/$handler_name.zip" "lambda-functions/$handler_name/" > /dev/null
    
    # Show size
    echo "✅ $handler_name: $(ls -lh lambda-functions/$handler_name.zip | awk '{print $5}')"
}

# Create packages for remaining handlers
create_package "bedrock-handler" "bedrockHandler.js" '{
    "@aws-sdk/client-bedrock-runtime": "^3.400.0",
    "@aws-sdk/client-bedrock-agent-runtime": "^3.400.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0"
}'

create_package "semantic-handler" "semanticRetrievalHandler.js" '{
    "@aws-sdk/client-bedrock-runtime": "^3.400.0",
    "@aws-sdk/client-s3": "3.907.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0"
}'

create_package "checkout-handler" "checkoutHandler.js" '{
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0"
}'

create_package "bedrock-tools-handler" "bedrockToolsHandler.js" '{
    "@aws-sdk/client-bedrock-agent-runtime": "^3.400.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0"
}'

create_package "doc-ingestion-handler" "documentIngestionHandler.js" '{
    "@aws-sdk/client-s3": "3.907.0",
    "@aws-sdk/client-sfn": "3.907.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0"
}'

echo ""
echo "📦 All Lambda packages created:"
ls -lh lambda-functions/*.zip

echo ""
echo "🎯 Next steps:"
echo "1. Upload each .zip file to its corresponding Lambda function"
echo "2. Set Handler to 'index.handler' for each function"
echo "3. Test each function"