#!/bin/bash

# Test Documentation Examples
# Validates that all code examples in the developer portal documentation work correctly

echo "=================================================="
echo "Testing Documentation Examples"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $2"
    ((TESTS_FAILED++))
  fi
}

echo "1. Testing Widget Unit Tests"
echo "----------------------------"
cd widget
if npm test -- documentation-examples.test.ts --no-watch --silent > /tmp/widget-test.log 2>&1; then
  TEST_RESULT=0
else
  TEST_RESULT=1
fi
grep -E "(PASS|FAIL|Tests:)" /tmp/widget-test.log 2>/dev/null || echo "Test output not available"
cd ..
print_result $TEST_RESULT "Widget documentation examples unit tests"
echo ""

echo "2. Testing Widget Build"
echo "----------------------"
cd widget
if npm run build > /dev/null 2>&1; then
  TEST_RESULT=0
else
  TEST_RESULT=1
fi
cd ..
print_result $TEST_RESULT "Widget builds successfully"
echo ""

echo "3. Checking Documentation Files"
echo "-------------------------------"

DOC_FILE="developer-portal/app/(dashboard)/documentation/page.tsx"

# Check if documentation page exists
if [ -f "$DOC_FILE" ]; then
  print_result 0 "Documentation page exists"
else
  print_result 1 "Documentation page exists"
fi

# Check for correct widget initialization pattern
if grep -q "new RAGAssistant" "$DOC_FILE"; then
  print_result 0 "Documentation uses correct 'new RAGAssistant' pattern"
else
  print_result 1 "Documentation uses correct 'new RAGAssistant' pattern"
fi

# Check for troubleshooting section
if grep -q "Troubleshooting" "$DOC_FILE"; then
  print_result 0 "Documentation includes troubleshooting section"
else
  print_result 1 "Documentation includes troubleshooting section"
fi

# Check for configuration options
if grep -q "Configuration Options" "$DOC_FILE"; then
  print_result 0 "Documentation includes configuration options"
else
  print_result 1 "Documentation includes configuration options"
fi

# Check for all required configuration fields
if grep -q "merchantId" "$DOC_FILE" && \
   grep -q "apiKey" "$DOC_FILE" && \
   grep -q "apiBaseUrl" "$DOC_FILE"; then
  print_result 0 "Documentation includes all required configuration fields"
else
  print_result 1 "Documentation includes all required configuration fields"
fi

# Check for theme options
if grep -q "primaryColor" "$DOC_FILE" && \
   grep -q "position" "$DOC_FILE"; then
  print_result 0 "Documentation includes theme options"
else
  print_result 1 "Documentation includes theme options"
fi

# Check for behavior options
if grep -q "autoOpen" "$DOC_FILE" && \
   grep -q "greeting" "$DOC_FILE"; then
  print_result 0 "Documentation includes behavior options"
else
  print_result 1 "Documentation includes behavior options"
fi

# Check for integration callbacks
if grep -q "addToCartCallback" "$DOC_FILE"; then
  print_result 0 "Documentation includes integration callbacks"
else
  print_result 1 "Documentation includes integration callbacks"
fi

echo ""
echo "4. Checking Widget Export"
echo "------------------------"

# Check if RAGAssistant is exported correctly
if grep -q "window.*RAGAssistant" widget/src/index.ts; then
  print_result 0 "Widget exports RAGAssistant to window object"
else
  print_result 1 "Widget exports RAGAssistant to window object"
fi

# Check if widget has correct exports
if grep -q "export.*RAGAssistant" widget/src/index.ts; then
  print_result 0 "Widget exports RAGAssistant as module"
else
  print_result 1 "Widget exports RAGAssistant as module"
fi

echo ""
echo "5. Checking API Examples"
echo "-----------------------"

# Check for API endpoint examples
if grep -q "/api/chat" "$DOC_FILE"; then
  print_result 0 "Documentation includes chat API example"
else
  print_result 1 "Documentation includes chat API example"
fi

if grep -q "/api/documents" "$DOC_FILE"; then
  print_result 0 "Documentation includes documents API example"
else
  print_result 1 "Documentation includes documents API example"
fi

# Check for authentication examples
if grep -q "Authorization.*Bearer" "$DOC_FILE"; then
  print_result 0 "Documentation includes authentication example"
else
  print_result 1 "Documentation includes authentication example"
fi

# Check for API key types
if grep -q "pk_live_" "$DOC_FILE" && \
   grep -q "pk_test_" "$DOC_FILE"; then
  print_result 0 "Documentation includes both API key types"
else
  print_result 1 "Documentation includes both API key types"
fi

echo ""
echo "6. Checking Test Files"
echo "---------------------"

# Check if test HTML file exists
if [ -f "widget/examples/test-sites/test-documentation-example.html" ]; then
  print_result 0 "Documentation example test HTML exists"
else
  print_result 1 "Documentation example test HTML exists"
fi

# Check if unit test file exists
if [ -f "widget/tests/documentation-examples.test.ts" ]; then
  print_result 0 "Documentation examples unit test exists"
else
  print_result 1 "Documentation examples unit test exists"
fi

echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All documentation examples are valid!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some documentation examples need fixes${NC}"
  exit 1
fi
