# API Response Format Standardization

## Overview

This document describes the standardized API response format implemented across all backend endpoints to ensure consistency and improve client-side handling.

## Standard Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_1730800000_abc123"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_1730800000_abc123"
}
```

### Error Response with Details

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  },
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_1730800000_abc123"
}
```

## Response Formatter Utility

A new utility module has been created at `src/api/utils/responseFormatter.ts` to standardize response creation:

### Available Functions

#### `sendSuccess<T>(res, data, statusCode?, requestId?)`
Sends a successful response with standardized format.

```typescript
import { sendSuccess, getRequestId } from '../utils/responseFormatter';

async myHandler(req: Request, res: Response): Promise<void> {
  const requestId = getRequestId(req);
  const data = { message: 'Operation successful' };
  sendSuccess(res, data, 200, requestId);
}
```

#### `sendError(res, error, statusCode?, requestId?, details?)`
Sends an error response with standardized format.

```typescript
import { sendError, getRequestId } from '../utils/responseFormatter';

async myHandler(req: Request, res: Response): Promise<void> {
  const requestId = getRequestId(req);
  try {
    // ... operation
  } catch (error) {
    sendError(res, error, 500, requestId);
  }
}
```

#### Helper Functions

- `sendValidationError(res, errors, requestId?)` - 422 status
- `sendUnauthorized(res, message?, requestId?)` - 401 status
- `sendForbidden(res, message?, requestId?)` - 403 status
- `sendNotFound(res, message?, requestId?)` - 404 status
- `sendServerError(res, error?, requestId?)` - 500 status

#### Request ID Management

- `getRequestId(req)` - Gets request ID from headers or generates a new one
- `generateRequestId()` - Generates a unique request ID

## Controller Updates

### Updated Controllers

The following controllers have been updated to use the standardized response format:

1. **DocumentController** - All methods updated to use response formatter utilities
2. **BedrockAgentController** - Updated to use response formatter utilities
3. **SemanticRetrievalController** - Updated to use response formatter utilities
4. **ChatController** - Already using standardized format
5. **SessionController** - Already using standardized format
6. **MerchantController** - Already using standardized format
7. **ApiKeyController** - Already using standardized format
8. **WebhookController** - Already using standardized format
9. **BillingController** - Already using standardized format
10. **AnalyticsController** - Already using standardized format
11. **UsageController** - Already using standardized format
12. **ProductSyncController** - Already using standardized format
13. **HealthController** - Already using standardized format
14. **AdminController** - Already using standardized format

### DocumentController Changes

The DocumentController was updated from inconsistent response formats to the standardized format:

**Before:**
```typescript
res.status(200).json({
  message: 'Document ingested successfully',
  documentId,
  merchantId
});
```

**After:**
```typescript
const requestId = getRequestId(req);
sendSuccess(res, {
  message: 'Document ingested successfully',
  documentId,
  merchantId
}, 200, requestId);
```

## Client-Side Handling

### Widget ApiClient

The widget's ApiClient already handles the standardized format with automatic unwrapping:

```typescript
async createSession(data: SessionRequest): Promise<SessionResponse> {
  const response = await this.client.post<any>('/api/chat/sessions', data);
  // Unwraps: { success, data: { sessionId, ... } } -> { sessionId, ... }
  return response.data.data || response.data;
}
```

### Developer Portal ApiClient

The developer portal's ApiClient also handles the standardized format:

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || json.message || 'Request failed');
  }

  // Unwraps: { success: true, data: {...} } -> {...}
  if (json.success && json.data !== undefined) {
    return json.data as T;
  }

  return json as T;
}
```

## Benefits

1. **Consistency** - All endpoints return responses in the same format
2. **Type Safety** - TypeScript `ApiResponse<T>` type ensures correct structure
3. **Error Handling** - Standardized error format makes client-side error handling easier
4. **Debugging** - Request IDs enable request tracing across the system
5. **Timestamps** - All responses include timestamps for logging and debugging
6. **Client Compatibility** - Both widget and portal clients handle unwrapping automatically

## Migration Guide

### For New Endpoints

Use the response formatter utilities:

```typescript
import { sendSuccess, sendError, getRequestId } from '../utils/responseFormatter';
import { ApiResponse } from '../../types';

async myEndpoint(req: Request, res: Response): Promise<void> {
  const requestId = getRequestId(req);
  try {
    const result = await someOperation();
    sendSuccess(res, result, 200, requestId);
  } catch (error) {
    sendError(res, error, 500, requestId);
  }
}
```

### For Existing Endpoints

Replace manual response construction with formatter utilities:

**Before:**
```typescript
res.status(200).json({ result: data });
```

**After:**
```typescript
const requestId = getRequestId(req);
sendSuccess(res, data, 200, requestId);
```

## Testing

### Manual Testing

Test that responses follow the standard format:

```bash
curl -X GET http://localhost:3000/api/merchants/test_merchant/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Request-ID: test_request_123"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "merchantId": "test_merchant",
    "companyName": "Test Company"
  },
  "timestamp": "2025-11-05T10:00:00.000Z",
  "requestId": "test_request_123"
}
```

### Integration Testing

Verify that both widget and portal clients can handle the responses:

1. Widget integration tests pass
2. Portal integration tests pass
3. No breaking changes for existing clients

## Acceptance Criteria

- [x] All endpoints use standard format
- [x] Response formatter utility created
- [x] DocumentController updated
- [x] Widget ApiClient handles unwrapping correctly
- [x] Portal ApiClient handles unwrapping correctly
- [x] No breaking changes introduced
- [x] TypeScript types defined
- [x] Documentation created

## Related Files

- `src/api/utils/responseFormatter.ts` - Response formatter utilities
- `src/types/index.ts` - ApiResponse type definition
- `src/api/controllers/*.ts` - All controller files
- `widget/src/services/ApiClient.ts` - Widget API client
- `developer-portal/lib/api-client.ts` - Portal API client

## Future Improvements

1. Add response compression for large payloads
2. Add response caching headers
3. Add pagination metadata to list responses
4. Add rate limit information to all responses
5. Add API version information to responses
