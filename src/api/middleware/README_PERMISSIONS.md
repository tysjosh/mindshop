# API Key Permissions Middleware

## Overview

The `requirePermissions()` middleware enforces permission-based access control for API endpoints. It must be used after the `apiKeyAuth()` middleware.

## Implementation

The middleware is located in `src/api/middleware/apiKeyAuth.ts` and includes:

1. **`apiKeyAuth()`** - Validates API keys and attaches key info to the request
2. **`requirePermissions(permissions: Permission[])`** - Checks if the API key has required permissions

## Usage

### Basic Example

```typescript
import { Router } from 'express';
import { apiKeyAuth, requirePermissions } from '../middleware/apiKeyAuth';
import { DocumentController } from '../controllers/DocumentController';

const router = Router();
const controller = new DocumentController();

// Read documents - requires 'documents:read' permission
router.get(
  '/documents',
  apiKeyAuth(),
  requirePermissions(['documents:read']),
  controller.listDocuments
);

// Create document - requires 'documents:write' permission
router.post(
  '/documents',
  apiKeyAuth(),
  requirePermissions(['documents:write']),
  controller.createDocument
);

// Delete document - requires 'documents:delete' permission
router.delete(
  '/documents/:id',
  apiKeyAuth(),
  requirePermissions(['documents:delete']),
  controller.deleteDocument
);
```

### Multiple Permissions

Require multiple permissions for sensitive operations:

```typescript
// Requires both 'documents:write' AND 'sync:write'
router.post(
  '/merchants/:merchantId/sync/upload',
  apiKeyAuth(),
  requirePermissions(['documents:write', 'sync:write']),
  controller.uploadFile
);
```

### Wildcard Permission

API keys with the `*` (wildcard) permission have access to all endpoints:

```typescript
// This API key can access any endpoint
const apiKey = {
  keyId: 'key_123',
  merchantId: 'merchant_456',
  permissions: ['*']
};
```

## Available Permissions

### Chat Permissions
- `chat:read` - Read chat history and conversation data
- `chat:write` - Send chat messages and create conversations

### Document Permissions
- `documents:read` - Read and search documents
- `documents:write` - Create and update documents
- `documents:delete` - Delete documents

### Session Permissions
- `sessions:read` - Read session data and history
- `sessions:write` - Create and manage sessions

### Analytics Permissions
- `analytics:read` - View analytics and usage statistics

### Webhook Permissions
- `webhooks:read` - View webhook configurations and delivery history
- `webhooks:write` - Create, update, and delete webhooks

### Product Sync Permissions
- `sync:read` - View product sync status and history
- `sync:write` - Configure and trigger product syncs

### Admin Permission
- `*` - Full access to all API endpoints (use with caution)

## Error Responses

### 401 - Authentication Required

Returned when no API key is attached to the request (apiKeyAuth middleware not used):

```json
{
  "success": false,
  "error": "Authentication required",
  "message": "API key authentication is required for this endpoint",
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

### 403 - Insufficient Permissions

Returned when the API key doesn't have the required permissions:

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "This API key does not have the required permissions: documents:write, sync:write",
  "requiredPermissions": ["documents:write", "sync:write"],
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

## Testing

Tests are located in `src/tests/apiKeyAuth.test.ts` and cover:

- ✅ Authentication without API key
- ✅ Wildcard permission access
- ✅ Specific permission validation
- ✅ Multiple permission requirements
- ✅ Missing permissions handling
- ✅ Error message formatting
- ✅ Request ID tracking

Run tests with:

```bash
npm test -- apiKeyAuth.test.ts --run
```

## Best Practices

1. **Always use apiKeyAuth() first**: The requirePermissions middleware depends on apiKeyAuth to attach the API key info to the request.

2. **Use specific permissions**: Avoid using wildcard permission for production API keys. Grant only the permissions needed.

3. **Group related permissions**: For complex operations, require multiple permissions to ensure proper access control.

4. **Document required permissions**: Add comments in your route files indicating which permissions are required.

5. **Test permission enforcement**: Write integration tests to verify permission checks work correctly.

## Example Route File

```typescript
import { Router } from 'express';
import { apiKeyAuth, requirePermissions } from '../middleware/apiKeyAuth';
import { ProductSyncController } from '../controllers/ProductSyncController';

const router = Router();
const controller = new ProductSyncController();

// All routes require authentication
router.use(apiKeyAuth());

/**
 * Get sync configuration
 * Required permissions: sync:read
 */
router.get(
  '/:merchantId/sync/configure',
  requirePermissions(['sync:read']),
  controller.getSyncConfig
);

/**
 * Configure product sync
 * Required permissions: sync:write
 */
router.post(
  '/:merchantId/sync/configure',
  requirePermissions(['sync:write']),
  controller.configureSync
);

/**
 * Upload product file
 * Required permissions: sync:write, documents:write
 */
router.post(
  '/:merchantId/sync/upload',
  requirePermissions(['sync:write', 'documents:write']),
  controller.uploadFile
);

export default router;
```

## Integration with Developer Portal

The Developer Portal UI allows merchants to select permissions when creating API keys. The selected permissions are stored in the database and validated by this middleware.

See `developer-portal/app/(dashboard)/api-keys/page.tsx` for the UI implementation.
