#!/bin/bash

# Development environment startup script

set -e

echo "🚀 Starting MindsDB RAG Assistant development environment..."

# Copy docker environment file if .env doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.docker template..."
    cp .env.docker .env
fi

# Start the database containers
echo "📦 Starting database containers..."
docker compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if database is initialized
if ! docker compose exec -T postgres psql -U postgres -d mindsdb_rag -c "SELECT 1 FROM documents LIMIT 1;" > /dev/null 2>&1; then
    echo "🔧 Database not initialized. Running setup..."
    ./scripts/setup-db.sh
else
    echo "✅ Database already initialized"
fi

echo "🎯 Starting development server..."
npm run dev