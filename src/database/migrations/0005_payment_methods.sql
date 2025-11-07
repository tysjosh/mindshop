-- Migration: Create payment_methods table
-- Description: Stores payment method information from Stripe for merchants
-- Date: 2025-11-04

-- ============================================================================
-- PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- card, bank_account, sepa_debit, etc.
  last4 VARCHAR(4),
  brand VARCHAR(50), -- visa, mastercard, amex, etc.
  exp_month INTEGER,
  exp_year INTEGER,
  bank_name VARCHAR(255),
  account_holder_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT payment_methods_type_check CHECK (type IN ('card', 'bank_account', 'sepa_debit', 'us_bank_account')),
  CONSTRAINT payment_methods_exp_month_check CHECK (exp_month IS NULL OR (exp_month >= 1 AND exp_month <= 12)),
  CONSTRAINT payment_methods_exp_year_check CHECK (exp_year IS NULL OR exp_year >= 2024),
  CONSTRAINT payment_methods_last4_check CHECK (last4 IS NULL OR length(last4) = 4)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_merchant_id ON payment_methods(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method_id ON payment_methods(stripe_payment_method_id);

-- Type filtering
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);

-- Default payment method lookup (should be unique per merchant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_merchant_default ON payment_methods(merchant_id) 
  WHERE is_default = true;

-- Active payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_merchant_type ON payment_methods(merchant_id, type);

-- Expiration tracking for cards
CREATE INDEX IF NOT EXISTS idx_payment_methods_expiring ON payment_methods(exp_year, exp_month) 
  WHERE type = 'card' AND exp_year IS NOT NULL;

-- Cards expiring soon (within 2 months)
CREATE INDEX IF NOT EXISTS idx_payment_methods_expiring_soon ON payment_methods(merchant_id, exp_year, exp_month) 
  WHERE type = 'card' 
    AND exp_year IS NOT NULL 
    AND (
      (exp_year = EXTRACT(YEAR FROM NOW()) AND exp_month <= EXTRACT(MONTH FROM NOW()) + 2)
      OR (exp_year = EXTRACT(YEAR FROM NOW()) + 1 AND exp_month + 12 <= EXTRACT(MONTH FROM NOW()) + 2)
    );

-- Recent payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_created_at ON payment_methods(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Ensure only one default payment method per merchant
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default payment methods for this merchant
    UPDATE payment_methods 
    SET is_default = false 
    WHERE merchant_id = NEW.merchant_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_payment_method
  BEFORE INSERT OR UPDATE ON payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_methods IS 'Stores payment method information from Stripe for merchants';
COMMENT ON COLUMN payment_methods.merchant_id IS 'Reference to merchant account';
COMMENT ON COLUMN payment_methods.stripe_payment_method_id IS 'Stripe payment method ID';
COMMENT ON COLUMN payment_methods.type IS 'Payment method type (card, bank_account, etc.)';
COMMENT ON COLUMN payment_methods.last4 IS 'Last 4 digits of card or account number';
COMMENT ON COLUMN payment_methods.brand IS 'Card brand (visa, mastercard, etc.)';
COMMENT ON COLUMN payment_methods.exp_month IS 'Card expiration month (1-12)';
COMMENT ON COLUMN payment_methods.exp_year IS 'Card expiration year';
COMMENT ON COLUMN payment_methods.bank_name IS 'Bank name for bank account payment methods';
COMMENT ON COLUMN payment_methods.account_holder_name IS 'Name on the account';
COMMENT ON COLUMN payment_methods.is_default IS 'Whether this is the default payment method';
