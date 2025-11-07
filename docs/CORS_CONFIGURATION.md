# CORS Configuration

## Overview

The API uses a dynamic CORS configuration that allows widget endpoints to work on any merchant domain while maintaining security for admin and merchant management endpoints.

## Configuration

### Dynamic Origin Validation

The CORS middleware uses a function-based origin validator that:

1. **Allows requests with no origin** - For mobile apps, curl, Postman, etc.
2. **Checks whitelist first** - Origins in `CORS_ORIGINS` environment variable are always allowed
3. **Allows all origins for widget endpoints** - Enables widget integration on any merchant site

### Widget Endpoints

The following endpoints allow requests from any origin to support widget integration:
- `/api/chat` - Chat queries
- `/api/sessions` - Session management
- `/api/documents` - Document operations
- `/api/bedrock-agent` - Bedrock agent integration

### Protected Endpoints

Admin and merchant management endpoints still respect the CORS whitelist:
- `/api/admin/*` - Admin panel
- `/api/merchants/*` - Merchant account management
- `/api/billing/*` - Billing operations

## Allowed Headers

The following headers are allowed in cross-origin requests:
- `Content-Type` - Request content type
- `Authorization` - JWT tokens
- `X-Request-ID` - Request tracking
- `X-Merchant-ID` - Merchant identification
- `X-User-ID` - User identification
- `X-Impersonation-Token` - Admin impersonation
- `X-API-Key` - API key authentication

## Exposed Headers

The following headers are exposed to client-side JavaScript:
- `X-Impersonating` - Impersonation status
- `X-Impersonated-By` - Impersonator ID
- `X-RateLimit-Limit` - Rate limit maximum
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Rate limit reset time
- `X-Request-ID` - Request tracking ID

## Environment Variables

Configure CORS origins via environment variable:

```bash
# Allow specific origins (comma-separated)
CORS_ORIGINS=http://localhost:3001,https://admin.example.com

# Allow all origins (not recommended for production)
CORS_ORIGINS=*
```

## Testing

Test the CORS configuration using the provided script:

```bash
# Start the API server
npm start

# In another terminal, run the CORS test
./scripts/test-cors-config.sh
```

## Security Considerations

### Current Implementation (Beta)

The current implementation allows all origins for widget endpoints to simplify merchant onboarding during beta testing.

**Pros:**
- Easy merchant integration
- No domain registration required
- Works immediately after API key creation

**Cons:**
- Less control over where widget is used
- Potential for unauthorized usage

### Future Enhancement (Production)

For production, consider implementing domain validation:

```typescript
origin: async (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  // Check whitelist first
  const allowedOrigins = this.config.corsOrigins;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return callback(null, true);
  }

  // For widget endpoints, validate against merchant's registered domains
  try {
    const merchantId = extractMerchantIdFromRequest(req);
    if (merchantId) {
      const merchant = await merchantRepository.findByMerchantId(merchantId);
      const allowedDomains = merchant?.settings?.allowedDomains || [];
      
      const originDomain = new URL(origin).hostname;
      const isAllowed = allowedDomains.some((domain: string) => 
        originDomain === domain || originDomain.endsWith(`.${domain}`)
      );
      
      if (isAllowed) {
        return callback(null, true);
      }
    }
  } catch (error) {
    console.error('CORS validation error:', error);
  }

  callback(new Error('Not allowed by CORS'));
}
```

## Troubleshooting

### Widget Not Loading

If the widget doesn't load on a merchant site:

1. Check browser console for CORS errors
2. Verify API key is valid
3. Ensure API base URL is correct
4. Check network tab for failed requests

### CORS Errors in Browser

If you see CORS errors:

1. Verify the origin is sending the correct headers
2. Check that preflight OPTIONS requests succeed
3. Ensure credentials are set correctly
4. Verify exposed headers are accessible

### Rate Limit Headers Not Visible

If rate limit headers aren't visible in JavaScript:

1. Check that headers are in the `exposedHeaders` list
2. Verify CORS preflight request succeeded
3. Check browser console for CORS errors

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- Widget Integration Guide: `widget/README.md`
