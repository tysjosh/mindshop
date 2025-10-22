# MindsDB RAG Assistant - Development Commands

.PHONY: help setup start stop reset logs clean dev prod tools

# Default target
help:
	@echo "MindsDB RAG Assistant - Available Commands:"
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup     - Complete development setup (first time)"
	@echo "  make start     - Start development environment"
	@echo "  make dev       - Start app in development mode"
	@echo ""
	@echo "🛠️  Environment Management:"
	@echo "  make start     - Start development services"
	@echo "  make prod      - Start production services"
	@echo "  make tools     - Start with development tools (pgAdmin, Redis UI)"
	@echo "  make stop      - Stop all services"
	@echo "  make reset     - Reset system (delete all data)"
	@echo ""
	@echo "📊 Monitoring:"
	@echo "  make logs      - View service logs"
	@echo "  make status    - Show service status"
	@echo "  make health    - Check system health"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  make clean     - Clean up Docker resources"
	@echo "  make migrate   - Run database migrations"
	@echo "  make seed      - Seed database with sample data"

# Complete development setup
setup:
	@echo "🛠️  Running complete development setup..."
	@./scripts/dev-setup.sh

# Start development environment
start:
	@echo "🚀 Starting development environment..."
	@./scripts/start.sh dev

# Start production environment
prod:
	@echo "🚀 Starting production environment..."
	@./scripts/start.sh prod

# Start with development tools
tools:
	@echo "🔧 Starting with development tools..."
	@./scripts/start.sh tools

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	@./scripts/stop.sh

# Reset system
reset:
	@echo "🔄 Resetting system..."
	@./scripts/reset.sh

# View logs
logs:
	@echo "📋 Viewing service logs..."
	@docker compose logs -f

# Show service status
status:
	@echo "📊 Service Status:"
	@docker compose ps

# Check system health
health:
	@echo "🏥 Checking system health..."
	@docker compose exec postgres pg_isready -U postgres -d mindsdb_rag || echo "❌ PostgreSQL not ready"
	@docker compose exec redis redis-cli ping || echo "❌ Redis not ready"
	@echo "✅ Health check complete"

# Clean up Docker resources
clean:
	@echo "🧹 Cleaning up Docker resources..."
	@docker system prune -f
	@docker volume prune -f

# Run database migrations
migrate:
	@echo "🗄️  Running database migrations..."
	@./scripts/setup-db.sh

# Seed database with sample data
seed:
	@echo "🌱 Seeding database..."
	@npm run db:seed

# Start development server
dev: start
	@echo "🚀 Starting development server..."
	@npm run dev

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install

# Run tests
test:
	@echo "🧪 Running tests..."
	@npm test

# Build for production
build:
	@echo "🏗️  Building for production..."
	@npm run build

# Open development tools
pgadmin:
	@echo "🔧 Opening pgAdmin..."
	@open http://localhost:8080

redis-ui:
	@echo "🔧 Opening Redis UI..."
	@open http://localhost:8081