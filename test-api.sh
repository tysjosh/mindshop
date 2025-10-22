#!/bin/bash

# MindsDB RAG Assistant - Comprehensive Local API Testing Script

BASE_URL="http://localhost:3000"
AUTH_TOKEN="dev_user_123:test-merchant-123"
MERCHANT_ID="test-merchant-123"
USER_ID="test-user-456"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local auth_required=${5:-true}
    
    print_test "Testing: $description"
    
    if [ "$auth_required" = "false" ]; then
        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $AUTH_TOKEN")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $AUTH_TOKEN" \
                -d "$data")
        fi
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        print_success "$description - HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        print_error "$description - HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

echo "🚀 MindsDB RAG Assistant - Comprehensive API Testing"
echo "=================================================="

# 1. HEALTH ENDPOINTS (No Auth Required)
echo -e "\n${YELLOW}📊 HEALTH & STATUS ENDPOINTS${NC}"
test_endpoint "GET" "/health" "" "System Health Check" false
test_endpoint "GET" "/ready" "" "Readiness Probe" false
test_endpoint "GET" "/live" "" "Liveness Probe" false
test_endpoint "GET" "/startup" "" "Startup Probe" false
test_endpoint "GET" "/api" "" "API Information" false
test_endpoint "GET" "/api/docs" "" "API Documentation" false

# 2. BEDROCK AGENT ENDPOINTS
echo -e "\n${YELLOW}🤖 BEDROCK AGENT ENDPOINTS${NC}"
test_endpoint "GET" "/api/bedrock-agent/health" "" "Bedrock Agent Health" false

test_endpoint "POST" "/api/bedrock-agent/chat" '{
    "query": "Hello, how can you help me with my e-commerce store?",
    "merchant_id": "'$MERCHANT_ID'",
    "user_id": "'$USER_ID'"
}' "Bedrock Agent Chat"

test_endpoint "POST" "/api/bedrock-agent/sessions" '{
    "merchant_id": "'$MERCHANT_ID'",
    "user_id": "'$USER_ID'",
    "context": {"store_type": "electronics"}
}' "Create Bedrock Session"

test_endpoint "POST" "/api/bedrock-agent/parse-intent" '{
    "query": "I want to buy a laptop",
    "merchant_id": "'$MERCHANT_ID'"
}' "Parse User Intent"

# 3. CHAT ENDPOINTS
echo -e "\n${YELLOW}💬 CHAT ENDPOINTS${NC}"
test_endpoint "GET" "/api/chat/health" "" "Chat Service Health" false

test_endpoint "POST" "/api/chat/chat" '{
    "query": "What products do you recommend?",
    "merchantId": "'$MERCHANT_ID'",
    "userId": "'$USER_ID'"
}' "Chat Query"

test_endpoint "GET" "/api/chat/analytics?merchantId=$MERCHANT_ID" "" "Chat Analytics"

# 4. DOCUMENT MANAGEMENT ENDPOINTS
echo -e "\n${YELLOW}📄 DOCUMENT MANAGEMENT ENDPOINTS${NC}"

# RAG System Management
test_endpoint "POST" "/api/merchants/$MERCHANT_ID/rag/initialize" '{
    "openaiApiKey": "test-key-for-demo"
}' "Initialize RAG System"

test_endpoint "GET" "/api/merchants/$MERCHANT_ID/rag/status" "" "RAG System Status"

# Document Operations
test_endpoint "POST" "/api/merchants/$MERCHANT_ID/documents" '{
    "content": "This is a test product description for a laptop computer.",
    "title": "Laptop Product Info",
    "source": "api_test",
    "document_type": "product"
}' "Ingest Document"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/documents/url" '{
    "url": "https://example.com/product-info",
    "title": "External Product Info"
}' "Ingest Document from URL"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/documents/search" '{
    "query": "laptop computer",
    "limit": 5
}' "Search Documents"

test_endpoint "GET" "/api/merchants/$MERCHANT_ID/documents/stats" "" "Document Statistics"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/rag/ask" '{
    "question": "What laptops do you have available?"
}' "Ask RAG Question"

test_endpoint "GET" "/api/health" "" "Document Service Health" false

# 5. SEMANTIC RETRIEVAL ENDPOINTS
echo -e "\n${YELLOW}🔍 SEMANTIC RETRIEVAL ENDPOINTS${NC}"
test_endpoint "GET" "/api/semantic-retrieval/health" "" "Semantic Retrieval Health" false

test_endpoint "POST" "/api/semantic-retrieval/deploy" '{
    "merchantId": "'$MERCHANT_ID'"
}' "Deploy Semantic Retriever"

test_endpoint "POST" "/api/semantic-retrieval/search" '{
    "query": "laptop specifications",
    "merchantId": "'$MERCHANT_ID'",
    "limit": 5,
    "threshold": 0.7
}' "Semantic Search"

test_endpoint "POST" "/api/semantic-retrieval/rest-search" '{
    "query": "product recommendations",
    "merchantId": "'$MERCHANT_ID'",
    "limit": 3
}' "REST Semantic Search"

test_endpoint "GET" "/api/semantic-retrieval/status/$MERCHANT_ID" "" "Semantic Retrieval Status"

# 6. SESSION MANAGEMENT ENDPOINTS
echo -e "\n${YELLOW}🔄 SESSION MANAGEMENT ENDPOINTS${NC}"
test_endpoint "GET" "/api/sessions/health" "" "Session Service Health" false

test_endpoint "POST" "/api/sessions" '{
    "merchantId": "'$MERCHANT_ID'",
    "userId": "'$USER_ID'",
    "context": {"session_type": "shopping"}
}' "Create Session"

test_endpoint "GET" "/api/sessions/analytics?merchantId=$MERCHANT_ID" "" "Session Analytics"

test_endpoint "GET" "/api/sessions/billing?merchantId=$MERCHANT_ID" "" "Session Billing Info"

test_endpoint "POST" "/api/sessions/track-usage" '{
    "merchantId": "'$MERCHANT_ID'",
    "sessionId": "test-session-123",
    "usage": {"tokens": 100, "requests": 5}
}' "Track Usage"

# 7. BEDROCK INTEGRATION ENDPOINTS
echo -e "\n${YELLOW}🧠 BEDROCK INTEGRATION ENDPOINTS${NC}"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/bedrock/initialize" '{
    "modelId": "amazon.nova-micro-v1:0",
    "config": {"temperature": 0.7}
}' "Initialize Bedrock Integration"

test_endpoint "GET" "/api/merchants/$MERCHANT_ID/bedrock/status" "" "Bedrock Integration Status"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/bedrock/ask" '{
    "question": "What are your best selling products?"
}' "Ask Bedrock Question"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/bedrock/query" '{
    "query": "SELECT * FROM products WHERE category = electronics",
    "context": {"use_ai": true}
}' "Bedrock Query"

test_endpoint "GET" "/api/bedrock/models" "" "Available Bedrock Models"

test_endpoint "POST" "/api/merchants/$MERCHANT_ID/bedrock/test" '{
    "testType": "connection"
}' "Test Bedrock Connection"

# 8. CHECKOUT ENDPOINTS
echo -e "\n${YELLOW}🛒 CHECKOUT ENDPOINTS${NC}"
test_endpoint "GET" "/api/checkout/health" "" "Checkout Service Health" false

test_endpoint "POST" "/api/checkout/process" '{
    "merchant_id": "'$MERCHANT_ID'",
    "user_id": "'$USER_ID'",
    "session_id": "test-session-123",
    "items": [
        {
            "sku": "LAPTOP001",
            "quantity": 1,
            "price": 999.99,
            "name": "Gaming Laptop",
            "description": "High-performance gaming laptop"
        }
    ],
    "payment_method": "default",
    "shipping_address": {
        "name": "Test User",
        "address_line_1": "123 Test St",
        "city": "Test City",
        "state": "Test State",
        "postal_code": "12345",
        "country": "US"
    },
    "user_consent": {
        "terms_accepted": true,
        "privacy_accepted": true,
        "consent_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }
}' "Process Checkout"

# Summary
echo -e "\n${GREEN}🎉 API Testing Complete!${NC}"
echo "=================================================="
echo "📊 All available endpoints have been tested"
echo "🔍 Check the output above for any failures"
echo "📝 Successful responses show JSON data"
echo "❌ Failed responses show error messages"
echo ""
echo "💡 Tips:"
echo "  - Green ✅ = Success (HTTP 2xx)"
echo "  - Red ❌ = Error (HTTP 4xx/5xx)"
echo "  - Some endpoints may fail if services aren't running"
echo "  - Auth token: $AUTH_TOKEN"
echo ""