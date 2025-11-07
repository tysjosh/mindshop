# API Key Permissions System

## Overview

The API Key Permissions system provides fine-grained access control for API keys. Each API key can be assigned specific permissions that determine which endpoints and operations it can access.

## Permission Model

Permissions follow a `resource:action` pattern:
- **Resource**: The API resource (e.g., `chat`, `documents`, `sessions`)
- **Action**: The operation (e.g., `read`, `write`, `delete`)

Example: `documents:write` allows creating and updating documents.

## Available Permissions

### Chat Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `chat:read` | Read chat history and conversation data | `GET /api/chat/history`<br>`GET /api/chat/sessions/:sessionId/messages` |
| `chat:write` | Send chat messages and create conversations | `POST /api/chat`<br>`POST /api/chat/sessions/:sessionId/messages` |

### Document Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `documents:read` | Read and search documents | `GET /api/documents`<br>`GET /api/documents/:id`<br>`POST /api/documents/search` |
| `documents:write` | Create and update documents | `POST /api/documents`<br>`PUT /api/documents/:id`<br>`POST /api/documents/batch` |
| `documents:delete` | Delete documents | `DELETE /api/documents/:id`<br>`DELETE /api/documents/batch` |

### Session Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `sessions:read` | Read session data and history | `GET /api/chat/sessions`<br>`GET /api/chat/sessions/:sessionId` |
| `sessions:write` | Create and manage sessions | `POST /api/chat/sessions`<br>`PUT /api/chat/sessions/:sessionId`<br>`DELETE /api/chat/sessions/:sessionId` |

### Analytics Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `analytics:read` | View analytics and usage statistics | `GET /api/analytics/overview`<br>`GET /api/analytics/performance`<br>`GET /api/analytics/top-queries`<br>`GET /api/usage` |

### Webhook Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `webhooks:read` | View webhook configurations and delivery history | `GET /api/webhooks`<br>`GET /api/webhooks/:id`<br>`GET /api/webhooks/:id/deliveries` |
| `webhooks:write` | Create, update, and delete webhooks | `POST /api/webhooks`<br>`PUT /api/webhooks/:id`<br>`DELETE /api/webhooks/:id`<br>`POST /api/webhooks/:id/test` |

### Product Sync Permissions

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `sync:read` | View product sync status and history | `GET /api/merchants/:merchantId/sync/configure`<br>`GET /api/merchants/:merchantId/sync/status`<br>`GET /api/merchants/:merchantId/sync/history` |
| `sync:write` | Configure and trigger product syncs | `POST /api/merchants/:merchantId/sync/configure`<br>`PUT /api/merchants/:merchantId/sync/configure`<br>`POST /api/merchants/:merchantId/sync/trigger`<br>`POST /api/merchants/:merchantId/sync/upload` |

### Wildcard Permission

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `*` | Full access to all API endpoints (use with caution) | All endpoints |

## Permission Categories

Permissions are organized into categories for easier management:

- **chat**: Chat and conversation operations
- **documents**: Document management
- **sessions**: Session management
- **analytics**: Analytics and reporting
- **webhooks**: Webhook configuration
- **sync**: Product synchronization
- **admin**: Administrative operations (wildcard)

## Default Permissions

### Production API Keys (Recommended)

For production use, we recommend starting with these permissions:

```json
[
  "chat:read",
  "chat:write",
  "documents:read",
  "sessions:read",
  "sessions:write"
]
```

This provides the core functionality needed for most integrations while maintaining security.

### Development API Keys

For development and testing, you can use the wildcard permission:

```json
["*"]
```

**Warning**: Never use wildcard permissions in production. Always use the principle of least privilege.

### Read-Only Access

For monitoring or analytics integrations:

```json
[
  "chat:read",
  "documents:read",
  "sessions:read",
  "analytics:read"
]
```

## Usage Examples

### Creating an API Key with Permissions

```typescript
// Using the API
POST /api/api-keys
{
  "name": "Production Widget Key",
  "environment": "production",
  "permissions": [
    "chat:read",
    "chat:write",
    "sessions:read",
    "sessions:write"
  ]
}
```

### Checking Permissions in Code

```typescript
import { hasPermission, hasAllPermissions } from '../types/permissions';

// Check single permission
if (hasPermission(apiKey.permissions, 'documents:write')) {
  // Allow document creation
}

// Check multiple permissions
if (hasAllPermissions(apiKey.permissions, ['documents:read', 'documents:write'])) {
  // Allow full document management
}
```

### Using Permission Middleware

```typescript
import { requirePermissions } from '../middleware/apiKeyAuth';

// Require specific permissions for an endpoint
router.post(
  '/documents',
  apiKeyAuth(),
  requirePermissions(['documents:write']),
  controller.createDocument
);

// Require multiple permissions
router.delete(
  '/documents/:id',
  apiKeyAuth(),
  requirePermissions(['documents:read', 'documents:delete']),
  controller.deleteDocument
);
```

## Error Responses

### Missing Authentication

```json
{
  "success": false,
  "error": "Authentication required",
  "message": "API key authentication is required for this endpoint",
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

Status Code: `401 Unauthorized`

### Insufficient Permissions

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "This API key does not have the required permissions: documents:write",
  "requiredPermissions": ["documents:write"],
  "timestamp": "2025-11-05T10:00:00Z",
  "requestId": "req_xxx"
}
```

Status Code: `403 Forbidden`

## Best Practices

### 1. Principle of Least Privilege

Only grant the minimum permissions needed for the API key's intended use:

```typescript
// ✅ Good: Specific permissions for widget integration
{
  "permissions": ["chat:read", "chat:write", "sessions:write"]
}

// ❌ Bad: Overly broad permissions
{
  "permissions": ["*"]
}
```

### 2. Separate Keys for Different Purposes

Create different API keys for different integrations:

```typescript
// Widget key (public-facing)
{
  "name": "Website Widget",
  "permissions": ["chat:read", "chat:write", "sessions:write"]
}

// Backend integration key
{
  "name": "Product Sync",
  "permissions": ["documents:write", "sync:write"]
}

// Analytics key (read-only)
{
  "name": "Analytics Dashboard",
  "permissions": ["analytics:read", "chat:read"]
}
```

### 3. Use Environment-Specific Keys

Use different keys for development and production:

```typescript
// Development key (full access for testing)
{
  "environment": "development",
  "permissions": ["*"]
}

// Production key (restricted access)
{
  "environment": "production",
  "permissions": ["chat:read", "chat:write"]
}
```

### 4. Regular Permission Audits

Periodically review API key permissions:

1. Remove unused permissions
2. Revoke keys that are no longer needed
3. Rotate keys regularly
4. Monitor permission usage in analytics

### 5. Document Permission Requirements

When creating integrations, document which permissions are required:

```typescript
/**
 * Product Sync Integration
 * 
 * Required Permissions:
 * - documents:write: To create/update product documents
 * - sync:write: To trigger synchronization
 * - sync:read: To check sync status
 */
```

## Permission Validation

The system validates permissions when:

1. **Creating API Keys**: Invalid permissions are rejected
2. **Making API Requests**: Permissions are checked on every request
3. **Updating API Keys**: Permission changes are validated

### Validation Example

```typescript
import { validatePermissions } from '../types/permissions';

const result = validatePermissions([
  'chat:read',
  'invalid:permission',
  'documents:write'
]);

console.log(result.valid);   // ['chat:read', 'documents:write']
console.log(result.invalid); // ['invalid:permission']
```

## Migration Guide

### Existing API Keys

Existing API keys without explicit permissions will be assigned default permissions:

```json
["chat:read", "documents:read", "sessions:read", "analytics:read"]
```

To update permissions for existing keys:

```bash
PUT /api/api-keys/:keyId
{
  "permissions": [
    "chat:read",
    "chat:write",
    "documents:read",
    "sessions:write"
  ]
}
```

## Security Considerations

### 1. Never Expose Wildcard Keys

Wildcard permissions (`*`) should never be used in:
- Client-side code
- Public-facing integrations
- Production environments (unless absolutely necessary)

### 2. Rotate Keys Regularly

Set expiration dates on API keys and rotate them periodically:

```typescript
{
  "expiresAt": "2025-12-31T23:59:59Z",
  "permissions": ["chat:read", "chat:write"]
}
```

### 3. Monitor Permission Usage

Track which permissions are being used:

```sql
SELECT 
  endpoint,
  COUNT(*) as request_count
FROM api_key_usage
WHERE key_id = 'key_xxx'
GROUP BY endpoint
ORDER BY request_count DESC;
```

### 4. Implement Rate Limiting

Combine permissions with rate limiting for additional security:

```typescript
router.post(
  '/documents',
  rateLimitMiddleware({ max: 100, windowMs: 60000 }),
  apiKeyAuth(),
  requirePermissions(['documents:write']),
  controller.createDocument
);
```

## Troubleshooting

### Permission Denied Errors

If you receive a `403 Forbidden` error:

1. Check the error response for `requiredPermissions`
2. Verify your API key has those permissions
3. Update the API key permissions if needed
4. Ensure the API key is active and not expired

### Permission Not Working

If a permission doesn't seem to work:

1. Verify the permission name is correct (case-sensitive)
2. Check if the API key is active
3. Ensure the middleware is applied in the correct order
4. Check for wildcard permission conflicts

## API Reference

### Get Permission Metadata

```typescript
import { getPermissionMetadata } from '../types/permissions';

const metadata = getPermissionMetadata('documents:write');
console.log(metadata);
// {
//   permission: 'documents:write',
//   category: 'documents',
//   description: 'Create and update documents',
//   requiredFor: ['POST /api/documents', 'PUT /api/documents/:id']
// }
```

### Get Permissions by Category

```typescript
import { getPermissionsByCategory } from '../types/permissions';

const chatPermissions = getPermissionsByCategory('chat');
// Returns all chat-related permissions
```

### Get All Permissions

```typescript
import { getAllPermissions } from '../types/permissions';

const allPermissions = getAllPermissions();
// Returns array of all available permissions
```

## Support

For questions or issues with permissions:

1. Check this documentation
2. Review the [API Reference](./api-reference.md)
3. Contact support at support@mindshop.ai
4. Check the [troubleshooting guide](./troubleshooting.md)
