-- Enhanced pgvector setup with optimized indexes and partitioning
-- This migration should be run after the initial Drizzle migration creates the tables
--
-- IMPORTANT: This file contains PL/pgSQL functions and optimizations.
-- The vector column type conversion and index creation is handled by the setup script:
-- 1. ALTER TABLE documents ALTER COLUMN embedding TYPE vector(1536)
-- 2. CREATE INDEX idx_documents_embedding_ivfflat ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)

-- Note: Vector indexes will be created after the embedding column is converted to vector type
-- This is handled by the setup script which:
-- 1. Converts embedding column from text to vector(1536)
-- 2. Creates the ivfflat index for optimal performance

-- Placeholder for vector index creation (done by setup script)
-- CREATE INDEX idx_documents_embedding_ivfflat ON documents 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create composite index for tenant-filtered searches (non-vector part)
CREATE INDEX IF NOT EXISTS idx_documents_merchant_embedding_filter ON documents (merchant_id)
WHERE merchant_id IS NOT NULL AND embedding IS NOT NULL;

-- Create GIN index for metadata JSONB queries
CREATE INDEX idx_documents_metadata_gin ON documents USING GIN (metadata);

-- Create partial indexes for common query patterns
CREATE INDEX idx_documents_merchant_type ON documents (merchant_id, document_type);
CREATE INDEX idx_documents_merchant_sku ON documents (merchant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_documents_merchant_created ON documents (merchant_id, created_at DESC);

-- Create materialized view for document statistics per merchant
CREATE MATERIALIZED VIEW document_stats AS
SELECT 
    merchant_id,
    document_type,
    COUNT(*) as document_count,
    COUNT(CASE WHEN sku IS NOT NULL THEN 1 END) as product_count,
    AVG(array_length(string_to_array(body, ' '), 1)) as avg_word_count,
    MIN(created_at) as first_document,
    MAX(created_at) as last_document,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_documents
FROM documents 
GROUP BY merchant_id, document_type;

-- Create unique index on materialized view for concurrent refresh
CREATE UNIQUE INDEX idx_document_stats_merchant_type ON document_stats (merchant_id, document_type);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to refresh document stats after document changes
CREATE OR REPLACE FUNCTION refresh_document_stats_trigger()
RETURNS TRIGGER AS $
BEGIN
    -- Refresh materialized view asynchronously to avoid blocking
    PERFORM pg_notify('refresh_stats', NEW.merchant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_stats_on_document_change
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION refresh_document_stats_trigger();

-- Create function for efficient vector similarity search with tenant filtering
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1536),
    target_merchant_id text,
    similarity_threshold float DEFAULT 0.7,
    result_limit int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    sku text,
    document_type document_type,
    metadata jsonb,
    similarity_score float,
    created_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.body,
        d.sku,
        d.document_type,
        d.metadata,
        1 - (d.embedding <=> query_embedding) as similarity_score,
        d.created_at
    FROM documents d
    WHERE d.merchant_id = target_merchant_id
        AND 1 - (d.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function for batch vector updates with transaction safety
CREATE OR REPLACE FUNCTION batch_update_embeddings(
    document_ids uuid[],
    embeddings vector(1536)[],
    target_merchant_id text
)
RETURNS int AS $$
DECLARE
    updated_count int := 0;
    i int;
BEGIN
    -- Validate input arrays have same length
    IF array_length(document_ids, 1) != array_length(embeddings, 1) THEN
        RAISE EXCEPTION 'Document IDs and embeddings arrays must have same length';
    END IF;
    
    -- Update embeddings in batch with merchant_id validation
    FOR i IN 1..array_length(document_ids, 1) LOOP
        UPDATE documents 
        SET embedding = embeddings[i], updated_at = NOW()
        WHERE id = document_ids[i] 
            AND merchant_id = target_merchant_id;
        
        IF FOUND THEN
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze vector index performance
CREATE OR REPLACE FUNCTION analyze_vector_index_stats(target_merchant_id text DEFAULT NULL)
RETURNS TABLE (
    merchant_id text,
    total_documents bigint,
    avg_embedding_dimension int,
    index_size text,
    last_vacuum timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.merchant_id::text,
        COUNT(*)::bigint as total_documents,
        CASE 
            WHEN COUNT(*) > 0 THEN array_length(d.embedding, 1)
            ELSE 0
        END as avg_embedding_dimension,
        pg_size_pretty(pg_relation_size('idx_documents_embedding_ivfflat'))::text as index_size,
        (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = 'documents') as last_vacuum
    FROM documents d
    WHERE (target_merchant_id IS NULL OR d.merchant_id = target_merchant_id)
        AND d.embedding IS NOT NULL
    GROUP BY d.merchant_id, d.embedding
    ORDER BY total_documents DESC;
END;
$$ LANGUAGE plpgsql;

-- Create maintenance function for vector index optimization
CREATE OR REPLACE FUNCTION maintain_vector_indexes()
RETURNS void AS $$
BEGIN
    -- Vacuum and analyze the documents table to optimize vector index
    VACUUM ANALYZE documents;
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;
    
    -- Log maintenance completion
    INSERT INTO audit_logs (
        merchant_id, 
        operation, 
        request_payload_hash, 
        response_reference, 
        outcome, 
        actor
    ) VALUES (
        'system',
        'vector_index_maintenance',
        'maintenance_' || extract(epoch from now())::text,
        'completed',
        'success',
        'system_maintenance'
    );
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job function (to be called by external scheduler)
CREATE OR REPLACE FUNCTION cleanup_and_maintain()
RETURNS void AS $$
DECLARE
    cleaned_sessions int;
    cleaned_predictions int;
BEGIN
    -- Clean up expired sessions
    SELECT cleanup_expired_sessions() INTO cleaned_sessions;
    
    -- Clean up expired prediction cache
    DELETE FROM prediction_results WHERE expires_at < NOW();
    GET DIAGNOSTICS cleaned_predictions = ROW_COUNT;
    
    -- Maintain vector indexes
    PERFORM maintain_vector_indexes();
    
    -- Log cleanup results
    INSERT INTO audit_logs (
        merchant_id, 
        operation, 
        request_payload_hash, 
        response_reference, 
        outcome, 
        actor
    ) VALUES (
        'system',
        'scheduled_cleanup',
        'cleanup_' || extract(epoch from now())::text,
        format('sessions:%s,predictions:%s', cleaned_sessions, cleaned_predictions),
        'success',
        'system_scheduler'
    );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust based on your application user)
-- GRANT EXECUTE ON FUNCTION search_similar_documents TO your_app_user;
-- GRANT EXECUTE ON FUNCTION batch_update_embeddings TO your_app_user;
-- GRANT EXECUTE ON FUNCTION analyze_vector_index_stats TO your_app_user;

-- Create indexes for audit logs performance
CREATE INDEX idx_audit_merchant_timestamp ON audit_logs (merchant_id, timestamp DESC);
CREATE INDEX idx_audit_operation_timestamp ON audit_logs (operation, timestamp DESC);

-- Create index for prediction results cache lookups
CREATE INDEX idx_predictions_merchant_sku_expires ON prediction_results (merchant_id, sku, expires_at) 
WHERE expires_at > NOW();

COMMENT ON FUNCTION search_similar_documents IS 'Optimized vector similarity search with tenant isolation';
COMMENT ON FUNCTION batch_update_embeddings IS 'Batch update embeddings with merchant validation';
COMMENT ON FUNCTION maintain_vector_indexes IS 'Maintenance routine for vector index optimization';
COMMENT ON MATERIALIZED VIEW document_stats IS 'Cached statistics for document corpus per merchant';