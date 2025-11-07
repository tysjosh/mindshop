#!/bin/bash

# RAG Assistant Widget - Test Sites Runner
# This script helps run and validate the test sites

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   RAG Assistant Widget - Test Sites Runner                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if widget is built
echo -e "${YELLOW}[1/4]${NC} Checking if widget is built..."
if [ ! -f "../../dist/widget.js" ] && [ ! -f "../../dist/widget.min.js" ]; then
    echo -e "${RED}✗ Widget not built!${NC}"
    echo -e "${YELLOW}Building widget...${NC}"
    cd ../..
    npm run build
    cd examples/test-sites
    echo -e "${GREEN}✓ Widget built successfully${NC}"
else
    echo -e "${GREEN}✓ Widget is built${NC}"
fi

echo ""

# Check if test sites exist
echo -e "${YELLOW}[2/4]${NC} Checking test sites..."
TEST_SITES=("vanilla-html.html" "jquery-site.html" "wordpress-simulation.html" "index.html")
MISSING_SITES=0

for site in "${TEST_SITES[@]}"; do
    if [ -f "$site" ]; then
        echo -e "${GREEN}  ✓${NC} $site"
    else
        echo -e "${RED}  ✗${NC} $site ${RED}(missing)${NC}"
        MISSING_SITES=$((MISSING_SITES + 1))
    fi
done

if [ $MISSING_SITES -gt 0 ]; then
    echo -e "${RED}✗ $MISSING_SITES test site(s) missing!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All test sites present${NC}"
echo ""

# Check for required files
echo -e "${YELLOW}[3/4]${NC} Checking documentation..."
DOCS=("README.md" "TEST_RESULTS.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}  ✓${NC} $doc"
    else
        echo -e "${YELLOW}  ⚠${NC} $doc ${YELLOW}(missing)${NC}"
    fi
done

echo ""

# Start local server
echo -e "${YELLOW}[4/4]${NC} Starting local server..."
echo ""
echo -e "${GREEN}Test sites are ready!${NC}"
echo ""
echo -e "${BLUE}Available test sites:${NC}"
echo -e "  1. Vanilla HTML:           ${GREEN}http://localhost:8080/test-sites/vanilla-html.html${NC}"
echo -e "  2. jQuery Site:            ${GREEN}http://localhost:8080/test-sites/jquery-site.html${NC}"
echo -e "  3. WordPress Simulation:   ${GREEN}http://localhost:8080/test-sites/wordpress-simulation.html${NC}"
echo -e "  4. Test Index:             ${GREEN}http://localhost:8080/test-sites/index.html${NC}"
echo ""
echo -e "${BLUE}Testing checklist:${NC}"
echo -e "  [ ] Widget loads without errors"
echo -e "  [ ] Widget appears in correct position"
echo -e "  [ ] Open/close functionality works"
echo -e "  [ ] Messages can be sent"
echo -e "  [ ] Callbacks fire correctly"
echo -e "  [ ] Session management works"
echo -e "  [ ] No console errors"
echo ""
echo -e "${YELLOW}Starting webpack dev server...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start webpack dev server from widget directory
cd ../..
npm run serve
