# API Reference Update Summary

## Date: November 5, 2025

## Overview
Updated the API reference documentation to include all recently implemented endpoints for billing, admin functionality, and enhanced analytics.

## Changes Made

### 1. API Reference Markdown (`api-reference.md`)

#### Added Billing & Subscriptions Section
- **POST** `/api/merchants/:merchantId/billing/subscribe` - Subscribe to a billing plan
- **GET** `/api/merchants/:merchantId/billing/current` - Get current billing information
- **GET** `/api/merchants/:merchantId/billing/invoices` - Retrieve billing invoices
- **GET** `/api/merchants/:merchantId/billing/payment-methods` - List payment methods
- **POST** `/api/merchants/:merchantId/billing/payment-methods` - Add payment method
- **DELETE** `/api/merchants/:merchantId/billing/payment-methods/:paymentMethodId` - Delete payment method
- **POST** `/api/merchants/:merchantId/billing/upgrade` - Upgrade subscription
- **POST** `/api/merchants/:merchantId/billing/cancel` - Cancel subscription

#### Enhanced Analytics Section
- **GET** `/api/merchants/:merchantId/analytics/performance` - Get detailed performance metrics (p50, p95, p99, cache hit rate, error rate, uptime)
- **GET** `/api/merchants/:merchantId/analytics/intents` - Get distribution of user intents

#### Added Admin API Section
- **GET** `/api/admin/merchants` - List all merchants (with pagination, filtering, search)
- **GET** `/api/admin/merchants/:merchantId` - Get detailed merchant information
- **PUT** `/api/admin/merchants/:merchantId/status` - Update merchant status
- **POST** `/api/admin/merchants/:merchantId/impersonate` - Generate impersonation token
- **GET** `/api/admin/system/health` - Get system health status
- **GET** `/api/admin/system/metrics` - Get system-wide metrics
- **GET** `/api/admin/errors` - Get system errors and audit logs

#### Added Code Examples
All new endpoints include complete code examples in:
- cURL
- JavaScript/Node.js
- Python
- PHP
- Ruby
- Go

### 2. OpenAPI Specification (`openapi.yaml`)

#### Updated Tags
- Added `Billing` tag for billing and subscription management
- Added `Admin` tag for admin endpoints

#### Added Schemas
- `PaymentMethod` - Payment method details (card, bank account)

#### Additional Endpoints Documentation
Created `openapi-additions.yaml` with endpoint definitions for:
- Billing endpoints (subscribe, current, invoices, payment methods, upgrade, cancel)
- Admin endpoints (merchants list, merchant details, status updates, impersonation, system health, metrics, errors)
- Enhanced analytics endpoints (queries time series, performance metrics, intent distribution)

### 3. Documentation Improvements

#### Added OpenAPI Specification Section
- Reference to complete OpenAPI 3.0 specification
- Instructions for using with Swagger UI, Postman, OpenAPI Generator, Redoc
- Link to additional endpoint definitions

#### Request/Response Examples
All new endpoints include:
- Complete request body examples with all required and optional fields
- Success response examples with realistic data
- Error response examples
- Authentication requirements
- Query parameter documentation

#### Security Documentation
- JWT authentication requirements for merchant endpoints
- Admin role requirements for admin endpoints
- API key authentication for programmatic access

## Files Modified

1. `docs/merchant-platform/api-reference.md` - Main API reference documentation
2. `docs/merchant-platform/openapi.yaml` - OpenAPI specification (tags updated)
3. `docs/merchant-platform/openapi-additions.yaml` - Additional endpoint definitions (new file)
4. `docs/merchant-platform/API_REFERENCE_UPDATE_SUMMARY.md` - This summary (new file)

## Implementation Status

### Completed ✅
- Billing endpoints documentation
- Admin endpoints documentation
- Enhanced analytics endpoints documentation
- Code examples for all new endpoints
- Request/response schemas
- Authentication requirements
- OpenAPI specification updates

### Pending ⏳
- Merge `openapi-additions.yaml` into main `openapi.yaml` file
- Generate interactive API documentation using Swagger UI
- Create Postman collection from OpenAPI spec
- Add webhook endpoints to OpenAPI spec (already in markdown)

## Testing Recommendations

1. **Validate OpenAPI Spec**
   ```bash
   npx @redocly/cli lint docs/merchant-platform/openapi.yaml
   ```

2. **Generate API Documentation**
   ```bash
   npx @redocly/cli build-docs docs/merchant-platform/openapi.yaml
   ```

3. **Test with Postman**
   - Import `openapi.yaml` into Postman
   - Test all new endpoints
   - Verify request/response formats

4. **Verify Code Examples**
   - Test cURL examples
   - Verify SDK examples work with actual API

## Next Steps

1. Review and merge `openapi-additions.yaml` into main OpenAPI spec
2. Set up automated API documentation generation
3. Create interactive API playground
4. Add more detailed error code documentation
5. Create SDK documentation for official client libraries
6. Add rate limiting details for each endpoint
7. Document webhook payload formats in OpenAPI spec

## Notes

- All endpoints follow RESTful conventions
- Consistent error response format across all endpoints
- Authentication clearly documented for each endpoint
- Admin endpoints require special role-based access
- Billing endpoints integrate with Stripe
- Analytics endpoints support date range filtering and grouping

## Related Documentation

- [Getting Started Guide](./getting-started.md)
- [Authentication Guide](./authentication.md)
- [Billing Guide](./billing-guide.md)
- [Admin Guide](./admin-guide.md)
- [Webhook Integration](./webhook-integration.md)
- [Video Tutorials](./video-tutorials.md)
