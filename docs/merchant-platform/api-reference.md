# API Reference

## Base URL

```
Production: https://api.rag-assistant.com
Development: https://api-dev.rag-assistant.com
```

## Authentication

All API requests require authentication using an API key in the Authorization header:

```bash
Authorization: Bearer pk_live_YOUR_API_KEY
```

## Rate Limits

Rate limits vary by plan:

| Plan | Requests/Day | Queries/Month | Burst Limit |
|------|--------------|---------------|-------------|
| Starter | 5,000 | 1,000 | 100/min |
| Professional | 50,000 | 10,000 | 500/min |
| Enterprise | Unlimited | Unlimited | Custom |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4850
X-RateLimit-Reset: 2025-11-02T00:00:00Z
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-11-01T12:00:00Z",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_API_KEY` | 401 | API key is invalid or expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INSUFFICIENT_PERMISSIONS` | 403 | API key lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Merchant Management

### Register Merchant

Create a new merchant account.

```http
POST /api/merchants/register
```

**Request Body:**

```json
{
  "email": "john@acme.com",
  "password": "SecurePass123!",
  "companyName": "ACME Electronics",
  "website": "https://acme.com",
  "industry": "Electronics"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "email": "john@acme.com",
    "status": "pending_verification"
  }
}
```

### Verify Email

Verify merchant email address.

```http
POST /api/merchants/verify-email
```

**Request Body:**

```json
{
  "email": "john@acme.com",
  "code": "123456"
}
```

### Login

Authenticate and receive JWT tokens.

```http
POST /api/merchants/login
```

**Request Body:**

```json
{
  "email": "john@acme.com",
  "password": "SecurePass123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "idToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600,
    "merchantId": "acme_electronics_2024"
  }
}
```

### Get Profile

Get merchant profile information.

```http
GET /api/merchants/:merchantId/profile
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "email": "john@acme.com",
    "companyName": "ACME Electronics",
    "website": "https://acme.com",
    "industry": "Electronics",
    "plan": "professional",
    "status": "active",
    "createdAt": "2025-10-01T10:00:00Z"
  }
}
```

---

## API Key Management

### Create API Key

Generate a new API key.

```http
POST /api/merchants/:merchantId/api-keys
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**

```json
{
  "name": "Production Key",
  "environment": "production",
  "permissions": ["chat:read", "documents:write"],
  "expiresInDays": 365
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "keyId": "key_abc123",
    "key": "pk_live_def456ghi789jkl012mno345pqr678",
    "prefix": "pk_live_",
    "environment": "production",
    "expiresAt": "2026-11-01T10:00:00Z"
  }
}
```

⚠️ **Important:** The full key is only shown once. Store it securely!

### List API Keys

Get all API keys for a merchant.

```http
GET /api/merchants/:merchantId/api-keys
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "keyId": "key_abc123",
      "name": "Production Key",
      "prefix": "pk_live_",
      "environment": "production",
      "status": "active",
      "lastUsedAt": "2025-11-01T09:30:00Z",
      "createdAt": "2025-10-01T10:00:00Z",
      "expiresAt": "2026-11-01T10:00:00Z"
    }
  ]
}
```

### Revoke API Key

Revoke an API key immediately.

```http
DELETE /api/merchants/:merchantId/api-keys/:keyId
```

**Response:**

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Chat API

### Send Chat Query

Process a user query and get AI-powered recommendations.

```http
POST /api/chat
```

**Headers:**
```
Authorization: Bearer pk_live_YOUR_API_KEY
```

**Request Body:**

```json
{
  "query": "Show me wireless headphones under $200",
  "sessionId": "session_abc123",
  "merchantId": "acme_electronics_2024",
  "userId": "user_xyz789",
  "context": {
    "page": "product-listing",
    "category": "electronics"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "answer": "I found several great wireless headphones under $200 for you:",
    "recommendations": [
      {
        "sku": "WBH-001",
        "title": "Premium Wireless Headphones",
        "description": "Noise-cancelling with 30-hour battery",
        "price": 199.99,
        "imageUrl": "https://cdn.acme.com/wbh-001.jpg",
        "inStock": true,
        "confidence": 0.95
      }
    ],
    "intent": "product_search",
    "confidence": 0.92,
    "sessionId": "session_abc123",
    "executionTime": 245
  }
}
```

### Get Chat History

Retrieve conversation history for a session.

```http
GET /api/chat/sessions/:sessionId/history
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "messages": [
      {
        "role": "user",
        "content": "Show me wireless headphones",
        "timestamp": "2025-11-01T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "I found several options...",
        "recommendations": [...],
        "timestamp": "2025-11-01T10:00:02Z"
      }
    ]
  }
}
```

---

## Document Management

### Create Document

Add a single document (product, FAQ, policy, etc.).

```http
POST /api/documents
```

**Request Body:**

```json
{
  "type": "product",
  "title": "Wireless Bluetooth Headphones",
  "content": "Premium noise-cancelling headphones with 30-hour battery life. Features include: Bluetooth 5.0, Active Noise Cancellation, Comfortable over-ear design, Foldable for travel.",
  "metadata": {
    "sku": "WBH-001",
    "price": 199.99,
    "category": "Electronics",
    "brand": "ACME",
    "inStock": true,
    "imageUrl": "https://cdn.acme.com/wbh-001.jpg",
    "url": "https://acme.com/products/wbh-001"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "documentId": "doc_abc123",
    "status": "indexed",
    "createdAt": "2025-11-01T10:00:00Z"
  }
}
```

### Bulk Upload Documents

Upload multiple documents at once.

```http
POST /api/documents/bulk
```

**Request Body:**

```json
{
  "documents": [
    {
      "type": "product",
      "title": "Product 1",
      "content": "Description...",
      "metadata": {...}
    },
    {
      "type": "product",
      "title": "Product 2",
      "content": "Description...",
      "metadata": {...}
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "documents": [
      {
        "documentId": "doc_abc123",
        "status": "indexed"
      },
      {
        "documentId": "doc_def456",
        "status": "indexed"
      }
    ]
  }
}
```

### Search Documents

Search your document collection.

```http
GET /api/documents/search?q=wireless+headphones&limit=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "documentId": "doc_abc123",
        "title": "Wireless Bluetooth Headphones",
        "content": "Premium noise-cancelling...",
        "metadata": {...},
        "score": 0.95
      }
    ],
    "total": 1
  }
}
```

---

## Usage & Analytics

### Get Current Usage

Get current billing period usage.

```http
GET /api/merchants/:merchantId/usage/current
```

**Response:**

```json
{
  "success": true,
  "data": {
    "queries": {
      "count": 450,
      "limit": 1000,
      "percentage": 45
    },
    "documents": {
      "count": 75,
      "limit": 100,
      "percentage": 75
    },
    "apiCalls": {
      "count": 2340,
      "limit": 5000,
      "percentage": 46.8
    },
    "storageGb": {
      "count": 0.5,
      "limit": 1,
      "percentage": 50
    },
    "costEstimate": 99.00
  }
}
```

### Get Analytics Overview

Get analytics for a date range.

```http
GET /api/merchants/:merchantId/analytics/overview?startDate=2025-10-01&endDate=2025-10-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalQueries": 450,
    "activeSessions": 23,
    "avgResponseTime": 245,
    "successRate": 94.5,
    "topQueries": [
      {
        "query": "wireless headphones",
        "count": 45,
        "avgConfidence": 0.92
      }
    ]
  }
}
```

### Get Query Time Series

Get query volume over time.

```http
GET /api/merchants/:merchantId/analytics/queries?startDate=2025-10-01&endDate=2025-10-31&groupBy=day
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-01T00:00:00Z",
      "count": 15,
      "avgResponseTime": 230,
      "successRate": 95.2
    },
    {
      "timestamp": "2025-10-02T00:00:00Z",
      "count": 18,
      "avgResponseTime": 245,
      "successRate": 94.1
    }
  ]
}
```

### Get Performance Metrics

Get detailed performance metrics.

```http
GET /api/merchants/:merchantId/analytics/performance?startDate=2025-10-01&endDate=2025-10-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "avgResponseTime": 245,
    "p50ResponseTime": 220,
    "p95ResponseTime": 380,
    "p99ResponseTime": 520,
    "cacheHitRate": 78.5,
    "errorRate": 1.2,
    "uptime": 99.95
  }
}
```

### Get Intent Distribution

Get distribution of user intents.

```http
GET /api/merchants/:merchantId/analytics/intents?startDate=2025-10-01&endDate=2025-10-31
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "intent": "product_search",
      "count": 320,
      "percentage": 71.1
    },
    {
      "intent": "product_comparison",
      "count": 85,
      "percentage": 18.9
    },
    {
      "intent": "faq",
      "count": 45,
      "percentage": 10.0
    }
  ]
}
```

---

## Admin API

**Note:** All admin endpoints require authentication with an admin role.

### Get All Merchants

List all merchants in the system.

```http
GET /api/admin/merchants
```

**Headers:**
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `status` (optional): Filter by status (active, suspended, pending_verification)
- `search` (optional): Search by company name or email

**Response:**

```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchantId": "acme_electronics_2024",
        "companyName": "ACME Electronics",
        "email": "john@acme.com",
        "plan": "professional",
        "status": "active",
        "createdAt": "2025-10-01T10:00:00Z",
        "lastActiveAt": "2025-11-01T09:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### Get Merchant Details

Get detailed information about a specific merchant.

```http
GET /api/admin/merchants/:merchantId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "companyName": "ACME Electronics",
    "email": "john@acme.com",
    "website": "https://acme.com",
    "industry": "Electronics",
    "plan": "professional",
    "status": "active",
    "createdAt": "2025-10-01T10:00:00Z",
    "usage": {
      "queries": 450,
      "documents": 75,
      "apiCalls": 2340
    },
    "billing": {
      "subscriptionId": "sub_abc123",
      "amount": 499.00,
      "nextBillingDate": "2025-12-01T00:00:00Z"
    }
  }
}
```

### Update Merchant Status

Update a merchant's status.

```http
PUT /api/admin/merchants/:merchantId/status
```

**Request Body:**

```json
{
  "status": "suspended",
  "reason": "Payment failure"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "status": "suspended",
    "updatedAt": "2025-11-01T10:00:00Z"
  }
}
```

### Impersonate Merchant

Generate a token to impersonate a merchant for debugging.

```http
POST /api/admin/merchants/:merchantId/impersonate
```

**Response:**

```json
{
  "success": true,
  "data": {
    "impersonationToken": "eyJhbGciOiJIUzI1NiIs...",
    "merchantId": "acme_electronics_2024",
    "expiresIn": 3600
  }
}
```

### Get System Health

Get overall system health status.

```http
GET /api/admin/system/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "mindsdb": "healthy",
      "bedrock": "healthy"
    },
    "uptime": 99.95,
    "lastChecked": "2025-11-01T10:00:00Z"
  }
}
```

### Get System Metrics

Get system-wide metrics and statistics.

```http
GET /api/admin/system/metrics
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalMerchants": 45,
    "activeMerchants": 38,
    "totalQueries": 12450,
    "totalDocuments": 3250,
    "avgResponseTime": 245,
    "errorRate": 0.8,
    "costs": {
      "bedrock": 125.50,
      "infrastructure": 450.00,
      "total": 575.50
    }
  }
}
```

### Get System Errors

Get recent system errors and audit logs.

```http
GET /api/admin/errors?limit=50&severity=error
```

**Query Parameters:**
- `limit` (optional): Number of errors to return (default: 50)
- `severity` (optional): Filter by severity (error, warning, info)
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "errorId": "err_abc123",
      "severity": "error",
      "message": "Database connection timeout",
      "merchantId": "acme_electronics_2024",
      "endpoint": "/api/chat",
      "timestamp": "2025-11-01T09:45:00Z",
      "stackTrace": "..."
    }
  ]
}
```

---

## Billing & Subscriptions

### Subscribe to Plan

Subscribe to a billing plan.

```http
POST /api/merchants/:merchantId/billing/subscribe
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**

```json
{
  "plan": "professional",
  "paymentMethodId": "pm_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_abc123",
    "plan": "professional",
    "status": "active",
    "currentPeriodEnd": "2025-12-01T00:00:00Z"
  }
}
```

### Get Current Billing

Get current billing information.

```http
GET /api/merchants/:merchantId/billing/current
```

**Response:**

```json
{
  "success": true,
  "data": {
    "plan": "professional",
    "status": "active",
    "currentPeriodStart": "2025-11-01T00:00:00Z",
    "currentPeriodEnd": "2025-12-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "amount": 499.00,
    "currency": "usd"
  }
}
```

### Get Invoices

Retrieve billing invoices.

```http
GET /api/merchants/:merchantId/billing/invoices
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "invoiceId": "inv_abc123",
      "amount": 499.00,
      "currency": "usd",
      "status": "paid",
      "periodStart": "2025-10-01T00:00:00Z",
      "periodEnd": "2025-11-01T00:00:00Z",
      "paidAt": "2025-10-01T10:00:00Z",
      "invoiceUrl": "https://invoice.stripe.com/..."
    }
  ]
}
```

### Add Payment Method

Add a new payment method.

```http
POST /api/merchants/:merchantId/billing/payment-methods
```

**Request Body:**

```json
{
  "paymentMethodId": "pm_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentMethodId": "pm_abc123",
    "type": "card",
    "card": {
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2026
    },
    "isDefault": true
  }
}
```

### Get Payment Methods

List all payment methods.

```http
GET /api/merchants/:merchantId/billing/payment-methods
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "paymentMethodId": "pm_abc123",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2026
      },
      "isDefault": true
    }
  ]
}
```

### Delete Payment Method

Remove a payment method.

```http
DELETE /api/merchants/:merchantId/billing/payment-methods/:paymentMethodId
```

**Response:**

```json
{
  "success": true,
  "message": "Payment method deleted successfully"
}
```

### Upgrade Subscription

Upgrade to a higher plan.

```http
POST /api/merchants/:merchantId/billing/upgrade
```

**Request Body:**

```json
{
  "plan": "enterprise"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_abc123",
    "plan": "enterprise",
    "status": "active",
    "proratedAmount": 250.00
  }
}
```

### Cancel Subscription

Cancel the current subscription.

```http
POST /api/merchants/:merchantId/billing/cancel
```

**Request Body:**

```json
{
  "cancelAtPeriodEnd": true,
  "reason": "switching_service"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_abc123",
    "status": "active",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2025-12-01T00:00:00Z"
  }
}
```

---

## Webhooks

### Create Webhook

Register a webhook endpoint.

```http
POST /api/merchants/:merchantId/webhooks
```

**Request Body:**

```json
{
  "url": "https://acme.com/webhooks/rag-assistant",
  "events": [
    "chat.query.completed",
    "document.created",
    "usage.limit.approaching"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "webhookId": "whk_abc123",
    "url": "https://acme.com/webhooks/rag-assistant",
    "events": ["chat.query.completed", "document.created"],
    "secret": "whsec_def456ghi789jkl012mno345pqr678",
    "status": "active"
  }
}
```

⚠️ **Important:** Store the secret to verify webhook signatures!

### Webhook Payload Format

All webhooks follow this format:

```json
{
  "id": "evt_abc123",
  "type": "chat.query.completed",
  "created": "2025-11-01T10:00:00Z",
  "data": {
    "sessionId": "session_abc123",
    "query": "wireless headphones",
    "answer": "I found several options...",
    "executionTime": 245
  }
}
```

### Verify Webhook Signature

Verify the webhook signature using HMAC SHA-256:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage
const isValid = verifyWebhook(
  req.body,
  req.headers['x-webhook-signature'],
  'whsec_YOUR_SECRET'
);
```

---

## Code Examples

### JavaScript (Node.js)

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.rag-assistant.com',
  headers: {
    'Authorization': 'Bearer pk_live_YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

// Send chat query
async function sendQuery(query, sessionId) {
  const response = await client.post('/api/chat', {
    query,
    sessionId,
    merchantId: 'acme_electronics_2024'
  });
  
  return response.data;
}

// Upload product
async function uploadProduct(product) {
  const response = await client.post('/api/documents', {
    type: 'product',
    title: product.title,
    content: product.description,
    metadata: {
      sku: product.sku,
      price: product.price,
      inStock: product.inStock
    }
  });
  
  return response.data;
}
```

### Python

```python
import requests

class RAGClient:
    def __init__(self, api_key, merchant_id):
        self.api_key = api_key
        self.merchant_id = merchant_id
        self.base_url = 'https://api.rag-assistant.com'
        
    def send_query(self, query, session_id):
        response = requests.post(
            f'{self.base_url}/api/chat',
            headers={'Authorization': f'Bearer {self.api_key}'},
            json={
                'query': query,
                'sessionId': session_id,
                'merchantId': self.merchant_id
            }
        )
        return response.json()
    
    def upload_product(self, product):
        response = requests.post(
            f'{self.base_url}/api/documents',
            headers={'Authorization': f'Bearer {self.api_key}'},
            json={
                'type': 'product',
                'title': product['title'],
                'content': product['description'],
                'metadata': {
                    'sku': product['sku'],
                    'price': product['price'],
                    'inStock': product['inStock']
                }
            }
        )
        return response.json()

# Usage
client = RAGClient('pk_live_YOUR_API_KEY', 'acme_electronics_2024')
result = client.send_query('wireless headphones', 'session_123')
```

### cURL

```bash
# Send chat query
curl -X POST https://api.rag-assistant.com/api/chat \
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "wireless headphones under $200",
    "sessionId": "session_abc123",
    "merchantId": "acme_electronics_2024"
  }'

# Upload product
curl -X POST https://api.rag-assistant.com/api/documents \
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "product",
    "title": "Wireless Headphones",
    "content": "Premium noise-cancelling headphones",
    "metadata": {
      "sku": "WBH-001",
      "price": 199.99,
      "inStock": true
    }
  }'

# Bulk upload products
curl -X POST https://api.rag-assistant.com/api/documents/bulk \
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "type": "product",
        "title": "Product 1",
        "content": "Description 1",
        "metadata": {"sku": "SKU-001", "price": 99.99}
      },
      {
        "type": "product",
        "title": "Product 2",
        "content": "Description 2",
        "metadata": {"sku": "SKU-002", "price": 149.99}
      }
    ]
  }'

# Get usage statistics
curl -X GET "https://api.rag-assistant.com/api/merchants/acme_electronics_2024/usage/current" \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Create API key
curl -X POST https://api.rag-assistant.com/api/merchants/acme_electronics_2024/api-keys \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "environment": "production",
    "permissions": ["chat:read", "documents:write"],
    "expiresInDays": 365
  }'
```

### PHP

```php
<?php

class RAGAssistantClient {
    private $apiKey;
    private $merchantId;
    private $baseUrl = 'https://api.rag-assistant.com';
    
    public function __construct($apiKey, $merchantId) {
        $this->apiKey = $apiKey;
        $this->merchantId = $merchantId;
    }
    
    private function request($method, $endpoint, $data = null) {
        $ch = curl_init($this->baseUrl . $endpoint);
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json'
        ]);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception("API request failed with status $httpCode");
        }
        
        return json_decode($response, true);
    }
    
    public function sendQuery($query, $sessionId, $context = []) {
        return $this->request('POST', '/api/chat', [
            'query' => $query,
            'sessionId' => $sessionId,
            'merchantId' => $this->merchantId,
            'context' => $context
        ]);
    }
    
    public function uploadProduct($product) {
        return $this->request('POST', '/api/documents', [
            'type' => 'product',
            'title' => $product['title'],
            'content' => $product['description'],
            'metadata' => [
                'sku' => $product['sku'],
                'price' => $product['price'],
                'inStock' => $product['inStock'],
                'imageUrl' => $product['imageUrl'] ?? null
            ]
        ]);
    }
    
    public function bulkUploadProducts($products) {
        $documents = array_map(function($product) {
            return [
                'type' => 'product',
                'title' => $product['title'],
                'content' => $product['description'],
                'metadata' => [
                    'sku' => $product['sku'],
                    'price' => $product['price'],
                    'inStock' => $product['inStock']
                ]
            ];
        }, $products);
        
        return $this->request('POST', '/api/documents/bulk', [
            'documents' => $documents
        ]);
    }
}

// Usage
$client = new RAGAssistantClient('pk_live_YOUR_API_KEY', 'acme_electronics_2024');

// Send query
$result = $client->sendQuery(
    'wireless headphones under $200',
    'session_' . uniqid()
);

echo "Answer: " . $result['data']['answer'] . "\n";
foreach ($result['data']['recommendations'] as $product) {
    echo "- " . $product['title'] . " ($" . $product['price'] . ")\n";
}

// Upload product
$product = [
    'title' => 'Wireless Headphones',
    'description' => 'Premium noise-cancelling headphones',
    'sku' => 'WBH-001',
    'price' => 199.99,
    'inStock' => true,
    'imageUrl' => 'https://example.com/image.jpg'
];

$result = $client->uploadProduct($product);
echo "Product uploaded: " . $result['data']['documentId'] . "\n";
```

### Ruby

```ruby
require 'net/http'
require 'json'
require 'uri'

class RAGAssistantClient
  def initialize(api_key, merchant_id)
    @api_key = api_key
    @merchant_id = merchant_id
    @base_url = 'https://api.rag-assistant.com'
  end
  
  def send_query(query, session_id, context = {})
    request('POST', '/api/chat', {
      query: query,
      sessionId: session_id,
      merchantId: @merchant_id,
      context: context
    })
  end
  
  def upload_product(product)
    request('POST', '/api/documents', {
      type: 'product',
      title: product[:title],
      content: product[:description],
      metadata: {
        sku: product[:sku],
        price: product[:price],
        inStock: product[:in_stock],
        imageUrl: product[:image_url]
      }
    })
  end
  
  def bulk_upload_products(products)
    documents = products.map do |product|
      {
        type: 'product',
        title: product[:title],
        content: product[:description],
        metadata: {
          sku: product[:sku],
          price: product[:price],
          inStock: product[:in_stock]
        }
      }
    end
    
    request('POST', '/api/documents/bulk', { documents: documents })
  end
  
  private
  
  def request(method, endpoint, data = nil)
    uri = URI("#{@base_url}#{endpoint}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = case method
              when 'POST' then Net::HTTP::Post.new(uri)
              when 'GET' then Net::HTTP::Get.new(uri)
              end
    
    request['Authorization'] = "Bearer #{@api_key}"
    request['Content-Type'] = 'application/json'
    request.body = data.to_json if data
    
    response = http.request(request)
    JSON.parse(response.body)
  end
end

# Usage
client = RAGAssistantClient.new('pk_live_YOUR_API_KEY', 'acme_electronics_2024')

# Send query
result = client.send_query(
  'wireless headphones under $200',
  "session_#{SecureRandom.uuid}"
)

puts "Answer: #{result['data']['answer']}"
result['data']['recommendations'].each do |product|
  puts "- #{product['title']} ($#{product['price']})"
end

# Upload product
product = {
  title: 'Wireless Headphones',
  description: 'Premium noise-cancelling headphones',
  sku: 'WBH-001',
  price: 199.99,
  in_stock: true,
  image_url: 'https://example.com/image.jpg'
}

result = client.upload_product(product)
puts "Product uploaded: #{result['data']['documentId']}"
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type RAGAssistantClient struct {
    APIKey     string
    MerchantID string
    BaseURL    string
}

type ChatRequest struct {
    Query      string                 `json:"query"`
    SessionID  string                 `json:"sessionId"`
    MerchantID string                 `json:"merchantId"`
    Context    map[string]interface{} `json:"context,omitempty"`
}

type ChatResponse struct {
    Success bool `json:"success"`
    Data    struct {
        Answer          string `json:"answer"`
        Recommendations []struct {
            SKU         string  `json:"sku"`
            Title       string  `json:"title"`
            Description string  `json:"description"`
            Price       float64 `json:"price"`
            ImageURL    string  `json:"imageUrl"`
            InStock     bool    `json:"inStock"`
        } `json:"recommendations"`
    } `json:"data"`
}

type DocumentRequest struct {
    Type     string                 `json:"type"`
    Title    string                 `json:"title"`
    Content  string                 `json:"content"`
    Metadata map[string]interface{} `json:"metadata"`
}

func NewRAGAssistantClient(apiKey, merchantID string) *RAGAssistantClient {
    return &RAGAssistantClient{
        APIKey:     apiKey,
        MerchantID: merchantID,
        BaseURL:    "https://api.rag-assistant.com",
    }
}

func (c *RAGAssistantClient) request(method, endpoint string, body interface{}) ([]byte, error) {
    var reqBody io.Reader
    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonData)
    }
    
    req, err := http.NewRequest(method, c.BaseURL+endpoint, reqBody)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+c.APIKey)
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    return io.ReadAll(resp.Body)
}

func (c *RAGAssistantClient) SendQuery(query, sessionID string, context map[string]interface{}) (*ChatResponse, error) {
    reqData := ChatRequest{
        Query:      query,
        SessionID:  sessionID,
        MerchantID: c.MerchantID,
        Context:    context,
    }
    
    respData, err := c.request("POST", "/api/chat", reqData)
    if err != nil {
        return nil, err
    }
    
    var chatResp ChatResponse
    err = json.Unmarshal(respData, &chatResp)
    return &chatResp, err
}

func (c *RAGAssistantClient) UploadProduct(title, description, sku string, price float64, inStock bool) error {
    doc := DocumentRequest{
        Type:    "product",
        Title:   title,
        Content: description,
        Metadata: map[string]interface{}{
            "sku":     sku,
            "price":   price,
            "inStock": inStock,
        },
    }
    
    _, err := c.request("POST", "/api/documents", doc)
    return err
}

func main() {
    client := NewRAGAssistantClient("pk_live_YOUR_API_KEY", "acme_electronics_2024")
    
    // Send query
    resp, err := client.SendQuery(
        "wireless headphones under $200",
        "session_123",
        map[string]interface{}{"page": "search"},
    )
    
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    fmt.Printf("Answer: %s\n", resp.Data.Answer)
    for _, product := range resp.Data.Recommendations {
        fmt.Printf("- %s ($%.2f)\n", product.Title, product.Price)
    }
    
    // Upload product
    err = client.UploadProduct(
        "Wireless Headphones",
        "Premium noise-cancelling headphones",
        "WBH-001",
        199.99,
        true,
    )
    
    if err != nil {
        fmt.Printf("Upload error: %v\n", err)
    } else {
        fmt.Println("Product uploaded successfully")
    }
}
```

---

## SDKs

Official SDKs are available for:

- **JavaScript/TypeScript**: `npm install @rag-assistant/sdk`
- **Python**: `pip install rag-assistant`
- **PHP**: `composer require rag-assistant/sdk`
- **Ruby**: `gem install rag_assistant`

See the [SDK Documentation](./sdks.md) for detailed usage.

---

---

## OpenAPI Specification

A complete OpenAPI 3.0 specification is available at [`openapi.yaml`](./openapi.yaml). This specification includes:

- All endpoint definitions with request/response schemas
- Authentication requirements
- Rate limiting information
- Error response formats
- Interactive API documentation

You can use this specification with tools like:
- **Swagger UI** - Interactive API documentation
- **Postman** - Import and test APIs
- **OpenAPI Generator** - Generate client SDKs
- **Redoc** - Beautiful API documentation

Additional endpoint definitions are documented in [`openapi-additions.yaml`](./openapi-additions.yaml) and will be merged into the main specification.

---

## Support

- 📚 [Full Documentation](./README.md)
- 💬 [API Status](https://status.rag-assistant.com)
- 📧 [Email Support](mailto:api@rag-assistant.com)
- 🐛 [Report Issues](https://github.com/rag-assistant/issues)
- 🎥 [Video Tutorials](./video-tutorials.md) - Visual guides for API integration

### 🎬 Related Video Tutorials

**Learn API integration through video:**

- **[API Integration Basics](./video-tutorials.md#6-api-integration-basics)** (10 min) - REST API fundamentals
- **[Uploading Your First Products](./video-tutorials.md#4-uploading-your-first-products)** (7 min) - Product upload via API
- **[Webhook Configuration](./video-tutorials.md#12-webhook-configuration)** (8 min) - Set up webhooks
- **[API Key Management & Security](./video-tutorials.md#13-api-key-management--security)** (6 min) - Best practices

📺 [View All Video Tutorials](./video-tutorials.md)
