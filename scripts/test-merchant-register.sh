#!/bin/bash

# Test script for merchant registration endpoint
# This script tests the POST /api/merchants/register endpoint

echo "Testing Merchant Registration Endpoint"
echo "======================================="
echo ""

# Test 1: Missing required fields
echo "Test 1: Missing required fields (should return 400)"
curl -X POST http://localhost:3000/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 2: Invalid email format
echo "Test 2: Invalid email format (should return 400)"
curl -X POST http://localhost:3000/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email", "password": "password123", "companyName": "Test Company"}' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 3: Password too short
echo "Test 3: Password too short (should return 400)"
curl -X POST http://localhost:3000/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "short", "companyName": "Test Company"}' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 4: Valid request (will fail without Cognito configured, but endpoint should exist)
echo "Test 4: Valid request structure (endpoint should exist)"
curl -X POST http://localhost:3000/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{"email": "newmerchant@example.com", "password": "SecurePassword123!", "companyName": "New Test Company", "website": "https://example.com", "industry": "Technology"}' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "======================================="
echo "Tests completed!"
