# Development Seed Data

This directory contains seed data for populating the database with realistic test data during development.

## Overview

The seed data creates:
- **5 Merchants** with different plans (Starter, Professional, Enterprise) and statuses
- **8 API Keys** (development and production keys for each merchant)
- **Usage Limits** configured per plan
- **30 days of historical usage data** for analytics testing
- **7 days of API key usage logs** for monitoring
- **Sample product catalogs** for each merchant
- **Active user sessions** for testing chat functionality
- **Cost tracking data** for billing analytics

## Usage

### Option 1: SQL Migration (Recommended for CI/CD)

Run the SQL migration directly:

```bash
# Using the setup script
./scripts/setup-database.sh seed

# Or directly with psql
psql -h localhost -p 5432 -U postgres -d mindsdb_rag -f database/migrations/008_seed_data_development.sql

# Or using npm script
npm run db:seed:sql
```

### Option 2: TypeScript Script (Recommended for Development)

Run the TypeScript seed script:

```bash
# Using npm script
npm run db:seed

# Or directly with ts-node
ts-node scripts/seed-development-data.ts
```

## Test Merchants

### 1. ACME Electronics (Starter Plan)
- **Merchant ID:** `acme_electronics_2024`
- **Email:** `admin@acme-electronics.com`
- **Plan:** Starter
- **Status:** Active
- **Industry:** Electronics
- **Products:** Laptops, Smartphones, Headphones
- **Limits:**
  - 1,000 queries/month
  - 100 documents max
  - 5,000 API calls/day
  - 1 GB storage

**API Keys:**
- Development: `key_acme_dev_001` (prefix: `pk_test_`)
- Production: `key_acme_prod_001` (prefix: `pk_live_`)

### 2. Fashion Hub (Professional Plan)
- **Merchant ID:** `fashion_hub_2024`
- **Email:** `contact@fashionhub.com`
- **Plan:** Professional
- **Status:** Active
- **Industry:** Fashion & Apparel
- **Products:** Dresses, Jeans, Jackets
- **Limits:**
  - 10,000 queries/month
  - 1,000 documents max
  - 50,000 API calls/day
  - 10 GB storage

**API Keys:**
- Development: `key_fashion_dev_001` (prefix: `pk_test_`)
- Production: `key_fashion_prod_001` (prefix: `pk_live_`)

### 3. Tech Store Pro (Enterprise Plan)
- **Merchant ID:** `tech_store_2024`
- **Email:** `support@techstore.com`
- **Plan:** Enterprise
- **Status:** Active
- **Industry:** Technology
- **Products:** Monitors, Keyboards, Mice
- **Limits:**
  - Unlimited queries
  - Unlimited documents
  - Unlimited API calls
  - 1 TB storage

**API Keys:**
- Development: `key_tech_dev_001` (prefix: `pk_test_`)
- Production (Website): `key_tech_prod_001` (prefix: `pk_live_`)
- Production (Mobile): `key_tech_prod_002` (prefix: `pk_live_`)

### 4. New Shop (Pending Verification)
- **Merchant ID:** `new_shop_2024`
- **Email:** `hello@newshop.com`
- **Plan:** Starter
- **Status:** Pending Verification
- **Industry:** General Retail

### 5. Suspended Store (Suspended)
- **Merchant ID:** `suspended_store_2024`
- **Email:** `admin@suspended.com`
- **Plan:** Starter
- **Status:** Suspended
- **Industry:** General Retail

## Data Included

### Merchants & Settings
- 5 merchants with different plans and statuses
- Customized widget settings for each merchant
- Company information and industry classification

### API Keys
- 8 API keys across merchants
- Mix of development and production keys
- Different permission sets
- Realistic last-used timestamps
- One revoked key for testing

### Usage Data
- 30 days of historical usage metrics
- Daily aggregated data for:
  - Query counts
  - Document counts
  - API call counts
  - Storage usage
- Realistic usage patterns based on plan tier

### API Key Usage Logs
- 7 days of detailed API usage logs
- Multiple endpoints tracked
- Response times and status codes
- Hourly granularity for analytics

### Product Catalogs
- 9 products across 3 merchants
- Product metadata (price, category, ratings, reviews)
- Policy documents (shipping, returns)
- FAQ documents

### User Sessions
- 3 active chat sessions
- Conversation history
- Session context and metadata

### Cost Tracking
- Sample cost data for different operations
- Token usage tracking
- Compute time metrics

## Testing Scenarios

### 1. API Key Authentication
```bash
# Test with ACME Electronics production key
curl -H "Authorization: Bearer pk_live_..." \
  http://localhost:3000/api/chat
```

### 2. Usage Analytics
```bash
# View usage for a merchant
curl http://localhost:3000/api/merchants/acme_electronics_2024/usage/current
```

### 3. Rate Limiting
```bash
# Test rate limits with high-volume requests
for i in {1..100}; do
  curl -H "Authorization: Bearer pk_test_..." \
    http://localhost:3000/api/chat
done
```

### 4. Product Search
```bash
# Search for products
curl -X POST http://localhost:3000/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{"query": "laptop", "merchantId": "acme_electronics_2024"}'
```

## Resetting Data

To reset and re-seed the database:

```bash
# Drop all tables and recreate
./scripts/setup-database.sh clean

# Run migrations
./scripts/setup-database.sh setup

# Seed data
./scripts/setup-database.sh seed
```

Or use the npm script:

```bash
npm run db:reset
npm run db:seed
```

## Notes

- **API Key Hashes:** The SQL migration uses mock bcrypt hashes for development. In production, these would be properly hashed.
- **Cognito Users:** The seed data references Cognito user IDs, but doesn't create actual Cognito users. You'll need to create those separately for full authentication testing.
- **Embeddings:** Document embeddings are not included in the seed data. Run the embedding service to generate them.
- **Historical Data:** Usage data is generated for the past 30 days using random values within realistic ranges.

## Customization

To customize the seed data:

1. **SQL Approach:** Edit `database/migrations/008_seed_data_development.sql`
2. **TypeScript Approach:** Edit `scripts/seed-development-data.ts`

Both approaches support the same data structure and can be used interchangeably.

## Troubleshooting

### Duplicate Key Errors
If you see duplicate key errors, the data may already exist. Use `ON CONFLICT DO NOTHING` clauses or reset the database first.

### Connection Errors
Ensure your database is running and environment variables are set correctly:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=mindsdb_rag
export DB_USERNAME=postgres
export DB_PASSWORD=password
```

### Missing Tables
Run migrations first:
```bash
./scripts/setup-database.sh setup
```

## Integration with Tests

The seed data is designed to work with the test suite:

```bash
# Run tests with seed data
npm run db:seed
npm run test

# Run specific test suites
npm run test:e2e
npm run test:security
```
