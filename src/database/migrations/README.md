# Database Migrations

This directory contains SQL migration files that are executed by the migration runner script (`scripts/run-migrations.ts`).

## Migration Files

Migrations are numbered sequentially and executed in order:

1. **0001_init_pgvector.sql** - Initialize pgvector extension and create vector indexes
2. **0002_performance_optimization.sql** - Performance optimizations for existing tables
3. **0003_billing_info.sql** - Create billing_info table for Stripe subscription management
4. **0004_invoices.sql** - Create invoices table for billing records
5. **0005_payment_methods.sql** - Create payment_methods table for payment method storage
6. **0006_webhooks.sql** - Create webhooks table for event notification configuration
7. **0007_webhook_deliveries.sql** - Create webhook_deliveries table for delivery tracking

## Running Migrations

To run all pending migrations:

```bash
npm run migrate
```

Or using ts-node directly:

```bash
ts-node scripts/run-migrations.ts
```

## Migration Tracking

The migration runner creates a `schema_migrations` table to track which migrations have been executed. Each migration is run within a transaction and recorded upon successful completion.

## Adding New Migrations

When adding a new migration:

1. Create a new file with the next sequential number: `000X_description.sql`
2. Include descriptive comments at the top of the file
3. Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency
4. Add rollback instructions in comments at the bottom
5. Test the migration on a development database before committing

## Billing & Webhook Migrations (0003-0007)

These migrations support the merchant platform billing and webhook features:

### Billing Tables (0003-0005)
- **billing_info**: Stores Stripe customer and subscription information
- **invoices**: Tracks invoice records from Stripe
- **payment_methods**: Stores payment method details (cards, bank accounts)

### Webhook Tables (0006-0007)
- **webhooks**: Webhook endpoint configurations and event subscriptions
- **webhook_deliveries**: Delivery attempts, status, and retry logic

All tables include:
- Comprehensive indexes for query performance
- Check constraints for data validation
- Triggers for automatic timestamp updates
- Helper functions for common operations
- Detailed column comments for documentation

## Notes

- All migrations use `IF NOT EXISTS` clauses to be idempotent
- Migrations are designed to be safe to run multiple times
- Each migration includes rollback instructions in comments
- Foreign key constraints ensure referential integrity
- Indexes are optimized for common query patterns
