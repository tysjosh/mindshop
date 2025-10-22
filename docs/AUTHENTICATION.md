# Authentication System

The MindsDB RAG Assistant now uses a robust authentication system with AWS Cognito JWT verification, replacing the previous mock implementation.

## Features

- **AWS Cognito Integration**: Real JWT token verification with Cognito User Pools
- **Development Mode**: Mock authentication for local development and testing
- **Tenant Isolation**: Automatic merchant ID validation to prevent cross-tenant access
- **Role-Based Access Control (RBAC)**: Support for user roles and permissions
- **Admin Override**: Admin users can access any merchant's data
- **Flexible Configuration**: Easy switching between Cognito and mock auth

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your_cognito_client_id_here
COGNITO_REGION=us-east-1
ENABLE_COGNITO_AUTH=true
```

### Development vs Production

**Development Mode** (Mock Auth):
```bash
ENABLE_COGNITO_AUTH=false
NODE_ENV=development
```

**Production Mode** (Cognito Auth):
```bash
ENABLE_COGNITO_AUTH=true
NODE_ENV=production
COGNITO_USER_POOL_ID=us-east-1_REALPOOL123
COGNITO_CLIENT_ID=real-client-id
```

## Usage

### API Requests

All API requests (except health checks) require authentication:

```bash
curl -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/chat
```

### Token Format

**Production (Cognito JWT)**: Standard JWT tokens from AWS Cognito
**Development (Mock)**: Simple format: `userId:merchantId:roles`

Example mock token:
```
user123:merchant456:user,merchant_admin
```

### User Information Structure

```typescript
interface UserInfo {
  userId: string;
  merchantId: string;
  email?: string;
  roles: string[];
  groups?: string[];
}
```

## Cognito Token Configuration

### Required Claims

Your Cognito tokens must include:

1. **User Identifier**: `sub`, `cognito:username`, or `username`
2. **Merchant ID**: One of:
   - `custom:merchant_id`
   - `merchant_id`
   - `cognito:merchant_id`
   - `merchantId`

### Role Configuration

Roles can be provided via:
- **Custom Attributes**: `custom:roles` (comma-separated)
- **Cognito Groups**: `cognito:groups`
- **Token Scopes**: `scope` (for access tokens, roles prefixed with `role:`)

Example Cognito token payload:
```json
{
  "sub": "user-uuid-123",
  "cognito:username": "john.doe",
  "email": "john@example.com",
  "custom:merchant_id": "merchant_abc123",
  "custom:roles": "user,merchant_admin",
  "cognito:groups": ["merchants", "premium_users"]
}
```

## Middleware Usage

### Basic Authentication

```typescript
import { createAuthMiddleware } from './middleware/auth';

const authMiddleware = createAuthMiddleware({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  region: process.env.COGNITO_REGION,
  enableMockAuth: process.env.NODE_ENV === 'development'
});

app.use('/api', authMiddleware);
```

### Merchant Access Control

```typescript
import { requireMerchantAccess } from './middleware/auth';

// Ensure user can only access their own merchant data
app.get('/api/documents/:merchantId', requireMerchantAccess, (req, res) => {
  // User's merchantId must match :merchantId parameter
});
```

### Role-Based Access

```typescript
import { requireRoles } from './middleware/auth';

// Require admin role
app.delete('/api/admin/users', requireRoles(['admin']), (req, res) => {
  // Only admin users can access this endpoint
});

// Require any of multiple roles
app.get('/api/reports', requireRoles(['admin', 'manager', 'analyst']), (req, res) => {
  // Users with admin, manager, or analyst roles can access
});
```

## AuthService

The `AuthService` class provides utilities for token management:

```typescript
import { getAuthService } from '../services/AuthService';

const authService = getAuthService();

// Verify a token
const userInfo = await authService.verifyToken(jwtToken);

// Generate development token
const mockToken = authService.generateDevToken({
  userId: 'test_user',
  merchantId: 'test_merchant',
  roles: ['user']
});

// Validate merchant access
const hasAccess = authService.validateMerchantAccess(userInfo, 'merchant_123');

// Check roles
const hasRole = authService.hasRequiredRoles(userInfo, ['admin']);
```

## Security Features

### Tenant Isolation

- All API requests automatically validate merchant access
- Users can only access data for their assigned merchant
- Admin users can override and access any merchant

### Token Validation

- JWT signature verification with Cognito public keys
- Token expiration checking
- Audience (client ID) validation
- Issuer validation

### Error Handling

- Consistent error responses for authentication failures
- Request ID tracking for debugging
- Secure error messages (no sensitive information leaked)

## Testing

### Mock Authentication

For testing, use the mock token format:

```javascript
// Test token: userId:merchantId:roles
const testToken = 'test_user:test_merchant:user,admin';

const response = await fetch('/api/documents', {
  headers: {
    'Authorization': `Bearer ${testToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Integration Tests

```javascript
const { getAuthService } = require('./dist/services/AuthService');

const authService = getAuthService();
const mockToken = authService.generateDevToken({
  userId: 'test_user',
  merchantId: 'test_merchant',
  roles: ['user']
});

// Use mockToken in your tests
```

## Migration from Mock Auth

If you're upgrading from the previous mock authentication:

1. **Update Environment**: Add Cognito configuration variables
2. **Update Tokens**: Replace simple tokens with proper JWT tokens
3. **Test Endpoints**: Verify all endpoints work with new authentication
4. **Update Client Code**: Ensure your frontend handles JWT tokens properly

## Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Check token format and expiration
   - Verify Cognito configuration
   - Ensure token includes required claims

2. **"Token missing required merchant identifier"**
   - Add merchant ID to Cognito token claims
   - Use custom attributes or groups

3. **"Access denied to merchant resources"**
   - Verify user's merchant ID matches requested resource
   - Check if user has admin role for cross-tenant access

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug
```

This will log authentication attempts and token validation details.