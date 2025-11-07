#!/bin/bash

# Test script for analytics performance endpoint
# This script tests the GET /api/merchants/:merchantId/analytics/performance endpoint

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
MERCHANT_ID="${MERCHANT_ID:-acme_electronics_2024}"

echo "========================================="
echo "Testing Analytics Performance Endpoint"
echo "========================================="
echo ""
echo "Base URL: $BASE_URL"
echo "Merchant ID: $MERCHANT_ID"
echo ""

# Test 1: Get performance metrics without authentication (should fail)
echo "Test 1: Request without authentication (should return 401)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "$BASE_URL/api/merchants/$MERCHANT_ID/analytics/performance")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ Test 1 PASSED: Correctly rejected unauthenticated request"
else
  echo "✗ Test 1 FAILED: Expected 401, got $HTTP_CODE"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Get performance metrics with authentication
# Note: You'll need to provide a valid JWT token
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 2: Request with authentication"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$BASE_URL/api/merchants/$MERCHANT_ID/analytics/performance" \
    -H "Authorization: Bearer $JWT_TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 2 PASSED: Successfully retrieved performance metrics"
  else
    echo "✗ Test 2 FAILED: Expected 200, got $HTTP_CODE"
  fi
else
  echo "Test 2: Skipped (no JWT_TOKEN provided)"
  echo "To run this test, set JWT_TOKEN environment variable"
  echo "Example: JWT_TOKEN=your_token_here ./scripts/test-analytics-performance.sh"
fi
echo ""

# Test 3: Get performance metrics with date range
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 3: Request with date range parameters"
  echo "-------------------------------------------"
  START_DATE=$(date -u -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
  END_DATE=$(date -u +%Y-%m-%d)
  
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$BASE_URL/api/merchants/$MERCHANT_ID/analytics/performance?startDate=$START_DATE&endDate=$END_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Test 3 PASSED: Successfully retrieved performance metrics with date range"
  else
    echo "✗ Test 3 FAILED: Expected 200, got $HTTP_CODE"
  fi
else
  echo "Test 3: Skipped (no JWT_TOKEN provided)"
fi
echo ""

# Test 4: Invalid date format (should fail)
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 4: Request with invalid date format (should return 400)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$BASE_URL/api/merchants/$MERCHANT_ID/analytics/performance?startDate=invalid-date" \
    -H "Authorization: Bearer $JWT_TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "400" ]; then
    echo "✓ Test 4 PASSED: Correctly rejected invalid date format"
  else
    echo "✗ Test 4 FAILED: Expected 400, got $HTTP_CODE"
    echo "Response: $BODY"
  fi
else
  echo "Test 4: Skipped (no JWT_TOKEN provided)"
fi
echo ""

# Test 5: Access another merchant's data (should fail)
if [ -n "$JWT_TOKEN" ]; then
  echo "Test 5: Request for different merchant (should return 403)"
  echo "-------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$BASE_URL/api/merchants/other_merchant_123/analytics/performance" \
    -H "Authorization: Bearer $JWT_TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "403" ]; then
    echo "✓ Test 5 PASSED: Correctly denied access to other merchant's data"
  else
    echo "✗ Test 5 FAILED: Expected 403, got $HTTP_CODE"
    echo "Response: $BODY"
  fi
else
  echo "Test 5: Skipped (no JWT_TOKEN provided)"
fi
echo ""

echo "========================================="
echo "Performance Endpoint Tests Complete"
echo "========================================="
echo ""
echo "Expected Response Format:"
echo "{"
echo "  \"success\": true,"
echo "  \"data\": {"
echo "    \"merchantId\": \"acme_electronics_2024\","
echo "    \"startDate\": \"2025-10-02T00:00:00.000Z\","
echo "    \"endDate\": \"2025-11-01T00:00:00.000Z\","
echo "    \"p50ResponseTime\": 245,"
echo "    \"p95ResponseTime\": 450,"
echo "    \"p99ResponseTime\": 680,"
echo "    \"cacheHitRate\": 75,"
echo "    \"errorRate\": 2,"
echo "    \"uptime\": 99.9"
echo "  },"
echo "  \"timestamp\": \"2025-11-01T12:00:00.000Z\","
echo "  \"requestId\": \"req_abc123\""
echo "}"
