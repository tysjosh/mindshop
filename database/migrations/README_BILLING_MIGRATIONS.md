# Billing System Migrations

This document describes the billing-related database migrations for the Merchant Platform.

## Overview

Three new migration files have been created to support the billing and payment functionality:

1. `009_billing_info.sql` - Merchant billing and subscription information
2. `010_invoices.sql` - Invoice records from Stripe
3. `011_payment_methods.sql` - Payment method information

## Migration Details

### 009_billing_info.sql

**Purpose:** Stores merchant billing information and Stripe subscription details.

**Key Features:**
- Links merchants to Stripe customers and subscriptions
- Tracks subscription plan (starter, professional, enterprise)
- Monitors subscription status (active, past_due, canceled, trialing, etc.)
- Records billing periods and trial periods
- Supports subscription cancellation scheduling

**Indexes:**
- Fast lookups by merchant_id, stripe_customer_id, stripe_subscription_id
- Efficient filtering by status and plan
- Identifies expiring subscriptions (within 7 days)
- Tracks trial period expirations
- Optimized queries for active subscriptions

**Triggers:**
- Automatically updates `updated_at` timestamp on row modifications

### 010_invoices.sql

**Purpose:** Stores invoice records from Stripe for merchant billing.

**Key Features:**
- Complete invoice details (amounts, status, dates)
- Computed column for amount_remaining (amount_due - amount_paid)
- Links to invoice PDFs and hosted invoice URLs
- Supports multiple currencies (USD, EUR, GBP, CAD, AUD)
- Tracks billing periods and due dates

**Indexes:**
- Fast lookups by merchant_id and stripe_invoice_id
- Efficient filtering by status
- Temporal queries (created_at, paid_at, due_date, period ranges)
- Identifies unpaid and overdue invoices
- Optimized for recent invoice queries (last 90 days)

**Constraints:**
- Validates invoice status values
- Ensures positive amounts
- Validates currency codes

### 011_payment_methods.sql

**Purpose:** Stores payment method information from Stripe for merchants.

**Key Features:**
- Supports multiple payment types (card, bank_account, sepa_debit, us_bank_account)
- Stores card details (last4, brand, expiration)
- Stores bank account details (bank_name, account_holder_name)
- Enforces single default payment method per merchant
- Tracks card expiration dates

**Indexes:**
- Fast lookups by merchant_id and stripe_payment_method_id
- Efficient filtering by payment type
- Unique constraint on default payment method per merchant
- Identifies expiring cards (within 2 months)

**Triggers:**
- Automatically ensures only one default payment method per merchant
- When a payment method is set as default, all other payment methods for that merchant are unset

## Running the Migrations

### Using the migration script:

```bash
# Run all pending migrations
npm run migrate

# Or run specific migrations
psql -U your_user -d your_database -f database/migrations/009_billing_info.sql
psql -U your_user -d your_database -f database/migrations/010_invoices.sql
psql -U your_user -d your_database -f database/migrations/011_payment_methods.sql
```

### Using Docker:

```bash
# If using docker-compose
docker-compose exec postgres psql -U mindshop -d mindshop_db -f /docker-entrypoint-initdb.d/009_billing_info.sql
docker-compose exec postgres psql -U mindshop -d mindshop_db -f /docker-entrypoint-initdb.d/010_invoices.sql
docker-compose exec postgres psql -U mindshop -d mindshop_db -f /docker-entrypoint-initdb.d/011_payment_methods.sql
```

## Rollback

Each migration file includes a rollback script in the comments at the bottom. To rollback:

```sql
-- Rollback payment_methods
DROP TRIGGER IF EXISTS trigger_ensure_single_default_payment_method ON payment_methods;
DROP FUNCTION IF EXISTS ensure_single_default_payment_method();
DROP TABLE IF EXISTS payment_methods CASCADE;

-- Rollback invoices
DROP TABLE IF EXISTS invoices CASCADE;

-- Rollback billing_info
DROP TRIGGER IF EXISTS trigger_billing_info_updated_at ON billing_info;
DROP FUNCTION IF EXISTS update_billing_info_updated_at();
DROP TABLE IF EXISTS billing_info CASCADE;
```

**Note:** Rollback in reverse order (011 → 010 → 009) to respect foreign key constraints.

## Dependencies

These migrations depend on:
- `merchants` table (from earlier migrations)
- PostgreSQL UUID extension
- PostgreSQL trigger support

## Next Steps

After running these migrations, you'll need to:

1. **Create Drizzle ORM schemas** - Define TypeScript schemas for these tables
2. **Create repository classes** - Implement data access layer
3. **Implement BillingService** - Business logic for Stripe integration
4. **Create API endpoints** - REST API for billing operations
5. **Build UI components** - Frontend for billing management

## Testing

To verify the migrations were successful:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('billing_info', 'invoices', 'payment_methods');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('billing_info', 'invoices', 'payment_methods');

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table IN ('billing_info', 'payment_methods');

-- Test constraints
INSERT INTO billing_info (merchant_id, stripe_customer_id, plan, status) 
VALUES ('test_merchant', 'cus_test123', 'invalid_plan', 'active');
-- Should fail with constraint violation
```

## Schema Diagram

```
┌─────────────────┐
│   merchants     │
│─────────────────│
│ merchant_id (PK)│
└────────┬────────┘
         │
         │ 1:1
         │
┌────────▼────────────────┐
│   billing_info          │
│─────────────────────────│
│ id (PK)                 │
│ merchant_id (FK)        │
│ stripe_customer_id      │
│ stripe_subscription_id  │
│ plan                    │
│ status                  │
│ current_period_start    │
│ current_period_end      │
└────────┬────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────┐       ┌─────────────────────┐
│   invoices          │       │  payment_methods    │
│─────────────────────│       │─────────────────────│
│ id (PK)             │       │ id (PK)             │
│ merchant_id (FK)    │◄──────┤ merchant_id (FK)    │
│ stripe_invoice_id   │  1:N  │ stripe_payment_...  │
│ amount_due          │       │ type                │
│ amount_paid         │       │ last4               │
│ status              │       │ is_default          │
└─────────────────────┘       └─────────────────────┘
```

## Support

For issues or questions about these migrations:
- Check the design document: `.kiro/specs/merchant-platform/design.md`
- Review the requirements: `.kiro/specs/merchant-platform/requirements.md`
- See the task list: `.kiro/specs/merchant-platform/tasks.md`
