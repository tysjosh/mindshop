-- MindsDB RAG Assistant Database Schema
-- Run this script to create all required tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('product', 'faq', 'policy', 'review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE outcome AS ENUM ('success', 'failure');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    sku TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding TEXT, -- Vector embedding as text for now
    document_type document_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_merchant ON documents(merchant_id);
CREATE INDEX IF NOT EXISTS idx_documents_sku ON documents(sku);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    conversation_history JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON user_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    merchant_id TEXT NOT NULL,
    user_id TEXT,
    session_id UUID,
    operation TEXT NOT NULL,
    request_payload_hash TEXT NOT NULL,
    response_reference TEXT NOT NULL,
    outcome outcome NOT NULL,
    reason TEXT,
    actor TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_merchant ON audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- Prediction results table
CREATE TABLE IF NOT EXISTS prediction_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    demand_score REAL NOT NULL,
    purchase_probability REAL NOT NULL,
    explanation TEXT NOT NULL,
    feature_importance JSONB NOT NULL,
    provenance JSONB NOT NULL,
    confidence REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create indexes for prediction_results
CREATE INDEX IF NOT EXISTS idx_predictions_merchant_sku ON prediction_results(merchant_id, sku);
CREATE INDEX IF NOT EXISTS idx_predictions_expires ON prediction_results(expires_at);

-- Cost tracking table
CREATE TABLE IF NOT EXISTS cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    session_id UUID,
    user_id TEXT,
    operation TEXT NOT NULL,
    cost_usd REAL NOT NULL,
    tokens JSONB DEFAULT '{}'::jsonb,
    compute_ms REAL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for cost_tracking
CREATE INDEX IF NOT EXISTS idx_cost_merchant ON cost_tracking(merchant_id);
CREATE INDEX IF NOT EXISTS idx_cost_session ON cost_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_operation ON cost_tracking(operation);

-- Model artifacts table
CREATE TABLE IF NOT EXISTS model_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_type TEXT NOT NULL,
    s3_location TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    training_metrics JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'training',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for model_artifacts
CREATE INDEX IF NOT EXISTS idx_artifacts_merchant_model ON model_artifacts(merchant_id, model_name);
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON model_artifacts(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON model_artifacts(created_at);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE,
    merchant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id UUID,
    items JSONB NOT NULL,
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_method TEXT NOT NULL,
    payment_gateway TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    gateway_transaction_id TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Create a function to automatically update updated_at timestamp
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

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Insert some sample data for testing (optional)
-- INSERT INTO documents (merchant_id, title, body, document_type) VALUES 
-- ('test-merchant-123', 'Sample Product', 'This is a sample product description.', 'product');

COMMENT ON TABLE user_sessions IS 'User chat sessions with conversation history';
COMMENT ON TABLE documents IS 'Document store for RAG system';
COMMENT ON TABLE audit_logs IS 'Audit trail for all system operations';
COMMENT ON TABLE prediction_results IS 'Cached ML prediction results';
COMMENT ON TABLE cost_tracking IS 'Cost tracking for AI operations';
COMMENT ON TABLE model_artifacts IS 'ML model versioning and artifacts';
COMMENT ON TABLE transactions IS 'E-commerce transaction records';

-- Show created tables
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'documents', 'user_sessions', 'audit_logs', 
        'prediction_results', 'cost_tracking', 
        'model_artifacts', 'transactions'
    )
ORDER BY tablename;