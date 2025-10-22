-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create custom vector index operator class if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_opclass 
        WHERE opcname = 'vector_cosine_ops'
    ) THEN
        -- This will be handled by the vector extension
        NULL;
    END IF;
END
$$;

-- Create GIN index for document metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin 
ON documents USING GIN (metadata);

-- Create vector index for embeddings (using IVFFlat with cosine distance)
-- Note: This should be created after data is loaded for optimal performance
-- Lists parameter should be approximately sqrt(total_rows)
CREATE INDEX IF NOT EXISTS idx_documents_embedding_cosine 
ON documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_active_products 
ON documents (merchant_id, sku) 
WHERE document_type = 'product' AND sku IS NOT NULL;

-- Create composite index for session cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup 
ON user_sessions (expires_at, merchant_id) 
WHERE expires_at < NOW();

-- Create index for cost tracking aggregations
CREATE INDEX IF NOT EXISTS idx_cost_tracking_daily 
ON cost_tracking (merchant_id, date_trunc('day', timestamp));

-- Add constraints for data integrity
ALTER TABLE documents 
ADD CONSTRAINT chk_embedding_dimensions 
CHECK (array_length(string_to_array(embedding::text, ','), 1) = 1536 OR embedding IS NULL);

-- Add constraint for valid document types
ALTER TABLE documents 
ADD CONSTRAINT chk_valid_document_type 
CHECK (document_type IN ('product', 'faq', 'policy', 'review'));

-- Add constraint for cost tracking
ALTER TABLE cost_tracking 
ADD CONSTRAINT chk_positive_cost 
CHECK (cost_usd >= 0);

-- Add constraint for transactions
ALTER TABLE transactions 
ADD CONSTRAINT chk_positive_amount 
CHECK (total_amount > 0);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for prediction cache cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_predictions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM prediction_results 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for cost analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_cost_summary AS
SELECT 
    merchant_id,
    date_trunc('day', timestamp) as date,
    operation,
    COUNT(*) as operation_count,
    SUM(cost_usd) as total_cost_usd,
    AVG(cost_usd) as avg_cost_usd,
    SUM(COALESCE((tokens->>'input')::numeric, 0)) as total_input_tokens,
    SUM(COALESCE((tokens->>'output')::numeric, 0)) as total_output_tokens
FROM cost_tracking
GROUP BY merchant_id, date_trunc('day', timestamp), operation;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_cost_summary_unique
ON daily_cost_summary (merchant_id, date, operation);

-- Create function to refresh cost summary
CREATE OR REPLACE FUNCTION refresh_daily_cost_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_cost_summary;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;