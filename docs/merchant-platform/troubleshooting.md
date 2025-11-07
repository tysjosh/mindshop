# Troubleshooting Guide

## Common Issues

### Widget Issues

#### Widget Not Appearing

**Symptoms:**
- Chat widget doesn't show on page
- No errors in console

**Solutions:**

1. **Check Script Loading**
   ```javascript
   // Open browser console (F12) and check Network tab
   // Look for widget.js request
   // Status should be 200
   ```

2. **Verify API Key**
   ```javascript
   // Check if API key is correct
   console.log('API Key:', 'pk_live_...');
   // Should start with pk_live_ or pk_test_
   ```

3. **Check Domain Whitelist**
   - Go to Developer Portal > Settings
   - Verify your domain is in "Allowed Domains"
   - Add domain if missing: `https://yourdomain.com`

4. **Check for JavaScript Errors**
   ```javascript
   // Open console (F12)
   // Look for errors related to RAGAssistant
   // Common errors:
   // - "ra is not defined" → Script not loaded
   // - "Invalid API key" → Wrong key
   // - "CORS error" → Domain not whitelisted
   ```

5. **Verify Initialization**
   ```javascript
   // Check if widget initialized
   console.log(window.RAGAssistant);
   // Should be defined
   
   // Check configuration
   ra('getConfig', function(config) {
     console.log('Config:', config);
   });
   ```

#### Widget Appears But Doesn't Respond

**Symptoms:**
- Widget loads but queries don't work
- Spinning indicator never stops

**Solutions:**

1. **Check API Connectivity**
   ```bash
   # Test API endpoint
   curl -X POST https://api.rag-assistant.com/api/chat \
     -H "Authorization: Bearer pk_live_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query":"test","sessionId":"test","merchantId":"YOUR_ID"}'
   ```

2. **Check Browser Console**
   ```javascript
   // Look for network errors
   // Common issues:
   // - 401 Unauthorized → Invalid API key
   // - 429 Too Many Requests → Rate limit exceeded
   // - 500 Internal Server Error → Server issue
   ```

3. **Verify Session ID**
   ```javascript
   // Check if session exists
   ra('getSessionId', function(sessionId) {
     console.log('Session ID:', sessionId);
   });
   
   // If null, create new session
   ra('createSession');
   ```

4. **Check Rate Limits**
   ```javascript
   // Check rate limit headers in Network tab
   // X-RateLimit-Remaining: 0 → Rate limit exceeded
   // Wait for X-RateLimit-Reset time
   ```

#### Widget Styling Issues

**Symptoms:**
- Widget looks broken
- Overlaps with site content
- Wrong colors/fonts

**Solutions:**

1. **CSS Conflicts**
   ```javascript
   // Enable CSS reset
   ra('updateConfig', {
     theme: {
       cssReset: true
     }
   });
   ```

2. **Z-Index Issues**
   ```javascript
   // Increase z-index
   ra('updateConfig', {
     theme: {
       zIndex: 99999
     }
   });
   ```

3. **Position Conflicts**
   ```javascript
   // Adjust position
   ra('updateConfig', {
     theme: {
       position: 'bottom-right',
       offset: {
         bottom: '20px',
         right: '20px'
       }
     }
   });
   ```

4. **Custom CSS**
   ```javascript
   // Override styles
   ra('updateConfig', {
     theme: {
       customCSS: `
         .rag-widget {
           font-family: inherit !important;
         }
         .rag-widget-toggle {
           bottom: 100px !important;
         }
       `
     }
   });
   ```

---

### API Issues

#### 401 Unauthorized

**Error:**
```json
{
  "success": false,
  "error": "Invalid or expired API key",
  "code": "INVALID_API_KEY"
}
```

**Solutions:**

1. **Check API Key Format**
   ```javascript
   // Should start with pk_live_ or pk_test_
   const apiKey = 'pk_live_abc123...';
   
   // Check Authorization header
   'Authorization': `Bearer ${apiKey}`
   ```

2. **Verify Key Status**
   - Go to Developer Portal > API Keys
   - Check if key is active (not revoked)
   - Check expiration date

3. **Check Environment**
   ```javascript
   // Test keys only work in development
   // Live keys only work in production
   
   // If using test key in production:
   const apiKey = process.env.NODE_ENV === 'production'
     ? process.env.LIVE_API_KEY
     : process.env.TEST_API_KEY;
   ```

4. **Regenerate Key**
   - Go to Developer Portal > API Keys
   - Click "Create API Key"
   - Replace old key in your code

#### 429 Rate Limit Exceeded

**Error:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**Solutions:**

1. **Check Rate Limit Headers**
   ```javascript
   const response = await fetch('https://api.rag-assistant.com/api/chat', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer pk_live_...'
     },
     body: JSON.stringify({...})
   });
   
   console.log('Limit:', response.headers.get('X-RateLimit-Limit'));
   console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
   console.log('Reset:', response.headers.get('X-RateLimit-Reset'));
   ```

2. **Implement Retry Logic**
   ```javascript
   async function fetchWithRetry(url, options) {
     const response = await fetch(url, options);
     
     if (response.status === 429) {
       const retryAfter = response.headers.get('Retry-After');
       await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
       return fetchWithRetry(url, options);
     }
     
     return response;
   }
   ```

3. **Upgrade Plan**
   - Go to Developer Portal > Billing
   - Upgrade to higher tier for more requests

4. **Optimize Requests**
   - Implement client-side caching
   - Batch requests when possible
   - Reduce unnecessary API calls

#### 404 Not Found

**Error:**
```json
{
  "success": false,
  "error": "Resource not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

**Solutions:**

1. **Check Endpoint URL**
   ```javascript
   // Correct
   'https://api.rag-assistant.com/api/chat'
   
   // Wrong
   'https://api.rag-assistant.com/chat' // Missing /api
   ```

2. **Check Merchant ID**
   ```javascript
   // Verify merchant ID is correct
   const merchantId = 'acme_electronics_2024';
   
   // Check in Developer Portal > Settings
   ```

3. **Check Session ID**
   ```javascript
   // Session may have expired
   // Create new session
   const response = await fetch('https://api.rag-assistant.com/api/chat/sessions', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer pk_live_...'
     },
     body: JSON.stringify({
       merchantId: 'acme_electronics_2024'
     })
   });
   
   const { sessionId } = await response.json();
   ```

#### 500 Internal Server Error

**Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

**Solutions:**

1. **Check API Status**
   - Visit [https://status.rag-assistant.com](https://status.rag-assistant.com)
   - Check for ongoing incidents

2. **Retry Request**
   ```javascript
   // Implement exponential backoff
   async function fetchWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, options);
         if (response.ok) return response;
         
         if (response.status >= 500) {
           const delay = Math.pow(2, i) * 1000;
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         
         return response;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         const delay = Math.pow(2, i) * 1000;
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

3. **Contact Support**
   - Email: support@rag-assistant.com
   - Include request ID from error response
   - Include timestamp of error

---

### Product Data Issues

#### No Recommendations Returned

**Symptoms:**
- Queries return empty recommendations array
- Assistant says "I couldn't find any products"

**Solutions:**

1. **Check Product Upload**
   ```bash
   # Verify products were uploaded
   curl -X GET https://api.rag-assistant.com/api/documents/search?q=test \
     -H "Authorization: Bearer pk_live_YOUR_KEY"
   ```

2. **Wait for Indexing**
   ```javascript
   // Products take 2-3 minutes to index
   // Check indexing status
   const response = await fetch('https://api.rag-assistant.com/api/merchants/acme/sync/status', {
     headers: {
       'Authorization': `Bearer ${accessToken}`
     }
   });
   
   const { status, lastSync } = await response.json();
   console.log('Sync status:', status);
   ```

3. **Check Product Data Quality**
   ```json
   // Ensure products have required fields
   {
     "type": "product",
     "title": "Product Name", // Required
     "content": "Detailed description", // Required
     "metadata": {
       "sku": "SKU-001", // Required
       "price": 99.99, // Required
       "inStock": true, // Required
       "category": "Electronics" // Recommended
     }
   }
   ```

4. **Improve Query Specificity**
   ```javascript
   // Too vague
   "show me products" // ❌
   
   // More specific
   "show me wireless headphones under $200" // ✅
   ```

#### Wrong Products Recommended

**Symptoms:**
- Irrelevant products returned
- Low confidence scores

**Solutions:**

1. **Improve Product Descriptions**
   ```json
   // Bad
   {
     "title": "Headphones",
     "content": "Black headphones"
   }
   
   // Good
   {
     "title": "Premium Wireless Bluetooth Headphones",
     "content": "Premium over-ear wireless headphones with active noise cancellation, 30-hour battery life, Bluetooth 5.0 connectivity, and comfortable memory foam cushions. Perfect for travel, commuting, and focused work."
   }
   ```

2. **Add Relevant Tags**
   ```json
   {
     "metadata": {
       "tags": [
         "wireless",
         "bluetooth",
         "noise-cancelling",
         "over-ear",
         "travel",
         "commute"
       ]
     }
   }
   ```

3. **Use Proper Categories**
   ```json
   {
     "metadata": {
       "category": "Electronics > Audio > Headphones > Over-Ear"
     }
   }
   ```

4. **Update Stale Data**
   ```javascript
   // Set up automatic sync
   await fetch('https://api.rag-assistant.com/api/merchants/acme/sync/configure', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       schedule: 'daily',
       time: '02:00'
     })
   });
   ```

---

### Authentication Issues

#### Can't Log In

**Symptoms:**
- Login fails with "Invalid credentials"
- Account locked

**Solutions:**

1. **Check Email/Password**
   - Verify email is correct
   - Check for typos
   - Ensure Caps Lock is off

2. **Reset Password**
   ```bash
   curl -X POST https://api.rag-assistant.com/api/merchants/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"john@acme.com"}'
   ```

3. **Check Account Status**
   - Email may not be verified
   - Check spam folder for verification email
   - Resend verification email

4. **Account Locked**
   - Too many failed login attempts
   - Wait 15 minutes and try again
   - Or contact support to unlock

#### Email Not Verified

**Symptoms:**
- Can't access dashboard
- "Email not verified" error

**Solutions:**

1. **Check Email**
   - Check inbox for verification email
   - Check spam/junk folder
   - Add noreply@rag-assistant.com to contacts

2. **Resend Verification**
   ```bash
   curl -X POST https://api.rag-assistant.com/api/merchants/resend-verification \
     -H "Content-Type: application/json" \
     -d '{"email":"john@acme.com"}'
   ```

3. **Contact Support**
   - If email not received after 10 minutes
   - Email: support@rag-assistant.com

---

### Performance Issues

#### Slow Response Times

**Symptoms:**
- Queries take > 5 seconds
- Widget feels sluggish

**Solutions:**

1. **Check Network**
   ```javascript
   // Test API latency
   const start = Date.now();
   await fetch('https://api.rag-assistant.com/api/health');
   const latency = Date.now() - start;
   console.log('API latency:', latency, 'ms');
   ```

2. **Optimize Product Data**
   - Reduce product count (< 10,000 products)
   - Shorten descriptions (< 500 words)
   - Remove unnecessary metadata

3. **Enable Caching**
   ```javascript
   // Client-side caching
   const cache = new Map();
   
   async function sendQuery(query, sessionId) {
     const cacheKey = `${query}:${sessionId}`;
     
     if (cache.has(cacheKey)) {
       return cache.get(cacheKey);
     }
     
     const response = await fetch('https://api.rag-assistant.com/api/chat', {
       method: 'POST',
       headers: {
         'Authorization': 'Bearer pk_live_...'
       },
       body: JSON.stringify({
         query,
         sessionId,
         merchantId: 'acme_electronics_2024'
       })
     });
     
     const data = await response.json();
     cache.set(cacheKey, data);
     
     return data;
   }
   ```

4. **Use CDN**
   ```html
   <!-- Preconnect to API -->
   <link rel="preconnect" href="https://api.rag-assistant.com">
   <link rel="dns-prefetch" href="https://api.rag-assistant.com">
   ```

#### High Memory Usage

**Symptoms:**
- Browser tab uses excessive memory
- Page becomes unresponsive

**Solutions:**

1. **Clear History**
   ```javascript
   // Clear conversation history
   ra('clearHistory');
   ```

2. **Limit History Size**
   ```javascript
   ra('updateConfig', {
     behavior: {
       maxHistorySize: 50 // Limit to 50 messages
     }
   });
   ```

3. **Disable Persistence**
   ```javascript
   ra('updateConfig', {
     behavior: {
       persistHistory: false
     }
   });
   ```

---

## Debugging Tools

### Enable Debug Mode

```javascript
// Enable debug logging
ra('updateConfig', {
  debug: true
});

// Check logs in console
// Will show:
// - API requests/responses
// - Session management
// - Cache hits/misses
// - Error details
```

### Network Inspector

```javascript
// Monitor API calls
window.addEventListener('fetch', (event) => {
  if (event.request.url.includes('rag-assistant.com')) {
    console.log('API Request:', {
      url: event.request.url,
      method: event.request.method,
      headers: Object.fromEntries(event.request.headers)
    });
  }
});
```

### Performance Monitoring

```javascript
// Track performance
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('rag-assistant')) {
      console.log('Performance:', {
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime
      });
    }
  }
});

observer.observe({ entryTypes: ['resource', 'measure'] });
```

---

## Getting Help

### Before Contacting Support

1. **Check Status Page**
   - Visit [https://status.rag-assistant.com](https://status.rag-assistant.com)
   - Check for ongoing incidents

2. **Search Documentation**
   - Check [documentation](./README.md)
   - Search [community forum](https://community.rag-assistant.com)

3. **Gather Information**
   - Error messages
   - Request IDs
   - Timestamps
   - Browser/device info
   - Steps to reproduce

### Contact Support

**Email:** support@rag-assistant.com

**Include:**
- Merchant ID
- API key prefix (pk_live_abc...)
- Error message
- Request ID
- Timestamp
- Steps to reproduce
- Browser/device info

**Response Times:**
- Starter: 24-48 hours
- Professional: 12-24 hours
- Enterprise: 4-8 hours

### Community Forum

- [https://community.rag-assistant.com](https://community.rag-assistant.com)
- Search existing topics
- Post new questions
- Help other merchants

### Emergency Support

For critical production issues:
- Email: emergency@rag-assistant.com
- Include "URGENT" in subject
- Enterprise customers only

---

## Additional Resources

- 📚 [Full Documentation](./README.md)
- 🎥 [Video Tutorials](https://www.youtube.com/rag-assistant)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📊 [API Status](https://status.rag-assistant.com)
- 🐛 [Report Bug](https://github.com/rag-assistant/issues)
