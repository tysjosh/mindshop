# Webhook Integration Guide

## Overview

Webhooks allow you to receive real-time notifications when events occur in your RAG Assistant integration. Instead of polling the API for updates, webhooks push event data to your server as soon as something happens.

**Use Cases:**
- Track when customers interact with the assistant
- Monitor document creation and updates
- Get alerts when usage limits are approaching
- Sync data with your CRM or analytics platform
- Trigger automated workflows based on assistant activity

## Table of Contents

1. [Quick Start](#quick-start)
2. [Webhook Events](#webhook-events)
3. [Creating Webhooks](#creating-webhooks)
4. [Receiving Webhooks](#receiving-webhooks)
5. [Verifying Signatures](#verifying-signatures)
6. [Handling Retries](#handling-retries)
7. [Testing Webhooks](#testing-webhooks)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Code Examples](#code-examples)

---

## Quick Start

### 1. Create a Webhook Endpoint

First, create an HTTPS endpoint on your server to receive webhook events:

```javascript
// Node.js/Express example
app.post('/webhooks/rag-assistant', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Verify signature (see Verifying Signatures section)
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process the event
  console.log('Received event:', payload.type);
  
  // Respond quickly (process async if needed)
  res.status(200).send('OK');
});
```

### 2. Register Your Webhook


Use the API to register your webhook endpoint:

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhooks/rag-assistant",
    "events": [
      "chat.query.completed",
      "document.created",
      "usage.limit.approaching"
    ]
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "webhookId": "whk_abc123def456",
    "url": "https://your-domain.com/webhooks/rag-assistant",
    "events": ["chat.query.completed", "document.created", "usage.limit.approaching"],
    "secret": "whsec_xyz789abc123def456ghi789jkl012mno345",
    "warning": "This is the only time the webhook secret will be shown. Please store it securely."
  }
}
```

⚠️ **Important:** Save the `secret` immediately - it won't be shown again!

### 3. Test Your Webhook

Send a test event to verify your endpoint is working:

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123def456/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Webhook Events

### Available Events


| Event Type | Description | Frequency |
|------------|-------------|-----------|
| `chat.query.completed` | A customer query was successfully processed | High |
| `chat.query.failed` | A query failed to process | Low |
| `document.created` | A new document was added to your catalog | Medium |
| `document.updated` | An existing document was modified | Medium |
| `document.deleted` | A document was removed from your catalog | Low |
| `usage.limit.approaching` | You've reached 80% of your plan limit | Low |
| `usage.limit.exceeded` | You've exceeded your plan limit | Low |
| `api_key.expiring` | An API key will expire in 7 days | Low |
| `webhook.test` | Test event for webhook verification | Manual |

### Event Payload Structure

All webhook events follow this standard format:

```json
{
  "id": "evt_abc123def456",
  "type": "chat.query.completed",
  "created": "2025-11-04T12:34:56Z",
  "data": {
    // Event-specific data
  }
}
```

### Event-Specific Payloads

#### chat.query.completed

Triggered when a customer query is successfully processed.

```json
{
  "id": "evt_abc123",
  "type": "chat.query.completed",
  "created": "2025-11-04T12:34:56Z",
  "data": {
    "sessionId": "session_xyz789",
    "userId": "user_123",
    "query": "Show me wireless headphones under $200",
    "answer": "I found several great options for you...",
    "recommendations": [
      {
        "sku": "WBH-001",
        "title": "Premium Wireless Headphones",
        "price": 199.99,
        "confidence": 0.95
      }
    ],
    "intent": "product_search",
    "confidence": 0.92,
    "executionTime": 245,
    "timestamp": "2025-11-04T12:34:56Z"
  }
}
```


#### chat.query.failed

Triggered when a query fails to process.

```json
{
  "id": "evt_def456",
  "type": "chat.query.failed",
  "created": "2025-11-04T12:35:00Z",
  "data": {
    "sessionId": "session_xyz789",
    "query": "Show me products",
    "error": "Query too vague - no results found",
    "errorCode": "NO_RESULTS",
    "timestamp": "2025-11-04T12:35:00Z"
  }
}
```

#### document.created

Triggered when a new document is added.

```json
{
  "id": "evt_ghi789",
  "type": "document.created",
  "created": "2025-11-04T12:36:00Z",
  "data": {
    "documentId": "doc_abc123",
    "type": "product",
    "title": "Wireless Bluetooth Headphones",
    "metadata": {
      "sku": "WBH-001",
      "price": 199.99,
      "category": "Electronics"
    },
    "timestamp": "2025-11-04T12:36:00Z"
  }
}
```

#### document.updated

Triggered when a document is modified.

```json
{
  "id": "evt_jkl012",
  "type": "document.updated",
  "created": "2025-11-04T12:37:00Z",
  "data": {
    "documentId": "doc_abc123",
    "type": "product",
    "title": "Wireless Bluetooth Headphones",
    "changes": {
      "price": {
        "old": 199.99,
        "new": 179.99
      }
    },
    "timestamp": "2025-11-04T12:37:00Z"
  }
}
```

#### document.deleted

Triggered when a document is removed.

```json
{
  "id": "evt_mno345",
  "type": "document.deleted",
  "created": "2025-11-04T12:38:00Z",
  "data": {
    "documentId": "doc_abc123",
    "type": "product",
    "title": "Wireless Bluetooth Headphones",
    "timestamp": "2025-11-04T12:38:00Z"
  }
}
```


#### usage.limit.approaching

Triggered when you reach 80% of your plan limit.

```json
{
  "id": "evt_pqr678",
  "type": "usage.limit.approaching",
  "created": "2025-11-04T12:39:00Z",
  "data": {
    "metric": "queries",
    "current": 800,
    "limit": 1000,
    "percentage": 80,
    "period": "monthly",
    "resetDate": "2025-12-01T00:00:00Z",
    "timestamp": "2025-11-04T12:39:00Z"
  }
}
```

#### usage.limit.exceeded

Triggered when you exceed your plan limit.

```json
{
  "id": "evt_stu901",
  "type": "usage.limit.exceeded",
  "created": "2025-11-04T12:40:00Z",
  "data": {
    "metric": "queries",
    "current": 1050,
    "limit": 1000,
    "percentage": 105,
    "period": "monthly",
    "action": "throttled",
    "upgradeUrl": "https://portal.rag-assistant.com/billing/upgrade",
    "timestamp": "2025-11-04T12:40:00Z"
  }
}
```

#### api_key.expiring

Triggered 7 days before an API key expires.

```json
{
  "id": "evt_vwx234",
  "type": "api_key.expiring",
  "created": "2025-11-04T12:41:00Z",
  "data": {
    "keyId": "key_abc123",
    "name": "Production Key",
    "environment": "production",
    "expiresAt": "2025-11-11T12:41:00Z",
    "daysRemaining": 7,
    "timestamp": "2025-11-04T12:41:00Z"
  }
}
```

---

## Creating Webhooks

### API Endpoint

```
POST /api/merchants/:merchantId/webhooks
```

### Authentication

Requires JWT token from merchant login:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Request Body

```json
{
  "url": "https://your-domain.com/webhooks/rag-assistant",
  "events": [
    "chat.query.completed",
    "document.created"
  ]
}
```


### Requirements

- **HTTPS Required**: Webhook URLs must use HTTPS (not HTTP)
- **Valid URL**: Must be a properly formatted URL
- **Accessible**: Your endpoint must be publicly accessible
- **Events**: Must specify at least one event type

### Response

```json
{
  "success": true,
  "data": {
    "webhookId": "whk_abc123def456",
    "url": "https://your-domain.com/webhooks/rag-assistant",
    "events": ["chat.query.completed", "document.created"],
    "secret": "whsec_xyz789abc123def456ghi789jkl012mno345",
    "warning": "This is the only time the webhook secret will be shown. Please store it securely."
  },
  "timestamp": "2025-11-04T12:00:00Z",
  "requestId": "req_abc123"
}
```

### Managing Webhooks

#### List All Webhooks

```bash
curl -X GET https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Optional Query Parameters:**
- `activeOnly=true` - Only return active webhooks

#### Update a Webhook

```bash
curl -X PUT https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://new-domain.com/webhooks/rag-assistant",
    "events": ["chat.query.completed", "document.created", "usage.limit.approaching"],
    "status": "active"
  }'
```

**Updatable Fields:**
- `url` - Change the webhook endpoint URL
- `events` - Modify subscribed events
- `status` - Set to `active` or `disabled`

#### Delete a Webhook

```bash
curl -X DELETE https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Receiving Webhooks

### Endpoint Requirements

Your webhook endpoint must:

1. **Accept POST requests** with JSON payload
2. **Respond with 2xx status code** (200, 201, 204) within 10 seconds
3. **Be publicly accessible** via HTTPS
4. **Verify webhook signatures** (see next section)


### HTTP Headers

Each webhook request includes these headers:

```
Content-Type: application/json
X-Webhook-Signature: sha256=abc123def456...
X-Webhook-Event: chat.query.completed
X-Webhook-ID: whk_abc123def456
X-Webhook-Delivery-ID: whdel_xyz789
User-Agent: RAG-Assistant-Webhooks/1.0
```

### Response Requirements

**Success Response:**

```
HTTP/1.1 200 OK
```

Any 2xx status code (200, 201, 204) is considered successful.

**Failure Response:**

Any non-2xx status code will trigger a retry:

```
HTTP/1.1 500 Internal Server Error
```

### Processing Tips

1. **Respond Quickly**: Return 200 immediately, process async
2. **Idempotency**: Handle duplicate events gracefully
3. **Logging**: Log all webhook events for debugging
4. **Error Handling**: Catch and log errors, don't crash

**Example:**

```javascript
app.post('/webhooks/rag-assistant', async (req, res) => {
  // Verify signature first
  if (!verifySignature(req.body, req.headers['x-webhook-signature'], WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Respond immediately
  res.status(200).send('OK');
  
  // Process asynchronously
  processWebhookAsync(req.body).catch(err => {
    console.error('Webhook processing error:', err);
  });
});

async function processWebhookAsync(payload) {
  const { type, data } = payload;
  
  switch (type) {
    case 'chat.query.completed':
      await handleQueryCompleted(data);
      break;
    case 'document.created':
      await handleDocumentCreated(data);
      break;
    // ... handle other events
  }
}
```

---

## Verifying Signatures

**Why verify signatures?**
- Ensures webhooks are from RAG Assistant
- Prevents spoofing and replay attacks
- Validates payload integrity


### Signature Algorithm

Webhooks are signed using HMAC SHA-256:

```
signature = HMAC-SHA256(webhook_secret, JSON.stringify(payload))
```

The signature is sent in the `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=abc123def456...
```

### Verification Code Examples

#### Node.js

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  // Generate expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

// Usage in Express
app.post('/webhooks/rag-assistant', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  res.status(200).send('OK');
});
```

#### Python

```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature, secret):
    """Verify webhook signature using HMAC SHA-256"""
    # Generate expected signature
    payload_str = json.dumps(payload, separators=(',', ':'))
    expected_signature = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison
    return hmac.compare_digest(signature, expected_signature)

# Usage in Flask
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhooks/rag-assistant', methods=['POST'])
def webhook_handler():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_json()
    
    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process webhook
    return jsonify({'status': 'ok'}), 200
```


#### PHP

```php
<?php

function verifyWebhookSignature($payload, $signature, $secret) {
    // Generate expected signature
    $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payloadJson, $secret);
    
    // Use constant-time comparison
    return hash_equals($signature, $expectedSignature);
}

// Usage
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$payload = json_decode(file_get_contents('php://input'), true);

if (!verifyWebhookSignature($payload, $signature, WEBHOOK_SECRET)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Process webhook
http_response_code(200);
echo json_encode(['status' => 'ok']);
```

#### Ruby

```ruby
require 'openssl'
require 'json'

def verify_webhook_signature(payload, signature, secret)
  # Generate expected signature
  payload_json = JSON.generate(payload)
  expected_signature = 'sha256=' + OpenSSL::HMAC.hexdigest(
    OpenSSL::Digest.new('sha256'),
    secret,
    payload_json
  )
  
  # Use constant-time comparison
  Rack::Utils.secure_compare(signature, expected_signature)
end

# Usage in Sinatra
post '/webhooks/rag-assistant' do
  signature = request.env['HTTP_X_WEBHOOK_SIGNATURE']
  payload = JSON.parse(request.body.read)
  
  unless verify_webhook_signature(payload, signature, ENV['WEBHOOK_SECRET'])
    halt 401, { error: 'Invalid signature' }.to_json
  end
  
  # Process webhook
  status 200
  { status: 'ok' }.to_json
end
```

#### Go

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "net/http"
)

func verifyWebhookSignature(payload []byte, signature, secret string) bool {
    // Generate expected signature
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    
    // Use constant-time comparison
    return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-Webhook-Signature")
    
    var payload map[string]interface{}
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }
    
    payloadBytes, _ := json.Marshal(payload)
    
    if !verifyWebhookSignature(payloadBytes, signature, webhookSecret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    // Process webhook
    w.WriteHeader(http.StatusOK)
    fmt.Fprintf(w, "OK")
}
```

---

## Handling Retries


### Retry Policy

If your endpoint fails to respond with a 2xx status code, we'll automatically retry:

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | Immediate | 0s |
| 2 | 1 minute | 1m |
| 3 | 5 minutes | 6m |
| 4 | 15 minutes | 21m |

**After 3 failed attempts**, the delivery is marked as failed and no further retries occur.

### Failure Handling

**Consecutive Failures:**
- After **10 consecutive failures**, your webhook is automatically disabled
- You'll receive an email notification
- Re-enable via the Developer Portal or API

**Checking Delivery Status:**

```bash
curl -X GET https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123/deliveries \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deliveries": [
      {
        "id": "whdel_xyz789",
        "webhookId": "whk_abc123",
        "eventType": "chat.query.completed",
        "status": "success",
        "statusCode": 200,
        "attemptCount": 1,
        "createdAt": "2025-11-04T12:00:00Z",
        "deliveredAt": "2025-11-04T12:00:01Z"
      },
      {
        "id": "whdel_abc456",
        "webhookId": "whk_abc123",
        "eventType": "document.created",
        "status": "failed",
        "statusCode": 500,
        "attemptCount": 3,
        "responseBody": "Internal Server Error",
        "createdAt": "2025-11-04T11:55:00Z",
        "lastAttemptAt": "2025-11-04T12:10:00Z"
      }
    ],
    "stats": {
      "totalDeliveries": 150,
      "successfulDeliveries": 148,
      "failedDeliveries": 2,
      "pendingDeliveries": 0,
      "avgAttemptCount": 1.02
    },
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 150
    }
  }
}
```

### Idempotency

**Why it matters:**
- Retries may cause duplicate events
- Network issues can cause double delivery
- Your code should handle duplicates gracefully

**Implementation:**

```javascript
// Store processed event IDs
const processedEvents = new Set();

async function processWebhook(payload) {
  const eventId = payload.id;
  
  // Check if already processed
  if (processedEvents.has(eventId)) {
    console.log(`Event ${eventId} already processed, skipping`);
    return;
  }
  
  // Process the event
  await handleEvent(payload);
  
  // Mark as processed
  processedEvents.add(eventId);
  
  // Optional: Persist to database for durability
  await db.processedEvents.create({ eventId, processedAt: new Date() });
}
```


---

## Testing Webhooks

### 1. Test Endpoint

Send a test event to verify your webhook is working:

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Test Event Payload:**

```json
{
  "id": "evt_test_abc123",
  "type": "webhook.test",
  "created": "2025-11-04T12:00:00Z",
  "data": {
    "message": "This is a test webhook delivery",
    "webhookId": "whk_abc123",
    "timestamp": "2025-11-04T12:00:00Z"
  }
}
```

### 2. Local Testing with ngrok

For local development, use [ngrok](https://ngrok.com) to expose your local server:

```bash
# Start your local server
npm start  # Running on http://localhost:3000

# In another terminal, start ngrok
ngrok http 3000
```

ngrok will provide a public HTTPS URL:

```
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

Use this URL when creating your webhook:

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/webhooks/rag-assistant",
    "events": ["chat.query.completed"]
  }'
```

### 3. Webhook Testing Tools

**RequestBin / Webhook.site:**

For quick testing without writing code:

1. Visit [webhook.site](https://webhook.site)
2. Copy your unique URL
3. Create a webhook with that URL
4. Send test events and view them in the browser

**Postman:**

1. Create a mock server in Postman
2. Use the mock server URL as your webhook endpoint
3. View incoming webhooks in Postman

### 4. Debugging Tips

**Check Delivery Logs:**

```bash
curl -X GET "https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123/deliveries?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Verify signature implementation |
| 404 Not Found | Check webhook URL is correct |
| 500 Server Error | Check your server logs for errors |
| Timeout | Respond within 10 seconds, process async |
| SSL Error | Ensure valid SSL certificate |

---

## Best Practices

### Security

1. **Always verify signatures** - Never trust webhook data without verification
2. **Use HTTPS only** - Never use HTTP endpoints
3. **Store secrets securely** - Use environment variables, not hardcoded values
4. **Rotate secrets periodically** - Update webhook secrets every 90 days
5. **Whitelist IPs** (optional) - Restrict webhook access to RAG Assistant IPs


### Performance

1. **Respond quickly** - Return 200 within 10 seconds
2. **Process asynchronously** - Use job queues for heavy processing
3. **Handle high volume** - Design for bursts of events
4. **Implement rate limiting** - Protect your server from overload
5. **Use connection pooling** - Reuse database connections

### Reliability

1. **Implement idempotency** - Handle duplicate events gracefully
2. **Log everything** - Keep detailed logs for debugging
3. **Monitor failures** - Set up alerts for webhook failures
4. **Handle errors gracefully** - Don't crash on bad data
5. **Test thoroughly** - Test all event types and edge cases

### Monitoring

```javascript
// Example monitoring setup
const webhookMetrics = {
  received: 0,
  processed: 0,
  failed: 0,
  avgProcessingTime: 0
};

app.post('/webhooks/rag-assistant', async (req, res) => {
  const startTime = Date.now();
  webhookMetrics.received++;
  
  try {
    // Verify and process
    await processWebhook(req.body);
    webhookMetrics.processed++;
    res.status(200).send('OK');
  } catch (error) {
    webhookMetrics.failed++;
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  } finally {
    const processingTime = Date.now() - startTime;
    webhookMetrics.avgProcessingTime = 
      (webhookMetrics.avgProcessingTime * (webhookMetrics.processed - 1) + processingTime) 
      / webhookMetrics.processed;
  }
});

// Expose metrics endpoint
app.get('/metrics/webhooks', (req, res) => {
  res.json(webhookMetrics);
});
```

---

## Troubleshooting

### Webhook Not Receiving Events

**Check:**
1. Webhook is active (not disabled)
2. Events are subscribed correctly
3. URL is publicly accessible
4. SSL certificate is valid
5. Firewall allows incoming connections

**Test:**
```bash
# Test your endpoint directly
curl -X POST https://your-domain.com/webhooks/rag-assistant \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Signature Verification Failing

**Common Causes:**
1. Wrong secret being used
2. Payload modified before verification
3. JSON serialization differences
4. Character encoding issues

**Debug:**
```javascript
console.log('Received signature:', req.headers['x-webhook-signature']);
console.log('Payload:', JSON.stringify(req.body));
console.log('Expected signature:', generateSignature(req.body, secret));
```

### High Failure Rate

**Investigate:**
1. Check server logs for errors
2. Review delivery history in portal
3. Verify response times < 10 seconds
4. Check for SSL/TLS issues
5. Monitor server resources (CPU, memory)


### Webhook Disabled Automatically

**Reason:** 10 consecutive failures

**Resolution:**
1. Fix the underlying issue
2. Test your endpoint manually
3. Re-enable via API:

```bash
curl -X PUT https://api.rag-assistant.com/api/merchants/YOUR_MERCHANT_ID/webhooks/whk_abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

---

## Code Examples

### Complete Node.js/Express Implementation

```javascript
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

// Webhook endpoint
app.post('/webhooks/rag-assistant', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const eventType = req.headers['x-webhook-event'];
  const payload = req.body;
  
  // Verify signature
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }
  
  // Respond immediately
  res.status(200).send('OK');
  
  // Process asynchronously
  processWebhookAsync(payload, eventType).catch(err => {
    console.error('Webhook processing error:', err);
  });
});

// Process webhook events
async function processWebhookAsync(payload, eventType) {
  console.log(`Processing webhook: ${eventType}`, payload);
  
  const { type, data } = payload;
  
  switch (type) {
    case 'chat.query.completed':
      await handleQueryCompleted(data);
      break;
      
    case 'chat.query.failed':
      await handleQueryFailed(data);
      break;
      
    case 'document.created':
      await handleDocumentCreated(data);
      break;
      
    case 'document.updated':
      await handleDocumentUpdated(data);
      break;
      
    case 'document.deleted':
      await handleDocumentDeleted(data);
      break;
      
    case 'usage.limit.approaching':
      await handleUsageLimitApproaching(data);
      break;
      
    case 'usage.limit.exceeded':
      await handleUsageLimitExceeded(data);
      break;
      
    case 'api_key.expiring':
      await handleApiKeyExpiring(data);
      break;
      
    case 'webhook.test':
      console.log('Test webhook received successfully');
      break;
      
    default:
      console.warn(`Unknown webhook event type: ${type}`);
  }
}

// Event handlers
async function handleQueryCompleted(data) {
  console.log('Query completed:', data.query);
  
  // Example: Track in analytics
  await analytics.track({
    event: 'assistant_query',
    userId: data.userId,
    properties: {
      query: data.query,
      intent: data.intent,
      confidence: data.confidence,
      executionTime: data.executionTime,
      recommendationCount: data.recommendations?.length || 0
    }
  });
  
  // Example: Update CRM
  if (data.recommendations?.length > 0) {
    await crm.updateLead(data.userId, {
      lastInteraction: new Date(),
      interestedProducts: data.recommendations.map(r => r.sku)
    });
  }
}

async function handleQueryFailed(data) {
  console.error('Query failed:', data.query, data.error);
  
  // Example: Alert team
  await slack.sendMessage({
    channel: '#alerts',
    text: `Query failed: "${data.query}" - ${data.error}`
  });
}

async function handleDocumentCreated(data) {
  console.log('Document created:', data.documentId);
  
  // Example: Sync to search index
  await searchIndex.addDocument({
    id: data.documentId,
    type: data.type,
    title: data.title,
    metadata: data.metadata
  });
}

async function handleDocumentUpdated(data) {
  console.log('Document updated:', data.documentId);
  
  // Example: Update search index
  await searchIndex.updateDocument(data.documentId, {
    changes: data.changes
  });
}

async function handleDocumentDeleted(data) {
  console.log('Document deleted:', data.documentId);
  
  // Example: Remove from search index
  await searchIndex.deleteDocument(data.documentId);
}

async function handleUsageLimitApproaching(data) {
  console.warn('Usage limit approaching:', data.metric, data.percentage);
  
  // Example: Send email alert
  await email.send({
    to: 'admin@example.com',
    subject: 'RAG Assistant Usage Alert',
    body: `You've used ${data.percentage}% of your ${data.metric} limit (${data.current}/${data.limit})`
  });
}

async function handleUsageLimitExceeded(data) {
  console.error('Usage limit exceeded:', data.metric);
  
  // Example: Urgent notification
  await pagerduty.trigger({
    severity: 'critical',
    summary: `Usage limit exceeded: ${data.metric}`,
    details: data
  });
}

async function handleApiKeyExpiring(data) {
  console.warn('API key expiring:', data.keyId, data.daysRemaining);
  
  // Example: Send reminder email
  await email.send({
    to: 'admin@example.com',
    subject: 'API Key Expiring Soon',
    body: `Your API key "${data.name}" will expire in ${data.daysRemaining} days`
  });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
```


### Complete Python/Flask Implementation

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import os
from datetime import datetime

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET')

def verify_signature(payload, signature, secret):
    """Verify webhook signature using HMAC SHA-256"""
    payload_str = json.dumps(payload, separators=(',', ':'))
    expected_signature = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhooks/rag-assistant', methods=['POST'])
def webhook_handler():
    """Handle incoming webhook events"""
    signature = request.headers.get('X-Webhook-Signature')
    event_type = request.headers.get('X-Webhook-Event')
    payload = request.get_json()
    
    # Verify signature
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        app.logger.error('Invalid webhook signature')
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Respond immediately
    response = jsonify({'status': 'ok'})
    
    # Process asynchronously (use Celery, RQ, or similar in production)
    process_webhook(payload, event_type)
    
    return response, 200

def process_webhook(payload, event_type):
    """Process webhook events"""
    app.logger.info(f'Processing webhook: {event_type}')
    
    event_type = payload.get('type')
    data = payload.get('data', {})
    
    handlers = {
        'chat.query.completed': handle_query_completed,
        'chat.query.failed': handle_query_failed,
        'document.created': handle_document_created,
        'document.updated': handle_document_updated,
        'document.deleted': handle_document_deleted,
        'usage.limit.approaching': handle_usage_limit_approaching,
        'usage.limit.exceeded': handle_usage_limit_exceeded,
        'api_key.expiring': handle_api_key_expiring,
        'webhook.test': handle_test_webhook,
    }
    
    handler = handlers.get(event_type)
    if handler:
        try:
            handler(data)
        except Exception as e:
            app.logger.error(f'Error processing webhook: {e}')
    else:
        app.logger.warning(f'Unknown webhook event type: {event_type}')

def handle_query_completed(data):
    """Handle chat query completed event"""
    app.logger.info(f"Query completed: {data.get('query')}")
    
    # Example: Track in analytics
    # analytics.track(
    #     user_id=data.get('userId'),
    #     event='assistant_query',
    #     properties={
    #         'query': data.get('query'),
    #         'intent': data.get('intent'),
    #         'confidence': data.get('confidence'),
    #         'execution_time': data.get('executionTime')
    #     }
    # )

def handle_query_failed(data):
    """Handle chat query failed event"""
    app.logger.error(f"Query failed: {data.get('query')} - {data.get('error')}")
    
    # Example: Send alert
    # slack.send_message(
    #     channel='#alerts',
    #     text=f"Query failed: {data.get('query')} - {data.get('error')}"
    # )

def handle_document_created(data):
    """Handle document created event"""
    app.logger.info(f"Document created: {data.get('documentId')}")
    
    # Example: Sync to search index
    # search_index.add_document(
    #     id=data.get('documentId'),
    #     type=data.get('type'),
    #     title=data.get('title'),
    #     metadata=data.get('metadata')
    # )

def handle_document_updated(data):
    """Handle document updated event"""
    app.logger.info(f"Document updated: {data.get('documentId')}")

def handle_document_deleted(data):
    """Handle document deleted event"""
    app.logger.info(f"Document deleted: {data.get('documentId')}")

def handle_usage_limit_approaching(data):
    """Handle usage limit approaching event"""
    app.logger.warning(
        f"Usage limit approaching: {data.get('metric')} at {data.get('percentage')}%"
    )
    
    # Example: Send email alert
    # email.send(
    #     to='admin@example.com',
    #     subject='RAG Assistant Usage Alert',
    #     body=f"You've used {data.get('percentage')}% of your {data.get('metric')} limit"
    # )

def handle_usage_limit_exceeded(data):
    """Handle usage limit exceeded event"""
    app.logger.error(f"Usage limit exceeded: {data.get('metric')}")

def handle_api_key_expiring(data):
    """Handle API key expiring event"""
    app.logger.warning(
        f"API key expiring: {data.get('keyId')} in {data.get('daysRemaining')} days"
    )

def handle_test_webhook(data):
    """Handle test webhook event"""
    app.logger.info('Test webhook received successfully')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```


### PHP Implementation

```php
<?php

// webhook-handler.php

define('WEBHOOK_SECRET', getenv('WEBHOOK_SECRET'));

function verifySignature($payload, $signature, $secret) {
    $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payloadJson, $secret);
    return hash_equals($signature, $expectedSignature);
}

function processWebhook($payload) {
    $type = $payload['type'] ?? '';
    $data = $payload['data'] ?? [];
    
    switch ($type) {
        case 'chat.query.completed':
            handleQueryCompleted($data);
            break;
        case 'document.created':
            handleDocumentCreated($data);
            break;
        case 'usage.limit.approaching':
            handleUsageLimitApproaching($data);
            break;
        default:
            error_log("Unknown webhook event: $type");
    }
}

function handleQueryCompleted($data) {
    error_log("Query completed: " . $data['query']);
    // Your logic here
}

function handleDocumentCreated($data) {
    error_log("Document created: " . $data['documentId']);
    // Your logic here
}

function handleUsageLimitApproaching($data) {
    error_log("Usage limit approaching: " . $data['metric']);
    // Send alert email
}

// Main handler
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$rawPayload = file_get_contents('php://input');
$payload = json_decode($rawPayload, true);

if (!verifySignature($payload, $signature, WEBHOOK_SECRET)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Respond immediately
http_response_code(200);
echo json_encode(['status' => 'ok']);

// Process webhook
processWebhook($payload);
```

---

## Additional Resources

### Documentation
- [API Reference](./api-reference.md) - Complete API documentation
- [Authentication Guide](./authentication.md) - JWT and API key authentication
- [Getting Started](./getting-started.md) - Quick start guide

### Tools
- [Webhook.site](https://webhook.site) - Test webhook endpoints
- [ngrok](https://ngrok.com) - Expose local servers for testing
- [RequestBin](https://requestbin.com) - Inspect webhook payloads

### Support
- 📧 Email: webhooks@rag-assistant.com
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📚 [Developer Portal](https://portal.rag-assistant.com)

---

## Summary

Webhooks provide real-time event notifications for your RAG Assistant integration:

1. **Create** a webhook endpoint on your server (HTTPS required)
2. **Register** the webhook via API with your desired events
3. **Verify** webhook signatures to ensure authenticity
4. **Process** events asynchronously for best performance
5. **Monitor** delivery status and handle failures gracefully

**Key Points:**
- Always verify signatures using HMAC SHA-256
- Respond within 10 seconds (process async)
- Handle duplicate events with idempotency
- Monitor failures and set up alerts
- Test thoroughly before going to production

For questions or issues, contact our support team or visit the [Developer Portal](https://portal.rag-assistant.com).
