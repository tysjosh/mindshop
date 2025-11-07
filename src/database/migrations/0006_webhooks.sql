-- Migration: Create webhooks table
-- Description: Stores webhook configurations for merchant event notifications
-- Date: 2025-11-04

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create webhook status enum if not exists
DO $$ BEGIN
    CREATE TYPE webhook_status AS ENUM ('active', 'disabled', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(100) UNIQUE NOT NULL,
  merchant_id VARCHAR(100) NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events JSONB NOT NULL, -- Array of event types: ['chat.completed', 'document.created', etc.]
  secret TEXT NOT NULL, -- HMAC secret for signature verification
  status webhook_status NOT NULL DEFAULT 'active',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT webhooks_url_check CHECK (url ~ '^https?://'),
  CONSTRAINT webhooks_failure_count_check CHECK (failure_count >= 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_webhook_id ON webhooks(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_id ON webhooks(merchant_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_status ON webhooks(merchant_id, status);

-- Event subscription queries (GIN index for JSONB array containment)
CREATE INDEX IF NOT EXISTS idx_webhooks_events_gin ON webhooks USING GIN (events);

-- Failure tracking
CREATE INDEX IF NOT EXISTS idx_webhooks_failure_count ON webhooks(failure_count) WHERE failure_count > 0;
CREATE INDEX IF NOT EXISTS idx_webhooks_last_failure_at ON webhooks(last_failure_at) WHERE last_failure_at IS NOT NULL;

-- Active webhooks lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(merchant_id, status) WHERE status = 'active';

-- Temporal indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_updated_at ON webhooks(updated_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();

-- Auto-disable webhook after too many failures
CREATE OR REPLACE FUNCTION auto_disable_failed_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- If failure count reaches 10, automatically disable the webhook
  IF NEW.failure_count >= 10 AND NEW.status = 'active' THEN
    NEW.status = 'failed';
    RAISE NOTICE 'Webhook % automatically disabled after % failures', NEW.webhook_id, NEW.failure_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_disable_failed_webhook
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  WHEN (NEW.failure_count >= 10 AND OLD.failure_count < 10)
  EXECUTE FUNCTION auto_disable_failed_webhook();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active webhooks for a specific event type
CREATE OR REPLACE FUNCTION get_active_webhooks_for_event(
  p_merchant_id VARCHAR(100),
  p_event_type TEXT
)
RETURNS TABLE (
  webhook_id VARCHAR(100),
  url TEXT,
  secret TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.webhook_id,
    w.url,
    w.secret
  FROM webhooks w
  WHERE w.merchant_id = p_merchant_id
    AND w.status = 'active'
    AND w.events @> to_jsonb(ARRAY[p_event_type]);
END;
$$ LANGUAGE plpgsql;

-- Function to increment failure count
CREATE OR REPLACE FUNCTION increment_webhook_failure(
  p_webhook_id VARCHAR(100)
)
RETURNS void AS $$
BEGIN
  UPDATE webhooks
  SET 
    failure_count = failure_count + 1,
    last_failure_at = NOW()
  WHERE webhook_id = p_webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record successful delivery
CREATE OR REPLACE FUNCTION record_webhook_success(
  p_webhook_id VARCHAR(100)
)
RETURNS void AS $$
BEGIN
  UPDATE webhooks
  SET 
    failure_count = 0,
    last_success_at = NOW()
  WHERE webhook_id = p_webhook_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhooks IS 'Stores webhook configurations for merchant event notifications';
COMMENT ON COLUMN webhooks.webhook_id IS 'Unique identifier for the webhook (e.g., whk_abc123)';
COMMENT ON COLUMN webhooks.merchant_id IS 'Reference to merchant account';
COMMENT ON COLUMN webhooks.url IS 'Webhook endpoint URL (must be HTTPS in production)';
COMMENT ON COLUMN webhooks.events IS 'Array of event types this webhook subscribes to';
COMMENT ON COLUMN webhooks.secret IS 'HMAC secret for webhook signature verification';
COMMENT ON COLUMN webhooks.status IS 'Current webhook status (active, disabled, failed)';
COMMENT ON COLUMN webhooks.failure_count IS 'Consecutive failure count (resets on success)';
COMMENT ON COLUMN webhooks.last_success_at IS 'Timestamp of last successful delivery';
COMMENT ON COLUMN webhooks.last_failure_at IS 'Timestamp of last failed delivery';

COMMENT ON FUNCTION get_active_webhooks_for_event IS 'Returns active webhooks subscribed to a specific event type';
COMMENT ON FUNCTION increment_webhook_failure IS 'Increments failure count and updates last_failure_at';
COMMENT ON FUNCTION record_webhook_success IS 'Resets failure count and updates last_success_at';
