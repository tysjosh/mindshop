#!/bin/bash
set -e

# MindsDB RAG Assistant - System Startup Script
echo "🚀 Starting MindsDB RAG Assistant System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    print_error "docker compose is not available. Please install Docker Compose v2."
    exit 1
fi

# Set environment (default to development)
ENVIRONMENT=${1:-dev}

print_status "Starting in ${ENVIRONMENT} environment..."

# Start the infrastructure services
case $ENVIRONMENT in
    "dev"|"development")
        print_status "Starting development environment..."
        docker compose up -d postgres redis
        ;;
    "prod"|"production")
        print_status "Starting production environment..."
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
        ;;
    "tools")
        print_status "Starting with development tools..."
        docker compose --profile tools up -d
        ;;
    *)
        print_error "Unknown environment: $ENVIRONMENT"
        print_status "Available environments: dev, prod, tools"
        exit 1
        ;;
esac

# Wait for services to be healthy
print_status "Waiting for services to be ready..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
timeout=60
counter=0
while ! docker compose exec -T postgres pg_isready -U postgres -d mindsdb_rag > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
echo ""
print_success "PostgreSQL is ready!"

# Wait for Redis
print_status "Waiting for Redis..."
counter=0
while ! docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "Redis failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
echo ""
print_success "Redis is ready!"

# Check if we need to run migrations
print_status "Checking database schema..."
if docker compose exec -T postgres psql -U postgres -d mindsdb_rag -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';" | grep -q "1 row"; then
    print_success "Database schema exists"
else
    print_warning "Database schema not found. You may need to run migrations."
    print_status "Run: npm run db:migrate (after installing dependencies)"
fi

# Show service status
print_status "Service Status:"
docker compose ps

# Show connection information
echo ""
print_success "🎉 System is ready!"
echo ""
echo "📊 Service Endpoints:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:      localhost:6379"

if [ "$ENVIRONMENT" = "tools" ]; then
    echo "  pgAdmin:    http://localhost:8080 (admin@mindsdb.com / admin)"
    echo "  Redis UI:   http://localhost:8081"
fi

echo ""
echo "🔧 Next Steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Set up environment:   cp .env.example .env"
echo "  3. Run migrations:       npm run db:migrate"
echo "  4. Start the app:        npm run dev"
echo ""
echo "📝 Useful Commands:"
echo "  View logs:     docker compose logs -f"
echo "  Stop system:   ./scripts/stop.sh"
echo "  Reset system:  ./scripts/reset.sh"
echo ""