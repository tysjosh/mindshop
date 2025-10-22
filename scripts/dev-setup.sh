#!/bin/bash
set -e

# MindsDB RAG Assistant - Development Setup Script
echo "🛠️  Setting up MindsDB RAG Assistant for development..."

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

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi

print_success "npm $(npm -v) ✓"

# Install dependencies
print_status "Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
# MindsDB RAG Assistant Environment Configuration

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mindsdb_rag
DB_USERNAME=postgres
DB_PASSWORD=password
DB_SSL=false

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_TTL=3600
REDIS_TLS=false
REDIS_KEY_PREFIX=mindsdb-rag

# AWS Configuration (for production)
AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key

# MindsDB
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=your-mindsdb-api-key
MINDSDB_TIMEOUT=30000

# Bedrock (for AI models)
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
BEDROCK_MAX_TOKENS=4096
BEDROCK_TEMPERATURE=0.7

# Security
JWT_SECRET=your-jwt-secret-change-in-production
ENCRYPTION_KEY=your-encryption-key-change-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_MEMORY=256mb

# Monitoring
METRICS_ENABLED=true
TRACING_ENABLED=false
EOF
    print_success "Created .env file with default values"
    print_warning "Please update the .env file with your actual configuration values"
else
    print_success ".env file already exists"
fi

# Start infrastructure
print_status "Starting infrastructure services..."
./scripts/start.sh dev

# Wait a moment for services to be fully ready
sleep 5

# Run database migrations
print_status "Running database migrations..."
if command -v drizzle-kit &> /dev/null; then
    npm run db:generate
    # Run the working database setup
    ./scripts/setup-db.sh
    print_success "Database migrations completed"
else
    print_warning "Drizzle Kit not found. Using npx..."
    npx drizzle-kit generate:pg
    ./scripts/setup-db.sh
    print_success "Database setup completed"
fi

# Check system health
print_status "Checking system health..."

# Test database connection
if docker-compose exec -T postgres psql -U postgres -d mindsdb_rag -c "SELECT version();" > /dev/null 2>&1; then
    print_success "Database connection ✓"
else
    print_error "Database connection failed ✗"
fi

# Test Redis connection
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis connection ✓"
else
    print_error "Redis connection failed ✗"
fi

echo ""
print_success "🎉 Development setup complete!"
echo ""
echo "🚀 Ready to start development:"
echo "  npm run dev          # Start the development server"
echo "  npm run test         # Run tests"
echo "  npm run build        # Build for production"
echo ""
echo "🔧 Development tools:"
echo "  pgAdmin:    http://localhost:8080 (admin@mindsdb.com / admin)"
echo "  Redis UI:   http://localhost:8081"
echo ""
echo "📚 Useful commands:"
echo "  npm run db:studio    # Open Drizzle Studio"
echo "  npm run db:reset     # Reset database"
echo "  ./scripts/stop.sh    # Stop all services"
echo ""