#!/bin/bash

# Browser Compatibility Testing Script
# Runs comprehensive browser tests and generates reports

set -e

echo "=========================================="
echo "RAG Assistant - Browser Compatibility Tests"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the widget directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from widget directory${NC}"
    exit 1
fi

# Check if widget is built
if [ ! -f "dist/widget.js" ]; then
    echo -e "${YELLOW}Widget not built. Building now...${NC}"
    npm run build
    echo -e "${GREEN}✓ Widget built successfully${NC}"
    echo ""
fi

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js${NC}"
    exit 1
fi

# Check if Playwright browsers are installed
if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo -e "${YELLOW}Playwright browsers not installed. Installing now...${NC}"
    npx playwright install
    echo -e "${GREEN}✓ Playwright browsers installed${NC}"
    echo ""
fi

# Parse command line arguments
BROWSER="all"
HEADED=false
DEBUG=false
UI=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --browser)
            BROWSER="$2"
            shift 2
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --ui)
            UI=true
            shift
            ;;
        --help)
            echo "Usage: ./run-browser-tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --browser <name>   Run tests on specific browser (chromium, firefox, webkit, mobile)"
            echo "  --headed           Run tests in headed mode (show browser)"
            echo "  --debug            Run tests in debug mode"
            echo "  --ui               Run tests in interactive UI mode"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-browser-tests.sh                    # Run all tests"
            echo "  ./run-browser-tests.sh --browser firefox  # Test Firefox only"
            echo "  ./run-browser-tests.sh --headed           # Show browser while testing"
            echo "  ./run-browser-tests.sh --ui               # Interactive UI mode"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build test command
TEST_CMD="npx playwright test"

if [ "$UI" = true ]; then
    echo -e "${GREEN}Starting Playwright UI...${NC}"
    npx playwright test --ui
    exit 0
fi

if [ "$DEBUG" = true ]; then
    TEST_CMD="$TEST_CMD --debug"
fi

if [ "$HEADED" = true ]; then
    TEST_CMD="$TEST_CMD --headed"
fi

if [ "$BROWSER" != "all" ]; then
    TEST_CMD="$TEST_CMD --project=$BROWSER"
fi

# Run tests
echo -e "${GREEN}Running browser compatibility tests...${NC}"
echo "Command: $TEST_CMD"
echo ""

if $TEST_CMD; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✓ All tests passed!"
    echo "==========================================${NC}"
    echo ""
    echo "View detailed report:"
    echo "  npm run test:browser:report"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "✗ Some tests failed"
    echo "==========================================${NC}"
    echo ""
    echo "View detailed report:"
    echo "  npm run test:browser:report"
    echo ""
    echo "Debug failed tests:"
    echo "  npx playwright test --debug"
    echo ""
    exit 1
fi
