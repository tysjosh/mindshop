#!/bin/bash

# Test script for analytics top queries endpoint
# This script tests the GET /api/merchants/:merchantId/analytics/top-queries endpoint

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
MERCHANT_ID="${MERCHANT_ID:-test_merchant_001}"

echo "========================================="
echo "Testing Analytics Top Queries Endpoint"
echo "========================================="
echo ""
echo "API URL: $API_URL"
echo "Merchant ID: $MERCHANT_ID"
echo ""

# Test 1: Get top queries without authentication (should fail)
echo "Test 1: Request without authentication (should return 401)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X GET \
  "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries")

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

# Test 2: Get top queries with authentication
# Note: You'll need to provide a valid JWT token
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 2: Request with authentication (default limit: 20)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 2 PASSED: Successfully retrieved top queries"
  else
    echo "✗ Test 2 FAILED: Expected 200, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 2: Skipped (no JWT_TOKEN provided)"
  echo "To run this test, set JWT_TOKEN environment variable"
  echo "Example: JWT_TOKEN=your_token_here ./scripts/test-analytics-top-queries.sh"
  echo ""
fi

# Test 3: Get top queries with custom limit
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 3: Request with custom limit (10)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries?limit=10")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 3 PASSED: Successfully retrieved top queries with custom limit"
  else
    echo "✗ Test 3 FAILED: Expected 200, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 3: Skipped (no JWT_TOKEN provided)"
  echo ""
fi

# Test 4: Get top queries with date range
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 4: Request with date range parameters"
  echo "-------------------------------------------"
  START_DATE=$(date -u -d '30 days ago' +%Y-%m-%d)
  END_DATE=$(date -u +%Y-%m-%d)
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries?startDate=$START_DATE&endDate=$END_DATE&limit=5")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Date Range: $START_DATE to $END_DATE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 4 PASSED: Successfully retrieved top queries with date range"
  else
    echo "✗ Test 4 FAILED: Expected 200, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 4: Skipped (no JWT_TOKEN provided)"
  echo ""
fi

# Test 5: Invalid limit parameter (should fail)
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 5: Request with invalid limit (should return 400)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries?limit=200")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "400" ]; then
    echo "✓ Test 5 PASSED: Correctly rejected invalid limit"
  else
    echo "✗ Test 5 FAILED: Expected 400, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 5: Skipped (no JWT_TOKEN provided)"
  echo ""
fi

# Test 6: Invalid date format (should fail)
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 6: Request with invalid date format (should return 400)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_URL/api/merchants/$MERCHANT_ID/analytics/top-queries?startDate=invalid-date")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "400" ]; then
    echo "✓ Test 6 PASSED: Correctly rejected invalid date format"
  else
    echo "✗ Test 6 FAILED: Expected 400, got $HTTP_CODE"
  fi
  echo ""
else
  echo "Test 6: Skipped (no JWT_TOKEN provided)"
  echo ""
fi

echo "========================================="
echo "Analytics Top Queries Endpoint Tests Complete"
echo "========================================="
