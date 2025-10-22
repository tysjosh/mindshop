#!/bin/bash
set -e

# Initialize pgvector extension and optimizations
# This script runs after PostgreSQL is initialized

echo "Initializing pgvector extension and optimizations..."

# Wait for PostgreSQL to be ready
until pg_isready -U postgres -d mindsdb_rag; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Connect to the database and set up extensions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS vector;
    
    -- Verify vector extension is loaded
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
    
    -- Set optimal pgvector parameters
    -- These settings optimize for 1536-dimensional embeddings (OpenAI ada-002)
    ALTER SYSTEM SET ivfflat.probes = 10;
    
    -- Reload configuration
    SELECT pg_reload_conf();
    
    -- Create a test vector to verify functionality
    DO \$\$
    BEGIN
        -- Test vector operations
        PERFORM '[1,2,3]'::vector;
        RAISE NOTICE 'Vector extension is working correctly';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Vector extension test failed: %', SQLERRM;
    END
    \$\$;
    
    -- Show current vector-related settings
    SHOW shared_preload_libraries;
    
    -- Create performance monitoring view
    CREATE OR REPLACE VIEW vector_index_stats AS
    SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE indexname LIKE '%vector%' OR indexname LIKE '%embedding%';
    
    COMMENT ON VIEW vector_index_stats IS 'Monitor vector index usage and performance';
EOSQL

echo "pgvector initialization completed successfully!"

# Set up automatic maintenance job (if needed)
cat > /tmp/maintenance.sql <<EOF
-- Maintenance queries for vector indexes
-- Run these periodically for optimal performance

-- Analyze tables with vector columns
ANALYZE documents;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;

-- Check vector index statistics
SELECT * FROM vector_index_stats;
EOF

echo "Maintenance SQL script created at /tmp/maintenance.sql"
echo "pgvector setup complete!"