-- Migration: Add performance indexes for merchant platform tables
-- Description: Comprehensive indexing strategy for optimal query performance
-- Date: 2025-11-01

-- ============================================================================
-- MERCHANTS TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_merchants_merchant_id ON merchants(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_cognito_user_id ON merchants(cognito_user_id);

-- Status and filtering indexes
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_plan ON merchants(plan);
CREATE INDEX IF NOT EXISTS idx_merchants_status_plan ON merchants(status, plan);

-- Temporal indexes for analytics
CREATE INDEX IF NOT EXISTS idx_merchants_created_at ON merchants(created_at);
CREATE INDEX IF NOT EXISTS idx_merchants_verified_at ON merchants(verified_at) WHERE verified_at IS NOT NULL;

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_merchants_deleted_at ON merchants(deleted_at) WHERE deleted_at IS NULL;

-- Composite index for active merchants
CREATE INDEX IF NOT EXISTS idx_merchants_active ON merchants(status, created_at) WHERE status = 'active';

-- ============================================================================
-- MERCHANT SETTINGS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_merchant_settings_merchant_id ON merchant_settings(merchant_id);

-- GIN index for JSONB settings queries
CREATE INDEX IF NOT EXISTS idx_merchant_settings_settings_gin ON merchant_settings USING GIN (settings);

-- ============================================================================
-- API KEYS TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Status and environment filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_environment ON api_keys(environment);
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_status ON api_keys(merchant_id, status);

-- Expiration tracking
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_expiring_soon ON api_keys(expires_at) 
  WHERE expires_at IS NOT NULL AND expires_at > NOW() AND expires_at < NOW() + INTERVAL '7 days';

-- Last used tracking for cleanup
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON api_keys(last_used_at);

-- GIN index for permissions array
CREATE INDEX IF NOT EXISTS idx_api_keys_permissions_gin ON api_keys USING GIN (permissions);

-- Composite index for active keys lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_active_lookup ON api_keys(merchant_id, status, environment) 
  WHERE status = 'active';

-- ============================================================================
-- API KEY USAGE TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_merchant_id ON api_key_usage(merchant_id);

-- Temporal indexes for analytics
CREATE INDEX IF NOT EXISTS idx_api_key_usage_date ON api_key_usage(date);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_key_usage_merchant_date ON api_key_usage(merchant_id, date);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_date ON api_key_usage(key_id, date);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_merchant_timestamp ON api_key_usage(merchant_id, timestamp);

-- Endpoint analytics
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_method ON api_key_usage(method);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_status_code ON api_key_usage(status_code);

-- Performance monitoring
CREATE INDEX IF NOT EXISTS idx_api_key_usage_response_time ON api_key_usage(response_time_ms);

-- Composite index for error tracking
CREATE INDEX IF NOT EXISTS idx_api_key_usage_errors ON api_key_usage(merchant_id, status_code, timestamp) 
  WHERE status_code >= 400;

-- ============================================================================
-- MERCHANT USAGE TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_merchant_usage_merchant_id ON merchant_usage(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_usage_date ON merchant_usage(date);
CREATE INDEX IF NOT EXISTS idx_merchant_usage_metric_type ON merchant_usage(metric_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_merchant_usage_merchant_date ON merchant_usage(merchant_id, date);
CREATE INDEX IF NOT EXISTS idx_merchant_usage_merchant_metric ON merchant_usage(merchant_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_merchant_usage_merchant_date_metric ON merchant_usage(merchant_id, date, metric_type);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_merchant_usage_date_range ON merchant_usage(merchant_id, date DESC);

-- GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_merchant_usage_metadata_gin ON merchant_usage USING GIN (metadata);

-- Aggregation optimization
CREATE INDEX IF NOT EXISTS idx_merchant_usage_aggregation ON merchant_usage(metric_type, date, metric_value);

-- ============================================================================
-- USAGE LIMITS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_limits_merchant_id ON usage_limits(merchant_id);
CREATE INDEX IF NOT EXISTS idx_usage_limits_plan ON usage_limits(plan);

-- Composite index for limit checks
CREATE INDEX IF NOT EXISTS idx_usage_limits_merchant_plan ON usage_limits(merchant_id, plan);

-- ============================================================================
-- WEBHOOKS TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_id ON webhooks(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_webhook_id ON webhooks(webhook_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_status ON webhooks(merchant_id, status);

-- Event subscription queries
CREATE INDEX IF NOT EXISTS idx_webhooks_events_gin ON webhooks USING GIN (events);

-- Failure tracking
CREATE INDEX IF NOT EXISTS idx_webhooks_failure_count ON webhooks(failure_count) WHERE failure_count > 0;
CREATE INDEX IF NOT EXISTS idx_webhooks_last_failure_at ON webhooks(last_failure_at) WHERE last_failure_at IS NOT NULL;

-- Active webhooks lookup
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(merchant_id, status) WHERE status = 'active';

-- ============================================================================
-- WEBHOOK DELIVERIES TABLE INDEXES
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
-- BILLING INFO TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_billing_info_merchant_id ON billing_info(merchant_id);
CREATE INDEX IF NOT EXISTS idx_billing_info_stripe_customer_id ON billing_info(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_info_stripe_subscription_id ON billing_info(stripe_subscription_id);

-- Status and plan filtering
CREATE INDEX IF NOT EXISTS idx_billing_info_status ON billing_info(status);
CREATE INDEX IF NOT EXISTS idx_billing_info_plan ON billing_info(plan);
CREATE INDEX IF NOT EXISTS idx_billing_info_status_plan ON billing_info(status, plan);

-- Subscription period tracking
CREATE INDEX IF NOT EXISTS idx_billing_info_current_period_end ON billing_info(current_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_info_expiring_soon ON billing_info(current_period_end) 
  WHERE current_period_end > NOW() AND current_period_end < NOW() + INTERVAL '7 days';

-- Cancellation tracking
CREATE INDEX IF NOT EXISTS idx_billing_info_cancel_at_period_end ON billing_info(cancel_at_period_end) 
  WHERE cancel_at_period_end = true;

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_billing_info_active ON billing_info(status, current_period_end) 
  WHERE status = 'active';

-- ============================================================================
-- INVOICES TABLE INDEXES
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
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start);
CREATE INDEX IF NOT EXISTS idx_invoices_period_end ON invoices(period_end);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_created ON invoices(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_period ON invoices(merchant_id, period_start, period_end);

-- Unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(merchant_id, status, created_at) 
  WHERE status IN ('open', 'draft');

-- Amount tracking
CREATE INDEX IF NOT EXISTS idx_invoices_amount_due ON invoices(amount_due);

-- ============================================================================
-- PAYMENT METHODS TABLE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_merchant_id ON payment_methods(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method_id ON payment_methods(stripe_payment_method_id);

-- Type filtering
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);

-- Default payment method lookup
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(merchant_id, is_default) 
  WHERE is_default = true;

-- Active payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_merchant_type ON payment_methods(merchant_id, type);

-- Expiration tracking for cards
CREATE INDEX IF NOT EXISTS idx_payment_methods_expiring ON payment_methods(exp_year, exp_month) 
  WHERE type = 'card' AND exp_year IS NOT NULL;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION NOTES
-- ============================================================================

-- 1. Partial Indexes: Used WHERE clauses to create smaller, more efficient indexes
--    for common filtered queries (e.g., active status, non-null values)

-- 2. Composite Indexes: Created multi-column indexes for frequently joined conditions
--    Order matters: most selective columns first

-- 3. GIN Indexes: Used for JSONB and array columns to enable efficient containment queries

-- 4. Covering Indexes: Some indexes include additional columns to avoid table lookups

-- 5. Index Maintenance: Consider running ANALYZE after bulk data loads
--    and REINDEX periodically for optimal performance

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan ASC;

-- Check index size:
-- SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Find unused indexes:
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0 AND schemaname = 'public';

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_merchants_merchant_id;
-- DROP INDEX IF EXISTS idx_merchants_email;
-- ... (drop all indexes created above)

COMMENT ON INDEX idx_merchants_merchant_id IS 'Primary lookup index for merchant_id';
COMMENT ON INDEX idx_api_keys_key_hash IS 'Fast lookup for API key validation';
COMMENT ON INDEX idx_merchant_usage_merchant_date_metric IS 'Optimizes usage queries by merchant, date, and metric type';
COMMENT ON INDEX idx_webhook_deliveries_next_retry IS 'Enables efficient retry queue processing';
COMMENT ON INDEX idx_billing_info_expiring_soon IS 'Identifies subscriptions expiring within 7 days';
