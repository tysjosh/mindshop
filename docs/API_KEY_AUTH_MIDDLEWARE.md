# API Key Authentication Middleware

## Overview

The API Key Authentication middleware provides a secure way to authenticate API requests using API keys. It validates API keys, checks permissions, and tracks usage for analytics and monitoring.

## Features

- ✅ API key validation with bcrypt hashing
- ✅ Permission-based access control
- ✅ Automatic usage tracking
- ✅ Expiration checking
- ✅ Merchant isolation
- ✅ Comprehensive error handling
- ✅ Request metadata attachment

## Installation

The middleware is already integrated into the project. Import it from the middleware module:

```typescript
import { apiKeyAuth, requirePermissions } from './api/middleware/apiKeyAuth';
```

## Usage

### Basic Authentication

Protect a route with API key authentication:

```typescript
import { Router } from 'express';
import { apiKeyAuth } from './api/middleware/apiKeyAuth';

const router = Router();

router.get('/api/data', apiKeyAuth(), (req, res) => {
  // Access merchant ID from request
  const merchantId = req.apiKey?.merchantId;
  
  res.json({
    success: true,
    merchantId,
    data: { ... }
  });
});
```

### Permission-Based Access

Require specific permissions for an endpoint:

```typescript
router.post('/api/documents', 
  apiKeyAuth(), 
  requirePermissions(['documents:write']),
  (req, res) => {
    // Only API keys with 'documents:write' permission can access
    res.json({ success: true });
  }
);
```

### Multiple Permissions

Require multiple permissions (all must be present):

```typescript
router.post('/api/admin/settings', 
  apiKeyAuth(), 
  requirePermissions(['admin:write', 'settings:write']),
  (req, res) => {
    // API key must have both permissions
    res.json({ success: true });
  }
);
```

### Wildcard Permissions

API keys with wildcard permission (`*`) have access to all endpoints:

```typescript
// This API key can access any endpoint
const apiKey = {
  permissions: ['*']
};
```

## Request Object

After successful authentication, the middleware attaches API key information to the request:

```typescript
interface ApiKeyRequest extends Request {
  apiKey?: {
    keyId: string;           // Unique key identifier
    merchantId: string;      // Merchant who owns the key
    permissions: string[];   // Array of permissions
  };
}
```

## Client Usage

### Making Authenticated Requests

Include the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer pk_live_abc123..." \
     https://api.example.com/api/data
```

### JavaScript/TypeScript

```typescript
const response = await fetch('https://api.example.com/api/data', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.example.com/api/data', headers=headers)
```

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Responses

#### 401 - Missing Authorization Header

```json
{
  "success": false,
  "error": "Missing or invalid API key",
  "message": "Authorization header must be in the format: Bearer <api_key>",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "requestId": "req_123"
}
```

#### 401 - Invalid or Expired API Key

```json
{
  "success": false,
  "error": "Invalid or expired API key",
  "message": "The provided API key is invalid, expired, or has been revoked",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "requestId": "req_123"
}
```

#### 403 - Insufficient Permissions

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "This API key does not have the required permissions: documents:write",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "requestId": "req_123"
}
```

#### 500 - Authentication Failed

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "An error occurred while validating the API key",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "requestId": "req_123"
}
```

## Permission System

### Permission Format

Permissions follow the format: `resource:action`

Examples:
- `chat:read` - Read chat messages
- `chat:write` - Send chat messages
- `documents:read` - Read documents
- `documents:write` - Create/update documents
- `analytics:read` - View analytics
- `admin:write` - Admin operations
- `*` - Wildcard (all permissions)

### Common Permission Sets

**Read-Only Access:**
```typescript
['chat:read', 'documents:read', 'analytics:read']
```

**Full Access:**
```typescript
['*']
```

**Standard Integration:**
```typescript
['chat:read', 'chat:write', 'documents:read']
```

## Usage Tracking

The middleware automatically tracks API key usage for each request:

- Endpoint accessed
- HTTP method
- Response status code
- Response time
- Timestamp

This data is used for:
- Analytics dashboards
- Rate limiting
- Billing calculations
- Security monitoring

## Security Considerations

### API Key Storage

- API keys are hashed using bcrypt before storage
- Full keys are only shown once during generation
- Keys cannot be retrieved after creation

### Key Validation

- Keys are validated against hashed values in the database
- Expired keys are automatically rejected
- Revoked keys are immediately invalidated

### Rate Limiting

Usage tracking enables rate limiting based on:
- API key
- Merchant
- Endpoint
- Time period

### Best Practices

1. **Use HTTPS Only**: Always use HTTPS in production
2. **Rotate Keys Regularly**: Implement key rotation policies
3. **Limit Permissions**: Grant minimum required permissions
4. **Monitor Usage**: Track unusual patterns
5. **Revoke Compromised Keys**: Immediately revoke if compromised

## Testing

The middleware includes comprehensive tests covering:

- Missing authorization headers
- Invalid API keys
- Expired API keys
- Valid API keys
- Permission checking
- Wildcard permissions
- Error handling

Run tests:

```bash
npm test -- src/tests/apiKeyAuth.test.ts --run
```

## Integration with Existing Routes

### Example: Chat API

```typescript
import { Router } from 'express';
import { apiKeyAuth, requirePermissions } from '../middleware/apiKeyAuth';

const router = Router();

// Public endpoint (no auth)
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Requires valid API key
router.post('/api/chat', 
  apiKeyAuth(),
  requirePermissions(['chat:write']),
  async (req, res) => {
    const { query } = req.body;
    const merchantId = req.apiKey!.merchantId;
    
    // Process chat query...
    res.json({ success: true, answer: '...' });
  }
);

export default router;
```

## Troubleshooting

### Common Issues

**Issue: "Missing or invalid API key"**
- Ensure Authorization header is present
- Check header format: `Bearer <api_key>`
- Verify API key is not expired

**Issue: "Invalid or expired API key"**
- Verify API key is correct
- Check if key has been revoked
- Confirm key hasn't expired

**Issue: "Insufficient permissions"**
- Check API key permissions
- Verify required permissions match
- Consider using wildcard permission for testing

**Issue: Usage not being tracked**
- Check database connection
- Verify ApiKeyUsageRepository is working
- Check logs for tracking errors

## Related Documentation

- [API Key Service](../src/services/ApiKeyService.ts)
- [API Key Repository](../src/repositories/ApiKeyRepository.ts)
- [Merchant Platform Design](.kiro/specs/merchant-platform/design.md)
- [Authentication Guide](./AUTHENTICATION.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test cases for examples
3. Check logs for detailed error messages
4. Contact the development team
