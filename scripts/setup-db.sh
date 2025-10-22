#!/bin/bash

# Setup script for MindsDB RAG Assistant database

set -e

echo "🚀 Setting up MindsDB RAG Assistant database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ docker compose is not available. Please install Docker Compose v2."
    exit 1
fi

# Start PostgreSQL and Redis containers
echo "📦 Starting PostgreSQL and Redis containers..."
docker compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=60
counter=0
while ! docker compose exec -T postgres pg_isready -U postgres -d mindsdb_rag > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo "❌ PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    echo "   Waiting for PostgreSQL... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

echo "✅ PostgreSQL is ready!"

# Create database if it doesn't exist
echo "🗄️  Creating database..."
docker compose exec postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS mindsdb_rag;" || true

# Run the initial setup SQL (extensions and functions)
echo "🔧 Running initial database setup..."
docker compose exec -T postgres psql -U postgres -d mindsdb_rag < database/migrations/001_initial_schema.sql

# Generate and run Drizzle migrations
echo "🔄 Generating Drizzle migrations..."
npm run db:generate

echo "📊 Applying Drizzle migrations..."
docker compose exec -T postgres psql -U postgres -d mindsdb_rag < drizzle/0000_*.sql

# Fix vector column type and add vector index
echo "🔍 Setting up vector search capabilities..."
docker compose exec postgres psql -U postgres -d mindsdb_rag -c "ALTER TABLE documents ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;" || echo "Vector column already configured"
docker compose exec postgres psql -U postgres -d mindsdb_rag -c "CREATE INDEX IF NOT EXISTS idx_documents_embedding_ivfflat ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);" || echo "Vector index already exists"

echo "✅ Database setup complete!"
echo ""
echo "📋 Connection details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: mindsdb_rag"
echo "   Username: postgres"
echo "   Password: password"
echo ""
echo "🔗 You can connect using:"
echo "   psql -h localhost -p 5432 -U postgres -d mindsdb_rag"
echo ""
echo "🛑 To stop the containers:"
echo "   docker compose down"
echo ""
echo "🗑️  To remove all data:"
echo "   docker compose down -v"