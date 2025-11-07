# Authentication Error Handling and Security Logging

This document describes the standardized error handling and security logging system for authentication in the MindShop platform.

## Overview

The authentication system now includes:
- **Standardized error codes** for all authentication failures
- **Consistent error response format** across all endpoints
- **Security logging** for authentication events
- **Rate limiting** to prevent brute force attacks
- **Suspicious activity detection** for security monitoring

## Error Codes

All authentication errors use standardized error codes from the `AuthErrorCode` enum:

### Authentication Errors (401)
- `AUTH_MISSING` - Missing or invalid authorization header
- `AUTH_INVALID_FORMAT` - Authorization header format is invalid
- `TOKEN_EXPIRED` - Token has expired
- `TOKEN_INVALID` - Token is invalid or malformed
- `TOKEN_SIGNATURE_INVALID` - Token signature verification failed
- `TOKEN_MISSING_CLAIMS` - Token is missing required claims
- `MERCHANT_ID_MISSING` - Token missing required merchant identifier
- `API_KEY_INVALID` - API key is invalid
- `API_KEY_EXPIRED` - API key has expired
- `API_KEY_REVOKED` - API key has been revoked

### Authorization Errors (403)
- `ACCESS_DENIED` - Access denied to merchant resources
- `INSUFFICIENT_PERMISSIONS` - Insufficient permissions for this operation
- `EMAIL_UNVERIFIED` - Email verification required

### Rate Limiting (429)
- `RATE_LIMIT_EXCEEDED` - Too many authentication attempts

### System Errors (500)
- `AUTH_SYSTEM_ERROR` - Authentication system error

## Error Response Format

All authentication errors return a consistent JSON response:

```json
{
  "success": false,
  "error": "Your session has expired. Please log in again.",
  "message": "Token has expired",
  "details": {
    "code": "TOKEN_EXPIRED"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-1234567890"
}
```

### Response Fields

- `success` - Always `false` for errors
- `error` - User-friendly error message (safe to display to users)
- `message` - Technical error message (for logging/debugging)
- `details` - Additional error details including error code
- `timestamp` - ISO 8601 timestamp of the error
- `requestId` - Unique request identifier for tracking

## Security Logging

All authentication events are logged with context for security monitoring and auditing.

### Logged Events

- `LOGIN_SUCCESS` - Successful JWT authentication
- `LOGIN_FAILURE` - Failed JWT authentication
- `TOKEN_VALIDATION_FAILURE` - Token validation failed
- `API_KEY_VALIDATION_SUCCESS` - Successful API key authentication
- `API_KEY_VALIDATION_FAILURE` - Failed API key authentication
- `ACCESS_DENIED` - User attempted to access unauthorized resources
- `SUSPICIOUS_ACTIVITY` - Suspicious authentication patterns detected
- `RATE_LIMIT_TRIGGERED` - Rate limit exceeded

### Log Context

Each log entry includes:
- Event type
- User ID (if available)
- Merchant ID (if available)
- IP address
- User agent
- Request path and method
- Error code (for failures)
- Timestamp
- Additional metadata

### Example Log Entry

```json
{
  "level": "warn",
  "eventType": "TOKEN_VALIDATION_FAILURE",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "errorCode": "TOKEN_EXPIRED",
  "errorMessage": "Authentication failed: TOKEN_EXPIRED",
  "requestPath": "/api/v1/merchants/test-merchant-123/analytics",
  "requestMethod": "GET",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "merchantId": "unknown",
  "requestId": "auth-1705318200000-abc123"
}
```

## Rate Limiting

The system implements rate limiting to prevent brute force attacks:

### Configuration
- **Max Failed Attempts**: 5 attempts per IP
- **Time Window**: 5 minutes
- **Cleanup Interval**: 10 minutes

### Behavior
1. Failed authentication attempts are tracked per IP address
2. After 5 failed attempts within 5 minutes, subsequent requests are blocked
3. Returns `429 Too Many Requests` with `RATE_LIMIT_EXCEEDED` error code
4. Successful authentication clears the failed attempt counter
5. Old records are automatically cleaned up every 10 minutes

### Rate Limit Response

```json
{
  "success": false,
  "error": "Too many authentication attempts. Please try again later.",
  "message": "Rate limit exceeded",
  "details": {
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-1234567890"
}
```

## Suspicious Activity Detection

The system monitors for suspicious authentication patterns:

### Detection Criteria
- **Threshold**: 10 different user identifiers from the same IP
- **Time Window**: 5 minutes

### Behavior
When suspicious activity is detected:
1. Event is logged with `SUSPICIOUS_ACTIVITY` type
2. Alert is triggered (if alerting is configured)
3. Includes metadata: failed attempts count, unique users, time window

### Example Suspicious Activity Log

```json
{
  "level": "error",
  "eventType": "SUSPICIOUS_ACTIVITY",
  "ipAddress": "192.168.1.100",
  "errorMessage": "Suspicious authentication activity detected",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "failedAttempts": 15,
    "uniqueUsers": 12,
    "timeWindow": "5 minutes"
  }
}
```

## CloudWatch Metrics

Authentication events are sent to CloudWatch for monitoring:

### Metrics
- `auth.events` - Count of all authentication events
- `auth.failures` - Count of failed authentication attempts

### Dimensions
- `eventType` - Type of authentication event
- `merchantId` - Merchant identifier (when available)

### Namespace
`MindShop/Authentication`

## Usage Examples

### Handling Authentication Errors in Client Code

```typescript
async function makeAuthenticatedRequest(endpoint: string, token: string) {
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    
    // Check error code for specific handling
    switch (error.details?.code) {
      case 'TOKEN_EXPIRED':
        // Refresh token and retry
        await refreshToken();
        return makeAuthenticatedRequest(endpoint, newToken);
      
      case 'RATE_LIMIT_EXCEEDED':
        // Show rate limit message and wait
        showError('Too many attempts. Please wait a few minutes.');
        break;
      
      case 'ACCESS_DENIED':
        // Redirect to unauthorized page
        redirectTo('/unauthorized');
        break;
      
      default:
        // Show generic error
        showError(error.error);
    }
  }

  return response.json();
}
```

### Checking Rate Limits in Middleware

```typescript
import { getAuthSecurityLogger } from './authSecurityLogger';

const securityLogger = getAuthSecurityLogger();

// Check if IP is rate limited
if (securityLogger.isRateLimitExceeded(clientIp)) {
  await securityLogger.logRateLimitExceeded(req);
  return res.status(429).json(errorResponse);
}
```

### Logging Custom Authentication Events

```typescript
import { getAuthSecurityLogger, AuthEventType } from './authSecurityLogger';

const securityLogger = getAuthSecurityLogger();

await securityLogger.logAuthEvent({
  eventType: AuthEventType.LOGIN_SUCCESS,
  userId: 'user-123',
  merchantId: 'merchant-456',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  requestPath: req.path,
  requestMethod: req.method,
  timestamp: new Date(),
});
```

## Security Best Practices

1. **Never log sensitive data** - Passwords, full tokens, and PII are automatically redacted
2. **Monitor rate limit metrics** - Set up alerts for high rate limit triggers
3. **Review suspicious activity logs** - Investigate patterns of suspicious behavior
4. **Rotate API keys regularly** - Encourage merchants to rotate keys periodically
5. **Use HTTPS only** - All authentication must use secure connections
6. **Implement token refresh** - Use short-lived access tokens with refresh tokens
7. **Set up CloudWatch alarms** - Alert on authentication failure spikes

## Monitoring and Alerts

### Recommended CloudWatch Alarms

1. **High Authentication Failure Rate**
   - Metric: `auth.failures`
   - Threshold: > 100 failures per 5 minutes
   - Action: Alert security team

2. **Suspicious Activity Detected**
   - Log filter: `eventType = "SUSPICIOUS_ACTIVITY"`
   - Threshold: > 5 occurrences per hour
   - Action: Alert security team

3. **Rate Limit Exceeded**
   - Metric: `auth.events` where `eventType = "RATE_LIMIT_TRIGGERED"`
   - Threshold: > 50 per 10 minutes
   - Action: Review and potentially block IPs

## Testing

Run the authentication error handling tests:

```bash
npm test -- src/tests/authErrorHandling.test.ts --run
```

## Related Documentation

- [Authentication Guide](./AUTHENTICATION.md)
- [API Key Permissions](./API_KEY_PERMISSIONS.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
