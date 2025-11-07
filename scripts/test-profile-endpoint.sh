#!/bin/bash

# Test script for GET /api/merchants/:merchantId/profile endpoint

echo "Testing GET /api/merchants/:merchantId/profile endpoint"
echo "=============================================="
echo ""

# Test merchant ID (from seed data)
MERCHANT_ID="acme_electronics_2024"

# Mock JWT token for development (format: userId:merchantId)
TOKEN="dev_user_123:${MERCHANT_ID}"

echo "1. Testing with valid authentication..."
curl -X GET "http://localhost:3000/api/merchants/${MERCHANT_ID}/profile" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "2. Testing without authentication (should fail)..."
curl -X GET "http://localhost:3000/api/merchants/${MERCHANT_ID}/profile" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "3. Testing with wrong merchant ID (should fail)..."
WRONG_TOKEN="dev_user_123:wrong_merchant_id"
curl -X GET "http://localhost:3000/api/merchants/${MERCHANT_ID}/profile" \
  -H "Authorization: Bearer ${WRONG_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "Test completed!"
