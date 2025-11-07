#!/bin/bash

# Test script for analytics overview endpoint
# This script tests the GET /api/merchants/:merchantId/analytics/overview endpoint

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
MERCHANT_ID="${MERCHANT_ID:-test_merchant_001}"

echo "========================================="
echo "Testing Analytics Overview Endpoint"
echo "========================================="
echo ""
echo "API URL: $API_URL"
echo "Merchant ID: $MERCHANT_ID"
echo ""

# Test 1: Get analytics overview without authentication (should fail)
echo "Test 1: Request without authentication (should return 401)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET \
  "$API_URL/api/merchants/$MERCHANT_ID/analytics/overview")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ Test 1 PASSED: Correctly rejected unauthenticated request"
else
  echo "✗ Test 1 FAILED: Expected 401, got $HTTP_CODE"
fi
echo ""

# Test 2: Get analytics overview with authentication
# Note: You'll need to provide a valid JWT token
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 2: Request with authentication"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/overview")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 2 PASSED: Successfully retrieved analytics overview"
  else
    echo "✗ Test 2 FAILED: Expected 200, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 2: Skipped (no JWT_TOKEN provided)"
  echo "To run this test, set JWT_TOKEN environment variable"
  echo "Example: JWT_TOKEN=your_token_here ./scripts/test-analytics-overview.sh"
  echo ""
fi

# Test 3: Get analytics overview with date range
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 3: Request with date range parameters"
  echo "-------------------------------------------"
  START_DATE=$(date -u -d '30 days ago' +%Y-%m-%d)
  END_DATE=$(date -u +%Y-%m-%d)
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/overview?startDate=$START_DATE&endDate=$END_DATE")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Date Range: $START_DATE to $END_DATE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 3 PASSED: Successfully retrieved analytics with date range"
  else
    echo "✗ Test 3 FAILED: Expected 200, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 3: Skipped (no JWT_TOKEN provided)"
  echo ""
fi

echo "========================================="
echo "Analytics Overview Endpoint Tests Complete"
echo "========================================="
