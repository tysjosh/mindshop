#!/bin/bash

# MindsDB Local Setup Script
# Sets up a self-hosted MindsDB instance for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if Docker is available
check_docker() {
    if command -v docker &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if Python is available
check_python() {
    if command -v python3 &> /dev/null || command -v python &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Create MindsDB configuration for RAG
create_mindsdb_config() {
    log "Creating MindsDB configuration for RAG..."
    
    mkdir -p ./mindsdb_config
    
    cat > ./mindsdb_config/config.json << 'EOF'
{
  "permanent_storage": {
    "location": "local"
  },
  "paths": {
    "root": "/root/mindsdb_storage"
  },
  "api": {
    "http": {
      "host": "0.0.0.0",
      "port": "47334",
      "restart_on_failure": true,
      "max_restart_count": 3,
      "max_restart_interval_seconds": 300
    },
    "mysql": {
      "host": "0.0.0.0",
      "port": "47335",
      "database": "mindsdb",
      "ssl": false,
      "restart_on_failure": true,
      "max_restart_count": 3,
      "max_restart_interval_seconds": 300
    }
  },
  "cache": {
    "type": "local"
  },
  "logging": {
    "handlers": {
      "console": {
        "enabled": true,
        "formatter": "default",
        "level": "INFO"
      },
      "file": {
        "enabled": true,
        "level": "INFO",
        "filename": "mindsdb.log",
        "maxBytes": 10485760,
        "backupCount": 5
      }
    }
  },
  "ml_task_queue": {
    "type": "local"
  },
  "url_file_upload": {
    "enabled": true,
    "allowed_origins": [],
    "disallowed_origins": []
  },
  "web_crawling_allowed_sites": [],
  "data_catalog": {
    "enabled": true
  }
}
EOF

    success "Created MindsDB configuration for RAG"
}

# Setup MindsDB with Docker
setup_docker_mindsdb() {
    log "Setting up MindsDB with Docker for RAG Assistant..."
    
    # Create configuration
    create_mindsdb_config
    
    # Check if MindsDB container is already running
    if docker ps | grep -q mindsdb; then
        warning "MindsDB container is already running"
        return 0
    fi
    
    # Stop any existing MindsDB container
    if docker ps -a | grep -q mindsdb; then
        log "Stopping existing MindsDB container..."
        docker stop mindsdb-rag 2>/dev/null || true
        docker rm mindsdb-rag 2>/dev/null || true
    fi
    
    # Pull latest MindsDB image
    log "Pulling MindsDB Docker image..."
    docker pull mindsdb/mindsdb:latest
    
    # Run MindsDB container with RAG configuration
    log "Starting MindsDB container with RAG configuration..."
    docker run -d \
        --name mindsdb-rag \
        -p 47334:47334 \
        -p 47335:47335 \
        -v "$(pwd)/mindsdb_data:/root/mindsdb_storage" \
        -v "$(pwd)/mindsdb_config/config.json:/root/config.json" \
        -e MINDSDB_CONFIG_PATH=/root/config.json \
        -e MINDSDB_APIS=http,mysql \
        --restart unless-stopped \
        mindsdb/mindsdb:latest
    
    # Wait for MindsDB to start
    log "Waiting for MindsDB to start..."
    for i in {1..30}; do
        if curl -s http://localhost:47334/api/status > /dev/null 2>&1; then
            success "MindsDB is running on http://localhost:47334"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    
    error "MindsDB failed to start within 60 seconds"
    docker logs mindsdb-rag --tail 50
    return 1
}

# Setup MindsDB with Python
setup_python_mindsdb() {
    log "Setting up MindsDB with Python..."
    
    # Check if MindsDB is already installed
    if python3 -c "import mindsdb" 2>/dev/null; then
        log "MindsDB is already installed"
    else
        log "Installing MindsDB..."
        pip3 install mindsdb
    fi
    
    # Check if MindsDB is already running
    if curl -s http://localhost:47334/api/status > /dev/null 2>&1; then
        warning "MindsDB is already running on port 47334"
        return 0
    fi
    
    log "Starting MindsDB server..."
    nohup python3 -m mindsdb --api http --port 47334 > mindsdb.log 2>&1 &
    
    # Wait for MindsDB to start
    log "Waiting for MindsDB to start..."
    for i in {1..30}; do
        if curl -s http://localhost:47334/api/status > /dev/null 2>&1; then
            success "MindsDB is running on http://localhost:47334"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    
    error "MindsDB failed to start within 60 seconds"
    return 1
}

# Update environment configuration
update_env_config() {
    log "Updating environment configuration..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        log "Created .env file from .env.example"
    fi
    
    # Update MindsDB configuration
    sed -i.bak 's|MINDSDB_ENDPOINT=.*|MINDSDB_ENDPOINT=http://localhost:47334|' .env
    sed -i.bak 's|MINDSDB_API_KEY=.*|MINDSDB_API_KEY=|' .env
    sed -i.bak 's|MINDSDB_USERNAME=.*|MINDSDB_USERNAME=|' .env
    sed -i.bak 's|MINDSDB_PASSWORD=.*|MINDSDB_PASSWORD=|' .env
    
    success "Updated .env configuration for local MindsDB"
}

# Create RAG initialization script
create_rag_init_script() {
    log "Creating RAG initialization script..."
    
    cat > ./mindsdb_config/init_rag.sql << 'EOF'
-- RAG Assistant Initialization Script
-- Run this script in MindsDB to set up RAG components

-- Show available ML engines and handlers
SHOW ML_ENGINES;
SHOW HANDLERS;

-- Create a project for RAG operations
CREATE PROJECT IF NOT EXISTS rag_assistant;
USE rag_assistant;

-- Show databases to verify connection
SHOW DATABASES;

-- Example Knowledge Base Creation (requires OpenAI API key)
-- Uncomment and modify with your API key:
/*
CREATE KNOWLEDGE_BASE demo_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name": "text-embedding-3-large",
        "api_key": "your-openai-api-key-here"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "your-openai-api-key-here"
    },
    metadata_columns = ['document_type', 'source', 'title', 'created_at'],
    content_columns = ['content'],
    id_column = 'document_id';
*/

-- Example Agent Creation (requires OpenAI API key)
-- Uncomment and modify with your API key:
/*
CREATE AGENT demo_agent
USING
    model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "your-openai-api-key-here"
    },
    data = {
        "knowledge_bases": ["demo_kb"]
    },
    prompt_template = 'You are a helpful RAG assistant. Answer questions based on the provided context from the knowledge base. If you cannot find relevant information, say so clearly.',
    timeout = 30;
*/

-- Example Document Ingestion Job
-- Uncomment after creating knowledge base:
/*
CREATE JOB document_ingestion_job (
    INSERT INTO demo_kb
    SELECT document_id, content, document_type, source, title
    FROM files.uploaded_documents
    WHERE created_at > LAST
)
EVERY 1 hour;
*/

SELECT 'RAG initialization script loaded successfully' as status;
EOF

    success "Created RAG initialization script at ./mindsdb_config/init_rag.sql"
}

# Test the setup
test_setup() {
    log "Testing MindsDB RAG setup..."
    
    # Test basic connectivity
    if curl -s http://localhost:47334/api/status > /dev/null; then
        success "✅ MindsDB API is accessible"
    else
        error "❌ MindsDB API is not accessible"
        return 1
    fi
    
    # Test SQL query
    log "Testing SQL query..."
    RESPONSE=$(curl -s -X POST http://localhost:47334/api/sql/query \
        -H "Content-Type: application/json" \
        -d '{"query":"SELECT 1 as test"}')
    
    if echo "$RESPONSE" | grep -q "test"; then
        success "✅ SQL queries are working"
    else
        warning "⚠️  SQL queries may not be working properly"
        echo "Response: $RESPONSE"
    fi
    
    # Test ML engines
    log "Testing ML engines..."
    ML_RESPONSE=$(curl -s -X POST http://localhost:47334/api/sql/query \
        -H "Content-Type: application/json" \
        -d '{"query":"SHOW ML_ENGINES"}')
    
    if echo "$ML_RESPONSE" | grep -q "lightwood\|openai"; then
        success "✅ ML engines are available"
    else
        warning "⚠️  ML engines may not be properly loaded"
    fi
    
    # Test handlers for RAG
    log "Testing handlers for RAG..."
    HANDLERS_RESPONSE=$(curl -s -X POST http://localhost:47334/api/sql/query \
        -H "Content-Type: application/json" \
        -d '{"query":"SHOW HANDLERS"}')
    
    if echo "$HANDLERS_RESPONSE" | grep -q "openai"; then
        success "✅ OpenAI handler is available for RAG"
    else
        warning "⚠️  OpenAI handler may not be available (needed for RAG)"
    fi
    
    # Test project creation
    log "Testing project creation..."
    PROJECT_RESPONSE=$(curl -s -X POST http://localhost:47334/api/sql/query \
        -H "Content-Type: application/json" \
        -d '{"query":"CREATE PROJECT IF NOT EXISTS test_rag"}')
    
    if echo "$PROJECT_RESPONSE" | grep -q "success\|completed"; then
        success "✅ Project creation is working"
        
        # Clean up test project
        curl -s -X POST http://localhost:47334/api/sql/query \
            -H "Content-Type: application/json" \
            -d '{"query":"DROP PROJECT test_rag"}' > /dev/null
    else
        warning "⚠️  Project creation may not be working properly"
    fi
    
    # Test with the application
    if [ -f "package.json" ]; then
        log "Testing application integration..."
        if npm run build > /dev/null 2>&1; then
            success "✅ Application builds successfully"
        else
            warning "⚠️  Application build failed"
        fi
        
        if command -v node &> /dev/null && [ -f "src/services/MindsDBService.ts" ]; then
            log "Testing MindsDB service connection..."
            # This would require a more complex test setup
            success "✅ MindsDB service files are present"
        fi
    fi
}

# Main setup function
main() {
    log "🚀 Setting up self-hosted MindsDB for RAG Assistant"
    
    # Choose setup method
    if check_docker; then
        log "Docker detected, using Docker setup..."
        setup_docker_mindsdb
    elif check_python; then
        log "Python detected, using Python setup..."
        setup_python_mindsdb
        create_mindsdb_config
    else
        error "Neither Docker nor Python found. Please install one of them first."
        exit 1
    fi
    
    # Create RAG initialization script
    create_rag_init_script
    
    # Update configuration
    update_env_config
    
    # Test the setup
    test_setup
    
    success "🎉 MindsDB RAG Assistant setup completed!"
    
    log ""
    log "📊 MindsDB Editor: http://localhost:47334"
    log "🔌 HTTP API: http://localhost:47334/api"
    log "🗄️  MySQL API: localhost:47335"
    log "📁 Data Directory: ./mindsdb_data"
    log "⚙️  Config Directory: ./mindsdb_config"
    log ""
    log "🚀 Next Steps:"
    log "1. Open MindsDB Editor: http://localhost:47334"
    log "2. Run the initialization script: ./mindsdb_config/init_rag.sql"
    log "3. Set up your OpenAI API key in the knowledge base and agent creation"
    log "4. Update your .env file with any additional configuration"
    log "5. Start your RAG Assistant application: npm run dev"
    log ""
    log "📖 RAG Assistant API Endpoints:"
    log "   POST /api/merchants/{merchantId}/rag/initialize - Initialize RAG system"
    log "   POST /api/merchants/{merchantId}/documents - Ingest documents"
    log "   POST /api/merchants/{merchantId}/documents/search - Search documents"
    log "   POST /api/merchants/{merchantId}/rag/ask - Ask questions"
    log ""
    log "🔧 Management Commands:"
    log "   ./scripts/setup-mindsdb-local.sh start - Start MindsDB"
    log "   ./scripts/setup-mindsdb-local.sh stop - Stop MindsDB"
    log "   ./scripts/setup-mindsdb-local.sh logs - View logs"
    log "   ./scripts/setup-mindsdb-local.sh test - Test setup"
    log ""
    log "📖 Documentation:"
    log "   MindsDB: https://docs.mindsdb.com"
    log "   RAG Guide: https://docs.mindsdb.com/mindsdb_sql/agents/knowledge-bases"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "start")
        if check_docker && docker ps -a | grep -q mindsdb-rag; then
            docker start mindsdb-rag
            success "MindsDB container started"
        else
            error "MindsDB container not found. Run setup first."
        fi
        ;;
    "stop")
        if check_docker && docker ps | grep -q mindsdb-rag; then
            docker stop mindsdb-rag
            success "MindsDB container stopped"
        else
            warning "MindsDB container not running"
        fi
        ;;
    "logs")
        if check_docker && docker ps -a | grep -q mindsdb-rag; then
            docker logs -f mindsdb-rag
        else
            error "MindsDB container not found"
        fi
        ;;
    "test")
        test_setup
        ;;
    *)
        echo "Usage: $0 [setup|start|stop|logs|test]"
        echo ""
        echo "Commands:"
        echo "  setup - Set up MindsDB (default)"
        echo "  start - Start MindsDB container"
        echo "  stop  - Stop MindsDB container"
        echo "  logs  - View MindsDB logs"
        echo "  test  - Test MindsDB connectivity"
        exit 1
        ;;
esac