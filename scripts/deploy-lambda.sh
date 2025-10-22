#!/bin/bash

# MindsDB RAG Assistant - Lambda Deployment Script
# This script builds your TypeScript code and packages it for AWS Lambda deployment

set -e

echo "🚀 Starting Lambda deployment process..."

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf lambda-packages/
mkdir -p lambda-packages

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript code
echo "🔨 Building TypeScript code..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: TypeScript build failed - dist directory not found"
    exit 1
fi

echo "✅ TypeScript build completed successfully"

# Create Lambda packages directory
mkdir -p lambda-packages

# Function to create Lambda package
create_lambda_package() {
    local handler_name=$1
    local handler_path=$2
    local package_name=$3
    
    echo "📦 Creating Lambda package for ${handler_name}..."
    
    # Create temporary directory for this Lambda
    local temp_dir="lambda-packages/temp-${package_name}"
    mkdir -p "${temp_dir}"
    
    # Copy compiled code
    cp -r dist/* "${temp_dir}/"
    
    # Create minimal package.json for Lambda
    cat > "${temp_dir}/package.json" << EOF
{
  "name": "mindsdb-rag-${package_name}",
  "version": "1.0.0",
  "main": "${handler_path}",
  "dependencies": {
    "node-fetch": "^2.6.7"
  }
}
EOF
    
    # Install only production dependencies
    cd "${temp_dir}"
    npm install --only=production --no-package-lock
    cd - > /dev/null
    
    # Create ZIP package
    cd "${temp_dir}"
    zip -r "../${package_name}-lambda.zip" . -x "*.git*" "*.DS_Store*" "node_modules/.cache/*"
    cd - > /dev/null
    
    # Clean up temp directory
    rm -rf "${temp_dir}"
    
    echo "✅ Created ${package_name}-lambda.zip ($(du -h lambda-packages/${package_name}-lambda.zip | cut -f1))"
}

# Create Lambda packages for each handler
echo "📦 Creating Lambda deployment packages..."

# Core API Handlers
create_lambda_package "Chat Handler" "lambda/chatHandler.handler" "chat-api"
create_lambda_package "Documents Handler" "lambda/documentsHandler.handler" "documents-api"
create_lambda_package "Bedrock Handler" "lambda/bedrockHandler.handler" "bedrock-api"
create_lambda_package "Semantic Retrieval Handler" "lambda/semanticRetrievalHandler.handler" "semantic-api"
create_lambda_package "Checkout Handler" "lambda/checkoutHandler.handler" "checkout-api"

# Specialized Handlers
create_lambda_package "Bedrock Tools Handler" "lambda/bedrockToolsHandler.handler" "bedrock-tools"
create_lambda_package "Document Ingestion Handler" "lambda/documentIngestionHandler.handler" "doc-ingestion"

# Health Handler (simple, no services needed)
echo "📦 Creating simple health handler package..."
mkdir -p lambda-packages/temp-health
cat > lambda-packages/temp-health/index.js << 'EOF'
exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'MindsDB RAG Assistant',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        })
    };
};
EOF

cd lambda-packages/temp-health
zip -r "../health-api-lambda.zip" .
cd - > /dev/null
rm -rf lambda-packages/temp-health

echo "✅ Created health-api-lambda.zip"

# Create deployment summary
echo ""
echo "🎉 Lambda deployment packages created successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "├── lambda-packages/"
echo "│   ├── chat-api-lambda.zip          (Main chat functionality)"
echo "│   ├── documents-api-lambda.zip     (Document management)"
echo "│   ├── bedrock-api-lambda.zip       (AI agent operations)"
echo "│   ├── semantic-api-lambda.zip      (Semantic search)"
echo "│   ├── checkout-api-lambda.zip      (E-commerce checkout)"
echo "│   ├── bedrock-tools-lambda.zip     (Bedrock agent tools)"
echo "│   ├── doc-ingestion-lambda.zip     (Document processing)"
echo "│   └── health-api-lambda.zip        (Health checks)"
echo ""

# Calculate total size
total_size=$(du -sh lambda-packages/ | cut -f1)
echo "📊 Total package size: ${total_size}"

# Check package sizes (Lambda has 50MB zipped limit)
echo ""
echo "📏 Package size check:"
for zip_file in lambda-packages/*.zip; do
    size=$(du -h "$zip_file" | cut -f1)
    filename=$(basename "$zip_file")
    
    # Convert size to MB for comparison
    size_mb=$(du -m "$zip_file" | cut -f1)
    
    if [ "$size_mb" -gt 50 ]; then
        echo "⚠️  ${filename}: ${size} (WARNING: Exceeds 50MB Lambda limit)"
    elif [ "$size_mb" -gt 30 ]; then
        echo "🟡 ${filename}: ${size} (Large package)"
    else
        echo "✅ ${filename}: ${size}"
    fi
done

echo ""
echo "🚀 Next Steps:"
echo "1. Upload these ZIP files to your Lambda functions in AWS Console"
echo "2. Set the correct handler for each function:"
echo "   - chat-api: lambda/chatHandler.handler"
echo "   - documents-api: lambda/documentsHandler.handler"
echo "   - bedrock-api: lambda/bedrockHandler.handler"
echo "   - semantic-api: lambda/semanticRetrievalHandler.handler"
echo "   - checkout-api: lambda/checkoutHandler.handler"
echo "   - bedrock-tools: lambda/bedrockToolsHandler.handler"
echo "   - doc-ingestion: lambda/documentIngestionHandler.handler"
echo "   - health-api: index.handler"
echo ""
echo "3. Configure environment variables for each Lambda function"
echo "4. Test the functions using the AWS Lambda console"
echo ""
echo "✨ Your sophisticated RAG assistant is ready for deployment!"