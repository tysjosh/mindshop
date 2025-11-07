# TypeScript Types Documentation

This directory contains TypeScript type definitions for the MindsDB RAG Assistant platform.

## Files

### `index.ts`
Core types for the RAG Assistant functionality including:
- Document and session management
- RAG responses and retrieval results
- Prediction results and model artifacts
- Audit logging and configuration
- API request/response types

### `merchant-platform.ts`
Comprehensive types for the B2B merchant platform including:

#### Merchant Account Types
- `MerchantRegistrationRequest/Response`
- `MerchantLoginRequest/Response`
- `MerchantProfile`
- `MerchantSettingsData`

#### API Key Types
- `ApiKeyGenerateRequest/Response`
- `ApiKeyListItem`
- `ApiKeyValidationResult`
- `ApiKeyUsageStats`

#### Usage Tracking Types
- `UsageMetrics`
- `UsageHistoryItem/Response`
- `UsageLimitCheckResult`
- `UsageForecast`

#### Analytics Types
- `AnalyticsOverview`
- `QueryAnalytics`
- `TopQuery`
- `IntentDistribution`
- `PerformanceMetrics`

#### Webhook Types
- `WebhookCreateRequest/Response`
- `WebhookEventType`
- `WebhookListItem`
- `WebhookDeliveryItem`
- `WebhookPayload`

#### Billing Types
- `BillingSubscribeRequest/Response`
- `BillingCurrentResponse`
- `InvoiceListItem`
- `PaymentMethodCreateRequest/ListItem`
- `BillingPlanDetails`

#### Admin Types
- `AdminMerchantListItem/Detail`
- `AdminSystemHealth/Metrics`
- `AdminErrorLog`

#### Product Sync Types
- `ProductSyncConfig`
- `ProductSyncStatus/History`

#### Widget Types
- `WidgetConfig`
- `WidgetMessage`
- `WidgetChatRequest/Response`

#### API Response Types
- `ApiResponse<T>`
- `PaginatedResponse<T>`
- `ErrorResponse`
- `RequestContext`
- `AuthenticatedRequest`
- `ValidationError/Result`

### `aws-stubs.ts`
AWS SDK type stubs for development

## Usage

Import types from the main index:

```typescript
import type {
  MerchantProfile,
  ApiKeyGenerateRequest,
  UsageMetrics,
  WebhookEventType,
  BillingSubscribeRequest,
} from '../types';
```

Or import directly from the merchant-platform module:

```typescript
import type {
  MerchantProfile,
  ApiKeyGenerateRequest,
} from '../types/merchant-platform';
```

## Type Safety

All types are designed to:
1. Match the Drizzle ORM schema definitions
2. Provide strong typing for API requests/responses
3. Support validation and error handling
4. Enable IDE autocomplete and type checking

## Drizzle Schema Types

The following types are re-exported from the Drizzle schema:
- `Merchant`, `NewMerchant`
- `MerchantSettings`, `NewMerchantSettings`
- `ApiKey`, `NewApiKey`
- `ApiKeyUsage`, `NewApiKeyUsage`
- `MerchantUsage`, `NewMerchantUsage`
- `UsageLimit`, `NewUsageLimit`
- `Webhook`, `NewWebhook`
- `WebhookDelivery`, `NewWebhookDelivery`
- `BillingInfo`, `NewBillingInfo`
- `Invoice`, `NewInvoice`
- `PaymentMethod`, `NewPaymentMethod`

These types are automatically inferred from the Drizzle schema and provide type safety for database operations.
