#!/bin/bash

# Test script for merchant verify-email endpoint
# This script tests the POST /api/merchants/verify-email endpoint

API_URL="http://localhost:3000"

echo "========================================="
echo "Testing Merchant Verify Email Endpoint"
echo "========================================="
echo ""

# Test 1: Verify email with valid data
echo "Test 1: Verify email with confirmation code"
echo "POST $API_URL/api/merchants/verify-email"
curl -X POST "$API_URL/api/merchants/verify-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "confirmationCode": "123456"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "========================================="
echo ""

# Test 2: Missing email
echo "Test 2: Missing email (should fail with 400)"
echo "POST $API_URL/api/merchants/verify-email"
curl -X POST "$API_URL/api/merchants/verify-email" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmationCode": "123456"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "========================================="
echo ""

# Test 3: Missing confirmation code
echo "Test 3: Missing confirmation code (should fail with 400)"
echo "POST $API_URL/api/merchants/verify-email"
curl -X POST "$API_URL/api/merchants/verify-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "========================================="
echo ""

# Test 4: Empty body
echo "Test 4: Empty body (should fail with 400)"
echo "POST $API_URL/api/merchants/verify-email"
curl -X POST "$API_URL/api/merchants/verify-email" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "========================================="
echo "Tests completed!"
echo "========================================="
