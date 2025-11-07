#!/bin/bash

# Test script for billing cancel endpoint
# This script tests the POST /api/merchants/:merchantId/billing/cancel endpoint

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Billing Cancel Endpoint${NC}"
echo "=================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
MERCHANT_ID="${MERCHANT_ID:-test_merchant_123}"

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}Error: JWT_TOKEN environment variable is required${NC}"
  echo "Usage: JWT_TOKEN=your_token ./scripts/test-billing-cancel.sh"
  exit 1
fi

echo "API URL: $API_URL"
echo "Merchant ID: $MERCHANT_ID"
echo ""

# Test 1: Cancel subscription at period end (default behavior)
echo -e "${YELLOW}Test 1: Cancel subscription at period end${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/merchants/$MERCHANT_ID/billing/cancel" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
else
  echo -e "${RED}✗ Test 1 failed${NC}"
fi
echo ""

# Test 2: Cancel subscription immediately
echo -e "${YELLOW}Test 2: Cancel subscription immediately${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/merchants/$MERCHANT_ID/billing/cancel" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": false
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
else
  echo -e "${RED}✗ Test 2 failed${NC}"
fi
echo ""

# Test 3: Cancel without authentication (should fail)
echo -e "${YELLOW}Test 3: Cancel without authentication (should fail)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/merchants/$MERCHANT_ID/billing/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Test 3 passed (correctly rejected)${NC}"
else
  echo -e "${RED}✗ Test 3 failed (should return 401)${NC}"
fi
echo ""

# Test 4: Cancel with wrong merchant ID (should fail)
echo -e "${YELLOW}Test 4: Cancel with wrong merchant ID (should fail)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$API_URL/api/merchants/wrong_merchant_id/billing/cancel" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ Test 4 passed (correctly rejected)${NC}"
else
  echo -e "${RED}✗ Test 4 failed (should return 403)${NC}"
fi
echo ""

echo "=================================="
echo -e "${YELLOW}Testing Complete${NC}"
