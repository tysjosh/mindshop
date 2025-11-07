#!/bin/bash

# Widget CORS Integration Test Script
# Tests that the widget can make requests from an external domain

set -e

echo "🧪 Widget CORS Integration Test"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
EXTERNAL_ORIGIN="https://merchant-store.example.com"
TEST_MERCHANT_ID="test_merchant_cors"
TEST_USER_ID="test_user_$(date +%s)"

echo "📋 Test Configuration:"
echo "   API URL: $API_URL"
echo "   External Origin: $EXTERNAL_ORIGIN"
echo "   Merchant ID: $TEST_MERCHANT_ID"
echo "   User ID: $TEST_USER_ID"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test CORS
test_cors() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -n "Testing: $test_name... "
    
    # Make request with Origin header
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Origin: $EXTERNAL_ORIGIN" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test_key" \
            -H "X-Merchant-ID: $TEST_MERCHANT_ID" \
            -d "$data" \
            "$API_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X GET \
            -H "Origin: $EXTERNAL_ORIGIN" \
            -H "Authorization: Bearer test_key" \
            -H "X-Merchant-ID: $TEST_MERCHANT_ID" \
            "$API_URL$endpoint" 2>&1)
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Check if request succeeded (2xx or 3xx status)
    if [[ "$status_code" =~ ^[23] ]]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $status_code)"
        echo "   Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test preflight OPTIONS request
test_preflight() {
    local endpoint="$1"
    echo -n "Testing: Preflight OPTIONS for $endpoint... "
    
    response=$(curl -s -w "\n%{http_code}" \
        -X OPTIONS \
        -H "Origin: $EXTERNAL_ORIGIN" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Merchant-ID" \
        "$API_URL$endpoint" 2>&1)
    
    status_code=$(echo "$response" | tail -n1)
    
    if [[ "$status_code" =~ ^[23] ]]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $status_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Check if API is running
echo "🔍 Checking if API is running..."
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ API is not running at $API_URL${NC}"
    echo "   Please start the API server first:"
    echo "   npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ API is running${NC}"
echo ""

# Run tests
echo "🧪 Running CORS Tests:"
echo "====================="
echo ""

# Test 1: Preflight for session creation
test_preflight "/api/chat/sessions"

# Test 2: Create session from external domain
SESSION_DATA="{\"merchantId\":\"$TEST_MERCHANT_ID\",\"userId\":\"$TEST_USER_ID\"}"
if test_cors "Create session from external domain" "POST" "/api/chat/sessions" "$SESSION_DATA"; then
    # Extract session ID from response for subsequent tests
    SESSION_ID=$(echo "$body" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(echo "$body" | grep -o '"sessionId": "[^"]*"' | cut -d'"' -f4)
    fi
    echo "   Session ID: $SESSION_ID"
fi

# Test 3: Preflight for chat endpoint
test_preflight "/api/chat"

# Test 4: Send chat message from external domain
if [ -n "$SESSION_ID" ]; then
    CHAT_DATA="{\"query\":\"Test message from external domain\",\"sessionId\":\"$SESSION_ID\",\"merchantId\":\"$TEST_MERCHANT_ID\",\"userId\":\"$TEST_USER_ID\"}"
    test_cors "Send chat message from external domain" "POST" "/api/chat" "$CHAT_DATA"
    
    # Test 5: Get session history from external domain
    test_cors "Get session history from external domain" "GET" "/api/chat/sessions/$SESSION_ID/history?merchantId=$TEST_MERCHANT_ID" ""
else
    echo -e "${YELLOW}⚠ Skipping chat tests (no session ID)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 2))
fi

# Test 6: Document search from external domain
test_cors "Document search from external domain" "GET" "/api/documents/search?merchantId=$TEST_MERCHANT_ID&limit=10" ""

# Test 7: Preflight for documents endpoint
test_preflight "/api/documents"

# Test 8: Check CORS headers are present
echo -n "Testing: CORS headers are exposed... "
CORS_HEADERS=$(curl -s -I \
    -X POST \
    -H "Origin: $EXTERNAL_ORIGIN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/chat/sessions" 2>&1 | grep -i "access-control")

if [ -n "$CORS_HEADERS" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "   Headers found:"
    echo "$CORS_HEADERS" | sed 's/^/   /'
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   No CORS headers found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo "📊 Test Summary:"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All CORS tests passed!${NC}"
    echo ""
    echo "The widget should work correctly on external merchant domains."
    exit 0
else
    echo -e "${RED}✗ Some CORS tests failed${NC}"
    echo ""
    echo "The widget may not work correctly on external merchant domains."
    echo "Please check the CORS configuration in src/api/app.ts"
    exit 1
fi
