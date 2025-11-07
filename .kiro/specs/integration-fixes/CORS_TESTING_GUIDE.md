# CORS Testing Guide

This guide explains how to test that the widget works correctly from external domains (merchant websites).

## Why CORS Testing is Important

The RAG Assistant widget is designed to be embedded on merchant websites. These websites will have different origins (domains) than our API server. Without proper CORS configuration, browsers will block the widget's API requests, making it non-functional.

## Test Methods

We provide two ways to test CORS functionality:

### Method 1: Automated Shell Script (Recommended)

The shell script tests CORS by making HTTP requests with the `Origin` header set to simulate an external domain.

**Prerequisites:**
- API server running on `http://localhost:3000` (or set `API_URL` environment variable)
- `curl` installed (pre-installed on macOS/Linux)

**Run the test:**

```bash
# Start the API server first
npm run dev

# In another terminal, run the CORS test
./scripts/test-widget-cors.sh
```

**Custom API URL:**

```bash
API_URL=http://localhost:3001 ./scripts/test-widget-cors.sh
```

**What it tests:**
- ✓ Preflight OPTIONS requests
- ✓ Session creation from external domain
- ✓ Chat message sending from external domain
- ✓ Session history retrieval from external domain
- ✓ Document search from external domain
- ✓ CORS headers are properly exposed

**Expected output:**

```
🧪 Widget CORS Integration Test
================================

📋 Test Configuration:
   API URL: http://localhost:3000
   External Origin: https://merchant-store.example.com
   Merchant ID: test_merchant_cors
   User ID: test_user_1699123456

🔍 Checking if API is running...
✓ API is running

🧪 Running CORS Tests:
=====================

Testing: Preflight OPTIONS for /api/chat/sessions... ✓ PASSED (HTTP 204)
Testing: Create session from external domain... ✓ PASSED (HTTP 201)
   Session ID: 550e8400-e29b-41d4-a716-446655440000
Testing: Preflight OPTIONS for /api/chat... ✓ PASSED (HTTP 204)
Testing: Send chat message from external domain... ✓ PASSED (HTTP 200)
Testing: Get session history from external domain... ✓ PASSED (HTTP 200)
Testing: Document search from external domain... ✓ PASSED (HTTP 200)
Testing: Preflight OPTIONS for /api/documents... ✓ PASSED (HTTP 204)
Testing: CORS headers are exposed... ✓ PASSED
   Headers found:
   access-control-allow-origin: https://merchant-store.example.com
   access-control-allow-credentials: true
   access-control-expose-headers: X-Request-ID, X-RateLimit-Limit, ...

📊 Test Summary:
===============
Tests Passed: 8
Tests Failed: 0
Total Tests: 8

✓ All CORS tests passed!

The widget should work correctly on external merchant domains.
```

### Method 2: Interactive HTML Test Page

The HTML test page provides a visual interface for testing CORS and can be used to debug issues.

**Prerequisites:**
- API server running
- Web browser

**Run the test:**

1. Start the API server:
   ```bash
   npm run dev
   ```

2. Open the test page in your browser:
   ```bash
   open widget/examples/test-sites/test-cors.html
   # or
   open http://localhost:3000/widget/examples/test-sites/test-cors.html
   ```

3. Configure the test parameters (if needed):
   - API Base URL (default: `http://localhost:3000`)
   - Merchant ID (default: `test_merchant_cors`)
   - API Key (default: `test_key`)

4. Click "Run CORS Tests"

**What it tests:**
- ✓ Preflight OPTIONS requests
- ✓ Session creation with CORS
- ✓ Chat message sending with CORS
- ✓ Session history retrieval with CORS
- ✓ Document search with CORS
- ✓ CORS headers validation

**Features:**
- Visual test results with pass/fail indicators
- Detailed error messages for debugging
- Test summary with statistics
- Configurable test parameters
- Browser console logging for debugging

## Testing from a Real External Domain

To test from an actual external domain (most realistic):

### Option A: Using ngrok (Recommended)

1. Install ngrok: https://ngrok.com/download

2. Start your API server:
   ```bash
   npm run dev
   ```

3. Expose it via ngrok:
   ```bash
   ngrok http 3000
   ```

4. Update the test page to use the ngrok URL:
   ```javascript
   // In test-cors.html, update the API URL input to:
   https://your-ngrok-url.ngrok.io
   ```

5. Host the test page on a different domain (e.g., GitHub Pages, Netlify, or another local server)

6. Open the test page and run the tests

### Option B: Using Two Local Servers

1. Start the API server on port 3000:
   ```bash
   npm run dev
   ```

2. Start a simple HTTP server on a different port for the test page:
   ```bash
   cd widget/examples/test-sites
   python3 -m http.server 8080
   ```

3. Open the test page at `http://localhost:8080/test-cors.html`

4. The test page (port 8080) will make requests to the API (port 3000), simulating cross-origin requests

## Troubleshooting

### CORS Errors in Browser Console

If you see errors like:
```
Access to fetch at 'http://localhost:3000/api/chat/sessions' from origin 'http://localhost:8080' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Solutions:**

1. **Check CORS configuration in `src/api/app.ts`:**
   ```typescript
   cors({
     origin: (origin, callback) => {
       // Should allow all origins or validate against whitelist
       callback(null, true);
     },
     credentials: true,
     // ... other settings
   })
   ```

2. **Verify exposed headers:**
   ```typescript
   exposedHeaders: [
     'X-Request-ID',
     'X-RateLimit-Limit',
     'X-RateLimit-Remaining',
     'X-RateLimit-Reset',
     // ... other headers
   ]
   ```

3. **Check preflight handling:**
   - Ensure OPTIONS requests return 200 or 204
   - Verify `Access-Control-Allow-Methods` includes required methods
   - Verify `Access-Control-Allow-Headers` includes required headers

### Tests Fail with "API is not running"

**Solutions:**
- Start the API server: `npm run dev`
- Check the API is accessible: `curl http://localhost:3000/health`
- Verify the port is correct (default: 3000)

### Session Creation Fails

**Solutions:**
- Check authentication is not required for test endpoints
- Verify merchant ID exists in database
- Check API logs for errors: `tail -f logs/combined.log`

### Preflight Requests Fail

**Solutions:**
- Ensure CORS middleware is loaded before routes
- Check that OPTIONS method is not blocked
- Verify `Access-Control-Allow-Methods` includes POST, GET, etc.

## CORS Configuration Reference

Current CORS configuration in `src/api/app.ts`:

```typescript
cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check whitelist
    const allowedOrigins = this.config.corsOrigins;
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Allow all origins for widget endpoints
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Merchant-ID',
    'X-User-ID',
    'X-Impersonation-Token',
    'X-API-Key',
  ],
  exposedHeaders: [
    'X-Impersonating',
    'X-Impersonated-By',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],
})
```

## Success Criteria

CORS is properly configured when:

- ✓ All automated tests pass
- ✓ Widget loads on external domains without errors
- ✓ Session creation works from external domains
- ✓ Chat messages can be sent from external domains
- ✓ Session history can be retrieved from external domains
- ✓ No CORS errors in browser console
- ✓ Rate limit headers are exposed
- ✓ Request ID headers are exposed

## Next Steps

After CORS tests pass:

1. Test widget integration on a real merchant website
2. Monitor CORS-related errors in production
3. Set up alerts for CORS rejection rates
4. Document allowed domains for merchants
5. Implement domain whitelisting per merchant (optional)

## Additional Resources

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [CORS Preflight Requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
