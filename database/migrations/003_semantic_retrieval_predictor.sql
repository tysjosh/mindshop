-- Migration: Deploy Semantic Retrieval Predictor with Enhanced Features
-- This migration creates the semantic retrieval predictor with tenant isolation and explainability

-- Create enhanced semantic retrieval predictor template
-- This will be instantiated per merchant for tenant isolation
CREATE OR REPLACE FUNCTION deploy_semantic_retriever(merchant_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
    predictor_name TEXT;
    deployment_sql TEXT;
BEGIN
    -- Validate merchant_id
    IF merchant_id_param IS NULL OR LENGTH(merchant_id_param) < 3 THEN
        RAISE EXCEPTION 'Invalid merchant_id: %', merchant_id_param;
    END IF;
    
    -- Generate tenant-specific predictor name
    predictor_name := 'semantic_retriever_' || merchant_id_param;
    
    -- Build deployment SQL
    deployment_sql := format('
        CREATE OR REPLACE PREDICTOR mindsdb.%I
        FROM documents
        WHERE merchant_id = %L
        PREDICT similarity_score, confidence, grounding_pass, grounding_score
        USING
            engine = ''sentence_transformers'',
            model_name = ''all-MiniLM-L6-v2'',
            embeddings_column = ''embedding'',
            tenant_isolation = true,
            grounding_validation = true,
            confidence_threshold = 0.7,
            max_results = 50,
            metadata_fields = [''sku'', ''document_type'', ''source_uri'', ''title''],
            explainability = true,
            query_analysis = true,
            semantic_similarity_weights = {
                ''exact_match'': 0.4,
                ''semantic_similarity'': 0.4,
                ''contextual_relevance'': 0.2
            },
            grounding_criteria = {
                ''min_overlap'': 0.3,
                ''semantic_threshold'': 0.7,
                ''factual_consistency'': true
            }
    ', predictor_name, merchant_id_param);
    
    -- Log the deployment
    INSERT INTO audit_logs (
        merchant_id,
        operation,
        request_payload_hash,
        response_reference,
        outcome,
        actor,
        timestamp
    ) VALUES (
        merchant_id_param,
        'deploy_semantic_retriever',
        md5(deployment_sql),
        'predictor:' || predictor_name,
        'success',
        'system',
        NOW()
    );
    
    RETURN predictor_name;
END;
$$ LANGUAGE plpgsql;

-- Create grounding validation function
CREATE OR REPLACE FUNCTION validate_grounding(
    query_text TEXT,
    document_text TEXT,
    merchant_id_param TEXT
) RETURNS JSON AS $$
DECLARE
    grounding_result JSON;
    overlap_score FLOAT;
    semantic_score FLOAT;
    factual_score FLOAT;
    final_score FLOAT;
    passed BOOLEAN;
    reasons TEXT[];
BEGIN
    -- Calculate text overlap score
    overlap_score := (
        SELECT COUNT(DISTINCT word) * 1.0 / GREATEST(
            array_length(string_to_array(lower(query_text), ' '), 1),
            array_length(string_to_array(lower(document_text), ' '), 1)
        )
        FROM unnest(string_to_array(lower(query_text), ' ')) AS word
        WHERE word = ANY(string_to_array(lower(document_text), ' '))
    );
    
    -- Semantic similarity score (simplified - in practice would use embeddings)
    semantic_score := CASE 
        WHEN overlap_score > 0.5 THEN 0.9
        WHEN overlap_score > 0.3 THEN 0.7
        WHEN overlap_score > 0.1 THEN 0.5
        ELSE 0.3
    END;
    
    -- Factual consistency score (simplified heuristic)
    factual_score := CASE
        WHEN document_text ILIKE '%' || query_text || '%' THEN 0.95
        WHEN LENGTH(document_text) > 100 AND overlap_score > 0.3 THEN 0.8
        ELSE 0.6
    END;
    
    -- Calculate final grounding score
    final_score := (overlap_score * 0.3 + semantic_score * 0.4 + factual_score * 0.3);
    passed := final_score >= 0.7;
    
    -- Generate reasons
    reasons := ARRAY[]::TEXT[];
    IF overlap_score > 0.5 THEN
        reasons := array_append(reasons, 'High term overlap detected');
    END IF;
    IF semantic_score > 0.8 THEN
        reasons := array_append(reasons, 'Strong semantic similarity');
    END IF;
    IF factual_score > 0.8 THEN
        reasons := array_append(reasons, 'Good factual consistency');
    END IF;
    IF NOT passed THEN
        reasons := array_append(reasons, 'Below grounding threshold');
    END IF;
    
    -- Build result JSON
    grounding_result := json_build_object(
        'passed', passed,
        'score', final_score,
        'reasons', reasons,
        'breakdown', json_build_object(
            'overlap_score', overlap_score,
            'semantic_score', semantic_score,
            'factual_score', factual_score
        )
    );
    
    RETURN grounding_result;
END;
$$ LANGUAGE plpgsql;

-- Create query analysis function
CREATE OR REPLACE FUNCTION analyze_query(query_text TEXT)
RETURNS JSON AS $$
DECLARE
    analysis_result JSON;
    extracted_terms TEXT[];
    query_intent TEXT;
    processed_query TEXT;
BEGIN
    -- Process query
    processed_query := lower(trim(query_text));
    
    -- Extract meaningful terms (remove stop words)
    extracted_terms := (
        SELECT array_agg(word)
        FROM unnest(string_to_array(processed_query, ' ')) AS word
        WHERE LENGTH(word) > 2
        AND word NOT IN ('the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were')
    );
    
    -- Determine query intent
    query_intent := CASE
        WHEN query_text ~* '\b(buy|purchase|order|checkout)\b' THEN 'purchase_intent'
        WHEN query_text ~* '\b(compare|vs|versus|difference)\b' THEN 'comparison'
        WHEN query_text ~* '\b(how|what|why|when|where)\b' THEN 'information_seeking'
        WHEN query_text ~* '\b(recommend|suggest|best)\b' THEN 'recommendation'
        ELSE 'general_search'
    END;
    
    -- Build analysis result
    analysis_result := json_build_object(
        'originalQuery', query_text,
        'processedQuery', processed_query,
        'extractedTerms', extracted_terms,
        'queryIntent', query_intent,
        'termCount', array_length(extracted_terms, 1),
        'complexity', CASE
            WHEN array_length(extracted_terms, 1) > 5 THEN 'high'
            WHEN array_length(extracted_terms, 1) > 2 THEN 'medium'
            ELSE 'low'
        END
    );
    
    RETURN analysis_result;
END;
$$ LANGUAGE plpgsql;

-- Create predictor status tracking table
CREATE TABLE IF NOT EXISTS semantic_predictor_status (
    id SERIAL PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    predictor_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    deployment_date TIMESTAMP DEFAULT NOW(),
    last_health_check TIMESTAMP,
    health_status TEXT DEFAULT 'unknown',
    configuration JSONB,
    performance_metrics JSONB,
    error_log TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(merchant_id, predictor_name)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_semantic_predictor_merchant 
ON semantic_predictor_status(merchant_id);

CREATE INDEX IF NOT EXISTS idx_semantic_predictor_status 
ON semantic_predictor_status(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_semantic_predictor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER semantic_predictor_status_updated_at
    BEFORE UPDATE ON semantic_predictor_status
    FOR EACH ROW
    EXECUTE FUNCTION update_semantic_predictor_updated_at();

-- Create retrieval performance tracking table
CREATE TABLE IF NOT EXISTS retrieval_performance_metrics (
    id SERIAL PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    query_text TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    results_count INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT FALSE,
    grounding_pass_rate FLOAT,
    average_confidence FLOAT,
    query_intent TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    INDEX(merchant_id, timestamp),
    INDEX(query_hash)
);

-- Create view for predictor health monitoring
CREATE OR REPLACE VIEW semantic_retrieval_health AS
SELECT 
    sps.merchant_id,
    sps.predictor_name,
    sps.status,
    sps.health_status,
    sps.last_health_check,
    sps.deployment_date,
    COALESCE(rpm.avg_response_time, 0) as avg_response_time_ms,
    COALESCE(rpm.total_queries, 0) as total_queries_24h,
    COALESCE(rpm.avg_grounding_rate, 0) as avg_grounding_pass_rate,
    COALESCE(rpm.avg_confidence, 0) as avg_confidence_score
FROM semantic_predictor_status sps
LEFT JOIN (
    SELECT 
        merchant_id,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) as total_queries,
        AVG(grounding_pass_rate) as avg_grounding_rate,
        AVG(average_confidence) as avg_confidence
    FROM retrieval_performance_metrics 
    WHERE timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY merchant_id
) rpm ON sps.merchant_id = rpm.merchant_id;

-- Insert initial configuration for common deployment scenarios
INSERT INTO semantic_predictor_status (merchant_id, predictor_name, status, configuration)
VALUES 
    ('demo_merchant', 'semantic_retriever_demo_merchant', 'template', 
     '{"threshold": 0.7, "max_results": 10, "grounding_validation": true}'::jsonb)
ON CONFLICT (merchant_id, predictor_name) DO NOTHING;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION deploy_semantic_retriever(TEXT) TO mindsdb_service;
GRANT EXECUTE ON FUNCTION validate_grounding(TEXT, TEXT, TEXT) TO mindsdb_service;
GRANT EXECUTE ON FUNCTION analyze_query(TEXT) TO mindsdb_service;
GRANT SELECT, INSERT, UPDATE ON semantic_predictor_status TO mindsdb_service;
GRANT SELECT, INSERT ON retrieval_performance_metrics TO mindsdb_service;
GRANT SELECT ON semantic_retrieval_health TO mindsdb_service;