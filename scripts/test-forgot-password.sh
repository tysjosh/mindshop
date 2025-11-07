#!/bin/bash

# Test script for POST /api/merchants/forgot-password endpoint
# This script demonstrates the forgot password functionality

echo "========================================="
echo "Testing POST /api/merchants/forgot-password"
echo "========================================="
echo ""

# Test 1: Missing email (should return 400)
echo "Test 1: Missing email parameter"
echo "Request: POST /api/merchants/forgot-password with empty body"
curl -X POST http://localhost:3000/api/merchants/forgot-password \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'
echo ""
echo "---"
echo ""

# Test 2: Empty email (should return 400)
echo "Test 2: Empty email string"
echo "Request: POST /api/merchants/forgot-password with email=''"
curl -X POST http://localhost:3000/api/merchants/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":""}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'
echo ""
echo "---"
echo ""

# Test 3: Valid email format (will attempt to send reset code via Cognito)
echo "Test 3: Valid email format"
echo "Request: POST /api/merchants/forgot-password with email='test@example.com'"
echo "Note: This will fail if the email doesn't exist in Cognito, but demonstrates proper request handling"
curl -X POST http://localhost:3000/api/merchants/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'
echo ""
echo "---"
echo ""

echo "========================================="
echo "Test completed!"
echo "========================================="
echo ""
echo "Expected behavior:"
echo "- Test 1 & 2: Should return 400 with 'Email is required' error"
echo "- Test 3: Should return 200 with success message OR 400 with Cognito error"
echo "  (depending on whether Cognito is configured and user exists)"
echo ""
echo "All responses should include:"
echo "  - success: boolean"
echo "  - timestamp: ISO date string"
echo "  - requestId: UUID"
echo "  - data or error: depending on success"
