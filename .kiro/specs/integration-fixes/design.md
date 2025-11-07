# Integration Fixes - Design Document

## Architecture Overview

This design addresses integration inconsistencies across three main components:

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Widget (CDN)   │────────▶│   API Backend   │◀────────│ Developer Portal│
│                 │  CORS   │                 │  Auth   │                 │
│ - RAGAssistant  │         │ - Routes        │         │ - React UI      │
│ - ApiClient     │         │ - Controllers   │         │ - API Client    │
│ - Components    │         │ - Services      │         │ - Components    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        │                           │                           │
        └───────────────────────────┴───────────────────────────┘
                    Consistent API Contract
```

## Component Designs

### 1. Product Sync Routes

**File:** `src/api/routes/productSync.ts`

```typescript
import { Router } from 'express';
import { ProductSyncController } from '../controllers/ProductSyncController';
import { authenticateJWT } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const controller = new ProductSyncController();

// All routes require JWT authentication
router.use(authenticateJWT());

// Rate limiting
const syncRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many sync requests',
});

// Validation schemas
const configureSyncSchema = {
  body: Joi.object({
    syncType: Joi.string().valid('scheduled', 'webhook', 'manual').required(),
    schedule: Joi.string().optional(),
    sourceType: Joi.string().valid('api', 'ftp', 's3', 'csv').required(),
    sourceUrl: Joi.string().uri().optional(),
    fieldMapping: Joi.object().required(),
  }),
};

// Routes
router.post(
  '/:merchantId/sync/configure',
  syncRateLimit,
  validateRequest(configureSyncSchema),
  controller.configureSync.bind(controller)
);

router.put(
  '/:merchantId/sync/configure',
  syncRateLimit,
  validateRequest(configureSyncSchema),
  controller.configureSync.bind(controller)
);

router.get(
  '/:merchantId/sync/configure',
  controller.getSyncConfig.bind(controller)
);

router.post(
  '/:merchantId/sync/trigger',
  syncRateLimit,
  controller.triggerSync.bind(controller)
);

router.get(
  '/:merchantId/sync/status',
  controller.getSyncStatus.bind(controller)
);

router.get(
  '/:merchantId/sync/history',
  controller.getSyncHistory.bind(controller)
);

router.post(
  '/:merchantId/sync/upload',
  syncRateLimit,
  controller.uploadFile.bind(controller)
);

router.post(
  '/:merchantId/sync/webhook',
  controller.handleWebhook.bind(controller)
);

export default router;
```

**Mounting in `src/api/app.ts`:**

```typescript
// Add import
import productSyncRoutes from './routes/productSync';

// Mount route (in setupRoutes method, after merchant routes)
this.app.use('/api/merchants', productSyncRoutes);
```

### 2. Product Sync Controller Fixes

**File:** `src/api/controllers/ProductSyncController.ts`

**Changes:**
1. Fix typo: `configureSyncSync` → `configureSync`
2. Consolidate POST/PUT to single method
3. Add proper error handling
4. Standardize response format

```typescript
/**
 * Configure or update product sync
 * POST/PUT /api/merchants/:merchantId/sync/configure
 */
async configureSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { merchantId } = req.params;
    const { syncType, schedule, sourceType, sourceUrl, fieldMapping } = req.body;

    // Validate merchant access
    if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(403).json(response);
      return;
    }

    // Check if config exists
    const existingConfig = await this.productSyncService.getSyncConfig(merchantId);
    
    let result;
    if (existingConfig) {
      // Update existing
      result = await this.productSyncService.updateSyncConfig(merchantId, {
        syncType,
        schedule,
        sourceType,
        sourceUrl,
        fieldMapping,
      });
    } else {
      // Create new
      result = await this.productSyncService.createSyncConfig(merchantId, {
        syncType,
        schedule,
        sourceType,
        sourceUrl,
        fieldMapping,
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };

    res.status(existingConfig ? 200 : 201).json(response);
  } catch (error: any) {
    console.error('Configure sync error:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || 'Failed to configure sync',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    res.status(400).json(response);
  }
}

/**
 * Get sync configuration
 * GET /api/merchants/:merchantId/sync/configure
 */
async getSyncConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { merchantId } = req.params;

    // Validate merchant access
    if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(403).json(response);
      return;
    }

    const config = await this.productSyncService.getSyncConfig(merchantId);

    const response: ApiResponse = {
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get sync config error:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || 'Failed to get sync config',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    res.status(400).json(response);
  }
}

/**
 * Upload file for processing
 * POST /api/merchants/:merchantId/sync/upload
 */
async uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { merchantId } = req.params;

    // Validate merchant access
    if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(403).json(response);
      return;
    }

    // Check if file exists
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: 'No file uploaded',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
      return;
    }

    // Determine file type and process
    const fileType = req.file.mimetype;
    let result;

    if (fileType === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      const content = req.file.buffer.toString('utf-8');
      result = await this.productSyncService.processCsvUpload(merchantId, content);
    } else if (fileType === 'application/json' || req.file.originalname.endsWith('.json')) {
      const content = req.file.buffer.toString('utf-8');
      result = await this.productSyncService.processJsonUpload(merchantId, content);
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'Unsupported file type. Please upload CSV or JSON.',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'File processed successfully',
        productsProcessed: result.productsProcessed,
        errors: result.errors || [],
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Upload file error:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || 'Failed to process file',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    res.status(400).json(response);
  }
}
```

**Add multer middleware for file uploads:**

```typescript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json'];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.csv') || 
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and JSON allowed.'));
    }
  },
});

// In route
router.post(
  '/:merchantId/sync/upload',
  syncRateLimit,
  upload.single('file'),
  controller.uploadFile.bind(controller)
);
```

### 3. CORS Configuration

**File:** `src/api/app.ts`

**Option A: Allow All Origins (Simplest for widget)**

```typescript
// CORS configuration
this.app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // For widget endpoints, allow all origins
      // For other endpoints, check whitelist
      const isWidgetEndpoint = origin.includes('/api/chat') || 
                               origin.includes('/api/documents') ||
                               origin.includes('/api/sessions');
      
      if (isWidgetEndpoint) {
        return callback(null, true);
      }

      // Check whitelist for other endpoints
      const allowedOrigins = this.config.corsOrigins;
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
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
);
```

**Option B: Validate Against Merchant Domains (More Secure)**

```typescript
// CORS configuration with merchant domain validation
this.app.use(
  cors({
    origin: async (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      try {
        // Extract merchant ID from request (if available)
        // This requires custom middleware to parse merchant ID from API key
        const merchantId = (req as any).merchantId;
        
        if (merchantId) {
          // Check if origin matches merchant's registered domains
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

        // Fall back to whitelist
        const allowedOrigins = this.config.corsOrigins;
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      } catch (error) {
        console.error('CORS validation error:', error);
        callback(error as Error);
      }
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
);
```

**Recommendation:** Start with Option A for beta, implement Option B for production.

### 4. Documentation Widget Code Fix

**File:** `developer-portal/app/(dashboard)/documentation/page.tsx`

**Replace incorrect code:**

```typescript
// BEFORE (WRONG):
<pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
{`<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_YOUR_API_KEY',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    }
  });
</script>`}
</pre>

// AFTER (CORRECT):
<pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
{`<!-- Load the RAG Assistant Widget -->
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>

<!-- Initialize the widget -->
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_YOUR_API_KEY',
    apiBaseUrl: 'https://api.rag-assistant.com',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    },
    behavior: {
      autoOpen: false,
      greeting: 'Hi! How can I help you today?'
    },
    integration: {
      addToCartCallback: (product) => {
        // Your add to cart logic
        console.log('Add to cart:', product);
      }
    }
  });
</script>`}
</pre>
```

**Add troubleshooting section:**

```typescript
<div>
  <h4 className="font-medium mb-2">Troubleshooting</h4>
  <div className="space-y-2 text-sm text-muted-foreground">
    <div>
      <p className="font-medium text-foreground">Widget not loading?</p>
      <ul className="list-disc list-inside ml-2">
        <li>Check browser console for errors</li>
        <li>Verify API key is correct and active</li>
        <li>Ensure merchant ID matches your account</li>
        <li>Check that CDN URL is accessible</li>
      </ul>
    </div>
    <div>
      <p className="font-medium text-foreground">CORS errors?</p>
      <ul className="list-disc list-inside ml-2">
        <li>Add your domain to allowed domains in settings</li>
        <li>Ensure you're using the correct API base URL</li>
        <li>Check that API key has proper permissions</li>
      </ul>
    </div>
    <div>
      <p className="font-medium text-foreground">Messages not sending?</p>
      <ul className="list-disc list-inside ml-2">
        <li>Verify API key is valid and not expired</li>
        <li>Check rate limits in usage dashboard</li>
        <li>Ensure session was created successfully</li>
        <li>Check network tab for failed requests</li>
      </ul>
    </div>
  </div>
</div>
```

### 5. Rate Limit Headers

**File:** `src/api/middleware/rateLimit.ts`

**Add headers to rate limit middleware:**

```typescript
export const rateLimitMiddleware = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `ratelimit:${req.ip}:${req.path}`;
      const limit = options.max;
      const windowMs = options.windowMs;

      // Get current count
      const current = await redis.incr(key);
      
      if (current === 1) {
        // First request in window, set expiry
        await redis.pexpire(key, windowMs);
      }

      // Get TTL for reset time
      const ttl = await redis.pttl(key);
      const resetTime = Date.now() + ttl;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current).toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());

      if (current > limit) {
        res.status(429).json({
          success: false,
          error: options.message || 'Too many requests',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // Don't block request on rate limit error
      next();
    }
  };
};
```

### 6. Webhook Documentation

**File:** `docs/WEBHOOK_INTEGRATION.md`

```markdown
# Webhook Integration Guide

## Overview

Webhooks allow you to receive real-time notifications when events occur in your MindShop account.

## Available Events

### Chat Events

**`chat.completed`**
Triggered when a chat query is successfully processed.

Payload:
\`\`\`json
{
  "event": "chat.completed",
  "timestamp": "2025-11-05T10:00:00Z",
  "data": {
    "sessionId": "session_xxx",
    "merchantId": "merchant_xxx",
    "userId": "user_xxx",
    "query": "Show me wireless headphones",
    "answer": "Here are some great options...",
    "recommendations": [...],
    "executionTime": 245
  }
}
\`\`\`

**`chat.failed`**
Triggered when a chat query fails.

Payload:
\`\`\`json
{
  "event": "chat.failed",
  "timestamp": "2025-11-05T10:00:00Z",
  "data": {
    "sessionId": "session_xxx",
    "merchantId": "merchant_xxx",
    "query": "...",
    "error": "Error message",
    "errorCode": "RATE_LIMIT_EXCEEDED"
  }
}
\`\`\`

### Document Events

**`document.created`**
**`document.updated`**
**`document.deleted`**

### Session Events

**`session.created`**
**`session.ended`**

### Sync Events

**`sync.started`**
**`sync.completed`**
**`sync.failed`**

## Security

### HMAC Signature Verification

All webhook requests include an `X-Webhook-Signature` header containing an HMAC SHA-256 signature.

**Verification Example (Node.js):**

\`\`\`javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook handler
app.post('/webhooks/mindshop', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET; // From MindShop dashboard
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const { event, data } = req.body;
  console.log('Received event:', event, data);
  
  res.status(200).send('OK');
});
\`\`\`

## Retry Policy

- Failed webhooks are retried up to 3 times
- Exponential backoff: 1min, 5min, 15min
- Webhook is disabled after 10 consecutive failures
- You can view delivery history in the dashboard

## Best Practices

1. **Respond quickly:** Return 200 status within 5 seconds
2. **Process asynchronously:** Queue webhook for background processing
3. **Verify signatures:** Always validate HMAC signature
4. **Handle duplicates:** Use event ID for idempotency
5. **Monitor failures:** Check delivery history regularly
```

### 7. API Key Permissions Middleware

**File:** `src/api/middleware/apiKeyAuth.ts`

**Add permission checking:**

```typescript
export const requirePermissions = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = req.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      });
    }

    // Check if API key has required permissions
    const keyPermissions = apiKey.permissions || [];
    const hasAllPermissions = requiredPermissions.every(perm => 
      keyPermissions.includes(perm) || keyPermissions.includes('*')
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredPermissions,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      });
    }

    next();
  };
};

// Usage in routes
router.post(
  '/documents',
  apiKeyAuth(),
  requirePermissions(['documents:write']),
  controller.createDocument
);

router.get(
  '/documents',
  apiKeyAuth(),
  requirePermissions(['documents:read']),
  controller.listDocuments
);
```

## Data Models

### Product Sync Configuration

```typescript
interface ProductSyncConfig {
  id: string;
  merchantId: string;
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: string; // Cron expression
  sourceType: 'api' | 'ftp' | 's3' | 'csv';
  sourceUrl?: string;
  fieldMapping: {
    sku: string;
    title: string;
    description: string;
    price: string;
    imageUrl?: string;
    category?: string;
    inStock?: string;
  };
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}
```

### Product Sync History

```typescript
interface ProductSyncHistory {
  id: string;
  merchantId: string;
  syncId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsFailed: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('ProductSyncController', () => {
  it('should create sync configuration', async () => {
    const req = mockRequest({
      params: { merchantId: 'test_merchant' },
      body: {
        syncType: 'manual',
        sourceType: 'csv',
        fieldMapping: { sku: 'sku', title: 'name' }
      }
    });
    
    await controller.configureSync(req, res);
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Object)
      })
    );
  });
});
```

### Integration Tests

```typescript
describe('Product Sync Integration', () => {
  it('should complete full sync flow', async () => {
    // 1. Configure sync
    const config = await apiClient.createProductSyncConfig(merchantId, {
      syncType: 'manual',
      sourceType: 'csv',
      fieldMapping: { sku: 'sku', title: 'name' }
    });
    
    // 2. Upload file
    const file = new File(['sku,name\nP001,Product 1'], 'products.csv');
    const upload = await apiClient.uploadProductFile(merchantId, file);
    
    expect(upload.productsProcessed).toBe(1);
    
    // 3. Check history
    const history = await apiClient.getProductSyncHistory(merchantId);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
  });
});
```

### Widget Integration Tests

```typescript
describe('Widget CORS', () => {
  it('should allow widget requests from external domain', async () => {
    const response = await fetch('http://localhost:3000/api/chat/sessions', {
      method: 'POST',
      headers: {
        'Origin': 'https://merchant-store.com',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pk_test_xxx'
      },
      body: JSON.stringify({
        merchantId: 'test_merchant',
        userId: 'test_user'
      })
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
```

## Deployment Plan

### Phase 1: Critical Fixes (Day 1-2)
1. Create and mount product sync routes
2. Fix documentation widget code
3. Update CORS configuration
4. Deploy to staging
5. Test with sample merchant

### Phase 2: Service Layer (Day 2-3)
1. Implement/fix ProductSyncService methods
2. Add file upload handling
3. Test sync flows
4. Deploy to staging

### Phase 3: Polish (Day 3-4)
1. Add rate limit headers
2. Implement permission checking
3. Add webhook documentation
4. Update all documentation
5. Deploy to production

### Phase 4: Validation (Day 4-5)
1. Run integration test suite
2. Manual testing of all flows
3. Beta merchant testing
4. Monitor for errors
5. Fix any issues found

## Monitoring

### Metrics to Track

- Product sync success/failure rate
- Widget load time
- CORS rejection rate
- API response times
- Rate limit hits
- Webhook delivery success rate

### Alerts

- Product sync failure rate > 10%
- Widget load failures > 5%
- CORS rejections > 100/hour
- API error rate > 1%
- Webhook delivery failure > 20%

## Rollback Plan

If critical issues are found:

1. Revert CORS changes (restore whitelist)
2. Disable product sync routes
3. Restore old documentation
4. Notify affected merchants
5. Fix issues in staging
6. Redeploy when stable
