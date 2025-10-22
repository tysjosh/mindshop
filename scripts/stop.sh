#!/bin/bash
set -e

# MindsDB RAG Assistant - System Stop Script
echo "🛑 Stopping MindsDB RAG Assistant System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Stop all services
print_status "Stopping all services..."
docker compose down

# Stop any running profiles
docker compose --profile tools down 2>/dev/null || true

print_success "All services stopped!"

# Show remaining containers (if any)
REMAINING=$(docker ps -q --filter "name=mindsdb-rag")
if [ ! -z "$REMAINING" ]; then
    echo ""
    print_status "Remaining containers:"
    docker ps --filter "name=mindsdb-rag"
    echo ""
    echo "To force stop: docker stop $REMAINING"
fi

echo ""
print_success "✅ System shutdown complete!"