#!/bin/bash

# Setup Bedrock Integration for MindsDB RAG Assistant
# This script sets up the direct MindsDB-Bedrock integration

set -e

echo "🚀 Setting up MindsDB-Bedrock Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_aws_credentials() {
    print_status "Checking AWS credentials..."
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        print_warning "AWS credentials not found in environment variables"
        print_status "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        print_status "You can also provide them when initializing Bedrock integration via API"
    else
        print_success "AWS credentials found in environment"
    fi
}

# Check if MindsDB is running
check_mindsdb() {
    print_status "Checking MindsDB connection..."
    
    MINDSDB_HOST=${MINDSDB_HOST:-localhost}
    MINDSDB_PORT=${MINDSDB_PORT:-47334}
    
    if curl -s "http://${MINDSDB_HOST}:${MINDSDB_PORT}/api/sql/query" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"query": "SELECT 1"}' > /dev/null 2>&1; then
        print_success "MindsDB is running and accessible"
    else
        print_error "MindsDB is not accessible at http://${MINDSDB_HOST}:${MINDSDB_PORT}"
        print_status "Please start MindsDB first using: ./scripts/setup-mindsdb-local.sh"
        exit 1
    fi
}

# Check if Bedrock handler is available in MindsDB
check_bedrock_handler() {
    print_status "Checking Bedrock handler availability..."
    
    MINDSDB_HOST=${MINDSDB_HOST:-localhost}
    MINDSDB_PORT=${MINDSDB_PORT:-47334}
    
    # Query for available handlers
    RESPONSE=$(curl -s "http://${MINDSDB_HOST}:${MINDSDB_PORT}/api/sql/query" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"query": "SHOW HANDLERS WHERE name = \"bedrock\""}')
    
    if echo "$RESPONSE" | grep -q '"bedrock"'; then
        print_success "Bedrock handler is available in MindsDB"
    else
        print_warning "Bedrock handler not found in MindsDB"
        print_status "The handler might not be installed or enabled"
        print_status "You can still use the integration, but Bedrock features may not work"
    fi
}

# Test the application endpoints
test_endpoints() {
    print_status "Testing Bedrock integration endpoints..."
    
    APP_HOST=${APP_HOST:-localhost}
    APP_PORT=${APP_PORT:-3000}
    
    # Test health endpoint
    if curl -s "http://${APP_HOST}:${APP_PORT}/api/health" > /dev/null 2>&1; then
        print_success "Application is running and accessible"
        
        # Test Bedrock models endpoint
        if curl -s "http://${APP_HOST}:${APP_PORT}/api/bedrock/models" > /dev/null 2>&1; then
            print_success "Bedrock integration endpoints are accessible"
        else
            print_warning "Bedrock integration endpoints not accessible"
            print_status "Make sure the application is fully started"
        fi
    else
        print_warning "Application not running at http://${APP_HOST}:${APP_PORT}"
        print_status "Start the application with: npm run dev"
    fi
}

# Create example configuration file
create_example_config() {
    print_status "Creating example Bedrock configuration..."
    
    cat > bedrock-integration-example.json << EOF
{
  "merchantId": "demo-merchant",
  "awsCredentials": {
    "awsAccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
    "awsSecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
    "awsSessionToken": "YOUR_AWS_SESSION_TOKEN (optional)",
    "awsRegion": "us-east-1"
  },
  "bedrockConfig": {
    "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
    "mode": "default",
    "maxTokens": 4000,
    "temperature": 0.1
  }
}
EOF
    
    print_success "Created bedrock-integration-example.json"
}

# Create test script
create_test_script() {
    print_status "Creating Bedrock integration test script..."
    
    cat > test-bedrock-integration.sh << 'EOF'
#!/bin/bash

# Test Bedrock Integration
# Usage: ./test-bedrock-integration.sh [merchant-id]

MERCHANT_ID=${1:-demo-merchant}
APP_HOST=${APP_HOST:-localhost}
APP_PORT=${APP_PORT:-3000}
BASE_URL="http://${APP_HOST}:${APP_PORT}/api"

echo "🧪 Testing Bedrock Integration for merchant: $MERCHANT_ID"

# Test 1: Check Bedrock models
echo "\n1. Listing available Bedrock models..."
curl -s "$BASE_URL/bedrock/models" | jq '.' || echo "Failed to list models"

# Test 2: Check integration status
echo "\n2. Checking Bedrock integration status..."
curl -s "$BASE_URL/merchants/$MERCHANT_ID/bedrock/status" | jq '.' || echo "No integration found"

# Test 3: Test integration (if configured)
echo "\n3. Testing Bedrock integration..."
curl -s -X POST "$BASE_URL/merchants/$MERCHANT_ID/bedrock/test" \
  -H "Content-Type: application/json" \
  -d '{"testQuery": "Hello, can you help me test the integration?"}' | jq '.' || echo "Test failed"

echo "\n✅ Bedrock integration test completed"
EOF
    
    chmod +x test-bedrock-integration.sh
    print_success "Created test-bedrock-integration.sh"
}

# Main setup function
main() {
    echo "🚀 MindsDB-Bedrock Integration Setup"
    echo "===================================="
    
    check_aws_credentials
    check_mindsdb
    check_bedrock_handler
    test_endpoints
    create_example_config
    create_test_script
    
    echo ""
    print_success "Bedrock integration setup completed!"
    echo ""
    print_status "Next steps:"
    echo "  1. Update bedrock-integration-example.json with your AWS credentials"
    echo "  2. Initialize Bedrock integration for a merchant:"
    echo "     curl -X POST http://localhost:3000/api/merchants/demo-merchant/bedrock/initialize \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d @bedrock-integration-example.json"
    echo "  3. Test the integration:"
    echo "     ./test-bedrock-integration.sh demo-merchant"
    echo "  4. Use the intelligent query router:"
    echo "     curl -X POST http://localhost:3000/api/merchants/demo-merchant/bedrock/ask \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"question\": \"How do I return a product?\"}'"
    echo ""
    print_status "📚 Documentation: Check README.md for complete API documentation"
}

# Run main function
main "$@"