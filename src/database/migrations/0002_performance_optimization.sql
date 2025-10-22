-- Performance optimization migration
-- This should be run after initial data load

-- Analyze tables for better query planning
ANALYZE documents;
ANALYZE user_sessions;
ANALYZE audit_logs;
ANALYZE prediction_results;
ANALYZE cost_tracking;
ANALYZE model_artifacts;
ANALYZE transactions;

-- Update vector index with better lists parameter based on data size
DO $$
DECLARE
    doc_count INTEGER;
    optimal_lists INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count FROM documents WHERE embedding IS NOT NULL;
    
    IF doc_count > 0 THEN
        -- Calculate optimal lists parameter (approximately sqrt of row count)
        optimal_lists := GREATEST(1, LEAST(1000, SQRT(doc_count)::INTEGER));
        
        -- Drop and recreate index with optimal parameters
        DROP INDEX IF EXISTS idx_documents_embedding_cosine;
        
        EXECUTE format('CREATE INDEX idx_documents_embedding_cosine 
                       ON documents USING ivfflat (embedding vector_cosine_ops) 
                       WITH (lists = %s)', optimal_lists);
    END IF;
END
$$;

-- Create additional performance indexes based on query patterns
CREATE INDEX IF NOT EXISTS idx_documents_merchant_type_created 
ON documents (merchant_id, document_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_merchant_user_activity 
ON user_sessions (merchant_id, user_id, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_audit_merchant_operation_timestamp 
ON audit_logs (merchant_id, operation, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_merchant_created 
ON prediction_results (merchant_id, created_at DESC) 
WHERE expires_at > NOW();

-- Create covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_search_covering 
ON documents (merchant_id, document_type) 
INCLUDE (id, title, sku, created_at);

-- Optimize for session-based queries
CREATE INDEX IF NOT EXISTS idx_cost_session_summary 
ON cost_tracking (session_id, operation) 
INCLUDE (cost_usd, tokens, compute_ms);

-- Create partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_active_sessions 
ON user_sessions (merchant_id, last_activity DESC) 
WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_recent_transactions 
ON transactions (merchant_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Set up table statistics targets for better query planning
ALTER TABLE documents ALTER COLUMN merchant_id SET STATISTICS 1000;
ALTER TABLE documents ALTER COLUMN document_type SET STATISTICS 1000;
ALTER TABLE user_sessions ALTER COLUMN merchant_id SET STATISTICS 1000;
ALTER TABLE cost_tracking ALTER COLUMN merchant_id SET STATISTICS 1000;
ALTER TABLE cost_tracking ALTER COLUMN operation SET STATISTICS 1000;

-- Configure autovacuum for high-traffic tables
ALTER TABLE user_sessions SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE cost_tracking SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

-- Create function for vector similarity search with performance optimization
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1536),
    merchant_filter text,
    doc_type_filter text DEFAULT NULL,
    similarity_threshold real DEFAULT 0.7,
    result_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    sku text,
    metadata jsonb,
    similarity_score real,
    document_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.body,
        d.sku,
        d.metadata,
        1 - (d.embedding <=> query_embedding) as similarity_score,
        d.document_type::text
    FROM documents d
    WHERE d.merchant_id = merchant_filter
        AND d.embedding IS NOT NULL
        AND (doc_type_filter IS NULL OR d.document_type::text = doc_type_filter)
        AND (1 - (d.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function for cost aggregation
CREATE OR REPLACE FUNCTION get_session_cost_summary(
    session_filter uuid
)
RETURNS TABLE (
    total_cost_usd real,
    operation_breakdown jsonb,
    total_tokens jsonb,
    session_duration_minutes real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(ct.cost_usd) as total_cost_usd,
        jsonb_object_agg(ct.operation, ct.operation_cost) as operation_breakdown,
        jsonb_build_object(
            'total_input', SUM(COALESCE((ct.tokens->>'input')::numeric, 0)),
            'total_output', SUM(COALESCE((ct.tokens->>'output')::numeric, 0))
        ) as total_tokens,
        EXTRACT(EPOCH FROM (MAX(ct.timestamp) - MIN(ct.timestamp))) / 60 as session_duration_minutes
    FROM (
        SELECT 
            operation,
            SUM(cost_usd) as operation_cost,
            cost_usd,
            tokens,
            timestamp
        FROM cost_tracking 
        WHERE session_id = session_filter
        GROUP BY operation, cost_usd, tokens, timestamp
    ) ct;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function for merchant cost analytics
CREATE OR REPLACE FUNCTION get_merchant_cost_analytics(
    merchant_filter text,
    start_date timestamp DEFAULT NOW() - INTERVAL '30 days',
    end_date timestamp DEFAULT NOW()
)
RETURNS TABLE (
    total_cost_usd real,
    avg_cost_per_session real,
    total_sessions bigint,
    cost_by_operation jsonb,
    daily_trend jsonb
) AS $$
BEGIN
    RETURN QUERY
    WITH session_costs AS (
        SELECT 
            session_id,
            SUM(cost_usd) as session_cost
        FROM cost_tracking
        WHERE merchant_id = merchant_filter
            AND timestamp BETWEEN start_date AND end_date
            AND session_id IS NOT NULL
        GROUP BY session_id
    ),
    operation_costs AS (
        SELECT 
            operation,
            SUM(cost_usd) as operation_total
        FROM cost_tracking
        WHERE merchant_id = merchant_filter
            AND timestamp BETWEEN start_date AND end_date
        GROUP BY operation
    ),
    daily_costs AS (
        SELECT 
            date_trunc('day', timestamp) as day,
            SUM(cost_usd) as daily_cost
        FROM cost_tracking
        WHERE merchant_id = merchant_filter
            AND timestamp BETWEEN start_date AND end_date
        GROUP BY date_trunc('day', timestamp)
        ORDER BY day
    )
    SELECT 
        (SELECT SUM(session_cost) FROM session_costs) as total_cost_usd,
        (SELECT AVG(session_cost) FROM session_costs) as avg_cost_per_session,
        (SELECT COUNT(*) FROM session_costs) as total_sessions,
        (SELECT jsonb_object_agg(operation, operation_total) FROM operation_costs) as cost_by_operation,
        (SELECT jsonb_agg(jsonb_build_object('date', day, 'cost', daily_cost)) FROM daily_costs) as daily_trend;
END;
$$ LANGUAGE plpgsql STABLE;

-- Final analyze after index creation
ANALYZE;