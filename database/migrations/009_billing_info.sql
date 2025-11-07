-- Migration: Create billing_info table
-- Description: Stores merchant billing information and Stripe subscription details
-- Date: 2025-11-04

-- ============================================================================
-- BILLING INFO TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
  status VARCHAR(50) NOT NULL DEFAULT 'trialing', -- active, past_due, canceled, trialing, incomplete
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT billing_info_plan_check CHECK (plan IN ('starter', 'professional', 'enterprise')),
  CONSTRAINT billing_info_status_check CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_billing_info_merchant_id ON billing_info(merchant_id);
CREATE INDEX IF NOT EXISTS idx_billing_info_stripe_customer_id ON billing_info(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_info_stripe_subscription_id ON billing_info(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Status and plan filtering
CREATE INDEX IF NOT EXISTS idx_billing_info_status ON billing_info(status);
CREATE INDEX IF NOT EXISTS idx_billing_info_plan ON billing_info(plan);
CREATE INDEX IF NOT EXISTS idx_billing_info_status_plan ON billing_info(status, plan);

-- Subscription period tracking
CREATE INDEX IF NOT EXISTS idx_billing_info_current_period_end ON billing_info(current_period_end) WHERE current_period_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_info_expiring_soon ON billing_info(current_period_end) 
  WHERE current_period_end > NOW() AND current_period_end < NOW() + INTERVAL '7 days';

-- Trial period tracking
CREATE INDEX IF NOT EXISTS idx_billing_info_trial_end ON billing_info(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_info_trial_expiring ON billing_info(trial_end) 
  WHERE trial_end > NOW() AND trial_end < NOW() + INTERVAL '7 days';

-- Cancellation tracking
CREATE INDEX IF NOT EXISTS idx_billing_info_cancel_at_period_end ON billing_info(cancel_at_period_end) 
  WHERE cancel_at_period_end = true;

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_billing_info_active ON billing_info(status, current_period_end) 
  WHERE status = 'active';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_billing_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_billing_info_updated_at
  BEFORE UPDATE ON billing_info
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_info_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE billing_info IS 'Stores merchant billing information and Stripe subscription details';
COMMENT ON COLUMN billing_info.merchant_id IS 'Reference to merchant account';
COMMENT ON COLUMN billing_info.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN billing_info.stripe_subscription_id IS 'Stripe subscription ID if subscribed';
COMMENT ON COLUMN billing_info.plan IS 'Current subscription plan tier';
COMMENT ON COLUMN billing_info.status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN billing_info.current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN billing_info.current_period_end IS 'End of current billing period';
COMMENT ON COLUMN billing_info.cancel_at_period_end IS 'Whether subscription will cancel at period end';
COMMENT ON COLUMN billing_info.trial_start IS 'Start of trial period if applicable';
COMMENT ON COLUMN billing_info.trial_end IS 'End of trial period if applicable';

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================

-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS trigger_billing_info_updated_at ON billing_info;
-- DROP FUNCTION IF EXISTS update_billing_info_updated_at();
-- DROP TABLE IF EXISTS billing_info CASCADE;
