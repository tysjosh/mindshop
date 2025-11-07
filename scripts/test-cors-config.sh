#!/bin/bash

# Test CORS Configuration
# This script tests the CORS configuration for widget endpoints

echo "🧪 Testing CORS Configuration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
API_URL="${API_URL:-http://localhost:3000}"

# Test counter
PASSED=0
FAILED=0

# Function to test CORS
test_cors() {
  local endpoint=$1
  local origin=$2
  local description=$3
  
  echo -e "${YELLOW}Testing:${NC} $description"
  echo "  Endpoint: $endpoint"
  echo "  Origin: $origin"
  
  # Make OPTIONS request (preflight)
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type, X-API-Key" \
    "$API_URL$endpoint")
  
  if [ "$response" = "204" ] || [ "$response" = "200" ]; then
    echo -e "  ${GREEN}✓ PASSED${NC} (HTTP $response)"
    ((PASSED++))
  else
    echo -e "  ${RED}✗ FAILED${NC} (HTTP $response)"
    ((FAILED++))
  fi
  echo ""
}

# Function to check headers
check_headers() {
  local endpoint=$1
  local origin=$2
  
  echo -e "${YELLOW}Checking Headers:${NC} $endpoint from $origin"
  
  headers=$(curl -s -I \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type, X-API-Key" \
    "$API_URL$endpoint")
  
  echo "$headers" | grep -i "access-control"
  echo ""
}

echo "================================================"
echo "  CORS Configuration Tests"
echo "================================================"
echo ""

# Test 1: Widget endpoint from external domain
test_cors "/api/chat" "https://merchant-store.com" "Widget endpoint from external domain"

# Test 2: Widget endpoint from another external domain
test_cors "/api/sessions" "https://example-shop.com" "Session endpoint from external domain"

# Test 3: Widget endpoint from whitelisted origin
test_cors "/api/chat" "http://localhost:3001" "Widget endpoint from whitelisted origin"

# Test 4: Document endpoint from external domain
test_cors "/api/documents" "https://merchant-website.com" "Document endpoint from external domain"

# Test 5: Bedrock agent endpoint from external domain
test_cors "/api/bedrock-agent/chat" "https://shop.example.com" "Bedrock agent endpoint from external domain"

# Check headers for one endpoint
echo "================================================"
echo "  Header Verification"
echo "================================================"
echo ""
check_headers "/api/chat" "https://merchant-store.com"

# Summary
echo "================================================"
echo "  Test Summary"
echo "================================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All CORS tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some CORS tests failed${NC}"
  exit 1
fi
