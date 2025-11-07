-- Migration: Add cost_tracking table
-- Description: Track costs for operations across the RAG system to monitor $0.05/session target
-- Date: 2025-11-05

-- Create cost_tracking table
CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  session_id UUID,
  user_id TEXT,
  operation TEXT NOT NULL, -- 'retrieval', 'prediction', 'generation', 'checkout', etc.
  cost_usd REAL NOT NULL,
  tokens JSONB DEFAULT '{}'::jsonb, -- {input: 100, output: 50}
  compute_ms REAL, -- compute time in milliseconds
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cost_merchant ON cost_tracking(merchant_id);
CREATE INDEX IF NOT EXISTS idx_cost_session ON cost_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_operation ON cost_tracking(operation);

-- Add comment
COMMENT ON TABLE cost_tracking IS 'Tracks costs for all operations to monitor per-session cost targets';
