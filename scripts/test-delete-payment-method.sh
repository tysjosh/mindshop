#!/bin/bash

# Test DELETE /api/merchants/:merchantId/billing/payment-methods/:paymentMethodId endpoint

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing DELETE Payment Method Endpoint${NC}"
echo "=========================================="

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
MERCHANT_ID="${MERCHANT_ID:-test_merchant_123}"
PAYMENT_METHOD_ID="${PAYMENT_METHOD_ID:-pm_test_123}"

# Get JWT token (you'll need to set this)
JWT_TOKEN="${JWT_TOKEN:-}"

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}Error: JWT_TOKEN environment variable is required${NC}"
  echo "Usage: JWT_TOKEN=your_token ./scripts/test-delete-payment-method.sh"
  exit 1
fi

echo -e "\n${YELLOW}Test 1: Delete payment method${NC}"
echo "Endpoint: DELETE $API_URL/api/merchants/$MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X DELETE \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/api/merchants/$MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Test passed${NC}"
else
  echo -e "${RED}✗ Test failed${NC}"
fi

echo -e "\n${YELLOW}Test 2: Delete payment method without authentication${NC}"
echo "Endpoint: DELETE $API_URL/api/merchants/$MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X DELETE \
  -H "Content-Type: application/json" \
  "$API_URL/api/merchants/$MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" -eq 401 ]; then
  echo -e "${GREEN}✓ Test passed (correctly rejected)${NC}"
else
  echo -e "${RED}✗ Test failed (should return 401)${NC}"
fi

echo -e "\n${YELLOW}Test 3: Delete payment method with invalid merchant ID${NC}"
INVALID_MERCHANT_ID="invalid_merchant"
echo "Endpoint: DELETE $API_URL/api/merchants/$INVALID_MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X DELETE \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/api/merchants/$INVALID_MERCHANT_ID/billing/payment-methods/$PAYMENT_METHOD_ID")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" -eq 403 ] || [ "$HTTP_CODE" -eq 404 ]; then
  echo -e "${GREEN}✓ Test passed (correctly rejected)${NC}"
else
  echo -e "${RED}✗ Test failed (should return 403 or 404)${NC}"
fi

echo -e "\n=========================================="
echo -e "${YELLOW}Testing Complete${NC}"
