# Best Practices Guide

## Overview

This guide covers best practices for integrating and using the RAG Assistant platform effectively, securely, and efficiently.

## Product Data Management

### Data Quality

#### Complete Product Information

Provide comprehensive product data for better recommendations:

```json
{
  "type": "product",
  "title": "Wireless Bluetooth Headphones - Premium Noise Cancelling",
  "content": "Experience superior sound quality with our premium wireless headphones. Features include: Active Noise Cancellation (ANC) that blocks up to 95% of ambient noise, 30-hour battery life for all-day listening, Bluetooth 5.0 for stable connectivity up to 30 feet, comfortable over-ear design with memory foam cushions, foldable design for easy travel, built-in microphone for hands-free calls, and premium audio drivers for rich bass and clear highs. Perfect for commuters, travelers, and audiophiles.",
  "metadata": {
    "sku": "WBH-001",
    "price": 199.99,
    "category": "Electronics > Audio > Headphones",
    "brand": "ACME Audio",
    "inStock": true,
    "stockQuantity": 45,
    "imageUrl": "https://cdn.acme.com/products/wbh-001-main.jpg",
    "images": [
      "https://cdn.acme.com/products/wbh-001-1.jpg",
      "https://cdn.acme.com/products/wbh-001-2.jpg"
    ],
    "url": "https://acme.com/products/wireless-headphones-wbh-001",
    "rating": 4.7,
    "reviewCount": 1234,
    "features": [
      "Active Noise Cancellation",
      "30-hour battery life",
      "Bluetooth 5.0",
      "Foldable design"
    ],
    "specifications": {
      "weight": "250g",
      "color": "Black",
      "connectivity": "Bluetooth 5.0",
      "batteryLife": "30 hours"
    },
    "tags": ["wireless", "bluetooth", "noise-cancelling", "over-ear", "premium"]
  }
}
```

#### Rich Descriptions

Write detailed, natural descriptions:

✅ **Good:**
```
"Premium wireless headphones with active noise cancellation that blocks up to 95% of ambient noise. 
Features 30-hour battery life, Bluetooth 5.0 connectivity, and comfortable memory foam ear cushions. 
Perfect for travel, commuting, or focused work sessions."
```

❌ **Bad:**
```
"Headphones. Wireless. Black."
```

### Data Organization

#### Consistent Categorization

Use hierarchical categories:

```
Electronics > Audio > Headphones > Over-Ear
Electronics > Audio > Headphones > In-Ear
Electronics > Audio > Speakers > Bluetooth
Clothing > Men > Shirts > T-Shirts
```

#### Meaningful Tags

Add relevant tags for better search:

```json
{
  "tags": [
    "wireless",
    "bluetooth",
    "noise-cancelling",
    "over-ear",
    "premium",
    "travel",
    "commute",
    "audiophile"
  ]
}
```

### Data Freshness

#### Regular Updates

Keep product data synchronized:

```javascript
// Option 1: Scheduled sync (recommended)
// Set up daily sync at 2 AM
await fetch('https://api.rag-assistant.com/api/merchants/acme/sync/configure', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    schedule: 'daily',
    time: '02:00',
    source: 'https://acme.com/api/products',
    incremental: true
  })
});

// Option 2: Webhook on product changes
// Configure webhook in your e-commerce platform
// POST to https://api.rag-assistant.com/api/webhooks/products/acme
```

#### Stock Status

Update stock status in real-time:

```javascript
// When product goes out of stock
await fetch('https://api.rag-assistant.com/api/documents/doc_abc123', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer pk_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    metadata: {
      inStock: false,
      stockQuantity: 0
    }
  })
});
```

---

## Query Optimization

### Session Management

#### Maintain Sessions

Keep sessions for conversation context:

```javascript
// Store session ID
let sessionId = localStorage.getItem('ragSessionId');

if (!sessionId) {
  // Create new session
  const response = await fetch('https://api.rag-assistant.com/api/chat/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      merchantId: 'acme_electronics_2024',
      userId: getUserId()
    })
  });
  
  const data = await response.json();
  sessionId = data.sessionId;
  localStorage.setItem('ragSessionId', sessionId);
}

// Use session in queries
await sendQuery('wireless headphones', sessionId);
```

#### Session Expiration

Handle expired sessions gracefully:

```javascript
async function sendQuery(query, sessionId) {
  const response = await fetch('https://api.rag-assistant.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      sessionId,
      merchantId: 'acme_electronics_2024'
    })
  });

  if (response.status === 404) {
    // Session expired, create new one
    localStorage.removeItem('ragSessionId');
    const newSessionId = await createSession();
    return sendQuery(query, newSessionId);
  }

  return response.json();
}
```

### Context Enrichment

Provide additional context for better results:

```javascript
await fetch('https://api.rag-assistant.com/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pk_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'wireless headphones',
    sessionId: 'session_abc123',
    merchantId: 'acme_electronics_2024',
    context: {
      page: 'product-listing',
      category: 'electronics',
      currentUrl: window.location.href,
      userPreferences: {
        priceRange: { min: 0, max: 200 },
        brands: ['ACME', 'TechBrand']
      },
      cartItems: [
        { sku: 'LAP-001', category: 'Electronics' }
      ]
    }
  })
});
```

---

## Performance Optimization

### Caching

#### Client-Side Caching

Cache responses to reduce API calls:

```javascript
class RAGCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }
}

const cache = new RAGCache();

async function sendQuery(query, sessionId) {
  const cacheKey = `${query}:${sessionId}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // Make API call
  const response = await fetch('https://api.rag-assistant.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      sessionId,
      merchantId: 'acme_electronics_2024'
    })
  });
  
  const data = await response.json();
  
  // Cache response
  cache.set(cacheKey, data);
  
  return data;
}
```

### Request Batching

Batch multiple operations:

```javascript
// ❌ Bad: Multiple individual requests
for (const product of products) {
  await createDocument(product);
}

// ✅ Good: Single batch request
await fetch('https://api.rag-assistant.com/api/documents/bulk', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pk_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    documents: products.map(p => ({
      type: 'product',
      title: p.title,
      content: p.description,
      metadata: p
    }))
  })
});
```

### Lazy Loading

Load widget only when needed:

```javascript
let widgetLoaded = false;

function loadWidget() {
  if (widgetLoaded) return;
  
  const script = document.createElement('script');
  script.src = 'https://cdn.rag-assistant.com/v1/widget.js';
  script.async = true;
  script.onload = () => {
    widgetLoaded = true;
    ra('init', config);
  };
  document.body.appendChild(script);
}

// Load on user interaction
document.getElementById('chat-button').addEventListener('click', loadWidget);

// Or load after page load
window.addEventListener('load', () => {
  setTimeout(loadWidget, 2000);
});
```

---

## Error Handling

### Graceful Degradation

Handle errors without breaking user experience:

```javascript
async function sendQuery(query, sessionId) {
  try {
    const response = await fetch('https://api.rag-assistant.com/api/chat', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer pk_live_...',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        sessionId,
        merchantId: 'acme_electronics_2024'
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error('RAG Assistant error:', error);
    
    // Fallback to basic search
    return {
      answer: "I'm having trouble right now. Try searching our catalog directly.",
      recommendations: [],
      fallback: true
    };
  }
}
```

### Retry Logic

Implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      // Retry server errors (5xx)
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw new Error(`Server error: ${response.status}`);
      
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Error Monitoring

Track errors for debugging:

```javascript
function trackError(error, context) {
  // Log to console
  console.error('RAG Assistant error:', error, context);
  
  // Send to error tracking service
  if (window.Sentry) {
    Sentry.captureException(error, {
      tags: {
        component: 'rag-assistant',
        merchantId: context.merchantId
      },
      extra: context
    });
  }
  
  // Send to analytics
  if (window.gtag) {
    gtag('event', 'exception', {
      description: error.message,
      fatal: false
    });
  }
}
```

---

## Security Best Practices

### API Key Management

#### Environment Variables

Never hardcode API keys:

```javascript
// ❌ Bad
const apiKey = 'pk_live_abc123def456...';

// ✅ Good
const apiKey = process.env.RAG_ASSISTANT_API_KEY;
```

#### Key Rotation

Rotate keys regularly:

```bash
# 1. Generate new key
curl -X POST https://api.rag-assistant.com/api/merchants/acme/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name":"Production Key (Rotated)","environment":"production"}'

# 2. Update environment variable
export RAG_ASSISTANT_API_KEY="pk_live_NEW_KEY"

# 3. Deploy application

# 4. Wait 24 hours (grace period)

# 5. Revoke old key
curl -X DELETE https://api.rag-assistant.com/api/merchants/acme/api-keys/key_old123 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Input Validation

Validate user input before sending to API:

```javascript
function validateQuery(query) {
  // Check length
  if (!query || query.length < 2) {
    throw new Error('Query too short');
  }
  
  if (query.length > 500) {
    throw new Error('Query too long');
  }
  
  // Sanitize HTML
  const sanitized = query
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  
  return sanitized;
}

async function sendQuery(query, sessionId) {
  const validatedQuery = validateQuery(query);
  
  // Send to API
  const response = await fetch('https://api.rag-assistant.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: validatedQuery,
      sessionId,
      merchantId: 'acme_electronics_2024'
    })
  });
  
  return response.json();
}
```

### Rate Limiting

Implement client-side rate limiting:

```javascript
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(time => 
      now - time < this.windowMs
    );

    // Check limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(waitTime / 1000)}s`);
    }

    this.requests.push(now);
  }
}

const limiter = new RateLimiter(100, 60000); // 100 requests per minute

async function sendQuery(query, sessionId) {
  await limiter.checkLimit();
  
  // Make API call
  const response = await fetch('https://api.rag-assistant.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      sessionId,
      merchantId: 'acme_electronics_2024'
    })
  });
  
  return response.json();
}
```

---

## Analytics & Monitoring

### Track Key Metrics

Monitor important metrics:

```javascript
// Track query performance
function trackQueryMetrics(query, response, startTime) {
  const metrics = {
    query,
    responseTime: Date.now() - startTime,
    recommendationCount: response.recommendations?.length || 0,
    confidence: response.confidence,
    intent: response.intent,
    success: response.success
  };
  
  // Send to analytics
  if (window.gtag) {
    gtag('event', 'rag_query', metrics);
  }
  
  // Send to custom analytics
  if (window.analytics) {
    analytics.track('RAG Query', metrics);
  }
}

// Usage
const startTime = Date.now();
const response = await sendQuery(query, sessionId);
trackQueryMetrics(query, response, startTime);
```

### Monitor Error Rates

Track and alert on errors:

```javascript
class ErrorMonitor {
  constructor(threshold = 0.05) { // 5% error rate
    this.threshold = threshold;
    this.total = 0;
    this.errors = 0;
  }

  recordSuccess() {
    this.total++;
  }

  recordError(error) {
    this.total++;
    this.errors++;
    
    const errorRate = this.errors / this.total;
    
    if (errorRate > this.threshold) {
      this.alert(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
  }

  alert(message) {
    console.error('RAG Assistant Alert:', message);
    
    // Send alert to monitoring service
    if (window.Sentry) {
      Sentry.captureMessage(message, 'warning');
    }
  }
}

const monitor = new ErrorMonitor();

async function sendQuery(query, sessionId) {
  try {
    const response = await fetch('https://api.rag-assistant.com/api/chat', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer pk_live_...',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        sessionId,
        merchantId: 'acme_electronics_2024'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    monitor.recordSuccess();
    return await response.json();
    
  } catch (error) {
    monitor.recordError(error);
    throw error;
  }
}
```

---

## Testing

### Unit Tests

Test your integration:

```javascript
// test/rag-assistant.test.js
const { RAGClient } = require('./rag-client');

describe('RAG Assistant Integration', () => {
  let client;

  beforeEach(() => {
    client = new RAGClient({
      apiKey: process.env.TEST_API_KEY,
      merchantId: 'test_merchant'
    });
  });

  test('should send query successfully', async () => {
    const response = await client.sendQuery('wireless headphones', 'session_123');
    
    expect(response.success).toBe(true);
    expect(response.answer).toBeDefined();
    expect(response.recommendations).toBeInstanceOf(Array);
  });

  test('should handle errors gracefully', async () => {
    const response = await client.sendQuery('', 'session_123');
    
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});
```

### Integration Tests

Test end-to-end flows:

```javascript
// test/e2e.test.js
const puppeteer = require('puppeteer');

describe('Widget Integration', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should load widget on page', async () => {
    await page.goto('https://acme.com');
    
    // Wait for widget to load
    await page.waitForSelector('.rag-widget');
    
    // Check widget is visible
    const widget = await page.$('.rag-widget');
    expect(widget).toBeTruthy();
  });

  test('should send query and receive response', async () => {
    await page.goto('https://acme.com');
    
    // Open widget
    await page.click('.rag-widget-toggle');
    
    // Type query
    await page.type('.rag-widget-input', 'wireless headphones');
    
    // Send query
    await page.click('.rag-widget-send');
    
    // Wait for response
    await page.waitForSelector('.rag-widget-message.assistant');
    
    // Check response
    const response = await page.$eval('.rag-widget-message.assistant', el => el.textContent);
    expect(response).toBeTruthy();
  });
});
```

---

## Deployment Checklist

### Pre-Launch

- [ ] Test with test API keys
- [ ] Verify product data is complete
- [ ] Test widget on all pages
- [ ] Test on mobile devices
- [ ] Set up error monitoring
- [ ] Configure analytics tracking
- [ ] Set up domain whitelist
- [ ] Review security settings

### Launch

- [ ] Switch to live API keys
- [ ] Update environment variables
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Check analytics data

### Post-Launch

- [ ] Monitor usage metrics
- [ ] Review top queries
- [ ] Optimize product data
- [ ] Gather user feedback
- [ ] Iterate on configuration

---

## Support

- 📚 [Full Documentation](./README.md)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📧 [Email Support](mailto:support@rag-assistant.com)
- 🎥 [Video Tutorials](https://www.youtube.com/rag-assistant)
