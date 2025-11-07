# Rate Limiting Middleware

## Overview

The rate limiting middleware provides Redis-based rate limiting with multiple strategies to protect your API from abuse and ensure fair usage across merchants.

## Features

- **IP-based rate limiting**: Protect against DDoS attacks
- **Merchant-based rate limiting**: Enforce usage limits per merchant
- **Endpoint-specific rate limiting**: Protect sensitive endpoints (e.g., login)
- **API key-specific rate limiting**: Different limits per API key
- **Atomic Redis operations**: Uses INCRBY for thread-safe counting
- **Automatic expiration**: TTL-based cleanup
- **Standard headers**: X-RateLimit-* headers for client visibility
- **Fail-open design**: Doesn't block requests on Redis failures

## Usage

### Global Rate Limiting

Apply rate limiting to all routes:

```typescript
import { rateLimitMiddleware } from './api/middleware/rateLimiting';

app.use(rateLimitMiddleware({
  checkMerchantLimits: true,  // Check merchant usage limits
  checkIpLimits: true,         // Check IP-based limits
  ipLimit: 100,                // 100 requests per IP
  ipWindow: 60,                // Per 60 seconds
  skipPaths: ['/health', '/api/health']  // Skip these paths
}));
```

### Endpoint-Specific Rate Limiting

Protect sensitive endpoints like login:

```typescript
import { createEndpointRateLimiter } from './api/middleware/rateLimiting';

// Allow only 5 login attempts per IP per 5 minutes
app.post('/api/merchants/login', 
  createEndpointRateLimiter(5, 300),
  loginHandler
);

// Allow only 3 password reset requests per IP per hour
app.post('/api/merchants/forgot-password',
  createEndpointRateLimiter(3, 3600),
  forgotPasswordHandler
);
```

### API Key Rate Limiting

Apply different rate limits per API key:

```typescript
import { apiKeyAuth } from './api/middleware/apiKeyAuth';
import { apiKeyRateLimiter } from './api/middleware/rateLimiting';

// Allow 1000 requests per minute per API key
app.use('/api',
  apiKeyAuth(),
  apiKeyRateLimiter(1000, 60),
  apiRoutes
);
```

### Combining Multiple Strategies

You can combine multiple rate limiting strategies:

```typescript
// Global IP protection
app.use(rateLimitMiddleware({
  checkIpLimits: true,
  ipLimit: 100,
  ipWindow: 60
}));

// API key authentication and rate limiting
app.use('/api',
  apiKeyAuth(),
  apiKeyRateLimiter(1000, 60)
);

// Endpoint-specific protection
app.post('/api/merchants/login',
  createEndpointRateLimiter(5, 300),
  loginHandler
);
```

## Response Headers

When rate limiting is active, the following headers are included in responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (only on 429 responses)

## Error Responses

When rate limit is exceeded, a 429 status code is returned:

```json
{
  "success": false,
  "error": "Too many requests from this IP address",
  "message": "Rate limit exceeded. Please try again later.",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

## Configuration Options

### rateLimitMiddleware Options

```typescript
interface RateLimitOptions {
  checkMerchantLimits?: boolean;  // Default: true
  checkIpLimits?: boolean;        // Default: true
  ipLimit?: number;               // Default: 100
  ipWindow?: number;              // Default: 60 (seconds)
  skipPaths?: string[];           // Default: ['/health', '/api/health']
}
```

### Merchant-Based Limits

Merchant limits are configured in the `usage_limits` table:

```sql
INSERT INTO usage_limits (merchant_id, plan, queries_per_month, api_calls_per_day)
VALUES ('merchant_123', 'professional', 10000, 50000);
```

The middleware automatically checks these limits and tracks usage in Redis.

## How It Works

### IP-Based Rate Limiting

1. Extract client IP from request (handles proxies via X-Forwarded-For)
2. Create Redis key: `rate_limit:ip:{ip_address}`
3. Atomically increment counter with INCRBY
4. Set expiration on first request
5. Check if count exceeds limit
6. Return 429 if exceeded, otherwise allow request

### Merchant-Based Rate Limiting

1. Extract merchant ID from API key or user context
2. Check current usage via UsageTrackingService
3. Compare against merchant's usage limits
4. Track API call in Redis and queue for database aggregation
5. Return 429 if limit exceeded, otherwise allow request

### Endpoint-Specific Rate Limiting

1. Create Redis key: `rate_limit:endpoint:{path}:{ip}`
2. Atomically increment counter
3. Check against endpoint-specific limit
4. Return 429 if exceeded

### API Key Rate Limiting

1. Extract API key ID from request
2. Create Redis key: `rate_limit:api_key:{key_id}`
3. Atomically increment counter
4. Check against key-specific limit
5. Return 429 if exceeded

## Best Practices

1. **Use appropriate limits**: Set limits based on your API's capacity and expected usage patterns
2. **Combine strategies**: Use IP limiting for DDoS protection and merchant limiting for fair usage
3. **Monitor Redis**: Ensure Redis is healthy and has sufficient memory
4. **Fail-open design**: The middleware fails open on errors to avoid blocking legitimate traffic
5. **Adjust for load balancers**: Ensure X-Forwarded-For headers are properly configured
6. **Test limits**: Use the provided tests as examples for testing your rate limiting configuration

## Testing

Run the rate limiting tests:

```bash
npm test -- src/tests/rateLimiting.test.ts --run
```

## Troubleshooting

### Rate limiting not working

1. Check Redis connection: `redis-cli ping`
2. Verify Redis keys are being created: `redis-cli keys "rate_limit:*"`
3. Check logs for errors

### False positives (legitimate users blocked)

1. Increase limits in configuration
2. Check if IP extraction is working correctly (proxy issues)
3. Verify merchant usage limits are set correctly

### Redis memory issues

1. Monitor Redis memory usage
2. Ensure TTL is set correctly (keys expire automatically)
3. Consider using Redis eviction policies

## Related Documentation

- [Usage Tracking Service](./USAGE_TRACKING.md)
- [API Key Authentication](./API_KEY_AUTH_MIDDLEWARE.md)
- [Merchant Platform Design](../.kiro/specs/merchant-platform/design.md)
