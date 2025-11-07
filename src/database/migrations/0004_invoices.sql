-- Migration: Create invoices table
-- Description: Stores invoice records from Stripe for merchant billing
-- Date: 2025-11-04

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(100) NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  amount_due INTEGER NOT NULL, -- in cents
  amount_paid INTEGER NOT NULL DEFAULT 0, -- in cents
  amount_remaining INTEGER GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- draft, open, paid, void, uncollectible
  invoice_pdf VARCHAR(500),
  hosted_invoice_url VARCHAR(500),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  CONSTRAINT invoices_amount_due_positive CHECK (amount_due >= 0),
  CONSTRAINT invoices_amount_paid_positive CHECK (amount_paid >= 0),
  CONSTRAINT invoices_currency_check CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_status ON invoices(merchant_id, status);

-- Temporal indexes
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start);
CREATE INDEX IF NOT EXISTS idx_invoices_period_end ON invoices(period_end);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_created ON invoices(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_period ON invoices(merchant_id, period_start, period_end);

-- Unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(merchant_id, status, created_at) 
  WHERE status IN ('open', 'draft');

-- Overdue invoices
CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON invoices(merchant_id, due_date, status) 
  WHERE status = 'open' AND due_date < NOW();

-- Amount tracking
CREATE INDEX IF NOT EXISTS idx_invoices_amount_due ON invoices(amount_due);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_remaining ON invoices(amount_remaining) WHERE amount_remaining > 0;

-- Recent invoices for dashboard
CREATE INDEX IF NOT EXISTS idx_invoices_recent ON invoices(merchant_id, created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '90 days';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE invoices IS 'Stores invoice records from Stripe for merchant billing';
COMMENT ON COLUMN invoices.merchant_id IS 'Reference to merchant account';
COMMENT ON COLUMN invoices.stripe_invoice_id IS 'Stripe invoice ID';
COMMENT ON COLUMN invoices.amount_due IS 'Total amount due in cents';
COMMENT ON COLUMN invoices.amount_paid IS 'Amount paid in cents';
COMMENT ON COLUMN invoices.amount_remaining IS 'Computed: amount_due - amount_paid';
COMMENT ON COLUMN invoices.currency IS 'Currency code (ISO 4217)';
COMMENT ON COLUMN invoices.status IS 'Invoice status from Stripe';
COMMENT ON COLUMN invoices.invoice_pdf IS 'URL to invoice PDF';
COMMENT ON COLUMN invoices.hosted_invoice_url IS 'URL to Stripe hosted invoice page';
COMMENT ON COLUMN invoices.period_start IS 'Start of billing period';
COMMENT ON COLUMN invoices.period_end IS 'End of billing period';
COMMENT ON COLUMN invoices.due_date IS 'Invoice due date';
COMMENT ON COLUMN invoices.paid_at IS 'Timestamp when invoice was paid';
