#!/bin/bash

# Database Setup Script for MindsDB RAG Assistant
# Creates all required database tables and indexes

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

# Load environment variables
if [ -f .env ]; then
    log "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mindsdb_rag}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"

# Check if psql is available
check_psql() {
    if command -v psql &> /dev/null; then
        return 0
    else
        error "psql command not found. Please install PostgreSQL client."
        error "On macOS: brew install postgresql"
        error "On Ubuntu: sudo apt-get install postgresql-client"
        return 1
    fi
}

# Test database connection
test_connection() {
    log "Testing database connection..."
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        success "Database connection successful"
        return 0
    else
        error "Database connection failed"
        error "Please check your database credentials and ensure the database is running"
        return 1
    fi
}

# Run SQL migration
run_migration() {
    log "Running database migration..."
    
    local sql_file="scripts/create-database-tables.sql"
    
    if [ ! -f "$sql_file" ]; then
        error "Migration file not found: $sql_file"
        return 1
    fi
    
    log "Executing SQL migration from $sql_file"
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$sql_file"; then
        success "Database migration completed successfully"
        return 0
    else
        error "Database migration failed"
        return 1
    fi
}

# Verify tables were created
verify_tables() {
    log "Verifying tables were created..."
    
    local expected_tables=("documents" "user_sessions" "audit_logs" "prediction_results" "cost_tracking" "model_artifacts" "transactions")
    
    for table in "${expected_tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
            success "Table '$table' exists and is accessible"
        else
            error "Table '$table' is missing or not accessible"
            return 1
        fi
    done
    
    return 0
}

# Show table information
show_table_info() {
    log "Database table information:"
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            tableowner,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public' 
            AND tablename IN (
                'documents', 'user_sessions', 'audit_logs', 
                'prediction_results', 'cost_tracking', 
                'model_artifacts', 'transactions'
            )
        ORDER BY tablename;
    "
}

# Clean up tables (for development/testing)
cleanup_tables() {
    warning "This will DROP ALL TABLES and their data!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        log "Dropping all tables..."
        
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "
            DROP TABLE IF EXISTS transactions CASCADE;
            DROP TABLE IF EXISTS model_artifacts CASCADE;
            DROP TABLE IF EXISTS cost_tracking CASCADE;
            DROP TABLE IF EXISTS prediction_results CASCADE;
            DROP TABLE IF EXISTS audit_logs CASCADE;
            DROP TABLE IF EXISTS user_sessions CASCADE;
            DROP TABLE IF EXISTS documents CASCADE;
            DROP TYPE IF EXISTS document_type CASCADE;
            DROP TYPE IF EXISTS outcome CASCADE;
            DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
            DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;
        "
        
        success "All tables dropped"
    else
        log "Cleanup cancelled"
    fi
}

# Insert sample data for testing (legacy)
insert_sample_data() {
    log "Inserting sample data for testing..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "
        -- Insert sample documents
        INSERT INTO documents (merchant_id, title, body, document_type, sku) VALUES 
        ('test-merchant-123', 'Sample Product A', 'This is a high-quality product with excellent features. Perfect for everyday use.', 'product', 'SKU-001'),
        ('test-merchant-123', 'Sample Product B', 'Premium product with advanced technology. Ideal for professional use.', 'product', 'SKU-002'),
        ('test-merchant-123', 'Shipping Policy', 'We offer free shipping on orders over \$50. Standard delivery takes 3-5 business days.', 'policy', NULL),
        ('test-merchant-123', 'Return Policy', 'Returns are accepted within 30 days of purchase. Items must be in original condition.', 'policy', NULL),
        ('test-merchant-123', 'FAQ: How to use Product A', 'Product A is easy to use. Simply follow the included instructions for best results.', 'faq', 'SKU-001')
        ON CONFLICT DO NOTHING;
        
        -- Insert sample session
        INSERT INTO user_sessions (user_id, merchant_id, conversation_history, context) VALUES 
        ('test-user-456', 'test-merchant-123', 
         '[{\"role\": \"user\", \"content\": \"Hello\"}, {\"role\": \"assistant\", \"content\": \"Hi! How can I help you today?\"}]'::jsonb,
         '{\"last_query\": \"Hello\", \"session_start\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'::jsonb)
        ON CONFLICT DO NOTHING;
    "
    
    success "Sample data inserted"
}

# Insert comprehensive seed data for development
seed_development_data() {
    log "Seeding comprehensive development data..."
    
    local seed_file="database/migrations/008_seed_data_development.sql"
    
    if [ ! -f "$seed_file" ]; then
        error "Seed data file not found: $seed_file"
        return 1
    fi
    
    log "Executing seed data from $seed_file"
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$seed_file"; then
        success "Development seed data inserted successfully"
        return 0
    else
        error "Failed to insert seed data"
        return 1
    fi
}

# Main function
main() {
    log "🚀 Setting up MindsDB RAG Assistant Database"
    
    # Check prerequisites
    if ! check_psql; then
        exit 1
    fi
    
    # Test connection
    if ! test_connection; then
        exit 1
    fi
    
    # Run migration
    if ! run_migration; then
        exit 1
    fi
    
    # Verify tables
    if ! verify_tables; then
        exit 1
    fi
    
    # Show table info
    show_table_info
    
    success "🎉 Database setup completed successfully!"
    
    log ""
    log "📊 Database Information:"
    log "   Host: $DB_HOST:$DB_PORT"
    log "   Database: $DB_NAME"
    log "   User: $DB_USERNAME"
    log ""
    log "📋 Created Tables:"
    log "   - documents (product catalog, FAQs, policies)"
    log "   - user_sessions (chat sessions with history)"
    log "   - audit_logs (system audit trail)"
    log "   - prediction_results (ML prediction cache)"
    log "   - cost_tracking (AI operation costs)"
    log "   - model_artifacts (ML model versioning)"
    log "   - transactions (e-commerce transactions)"
    log ""
    log "🔧 Management Commands:"
    log "   ./scripts/setup-database.sh info     - Show table information"
    log "   ./scripts/setup-database.sh sample   - Insert sample data"
    log "   ./scripts/setup-database.sh clean    - Drop all tables (DANGEROUS)"
    log "   ./scripts/setup-database.sh test     - Test database connection"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "info")
        if test_connection; then
            show_table_info
        fi
        ;;
    "sample")
        if test_connection; then
            insert_sample_data
        fi
        ;;
    "seed")
        if test_connection; then
            seed_development_data
        fi
        ;;
    "clean")
        if test_connection; then
            cleanup_tables
        fi
        ;;
    "test")
        test_connection
        ;;
    *)
        echo "Usage: $0 [setup|info|sample|seed|clean|test]"
        echo ""
        echo "Commands:"
        echo "  setup  - Create all database tables (default)"
        echo "  info   - Show table information"
        echo "  sample - Insert sample data for testing (legacy)"
        echo "  seed   - Insert comprehensive development seed data"
        echo "  clean  - Drop all tables (DANGEROUS)"
        echo "  test   - Test database connection"
        echo ""
        echo "Environment Variables:"
        echo "  DB_HOST     - Database host (default: localhost)"
        echo "  DB_PORT     - Database port (default: 5432)"
        echo "  DB_NAME     - Database name (default: mindsdb_rag)"
        echo "  DB_USERNAME - Database username (default: postgres)"
        echo "  DB_PASSWORD - Database password (default: password)"
        exit 1
        ;;
esac