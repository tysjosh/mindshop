#!/bin/bash

# API Testing Script for Local Development
# Tests endpoints that work without external dependencies

set -e

# Configuration
BASE_URL="http://localhost:3000"
TOKEN="dev_user_123:test_merchant_456"
MERCHANT_ID="test_merchant_456"
MERCHANT_UUID="550e8400-e29b-41d4-a716-446655440000"  # Valid UUID for bedrock-agent
USER_ID="dev_user_123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing MindsDB RAG Assistant API"
echo "======================================"
echo ""

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local auth=$5
    
    echo -n "Testing: $description... "
    
    if [ "$auth" = "true" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN")
        fi
    else
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -X $method "$BASE_URL$endpoint")
        fi
    fi
    
    # Check if response contains "success":true or status 200
    if echo "$response" | grep -q '"success":true\|"status":"healthy"\|"status":200'; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Track results
PASSED=0
FAILED=0

echo "📋 Section 1: Health Checks (No Auth Required)"
echo "----------------------------------------------"

if test_endpoint "GET" "/health" "Basic health check" "" "false"; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "GET" "/ready" "Readiness probe" "" "false"; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "GET" "/live" "Liveness probe" "" "false"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "📋 Section 2: API Info (Auth Required)"
echo "--------------------------------------"

if test_endpoint "GET" "/api" "API version info" "" "true"; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "GET" "/api/docs" "API documentation" "" "true"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "📋 Section 3: Bedrock Agent (No Auth)"
echo "-------------------------------------"

if test_endpoint "GET" "/api/bedrock-agent/health" "Bedrock Agent health" "" "false"; then
    ((PASSED++))
else
    ((FAILED++))
fi

SESSION_DATA='{
  "merchant_id": "'"$MERCHANT_UUID"'",
  "user_id": "'"$USER_ID"'"
}'

echo -n "Testing: Create Bedrock Agent session... "
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bedrock-agent/sessions" \
    -H "Content-Type: application/json" \
    -d "$SESSION_DATA")

if echo "$SESSION_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    echo "  Session ID: $SESSION_ID"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $SESSION_RESPONSE"
    ((FAILED++))
fi

echo ""
echo "📋 Section 4: Semantic Retrieval (Auth Required)"
echo "------------------------------------------------"

if test_endpoint "GET" "/api/semantic-retrieval/health" "Semantic retrieval health" "" "true"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "📋 Section 5: Document Management (Auth Required)"
echo "-------------------------------------------------"

DOC_DATA='{
  "merchantId": "'"$MERCHANT_ID"'",
  "content": "Premium wireless headphones with active noise cancellation, 30-hour battery life, and superior sound quality.",
  "title": "Test Wireless Headphones",
  "source": "api_test",
  "document_type": "product"
}'

echo -n "Testing: Create document... "
DOC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/documents" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$DOC_DATA")

if echo "$DOC_RESPONSE" | grep -q '"success":true\|"documentId":'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    DOC_ID=$(echo "$DOC_RESPONSE" | grep -o '"documentId":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$DOC_ID" ]; then
        echo "  Document ID: $DOC_ID"
    fi
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $DOC_RESPONSE"
    ((FAILED++))
fi

echo -n "Testing: Search documents... "
SEARCH_DATA='{
  "merchantId": "'"$MERCHANT_ID"'",
  "query": "wireless headphones",
  "limit": 10
}'
SEARCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/documents/search" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$SEARCH_DATA")

if echo "$SEARCH_RESPONSE" | grep -q '"results":\|"totalFound":'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $SEARCH_RESPONSE"
    ((FAILED++))
fi

echo -n "Testing: Get document stats... "
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents/stats?merchantId=$MERCHANT_ID" \
    -H "Authorization: Bearer $TOKEN")

if echo "$STATS_RESPONSE" | grep -q '"stats":\|"merchantId":'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $STATS_RESPONSE"
    ((FAILED++))
fi

echo ""
echo "📋 Section 6: Session Management (Auth Required)"
echo "------------------------------------------------"

SESSION_CREATE_DATA='{
  "merchantId": "'"$MERCHANT_ID"'",
  "userId": "'"$USER_ID"'",
  "context": {
    "preferences": {
      "language": "en",
      "currency": "USD"
    }
  }
}'

echo -n "Testing: Create session... "
SESSION_CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$SESSION_CREATE_DATA")

if echo "$SESSION_CREATE_RESPONSE" | grep -q '"success":true\|"sessionId":\|"id":'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    API_SESSION_ID=$(echo "$SESSION_CREATE_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || echo "$SESSION_CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$API_SESSION_ID" ]; then
        echo "  Session ID: $API_SESSION_ID"
    fi
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $SESSION_CREATE_RESPONSE"
    ((FAILED++))
fi

echo -n "Testing: Session analytics... "
ANALYTICS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/sessions/analytics?merchantId=$MERCHANT_ID" \
    -H "Authorization: Bearer $TOKEN")

if echo "$ANALYTICS_RESPONSE" | grep -q '"success":true\|"analytics":\|"data":'; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $ANALYTICS_RESPONSE"
    ((FAILED++))
fi

echo ""
echo "======================================"
echo "📊 Test Results Summary"
echo "======================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
