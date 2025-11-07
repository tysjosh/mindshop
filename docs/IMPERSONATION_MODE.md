# Impersonation Mode

## Overview

The impersonation mode allows administrators to temporarily act as a merchant for debugging and support purposes. All actions performed during impersonation are logged and attributed to the admin who initiated the impersonation.

## Features

- **Secure Token-Based Authentication**: Uses JWT tokens with 1-hour expiration
- **Audit Logging**: All impersonated actions are logged with admin attribution
- **Visual Indicator**: Prominent banner shows when in impersonation mode
- **Easy Exit**: One-click exit from impersonation mode
- **Protected Endpoints**: Sensitive operations (password changes, account deletion) are blocked during impersonation

## How It Works

### Backend Implementation

#### 1. Impersonation Token Generation

When an admin initiates impersonation, the system generates a JWT token containing:

```typescript
{
  adminUserId: string;      // Admin's user ID
  adminEmail: string;       // Admin's email
  merchantId: string;       // Target merchant ID
  expiresAt: number;        // Token expiration timestamp
  type: 'impersonation';    // Token type identifier
}
```

The token is signed with a secret key and expires after 1 hour.

#### 2. Impersonation Middleware

The `impersonationMiddleware` checks for the `X-Impersonation-Token` header on incoming requests:

- If present and valid, it modifies the request context to act as the impersonated merchant
- Adds impersonation metadata to track the admin
- Logs all actions with admin attribution
- Sets response headers to indicate impersonation mode

```typescript
// Request headers
X-Impersonation-Token: <jwt_token>

// Response headers
X-Impersonating: <merchant_id>
X-Impersonated-By: <admin_email>
```

#### 3. Protected Endpoints

Use the `preventImpersonation()` middleware on sensitive endpoints:

```typescript
router.post(
  '/merchants/:merchantId/account/delete',
  authenticateJWT(),
  preventImpersonation(),  // Block during impersonation
  merchantController.deleteAccount
);
```

### Frontend Implementation

#### 1. Starting Impersonation

From the admin merchant detail page:

1. Click "Impersonate" button
2. Confirm the action in the dialog
3. System generates impersonation token
4. Token is stored in localStorage
5. User is redirected to merchant dashboard

```typescript
// Impersonation state stored in localStorage
{
  isImpersonating: true,
  merchantId: "acme_electronics_2024",
  companyName: "Acme Electronics",
  impersonatedBy: "admin@example.com",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. During Impersonation

- **Banner Display**: Orange banner at top of dashboard shows impersonation status
- **API Requests**: All API calls automatically include `X-Impersonation-Token` header
- **Navigation**: Admin can navigate through merchant's dashboard normally
- **Restrictions**: Sensitive actions are blocked with appropriate error messages

#### 3. Exiting Impersonation

Click "Exit Impersonation" button in the banner:

1. Clears impersonation state from localStorage
2. Redirects back to admin merchant list
3. Subsequent API calls use admin's normal authentication

## API Endpoints

### Start Impersonation

```http
POST /api/admin/merchants/:merchantId/impersonate
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "email": "merchant@acme.com",
    "companyName": "Acme Electronics",
    "impersonationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "message": "Impersonation session created. Use the X-Impersonation-Token header to act as this merchant.",
    "warning": "All actions will be logged and attributed to the impersonating admin."
  }
}
```

### Using Impersonation Token

Include the token in the `X-Impersonation-Token` header for all subsequent requests:

```http
GET /api/merchants/acme_electronics_2024/profile
Authorization: Bearer <admin_jwt_token>
X-Impersonation-Token: <impersonation_token>
```

The request will be processed as if it came from the merchant, but all actions are logged with admin attribution.

## Security Considerations

### 1. Token Security

- Tokens are signed with a secret key (IMPERSONATION_SECRET environment variable)
- Tokens expire after 1 hour
- Tokens are single-use per merchant (new token required for each impersonation session)

### 2. Audit Logging

All impersonated actions are logged with:

- Admin user ID and email
- Merchant ID being impersonated
- Action performed
- Timestamp
- IP address
- User agent

Example audit log entry:

```json
{
  "merchantId": "acme_electronics_2024",
  "userId": "admin_user_123",
  "operation": "impersonation.action",
  "requestPayloadHash": "{\"method\":\"GET\",\"path\":\"/api/merchants/acme_electronics_2024/profile\",\"impersonatedBy\":\"admin@example.com\"}",
  "outcome": "success",
  "reason": "Admin admin@example.com performed action while impersonating merchant",
  "actor": "admin@example.com",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2025-11-04T12:00:00Z"
}
```

### 3. Protected Operations

The following operations are blocked during impersonation:

- Changing password
- Deleting account
- Modifying billing information
- Revoking API keys (can view only)
- Changing email address

To protect an endpoint, use the `preventImpersonation()` middleware:

```typescript
import { preventImpersonation } from '../middleware/impersonation';

router.post(
  '/sensitive-operation',
  authenticateJWT(),
  preventImpersonation(),
  controller.sensitiveOperation
);
```

### 4. Role Requirements

Only users with `admin` or `super_admin` roles can initiate impersonation:

```typescript
router.post(
  '/merchants/:merchantId/impersonate',
  authenticateJWT(),
  requireRoles(['admin', 'super_admin']),
  adminController.impersonateMerchant
);
```

## Configuration

### Environment Variables

```bash
# Impersonation token secret (defaults to JWT_SECRET if not set)
IMPERSONATION_SECRET=your-secret-key-here

# Token expiration (in seconds, default: 3600 = 1 hour)
IMPERSONATION_EXPIRY=3600
```

### CORS Configuration

Ensure the following headers are allowed in CORS configuration:

```typescript
allowedHeaders: [
  'X-Impersonation-Token',
  // ... other headers
],
exposedHeaders: [
  'X-Impersonating',
  'X-Impersonated-By',
  // ... other headers
]
```

## Usage Examples

### Example 1: Debug Merchant Issue

1. Admin receives support ticket from merchant "Acme Electronics"
2. Admin navigates to Admin Panel → Merchants → Acme Electronics
3. Admin clicks "Impersonate" button
4. Admin is redirected to merchant's dashboard
5. Admin can now see exactly what the merchant sees
6. Admin reproduces the issue and identifies the problem
7. Admin clicks "Exit Impersonation" to return to admin view

### Example 2: Verify Configuration

1. Admin helps merchant set up API keys
2. Admin impersonates merchant to verify API key configuration
3. Admin tests API calls using merchant's keys
4. Admin confirms everything works correctly
5. Admin exits impersonation

### Example 3: Training Support Team

1. Admin impersonates demo merchant account
2. Admin walks support team through merchant dashboard
3. Support team learns merchant workflows
4. Admin exits impersonation

## Troubleshooting

### Token Expired Error

**Error:** "Invalid or expired impersonation token"

**Solution:** Impersonation tokens expire after 1 hour. Start a new impersonation session.

### Permission Denied

**Error:** "This action cannot be performed while impersonating"

**Solution:** Some sensitive operations are blocked during impersonation. Exit impersonation mode or use admin privileges directly.

### Token Not Found

**Error:** "Missing or invalid API key"

**Solution:** Ensure the `X-Impersonation-Token` header is included in the request. Check that impersonation state is stored in localStorage.

### Merchant Not Found

**Error:** "Impersonated merchant not found"

**Solution:** The merchant may have been deleted or suspended. Verify the merchant exists and is active.

## Best Practices

1. **Use Sparingly**: Only impersonate when necessary for debugging or support
2. **Document Actions**: Add notes to support tickets explaining what was done during impersonation
3. **Time Limit**: Keep impersonation sessions short (tokens expire after 1 hour)
4. **Verify Identity**: Confirm you're impersonating the correct merchant before taking actions
5. **Exit Promptly**: Exit impersonation mode as soon as the task is complete
6. **Review Logs**: Regularly review audit logs for impersonation activities

## Related Documentation

- [Admin Panel Guide](./ADMIN_PANEL.md)
- [Audit Logging](./AUDIT_LOGGING.md)
- [Authentication](./AUTHENTICATION.md)
- [Security Best Practices](./SECURITY.md)

