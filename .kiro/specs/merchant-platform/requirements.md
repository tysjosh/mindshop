# Merchant Platform Requirements - REVISED
## B2B API/SDK Platform for RAG Assistant Integration

## Overview
This specification covers the missing features required to transform the MindsDB RAG Assistant from a technical proof-of-concept into a production-ready, self-service B2B platform where merchants can integrate the RAG assistant into their existing e-commerce sites.

**Key Principle:** Merchants already have their own e-commerce platforms (Shopify, WooCommerce, custom). They're integrating YOUR RAG assistant, not building a store on your platform.

---

## What You're Building

**Think Stripe/Twilio Model:**
- Merchants use their dashboard to get API keys and monitor usage
- Merchants integrate your API/SDK into their existing site
- You provide analytics on assistant usage, not product management
- You handle billing for API usage

**NOT Building:**
- ❌ E-commerce storefront
- ❌ Product catalog management UI (merchants manage on their platform)
- ❌ Shopping cart
- ❌ Order management system

---

## Current Implementation Status

### ✅ ALREADY IMPLEMENTED (Core RAG Functionality)

**1. RAG Chat API**
- ✅ POST /api/chat - Process queries with RAG
- ✅ GET /api/chat/sessions/:sessionId/history
- ✅ DELETE /api/chat/sessions/:sessionId
- ✅ Session management with PostgreSQL
- ✅ Cost tracking per session

**2. Document Management API**
- ✅ POST /api/documents - Create documents
- ✅ GET /api/documents/search - Search documents
- ✅ POST /api/documents/bulk - Bulk upload
- ✅ Document types: product, faq, policy, review

**3. Semantic Retrieval**
- ✅ POST /api/semantic-retrieval/deploy - Deploy predictor
- ✅ POST /api/semantic-retrieval/search - Semantic search
- ✅ GET /api/semantic-retrieval/status/:merchantId
- ✅ PUT /api/semantic-retrieval/config/:merchantId

**4. Bedrock Agent Integration**
- ✅ POST /api/bedrock-agent/chat
- ✅ Session management
- ✅ Intent parsing
- ✅ Audit logging

**5. Authentication Infrastructure**
- ✅ AWS Cognito User Pool configured
- ✅ JWT verification middleware
- ✅ Token validation (access & ID tokens)
- ✅ User context extraction (userId, merchantId, email, roles)
- ✅ Tenant isolation (`requireMerchantAccess`)
- ✅ Role-based access control (`requireRoles`)

**6. Database & Infrastructure**
- ✅ PostgreSQL with Drizzle ORM
- ✅ Redis caching
- ✅ MindsDB integration
- ✅ AWS Bedrock integration
- ✅ Docker deployment

---

## ❌ MISSING FOR PRODUCTION (What You Need to Build)

### Priority Levels
- **P0 (Critical)** - Must have for any merchant to use the platform
- **P1 (High)** - Needed for self-service at scale
- **P2 (Medium)** - Needed for production operations
- **P3 (Low)** - Nice to have, can defer

---

## P0 - CRITICAL (Launch Blockers)

### 1. Merchant Account Management API [P0]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
You have Cognito infrastructure but no API endpoints that interact with it.

#### Required Endpoints:
```
❌ POST /api/merchants/register
   Purpose: Create new merchant account via Cognito
   Calls: CognitoIdentityProvider.signUp()
   Creates: Merchant record in database
   Returns: merchantId, verification email sent
   
❌ POST /api/merchants/verify-email
   Purpose: Verify email after registration
   Calls: CognitoIdentityProvider.confirmSignUp()
   
❌ POST /api/merchants/login
   Purpose: Authenticate merchant
   Calls: CognitoIdentityProvider.initiateAuth()
   Returns: JWT tokens (access, ID, refresh)
   
❌ POST /api/merchants/refresh-token
   Purpose: Refresh expired tokens
   Calls: CognitoIdentityProvider.initiateAuth() with REFRESH_TOKEN_AUTH
   
❌ POST /api/merchants/forgot-password
   Purpose: Initiate password reset
   Calls: CognitoIdentityProvider.forgotPassword()
   
❌ POST /api/merchants/reset-password
   Purpose: Complete password reset
   Calls: CognitoIdentityProvider.confirmForgotPassword()
   
❌ GET /api/merchants/:merchantId/profile
   Purpose: Get merchant profile
   Calls: CognitoIdentityProvider.adminGetUser()
   Returns: Cognito attributes + database merchant record
   
❌ PUT /api/merchants/:merchantId/profile
   Purpose: Update merchant profile
   Calls: CognitoIdentityProvider.adminUpdateUserAttributes()
   Updates: Database merchant record
```

**Impact if Missing:**
- Merchants can't self-register
- You must manually create accounts
- No password reset flow
- No profile management

**Estimated Effort:** 2-3 weeks

---

### 2. API Key Management System [P0]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No way for merchants to generate/manage API keys for their integration.

#### Required Endpoints:
```
❌ POST /api/merchants/:merchantId/api-keys
   Purpose: Generate new API key
   Body: { name, environment: 'dev'|'prod', permissions: [] }
   Returns: { keyId, key: 'pk_live_...', secret: 'sk_live_...' }
   Note: Show key once, store hashed
   
❌ GET /api/merchants/:merchantId/api-keys
   Purpose: List all API keys
   Returns: [{ keyId, name, environment, created, lastUsed, status }]
   
❌ DELETE /api/merchants/:merchantId/api-keys/:keyId
   Purpose: Revoke API key
   
❌ POST /api/merchants/:merchantId/api-keys/:keyId/rotate
   Purpose: Rotate API key (generate new, deprecate old)
   Returns: New key with grace period for old key
   
❌ GET /api/merchants/:merchantId/api-keys/:keyId/usage
   Purpose: View API key usage stats
   Returns: { requests, bandwidth, errors, lastUsed }
```

#### Required Middleware:
```
❌ API Key Validation Middleware
   Purpose: Validate API keys on incoming requests
   Logic:
   - Extract key from Authorization: Bearer pk_live_...
   - Hash and lookup in database
   - Check expiration, rate limits, permissions
   - Attach merchantId to request
```

**Impact if Missing:**
- Merchants can't integrate (no API keys)
- Using mock auth only (not production-ready)
- No way to revoke compromised keys
- No per-key rate limiting

**Estimated Effort:** 2-3 weeks

---

### 3. Developer Portal (Frontend) [P0]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No web interface for merchants to manage their integration.

#### Required Pages:
```
❌ Login/Register Page
   - Email/password form
   - OAuth options (Google, GitHub)
   - Password reset link
   
❌ Dashboard Home
   - Quick stats: queries today, active sessions, API calls
   - Recent activity feed
   - Integration status (connected/not connected)
   - Quick links to docs, API keys, support
   
❌ API Keys Page
   - List all API keys
   - Create new key button
   - Copy key, view usage, revoke
   - Environment badges (dev/prod)
   
❌ Documentation Page
   - Getting started guide
   - API reference (interactive)
   - Code examples (curl, JavaScript, Python)
   - Integration guides (Shopify, WooCommerce, custom)
   
❌ Settings Page
   - Company profile
   - Notification preferences
   - Billing information
   - Danger zone (delete account)
```

**Tech Stack Recommendation:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Query for API calls

**Impact if Missing:**
- Merchants can't self-serve
- Everything requires manual support
- Poor developer experience
- Can't scale to multiple merchants

**Estimated Effort:** 4-6 weeks

---

### 4. Usage Tracking & Metering [P0]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No way to track merchant usage for billing or rate limiting.

#### Required Endpoints:
```
❌ GET /api/merchants/:merchantId/usage/current
   Purpose: Get current billing period usage
   Returns: {
     queries: { count, limit, percentage },
     documents: { count, limit, storage_gb },
     api_calls: { count, limit },
     cost_estimate: 123.45
   }
   
❌ GET /api/merchants/:merchantId/usage/history
   Purpose: Historical usage data
   Query: ?startDate=2025-10-01&endDate=2025-10-31
   Returns: Daily/monthly aggregates
   
❌ POST /api/merchants/:merchantId/usage/limits
   Purpose: Set usage limits (admin only)
   Body: { queries_per_month, documents_max, api_calls_per_day }
```

#### Required Background Jobs:
```
❌ Usage Aggregation Job
   Purpose: Aggregate usage metrics hourly/daily
   Metrics:
   - Chat queries (count, tokens used)
   - Documents stored (count, storage size)
   - API calls (count, bandwidth)
   - Compute time (seconds)
   
❌ Rate Limiting Middleware
   Purpose: Enforce usage limits
   Logic:
   - Check current usage vs limits
   - Return 429 if exceeded
   - Include X-RateLimit-* headers
```

**Impact if Missing:**
- Can't bill merchants
- No rate limiting (abuse risk)
- No usage visibility for merchants
- Can't enforce plan limits

**Estimated Effort:** 2-3 weeks

---

### 5. Basic Analytics Dashboard [P0]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
Merchants need to see how customers are using the assistant.

#### Required Dashboard Sections:
```
❌ Overview Page
   - Total queries (today, week, month)
   - Active sessions
   - Average response time
   - Success rate (queries with results)
   - Top queries (most common)
   
❌ Query Analytics
   - Query volume over time (chart)
   - Popular queries (table)
   - Intent distribution (pie chart)
   - Confidence scores (histogram)
   - Failed queries (table with reasons)
   
❌ Performance Metrics
   - Response time (p50, p95, p99)
   - Cache hit rate
   - Error rate
   - Uptime
```

#### Required API Endpoints:
```
❌ GET /api/merchants/:merchantId/analytics/overview
   Query: ?startDate=2025-10-01&endDate=2025-10-31
   Returns: Aggregated metrics
   
❌ GET /api/merchants/:merchantId/analytics/queries
   Query: ?startDate=...&groupBy=day|hour
   Returns: Time series data
   
❌ GET /api/merchants/:merchantId/analytics/top-queries
   Query: ?limit=20
   Returns: [{ query, count, avg_confidence }]
```

**Impact if Missing:**
- Merchants can't measure ROI
- No visibility into assistant performance
- Can't optimize integration
- Poor merchant retention

**Estimated Effort:** 3-4 weeks

---

## P1 - HIGH (Needed for Scale)

### 6. Webhook System [P1]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No way to notify merchants of events in real-time.

#### Required Endpoints:
```
❌ POST /api/merchants/:merchantId/webhooks
   Purpose: Register webhook endpoint
   Body: {
     url: 'https://merchant.com/webhooks/rag-assistant',
     events: ['chat.completed', 'document.created'],
     secret: 'whsec_...'
   }
   
❌ GET /api/merchants/:merchantId/webhooks
   Purpose: List webhooks
   
❌ PUT /api/merchants/:merchantId/webhooks/:webhookId
   Purpose: Update webhook
   
❌ DELETE /api/merchants/:merchantId/webhooks/:webhookId
   Purpose: Delete webhook
   
❌ POST /api/merchants/:merchantId/webhooks/:webhookId/test
   Purpose: Send test webhook
   
❌ GET /api/merchants/:merchantId/webhooks/:webhookId/deliveries
   Purpose: View webhook delivery history
```

#### Required Background Service:
```
❌ Webhook Delivery Service
   Purpose: Deliver webhooks reliably
   Features:
   - Queue webhook events
   - Retry with exponential backoff (3 attempts)
   - Sign payloads with HMAC
   - Log delivery status
   - Auto-disable after repeated failures
```

#### Webhook Events:
```
- chat.query.completed
- chat.query.failed
- document.created
- document.updated
- document.deleted
- usage.limit.approaching (80%)
- usage.limit.exceeded
- api_key.expiring (7 days)
```

**Impact if Missing:**
- Merchants can't integrate with their systems
- No real-time notifications
- Must poll APIs instead
- Poor integration experience

**Estimated Effort:** 2-3 weeks

---

### 7. JavaScript Widget [P1]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No embeddable chat widget for merchant websites.

#### Required Deliverables:
```
❌ widget.js - Embeddable script
   Features:
   - Async loading (doesn't block page)
   - Customizable appearance (colors, position)
   - Responsive (mobile/desktop)
   - Product cards with images
   - Add to cart integration
   - Conversation history (localStorage)
   - Typing indicators
   - Error handling
   
❌ CDN Hosting
   - Host widget.js on CDN (CloudFront)
   - Versioned URLs (v1/widget.js)
   - CORS configured
   
❌ Widget Configuration UI
   - Visual customizer in dashboard
   - Live preview
   - Generate embed code
```

#### Embed Code Example:
```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'acme_electronics_2024',
    apiKey: 'pk_live_...',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    }
  });
</script>
```

**Impact if Missing:**
- Merchants must build their own UI
- High integration friction
- Poor adoption rate
- Competitive disadvantage

**Estimated Effort:** 4-5 weeks

---

### 8. Billing & Payments [P1]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No way to charge merchants or manage subscriptions.

#### Required Integration:
```
❌ Stripe Integration
   - Create Stripe customers
   - Manage subscriptions
   - Process payments
   - Handle webhooks (payment.succeeded, payment.failed)
   
❌ Billing Endpoints
   POST /api/merchants/:merchantId/billing/subscribe
   GET /api/merchants/:merchantId/billing/invoices
   GET /api/merchants/:merchantId/billing/current
   POST /api/merchants/:merchantId/billing/payment-methods
   DELETE /api/merchants/:merchantId/billing/payment-methods/:methodId
   POST /api/merchants/:merchantId/billing/upgrade
   POST /api/merchants/:merchantId/billing/cancel
```

#### Pricing Tiers:
```
Starter: $99/month
- 1,000 queries/month
- 100 documents
- 7-day data retention
- Email support

Professional: $499/month
- 10,000 queries/month
- 1,000 documents
- 30-day data retention
- Priority support
- Custom branding

Enterprise: Custom
- Unlimited queries
- Unlimited documents
- Unlimited retention
- 24/7 support
- SLA guarantees
```

#### Required Background Jobs:
```
❌ Invoice Generation Job
   Purpose: Generate monthly invoices
   Schedule: 1st of each month
   Logic:
   - Calculate usage-based charges
   - Create Stripe invoice
   - Email merchant
   
❌ Payment Retry Job
   Purpose: Retry failed payments
   Schedule: Daily
   Logic:
   - Retry failed payments (3 attempts)
   - Suspend account after 3 failures
   - Notify merchant
```

**Impact if Missing:**
- Can't monetize the platform
- No revenue
- Can't sustain operations
- Not a viable business

**Estimated Effort:** 3-4 weeks

---

### 9. Admin Panel [P1]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No way to manage merchants at scale.

#### Required Pages:
```
❌ Merchant List
   - Search/filter merchants
   - Status badges (active, suspended, trial)
   - Quick actions (view, suspend, delete)
   
❌ Merchant Detail View
   - Profile information
   - API keys
   - Usage stats
   - Billing history
   - Audit logs
   - Support tickets
   
❌ System Health Dashboard
   - Overall system metrics
   - Error rates
   - Performance metrics
   - Cost tracking
   
❌ Support Tools
   - Impersonate merchant (for debugging)
   - Manual invoice generation
   - Usage limit overrides
   - Feature flags
```

#### Required API Endpoints:
```
❌ GET /api/admin/merchants
❌ GET /api/admin/merchants/:merchantId
❌ PUT /api/admin/merchants/:merchantId/status
❌ POST /api/admin/merchants/:merchantId/impersonate
❌ GET /api/admin/system/health
❌ GET /api/admin/system/metrics
❌ GET /api/admin/errors
```

**Impact if Missing:**
- Can't manage multiple merchants
- Manual support is time-consuming
- Can't scale operations
- Poor merchant experience

**Estimated Effort:** 3-4 weeks

---

## P2 - MEDIUM (Production Operations)

### 10. Product Sync Automation [P2]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
Merchants must manually push products via API.

#### Required Features:
```
❌ Scheduled Sync
   - Configure sync schedule (hourly, daily)
   - Specify source (API endpoint, FTP, S3)
   - Map fields (sku, title, description, price)
   - Incremental sync (only changed products)
   
❌ Webhook Listener
   - Receive product updates from merchant
   - Validate signature
   - Update documents in real-time
   
❌ CSV/JSON Upload
   - Upload file via dashboard
   - Validate format
   - Preview changes
   - Bulk import
```

#### Required Endpoints:
```
❌ POST /api/merchants/:merchantId/sync/configure
❌ GET /api/merchants/:merchantId/sync/status
❌ POST /api/merchants/:merchantId/sync/trigger
❌ GET /api/merchants/:merchantId/sync/history
❌ POST /api/webhooks/products/:merchantId (for merchant to call)
```

**Impact if Missing:**
- High integration friction
- Products get stale
- Manual work for merchants
- Poor data freshness

**Estimated Effort:** 3-4 weeks

---

### 11. E-commerce Platform Integrations [P2]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No pre-built integrations for popular platforms.

#### Required Integrations:
```
❌ Shopify App
   - OAuth flow
   - Auto product sync via Shopify API
   - Webhook subscriptions (products/create, products/update)
   - Theme extension for widget
   
❌ WooCommerce Plugin
   - WordPress plugin
   - API key configuration
   - Auto product sync via WooCommerce REST API
   - Widget shortcode
   
❌ BigCommerce App
   - OAuth flow
   - Auto product sync
   - Webhook subscriptions
```

**Impact if Missing:**
- High integration friction for non-technical merchants
- Limited market reach
- Competitive disadvantage
- Lower adoption rate

**Estimated Effort:** 6-8 weeks (2-3 weeks per platform)

---

### 12. Documentation & Developer Resources [P2]

**Status:** ❌ PARTIALLY IMPLEMENTED

**What's Missing:**
Limited documentation for merchant developers.

#### Required Documentation:
```
❌ Getting Started Guide
   - Account setup
   - Generate API keys
   - First API call
   - Embed widget
   
❌ API Reference
   - OpenAPI/Swagger spec
   - Interactive API explorer
   - Code examples (curl, JavaScript, Python, PHP)
   
❌ Integration Guides
   - Shopify integration
   - WooCommerce integration
   - Custom integration
   - Mobile app integration
   
❌ Best Practices
   - Error handling
   - Rate limiting
   - Caching strategies
   - Security best practices
   
❌ Troubleshooting Guide
   - Common errors
   - Debug tools
   - Support contact
```

#### Required Tools:
```
❌ API Playground
   - Test endpoints in browser
   - Pre-filled examples
   - Save requests
   
❌ Webhook Tester
   - Simulate webhook deliveries
   - View payloads
   
❌ Log Viewer
   - Real-time API logs
   - Filter by endpoint, status
   - Export logs
```

**Impact if Missing:**
- High support burden
- Slow integration times
- Poor developer experience
- Low adoption rate

**Estimated Effort:** 3-4 weeks

---

## P3 - LOW (Future Enhancements)

### 13. Mobile SDKs [P3]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
No native mobile integration.

#### Required SDKs:
```
❌ iOS SDK (Swift)
   - CocoaPods/SPM distribution
   - Native UI components
   - Offline queue
   
❌ Android SDK (Kotlin)
   - Gradle distribution
   - Native UI components
   - Offline queue
   
❌ React Native SDK
   - npm distribution
   - Cross-platform components
```

**Impact if Missing:**
- No mobile app integration
- Limited use cases
- Competitive disadvantage

**Estimated Effort:** 6-8 weeks (2-3 weeks per SDK)

---

### 14. Advanced Features [P3]

**Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
Advanced features for enterprise merchants.

#### Features:
```
❌ A/B Testing Framework
   - Create experiments
   - Define variants
   - Track conversion rates
   - Statistical significance
   
❌ White-Label Options
   - Custom domain (chat.merchant.com)
   - Remove branding
   - Custom logo/colors
   
❌ Multi-Language Support
   - Auto-detect language
   - Translate responses
   - Multi-language product data
   
❌ Custom ML Models
   - Upload custom embeddings
   - Fine-tune models
   - Custom intent classifiers
```

**Impact if Missing:**
- Can't serve enterprise customers
- Limited revenue potential
- Competitive disadvantage

**Estimated Effort:** 8-12 weeks

---

## Summary: What You Actually Need

### Minimum Viable Product (MVP) - 3-4 months
**Goal:** Enable 5-10 pilot merchants to integrate

1. ✅ Merchant registration/login API (Cognito integration)
2. ✅ API key management
3. ✅ Basic developer portal (login, API keys, docs)
4. ✅ Usage tracking & rate limiting
5. ✅ Basic analytics dashboard
6. ✅ JavaScript widget
7. ✅ Documentation

**After MVP:** You can onboard pilot merchants manually, no billing yet.

---

### Beta Release - 2-3 months after MVP
**Goal:** Self-service for 50-100 merchants

8. ✅ Billing & payments (Stripe)
9. ✅ Webhook system
10. ✅ Admin panel
11. ✅ Product sync automation
12. ✅ Enhanced documentation

**After Beta:** Merchants can self-serve completely, you can charge them.

---

### Production Release - 2-3 months after Beta
**Goal:** Scale to 500+ merchants

13. ✅ E-commerce platform integrations (Shopify, WooCommerce)
14. ✅ Mobile SDKs
15. ✅ Advanced features (A/B testing, white-label)
16. ✅ Enterprise features

**After Production:** Fully scalable, enterprise-ready platform.

---

## Total Timeline: 7-10 months

**Phase 1 (MVP):** 3-4 months → Pilot merchants
**Phase 2 (Beta):** 2-3 months → Self-service at scale
**Phase 3 (Production):** 2-3 months → Enterprise-ready

---

## Key Differences from Original Spec

### ❌ REMOVED (Not Needed)
- Product catalog management UI (merchants manage on their platform)
- Shopping cart (merchants have their own)
- Order management (merchants have their own)
- Inventory management (merchants have their own)

### ✅ KEPT (Actually Needed)
- Developer portal (API keys, docs, analytics)
- API key management
- Usage tracking & billing
- JavaScript widget (for embedding)
- Webhook system (for integration)
- Analytics dashboard (assistant usage, not product sales)

### 🎯 FOCUS
Build a **developer platform** (like Stripe), not an e-commerce platform (like Shopify).
