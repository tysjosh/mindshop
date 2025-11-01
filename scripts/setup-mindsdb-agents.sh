#!/bin/bash

# MindsDB Agents and Knowledge Bases Setup Script
# Sets up RAG agents and knowledge bases for the MindsDB RAG Assistant

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

# Configuration
MINDSDB_ENDPOINT="${MINDSDB_ENDPOINT:-http://localhost:47334}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
BEDROCK_REGION="${BEDROCK_REGION:-us-east-2}"

# Check if MindsDB is running
check_mindsdb() {
    log "Checking MindsDB connectivity..."
    
    if curl -s "${MINDSDB_ENDPOINT}/api/status" > /dev/null 2>&1; then
        success "MindsDB is accessible at ${MINDSDB_ENDPOINT}"
        return 0
    else
        error "MindsDB is not accessible at ${MINDSDB_ENDPOINT}"
        error "Please ensure MindsDB is running. Run: ./scripts/setup-mindsdb-local.sh"
        return 1
    fi
}

# Execute SQL query against MindsDB
execute_sql() {
    local query="$1"
    local description="$2"
    
    log "${description}"
    
    local response=$(curl -s -X POST "${MINDSDB_ENDPOINT}/api/sql/query" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"${query}\"}")
    
    if echo "$response" | grep -q '"error"'; then
        error "SQL execution failed: $response"
        return 1
    else
        success "${description} - completed"
        return 0
    fi
}

# Create RAG project
create_rag_project() {
    log "Setting up RAG project..."
    
    execute_sql "CREATE PROJECT IF NOT EXISTS rag_assistant;" "Creating RAG project"
    execute_sql "USE rag_assistant;" "Switching to RAG project"
}

# Set up database connection
setup_database_connection() {
    log "Setting up database connection..."
    
    # Check if we have database credentials
    if [ -n "${DB_HOST}" ] && [ -n "${DB_USERNAME}" ] && [ -n "${DB_PASSWORD}" ]; then
        log "Creating PostgreSQL database connection..."
        
        local db_query="CREATE DATABASE postgres_db
        WITH ENGINE = 'postgres',
        PARAMETERS = {
            'host': '${DB_HOST}',
            'port': '${DB_PORT:-5432}',
            'database': '${DB_NAME:-mindsdb_rag}',
            'user': '${DB_USERNAME}',
            'password': '${DB_PASSWORD}',
            'ssl': true
        };"
        
        execute_sql "$db_query" "Creating PostgreSQL connection"
    else
        warning "Database credentials not provided, skipping database connection"
    fi
}

# Create knowledge base with OpenAI
create_openai_knowledge_base() {
    if [ -z "$OPENAI_API_KEY" ]; then
        warning "OPENAI_API_KEY not provided, skipping OpenAI knowledge base creation"
        return 0
    fi
    
    log "Creating OpenAI-powered knowledge base..."
    
    local kb_query="CREATE KNOWLEDGE_BASE rag_documents_kb
    USING
        embedding_model = {
            'provider': 'openai',
            'model_name': 'text-embedding-3-large',
            'api_key': '${OPENAI_API_KEY}'
        },
        reranking_model = {
            'provider': 'openai',
            'model_name': 'gpt-4o',
            'api_key': '${OPENAI_API_KEY}'
        },
        metadata_columns = ['document_type', 'merchant_id', 'sku', 'title', 'created_at'],
        content_columns = ['body'],
        id_column = 'id';"
    
    execute_sql "$kb_query" "Creating OpenAI knowledge base"
}

# Create knowledge base with Bedrock
create_bedrock_knowledge_base() {
    log "Creating Bedrock-powered knowledge base..."
    
    local kb_query="CREATE KNOWLEDGE_BASE rag_documents_bedrock_kb
    USING
        embedding_model = {
            'provider': 'bedrock',
            'model_name': 'amazon.titan-embed-text-v2:0',
            'region': '${BEDROCK_REGION}'
        },
        reranking_model = {
            'provider': 'bedrock',
            'model_name': 'amazon.nova-micro-v1:0',
            'region': '${BEDROCK_REGION}'
        },
        metadata_columns = ['document_type', 'merchant_id', 'sku', 'title', 'created_at'],
        content_columns = ['body'],
        id_column = 'id';"
    
    execute_sql "$kb_query" "Creating Bedrock knowledge base"
}

# Create RAG agent with OpenAI
create_openai_agent() {
    if [ -z "$OPENAI_API_KEY" ]; then
        warning "OPENAI_API_KEY not provided, skipping OpenAI agent creation"
        return 0
    fi
    
    log "Creating OpenAI RAG agent..."
    
    local agent_query="CREATE AGENT rag_assistant_openai
    USING
        model = {
            'provider': 'openai',
            'model_name': 'gpt-4o',
            'api_key': '${OPENAI_API_KEY}'
        },
        data = {
            'knowledge_bases': ['rag_documents_kb']
        },
        prompt_template = 'You are a helpful e-commerce RAG assistant. Answer questions based on the provided context from the knowledge base about products, FAQs, policies, and reviews. 

Context: {{context}}
Question: {{question}}

Instructions:
- Use only the information provided in the context
- If you cannot find relevant information, say so clearly
- Be concise and helpful
- Focus on product recommendations and customer support
- Include relevant product SKUs when available

Answer:',
        timeout = 30;"
    
    execute_sql "$agent_query" "Creating OpenAI RAG agent"
}

# Create RAG agent with Bedrock
create_bedrock_agent() {
    log "Creating Bedrock RAG agent..."
    
    local agent_query="CREATE AGENT rag_assistant_bedrock
    USING
        model = {
            'provider': 'bedrock',
            'model_name': 'amazon.nova-micro-v1:0',
            'region': '${BEDROCK_REGION}'
        },
        data = {
            'knowledge_bases': ['rag_documents_bedrock_kb']
        },
        prompt_template = 'You are a helpful e-commerce RAG assistant. Answer questions based on the provided context from the knowledge base about products, FAQs, policies, and reviews. 

Context: {{context}}
Question: {{question}}

Instructions:
- Use only the information provided in the context
- If you cannot find relevant information, say so clearly
- Be concise and helpful
- Focus on product recommendations and customer support
- Include relevant product SKUs when available

Answer:',
        timeout = 30;"
    
    execute_sql "$agent_query" "Creating Bedrock RAG agent"
}

# Create document ingestion job
create_ingestion_job() {
    if [ -n "${DB_HOST}" ]; then
        log "Creating document ingestion job..."
        
        local job_query="CREATE JOB document_ingestion_job (
            INSERT INTO rag_documents_kb (
                SELECT id, body, document_type, merchant_id, sku, title, created_at
                FROM postgres_db.documents
                WHERE updated_at > LAST
            )
        ) EVERY 5 minutes;"
        
        execute_sql "$job_query" "Creating document ingestion job"
    else
        warning "Database connection not available, skipping ingestion job creation"
    fi
}

# Test the setup
test_setup() {
    log "Testing MindsDB RAG setup..."
    
    # Test knowledge base
    if [ -n "$OPENAI_API_KEY" ]; then
        log "Testing OpenAI knowledge base..."
        execute_sql "DESCRIBE rag_documents_kb;" "Checking OpenAI knowledge base"
        
        log "Testing OpenAI agent..."
        execute_sql "SELECT * FROM rag_assistant_openai WHERE question='What products do you have?' LIMIT 1;" "Testing OpenAI agent query"
    fi
    
    # Test Bedrock knowledge base
    log "Testing Bedrock knowledge base..."
    execute_sql "DESCRIBE rag_documents_bedrock_kb;" "Checking Bedrock knowledge base"
    
    log "Testing Bedrock agent..."
    execute_sql "SELECT * FROM rag_assistant_bedrock WHERE question='What products do you have?' LIMIT 1;" "Testing Bedrock agent query"
    
    # List all created objects
    log "Listing created objects..."
    execute_sql "SHOW KNOWLEDGE_BASES;" "Listing knowledge bases"
    execute_sql "SHOW AGENTS;" "Listing agents"
    execute_sql "SHOW JOBS;" "Listing jobs"
}

# Main setup function
main() {
    log "🚀 Setting up MindsDB RAG Agents and Knowledge Bases"
    
    # Check prerequisites
    if ! check_mindsdb; then
        exit 1
    fi
    
    # Load environment variables if .env exists
    if [ -f .env ]; then
        log "Loading environment variables from .env"
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Create RAG project
    create_rag_project
    
    # Set up database connection
    setup_database_connection
    
    # Create knowledge bases
    create_openai_knowledge_base
    create_bedrock_knowledge_base
    
    # Create agents
    create_openai_agent
    create_bedrock_agent
    
    # Create ingestion job
    create_ingestion_job
    
    # Test the setup
    test_setup
    
    success "🎉 MindsDB RAG Agents and Knowledge Bases setup completed!"
    
    log ""
    log "📊 MindsDB Editor: ${MINDSDB_ENDPOINT}"
    log "🤖 Available Agents:"
    if [ -n "$OPENAI_API_KEY" ]; then
        log "   - rag_assistant_openai (OpenAI GPT-4o)"
    fi
    log "   - rag_assistant_bedrock (Amazon Nova Micro)"
    log ""
    log "📚 Available Knowledge Bases:"
    if [ -n "$OPENAI_API_KEY" ]; then
        log "   - rag_documents_kb (OpenAI embeddings)"
    fi
    log "   - rag_documents_bedrock_kb (Bedrock embeddings)"
    log ""
    log "🔄 Document Ingestion:"
    if [ -n "${DB_HOST}" ]; then
        log "   - Automatic ingestion job created (runs every 5 minutes)"
    else
        log "   - Manual ingestion required (no database connection)"
    fi
    log ""
    log "🚀 Next Steps:"
    log "1. Add documents to your knowledge base:"
    log "   INSERT INTO rag_documents_kb (id, body, document_type, merchant_id, sku, title)"
    log "   VALUES ('doc1', 'Product description...', 'product', 'merchant1', 'SKU123', 'Product Title');"
    log ""
    log "2. Query your RAG agent:"
    log "   SELECT * FROM rag_assistant_bedrock WHERE question='Tell me about your products';"
    log ""
    log "3. Use in your application via the MindsDB API endpoints"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "test")
        check_mindsdb && test_setup
        ;;
    "clean")
        log "Cleaning up RAG setup..."
        execute_sql "DROP AGENT IF EXISTS rag_assistant_openai;" "Dropping OpenAI agent"
        execute_sql "DROP AGENT IF EXISTS rag_assistant_bedrock;" "Dropping Bedrock agent"
        execute_sql "DROP KNOWLEDGE_BASE IF EXISTS rag_documents_kb;" "Dropping OpenAI knowledge base"
        execute_sql "DROP KNOWLEDGE_BASE IF EXISTS rag_documents_bedrock_kb;" "Dropping Bedrock knowledge base"
        execute_sql "DROP JOB IF EXISTS document_ingestion_job;" "Dropping ingestion job"
        execute_sql "DROP DATABASE IF EXISTS postgres_db;" "Dropping database connection"
        success "RAG setup cleaned up"
        ;;
    *)
        echo "Usage: $0 [setup|test|clean]"
        echo ""
        echo "Commands:"
        echo "  setup - Set up RAG agents and knowledge bases (default)"
        echo "  test  - Test the RAG setup"
        echo "  clean - Clean up all RAG components"
        echo ""
        echo "Environment Variables:"
        echo "  MINDSDB_ENDPOINT - MindsDB API endpoint (default: http://localhost:47334)"
        echo "  OPENAI_API_KEY   - OpenAI API key for OpenAI-powered components"
        echo "  BEDROCK_REGION   - AWS Bedrock region (default: us-east-2)"
        echo "  DB_HOST          - PostgreSQL host for document ingestion"
        echo "  DB_USERNAME      - PostgreSQL username"
        echo "  DB_PASSWORD      - PostgreSQL password"
        exit 1
        ;;
esac