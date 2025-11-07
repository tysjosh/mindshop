-- Migration: Enhance webhook_deliveries table
-- Description: Adds constraints, triggers, and helper functions for webhook delivery management
-- Date: 2025-11-04
-- Note: The webhook_deliveries table already exists (created by Drizzle ORM)
--       This migration adds additional constraints, indexes, triggers, and helper functions

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Webhook delivery status enum should already exist from Drizzle schema
-- Verify it exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_delivery_status') THEN
        CREATE TYPE webhook_delivery_status AS ENUM ('pending', 'success', 'failed');
    END IF;
END $$;

-- ============================================================================
-- ADD CONSTRAINTS TO EXISTING TABLE
-- ============================================================================

-- Add check constraints if they don't exist
DO $$ BEGIN
    -- Attempt count must be non-negative
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_deliveries_attempt_count_check'
    ) THEN
        ALTER TABLE webhook_deliveries 
        ADD CONSTRAINT webhook_deliveries_attempt_count_check 
        CHECK (attempt_count >= 0);
    END IF;

    -- Attempt count maximum limit
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_deliveries_attempt_count_max'
    ) THEN
        ALTER TABLE webhook_deliveries 
        ADD CONSTRAINT webhook_deliveries_attempt_count_max 
        CHECK (attempt_count <= 10);
    END IF;

    -- Status code validation
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_deliveries_status_code_check'
    ) THEN
        ALTER TABLE webhook_deliveries 
        ADD CONSTRAINT webhook_deliveries_status_code_check 
        CHECK (status_code IS NULL OR (status_code >= 100 AND status_code < 600));
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

-- Retry queue management
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) 
  WHERE next_retry_at IS NOT NULL AND status = 'failed';

-- Temporal indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at) 
  WHERE delivered_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_status ON webhook_deliveries(webhook_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created ON webhook_deliveries(webhook_id, created_at DESC);

-- Pending deliveries queue
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(created_at) 
  WHERE status = 'pending';

-- Failed deliveries for retry
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed_retry ON webhook_deliveries(next_retry_at, attempt_count) 
  WHERE status = 'failed' AND attempt_count < 3;

-- GIN index for payload queries (if needed for debugging)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_payload_gin ON webhook_deliveries USING GIN (payload);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update delivered_at timestamp when status changes to success
CREATE OR REPLACE FUNCTION update_webhook_delivery_delivered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND OLD.status != 'success' THEN
    NEW.delivered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhook_delivery_delivered_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'success' AND OLD.status != 'success')
  EXECUTE FUNCTION update_webhook_delivery_delivered_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get pending deliveries for processing
CREATE OR REPLACE FUNCTION get_pending_webhook_deliveries(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  webhook_id TEXT,
  event_type TEXT,
  payload JSONB,
  attempt_count REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.id,
    wd.webhook_id,
    wd.event_type,
    wd.payload,
    wd.attempt_count
  FROM webhook_deliveries wd
  WHERE wd.status = 'pending'
  ORDER BY wd.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get failed deliveries ready for retry
CREATE OR REPLACE FUNCTION get_webhook_deliveries_for_retry(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  webhook_id TEXT,
  event_type TEXT,
  payload JSONB,
  attempt_count REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.id,
    wd.webhook_id,
    wd.event_type,
    wd.payload,
    wd.attempt_count
  FROM webhook_deliveries wd
  WHERE wd.status = 'failed'
    AND wd.next_retry_at IS NOT NULL
    AND wd.next_retry_at <= NOW()
    AND wd.attempt_count < 3
  ORDER BY wd.next_retry_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Drop old function signatures if they exist
DROP FUNCTION IF EXISTS record_webhook_delivery_attempt(UUID, webhook_delivery_status, INTEGER, TEXT, TIMESTAMP);
DROP FUNCTION IF EXISTS create_webhook_delivery(VARCHAR, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS get_webhook_delivery_history(VARCHAR, INTEGER, INTEGER);

-- Function to record delivery attempt
CREATE OR REPLACE FUNCTION record_webhook_delivery_attempt(
  p_delivery_id UUID,
  p_status webhook_delivery_status,
  p_status_code REAL,
  p_response_body TEXT,
  p_next_retry_at TIMESTAMP DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE webhook_deliveries
  SET 
    status = p_status,
    status_code = p_status_code,
    response_body = p_response_body,
    attempt_count = attempt_count + 1,
    next_retry_at = p_next_retry_at
  WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create webhook delivery
CREATE OR REPLACE FUNCTION create_webhook_delivery(
  p_webhook_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS UUID AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
  VALUES (p_webhook_id, p_event_type, p_payload, 'pending')
  RETURNING id INTO v_delivery_id;
  
  RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get delivery history for a webhook
CREATE OR REPLACE FUNCTION get_webhook_delivery_history(
  p_webhook_id TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  status webhook_delivery_status,
  status_code REAL,
  attempt_count REAL,
  created_at TIMESTAMP,
  delivered_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.id,
    wd.event_type,
    wd.status,
    wd.status_code,
    wd.attempt_count,
    wd.created_at,
    wd.delivered_at
  FROM webhook_deliveries wd
  WHERE wd.webhook_id = p_webhook_id
  ORDER BY wd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhook_deliveries IS 'Stores webhook delivery attempts for audit trail and retry logic';
COMMENT ON COLUMN webhook_deliveries.id IS 'Unique identifier for the delivery attempt';
COMMENT ON COLUMN webhook_deliveries.webhook_id IS 'Reference to the webhook configuration';
COMMENT ON COLUMN webhook_deliveries.event_type IS 'Type of event being delivered (e.g., chat.query.completed)';
COMMENT ON COLUMN webhook_deliveries.payload IS 'JSON payload sent to the webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.status IS 'Delivery status (pending, success, failed)';
COMMENT ON COLUMN webhook_deliveries.status_code IS 'HTTP status code from the webhook endpoint';
COMMENT ON COLUMN webhook_deliveries.response_body IS 'Response body from the webhook endpoint (truncated if too large)';
COMMENT ON COLUMN webhook_deliveries.attempt_count IS 'Number of delivery attempts made';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'Timestamp for next retry attempt (if failed)';
COMMENT ON COLUMN webhook_deliveries.delivered_at IS 'Timestamp when delivery succeeded';
COMMENT ON COLUMN webhook_deliveries.created_at IS 'Timestamp when delivery was created';

COMMENT ON FUNCTION get_pending_webhook_deliveries IS 'Returns pending webhook deliveries for processing';
COMMENT ON FUNCTION get_webhook_deliveries_for_retry IS 'Returns failed deliveries ready for retry';
COMMENT ON FUNCTION record_webhook_delivery_attempt IS 'Records a delivery attempt with status and response';
COMMENT ON FUNCTION create_webhook_delivery IS 'Creates a new webhook delivery record';
COMMENT ON FUNCTION get_webhook_delivery_history IS 'Returns delivery history for a webhook';

-- ============================================================================
-- SAMPLE DATA (for development/testing)
-- ============================================================================

-- Example webhook delivery events:
-- - chat.query.completed: { sessionId, query, response, timestamp }
-- - chat.query.failed: { sessionId, query, error, timestamp }
-- - document.created: { documentId, merchantId, title, timestamp }
-- - document.updated: { documentId, merchantId, changes, timestamp }
-- - document.deleted: { documentId, merchantId, timestamp }
-- - usage.limit.approaching: { merchantId, metricType, current, limit, percentage, timestamp }
-- - usage.limit.exceeded: { merchantId, metricType, current, limit, timestamp }
-- - api_key.expiring: { keyId, merchantId, expiresAt, daysRemaining, timestamp }
-- - api_key.created: { keyId, merchantId, name, environment, timestamp }
-- - api_key.revoked: { keyId, merchantId, name, timestamp }

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================

-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS trigger_webhook_delivery_delivered_at ON webhook_deliveries;
-- DROP FUNCTION IF EXISTS get_webhook_delivery_history(VARCHAR, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS create_webhook_delivery(VARCHAR, VARCHAR, JSONB);
-- DROP FUNCTION IF EXISTS record_webhook_delivery_attempt(UUID, webhook_delivery_status, INTEGER, TEXT, TIMESTAMP);
-- DROP FUNCTION IF EXISTS get_webhook_deliveries_for_retry(INTEGER);
-- DROP FUNCTION IF EXISTS get_pending_webhook_deliveries(INTEGER);
-- DROP FUNCTION IF EXISTS update_webhook_delivery_delivered_at();
-- DROP TABLE IF EXISTS webhook_deliveries CASCADE;
-- DROP TYPE IF EXISTS webhook_delivery_status;
