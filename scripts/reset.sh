#!/bin/bash
set -e

# MindsDB RAG Assistant - System Reset Script
echo "🔄 Resetting MindsDB RAG Assistant System..."

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Confirm reset
read -p "⚠️  This will delete all data and reset the system. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Reset cancelled."
    exit 0
fi

print_warning "Resetting system in 3 seconds... Press Ctrl+C to cancel"
sleep 3

# Stop all services
print_status "Stopping all services..."
docker-compose down --volumes --remove-orphans
docker-compose --profile tools down --volumes --remove-orphans 2>/dev/null || true

# Remove volumes
print_status "Removing data volumes..."
docker volume rm mindsdb_postgres_data 2>/dev/null || true
docker volume rm mindsdb_redis_data 2>/dev/null || true
docker volume rm mindsdb_pgadmin_data 2>/dev/null || true

# Remove any orphaned containers
print_status "Cleaning up containers..."
docker container prune -f --filter "label=com.docker.compose.project=mindsdb"

# Remove networks
print_status "Cleaning up networks..."
docker network prune -f --filter "label=com.docker.compose.project=mindsdb"

# Clean up images (optional)
read -p "🗑️  Remove Docker images as well? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Removing Docker images..."
    docker image rm pgvector/pgvector:pg15 2>/dev/null || true
    docker image rm redis:7-alpine 2>/dev/null || true
    docker image rm dpage/pgadmin4:latest 2>/dev/null || true
    docker image rm rediscommander/redis-commander:latest 2>/dev/null || true
fi

print_success "✅ System reset complete!"
echo ""
print_status "To start fresh:"
echo "  ./scripts/start.sh"