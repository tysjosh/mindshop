# Product Sync Guide

## Overview

The Product Sync feature automates the process of keeping your product catalog synchronized with the RAG Assistant. Instead of manually uploading products via API, you can configure automatic synchronization from your e-commerce platform, API endpoint, or file storage.

## Why Use Product Sync?

- **Automated Updates**: Products stay fresh without manual intervention
- **Real-Time Changes**: Webhook integration for instant updates
- **Scheduled Syncs**: Hourly, daily, or weekly automatic synchronization
- **Incremental Sync**: Only sync changed products to save bandwidth
- **Multiple Sources**: Support for API endpoints, webhooks, CSV/JSON uploads, and S3

## Sync Methods

### 1. Scheduled Sync (Recommended)

Automatically fetch products from your API endpoint on a schedule.

**Best for:**
- Regular product catalog updates
- API-based e-commerce platforms
- Predictable update patterns

**Frequency options:**
- Hourly
- Daily
- Weekly

### 2. Webhook Sync (Real-Time)

Receive instant notifications when products change on your platform.

**Best for:**
- Real-time inventory updates
- Price changes
- New product launches
- Platforms with webhook support (Shopify, WooCommerce, BigCommerce)

### 3. Manual Upload

Upload CSV or JSON files through the Developer Portal.

**Best for:**
- One-time bulk imports
- Testing and development
- Platforms without API access
- Small catalogs (<1000 products)

---

## Getting Started

### Step 1: Choose Your Sync Method

Navigate to **Product Sync** in the Developer Portal and select your preferred method:

1. **Scheduled Sync** - Configure API endpoint and schedule
2. **Webhook Sync** - Set up webhook listener
3. **Manual Upload** - Upload CSV/JSON file

### Step 2: Configure Field Mapping

Map your product fields to the RAG Assistant format:

| RAG Field | Required | Description | Your Field |
|-----------|----------|-------------|------------|
| `sku` | ✅ Yes | Unique product identifier | `product_id`, `sku`, `id` |
| `title` | ✅ Yes | Product name | `name`, `title`, `product_name` |
| `description` | ✅ Yes | Product description | `description`, `body`, `content` |
| `price` | ⚠️ Recommended | Product price | `price`, `cost`, `amount` |
| `imageUrl` | ⚠️ Recommended | Product image URL | `image`, `image_url`, `thumbnail` |
| `category` | Optional | Product category | `category`, `type`, `collection` |

**Example Mapping:**
```json
{
  "sku": "id",
  "title": "name",
  "description": "description",
  "price": "price",
  "imageUrl": "images.0.src",
  "category": "product_type"
}
```

### Step 3: Test Your Configuration

Before enabling automatic sync, test with a small batch:

1. Click **Test Sync** in the Developer Portal
2. Review the preview of products to be synced
3. Check for any errors or missing fields
4. Adjust field mapping if needed

### Step 4: Enable Sync

Once testing is successful:

1. Click **Enable Sync**
2. Monitor the first sync in the **Sync History** tab
3. Verify products appear in your analytics

---

## Scheduled Sync Setup

### Configuration via Developer Portal

1. Navigate to **Product Sync** > **Scheduled Sync**
2. Enter your API endpoint URL
3. Configure authentication (if required)
4. Set field mapping
5. Choose sync frequency
6. Enable incremental sync (optional)
7. Click **Save Configuration**

### Configuration via API

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "scheduled",
    "schedule": "daily",
    "source": {
      "type": "api",
      "url": "https://your-store.com/api/products",
      "credentials": {
        "apiKey": "your_api_key"
      }
    },
    "fieldMapping": {
      "sku": "id",
      "title": "name",
      "description": "description",
      "price": "price",
      "imageUrl": "image_url",
      "category": "category"
    },
    "incrementalSync": true
  }'
```

### API Endpoint Requirements

Your API endpoint must:

1. **Return JSON** with product array
2. **Support pagination** (optional but recommended)
3. **Include all required fields** (sku, title, description)
4. **Use HTTPS** for security

**Example API Response:**
```json
{
  "products": [
    {
      "id": "WBH-001",
      "name": "Wireless Bluetooth Headphones",
      "description": "Premium noise-cancelling headphones with 30-hour battery life",
      "price": 199.99,
      "image_url": "https://cdn.example.com/wbh-001.jpg",
      "category": "Electronics",
      "in_stock": true
    },
    {
      "id": "WBH-002",
      "name": "Sport Wireless Earbuds",
      "description": "Water-resistant earbuds perfect for workouts",
      "price": 79.99,
      "image_url": "https://cdn.example.com/wbh-002.jpg",
      "category": "Electronics",
      "in_stock": true
    }
  ]
}
```

### Authentication Options

#### API Key (Recommended)
```json
{
  "source": {
    "type": "api",
    "url": "https://your-store.com/api/products",
    "credentials": {
      "apiKey": "your_api_key"
    }
  }
}
```

The API key will be sent as: `Authorization: Bearer your_api_key`

#### Basic Auth
```json
{
  "source": {
    "type": "api",
    "url": "https://your-store.com/api/products",
    "credentials": {
      "username": "your_username",
      "password": "your_password"
    }
  }
}
```

#### No Auth (Public API)
```json
{
  "source": {
    "type": "api",
    "url": "https://your-store.com/api/products"
  }
}
```

### Incremental Sync

Enable incremental sync to only update changed products:

```json
{
  "incrementalSync": true
}
```

**How it works:**
1. RAG Assistant compares new product data with existing data
2. Only products with changes are updated
3. Unchanged products are skipped
4. Reduces processing time and API calls

**Fields checked for changes:**
- Title
- Description
- Price
- Image URL
- Category

---

## Webhook Sync Setup

### Step 1: Get Your Webhook URL

1. Navigate to **Product Sync** > **Webhook Sync**
2. Copy your unique webhook URL:
   ```
   https://api.rag-assistant.com/api/webhooks/products/:merchantId
   ```
3. Copy your webhook secret (for signature verification)

### Step 2: Configure Your Platform

#### Shopify

1. Go to **Settings** > **Notifications** > **Webhooks**
2. Click **Create webhook**
3. Select event: **Product creation**, **Product update**, **Product deletion**
4. Enter webhook URL
5. Format: **JSON**
6. Click **Save**

#### WooCommerce

1. Install **WooCommerce Webhooks** plugin
2. Go to **WooCommerce** > **Settings** > **Advanced** > **Webhooks**
3. Click **Add webhook**
4. Name: "RAG Assistant Product Sync"
5. Status: **Active**
6. Topic: **Product created**, **Product updated**, **Product deleted**
7. Delivery URL: Your webhook URL
8. Secret: Your webhook secret
9. Click **Save**

#### BigCommerce

1. Go to **Settings** > **API** > **Webhooks**
2. Click **Create a Webhook**
3. Scope: **Products**
4. Events: **Created**, **Updated**, **Deleted**
5. Destination: Your webhook URL
6. Click **Save**

#### Custom Platform

Send POST requests to your webhook URL when products change:

```bash
curl -X POST https://api.rag-assistant.com/api/webhooks/products/:merchantId \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=<signature>" \
  -d '{
    "event": "product.updated",
    "product": {
      "id": "WBH-001",
      "name": "Wireless Bluetooth Headphones",
      "description": "Premium noise-cancelling headphones",
      "price": 199.99,
      "image_url": "https://cdn.example.com/wbh-001.jpg",
      "category": "Electronics"
    }
  }'
```

### Step 3: Configure Field Mapping

Map webhook payload fields to RAG Assistant format:

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "webhook",
    "webhookSecret": "your_webhook_secret",
    "fieldMapping": {
      "sku": "product.id",
      "title": "product.name",
      "description": "product.description",
      "price": "product.price",
      "imageUrl": "product.image_url",
      "category": "product.category"
    }
  }'
```

### Webhook Signature Verification

For security, verify webhook signatures:

**Signature Format:**
```
X-Webhook-Signature: sha256=<hmac_hex_digest>
```

**Verification Example (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage
const isValid = verifyWebhookSignature(
  req.body,
  req.headers['x-webhook-signature'],
  'your_webhook_secret'
);

if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

**Verification Example (Python):**
```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# Usage
is_valid = verify_webhook_signature(
    request.body,
    request.headers.get('X-Webhook-Signature'),
    'your_webhook_secret'
)

if not is_valid:
    return {'error': 'Invalid signature'}, 401
```

---

## Manual Upload

### CSV Upload

#### Step 1: Download Template

1. Navigate to **Product Sync** > **Manual Upload**
2. Click **Download CSV Template**
3. Open in Excel or Google Sheets

#### Step 2: Fill in Product Data

**Template Format:**
```csv
sku,title,description,price,imageUrl,category
WBH-001,Wireless Bluetooth Headphones,Premium noise-cancelling headphones with 30-hour battery life,199.99,https://cdn.example.com/wbh-001.jpg,Electronics
WBH-002,Sport Wireless Earbuds,Water-resistant earbuds perfect for workouts,79.99,https://cdn.example.com/wbh-002.jpg,Electronics
```

**Required Columns:**
- `sku` - Unique product identifier
- `title` - Product name
- `description` - Product description

**Optional Columns:**
- `price` - Product price (numeric)
- `imageUrl` - Product image URL (must be publicly accessible)
- `category` - Product category
- Any custom fields (will be stored in metadata)

#### Step 3: Upload File

1. Click **Upload CSV**
2. Select your file
3. Review the preview
4. Click **Import Products**

#### Step 4: Monitor Import

- View import progress in real-time
- Check for any errors or warnings
- Download error report if needed

### JSON Upload

#### Format

```json
[
  {
    "sku": "WBH-001",
    "title": "Wireless Bluetooth Headphones",
    "description": "Premium noise-cancelling headphones with 30-hour battery life",
    "price": 199.99,
    "imageUrl": "https://cdn.example.com/wbh-001.jpg",
    "category": "Electronics",
    "brand": "ACME",
    "inStock": true
  },
  {
    "sku": "WBH-002",
    "title": "Sport Wireless Earbuds",
    "description": "Water-resistant earbuds perfect for workouts",
    "price": 79.99,
    "imageUrl": "https://cdn.example.com/wbh-002.jpg",
    "category": "Electronics",
    "brand": "ACME",
    "inStock": true
  }
]
```

#### Upload via API

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/upload/json \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "sku": "WBH-001",
        "title": "Wireless Bluetooth Headphones",
        "description": "Premium noise-cancelling headphones",
        "price": 199.99,
        "imageUrl": "https://cdn.example.com/wbh-001.jpg",
        "category": "Electronics"
      }
    ],
    "fieldMapping": {
      "sku": "sku",
      "title": "title",
      "description": "description",
      "price": "price",
      "imageUrl": "imageUrl",
      "category": "category"
    }
  }'
```

---

## Monitoring & Management

### Sync Status

View current sync status in the Developer Portal:

**Status Indicators:**
- 🟢 **Idle** - No sync in progress, ready for next sync
- 🔵 **Syncing** - Sync currently in progress
- 🔴 **Error** - Last sync failed, check error logs

### Sync History

View detailed history of all syncs:

```bash
GET /api/merchants/:merchantId/sync/history?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "syncId": "sync_1730476800_a1b2c3d4",
      "merchantId": "acme_electronics_2024",
      "status": "success",
      "startedAt": "2025-11-01T10:00:00Z",
      "completedAt": "2025-11-01T10:05:23Z",
      "stats": {
        "totalProducts": 150,
        "created": 5,
        "updated": 120,
        "skipped": 25,
        "failed": 0
      }
    }
  ]
}
```

### Sync Statistics

Each sync provides detailed statistics:

- **Total Products**: Number of products processed
- **Created**: New products added
- **Updated**: Existing products modified
- **Skipped**: Unchanged products (incremental sync only)
- **Failed**: Products that failed to sync

### Error Handling

If products fail to sync, view detailed error reports:

```json
{
  "errors": [
    {
      "sku": "WBH-003",
      "error": "Missing required field: description"
    },
    {
      "sku": "WBH-004",
      "error": "Invalid price format: 'N/A'"
    }
  ]
}
```

**Common Errors:**
- Missing required fields (sku, title, description)
- Invalid data types (price must be numeric)
- Duplicate SKUs
- Invalid image URLs
- API timeout or connection errors

### Manual Sync Trigger

Trigger a sync manually at any time:

```bash
POST /api/merchants/:merchantId/sync/trigger
```

**Use cases:**
- Test configuration changes
- Force immediate sync
- Recover from failed sync
- Sync after bulk product updates

---

## Platform-Specific Guides

### Shopify Integration

#### Option 1: Scheduled Sync (Recommended)

**Step 1: Generate Shopify API Credentials**

1. Go to **Settings** > **Apps and sales channels** > **Develop apps**
2. Click **Create an app**
3. Name: "RAG Assistant Product Sync"
4. Click **Configure Admin API scopes**
5. Select: `read_products`
6. Click **Save**
7. Click **Install app**
8. Copy **Admin API access token**

**Step 2: Configure in RAG Assistant**

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "scheduled",
    "schedule": "daily",
    "source": {
      "type": "api",
      "url": "https://your-store.myshopify.com/admin/api/2024-01/products.json",
      "credentials": {
        "apiKey": "your_admin_api_access_token"
      }
    },
    "fieldMapping": {
      "sku": "variants.0.sku",
      "title": "title",
      "description": "body_html",
      "price": "variants.0.price",
      "imageUrl": "images.0.src",
      "category": "product_type"
    },
    "incrementalSync": true
  }'
```

#### Option 2: Webhook Sync (Real-Time)

**Step 1: Create Webhook in Shopify**

1. Go to **Settings** > **Notifications** > **Webhooks**
2. Click **Create webhook**
3. Event: **Product creation**, **Product update**
4. Format: **JSON**
5. URL: `https://api.rag-assistant.com/api/webhooks/products/:merchantId`
6. Click **Save**

**Step 2: Configure Field Mapping**

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "webhook",
    "webhookSecret": "your_webhook_secret",
    "fieldMapping": {
      "sku": "variants.0.sku",
      "title": "title",
      "description": "body_html",
      "price": "variants.0.price",
      "imageUrl": "images.0.src",
      "category": "product_type"
    }
  }'
```

### WooCommerce Integration

#### Option 1: Scheduled Sync

**Step 1: Generate WooCommerce API Keys**

1. Go to **WooCommerce** > **Settings** > **Advanced** > **REST API**
2. Click **Add key**
3. Description: "RAG Assistant"
4. User: Select admin user
5. Permissions: **Read**
6. Click **Generate API key**
7. Copy **Consumer key** and **Consumer secret**

**Step 2: Configure in RAG Assistant**

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "scheduled",
    "schedule": "daily",
    "source": {
      "type": "api",
      "url": "https://your-store.com/wp-json/wc/v3/products",
      "credentials": {
        "username": "consumer_key",
        "password": "consumer_secret"
      }
    },
    "fieldMapping": {
      "sku": "sku",
      "title": "name",
      "description": "description",
      "price": "price",
      "imageUrl": "images.0.src",
      "category": "categories.0.name"
    },
    "incrementalSync": true
  }'
```

#### Option 2: Webhook Sync

**Step 1: Install WooCommerce Webhooks**

1. Go to **WooCommerce** > **Settings** > **Advanced** > **Webhooks**
2. Click **Add webhook**
3. Name: "RAG Assistant Product Sync"
4. Status: **Active**
5. Topic: **Product created**, **Product updated**
6. Delivery URL: `https://api.rag-assistant.com/api/webhooks/products/:merchantId`
7. Secret: Your webhook secret
8. API Version: **WP REST API Integration v3**
9. Click **Save**

### BigCommerce Integration

**Step 1: Create API Account**

1. Go to **Settings** > **API** > **API Accounts**
2. Click **Create API Account**
3. Name: "RAG Assistant"
4. OAuth Scopes: **Products** (read-only)
5. Click **Save**
6. Copy **Access Token**

**Step 2: Configure in RAG Assistant**

```bash
curl -X POST https://api.rag-assistant.com/api/merchants/:merchantId/sync/configure \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "syncType": "scheduled",
    "schedule": "daily",
    "source": {
      "type": "api",
      "url": "https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products",
      "credentials": {
        "apiKey": "your_access_token"
      }
    },
    "fieldMapping": {
      "sku": "sku",
      "title": "name",
      "description": "description",
      "price": "price",
      "imageUrl": "images.0.url_standard",
      "category": "categories.0"
    },
    "incrementalSync": true
  }'
```

### Custom Platform Integration

For custom e-commerce platforms, create an API endpoint that returns products in this format:

```json
{
  "products": [
    {
      "id": "unique_sku",
      "name": "Product Name",
      "description": "Product description",
      "price": 99.99,
      "image": "https://example.com/image.jpg",
      "category": "Category Name"
    }
  ]
}
```

Then configure scheduled sync with your endpoint URL.

---

## Best Practices

### 1. Start with Manual Upload

Before setting up automated sync:
1. Upload a small batch (10-20 products) manually
2. Test queries in the widget
3. Verify product recommendations are accurate
4. Adjust field mapping if needed

### 2. Use Incremental Sync

Enable incremental sync to:
- Reduce processing time
- Save API calls
- Minimize database writes
- Improve sync performance

### 3. Schedule During Off-Peak Hours

For scheduled sync:
- Choose low-traffic times (e.g., 2 AM)
- Avoid peak shopping hours
- Consider time zones

### 4. Monitor Sync Health

Regularly check:
- Sync success rate
- Error logs
- Product count trends
- Sync duration

### 5. Keep Field Mapping Updated

When your product schema changes:
- Update field mapping immediately
- Test with a manual sync
- Monitor for errors

### 6. Use Webhooks for Real-Time Updates

For time-sensitive updates:
- Price changes
- Inventory updates
- New product launches
- Flash sales

### 7. Validate Product Data

Ensure products have:
- Unique SKUs
- Descriptive titles (not just SKU)
- Detailed descriptions (50+ words recommended)
- Valid image URLs (HTTPS, publicly accessible)
- Accurate prices

### 8. Handle Large Catalogs

For catalogs with 10,000+ products:
- Use scheduled sync (not manual upload)
- Enable incremental sync
- Consider pagination in API endpoint
- Monitor sync duration

---

## Troubleshooting

### Sync Not Starting

**Symptoms:**
- Sync status stuck on "Idle"
- No sync history entries

**Solutions:**
1. Check sync configuration is saved
2. Verify API endpoint is accessible
3. Test API credentials
4. Check for error messages in sync history

### Products Not Appearing

**Symptoms:**
- Sync completes successfully
- Products not showing in analytics
- Widget doesn't recommend products

**Solutions:**
1. Wait 2-3 minutes for indexing
2. Check field mapping is correct
3. Verify products have required fields (sku, title, description)
4. Check product count in analytics dashboard

### Sync Failing

**Symptoms:**
- Sync status shows "Error"
- High failure rate in sync stats

**Solutions:**
1. Check error logs in sync history
2. Verify API endpoint is responding
3. Test API credentials
4. Check for rate limiting
5. Validate product data format

### Duplicate Products

**Symptoms:**
- Same product appears multiple times
- Inflated product count

**Solutions:**
1. Ensure SKUs are unique
2. Check for duplicate entries in source data
3. Use incremental sync to prevent duplicates
4. Contact support to clean up duplicates

### Slow Sync Performance

**Symptoms:**
- Sync takes longer than expected
- Timeouts

**Solutions:**
1. Enable incremental sync
2. Reduce batch size
3. Check API endpoint performance
4. Consider pagination
5. Schedule during off-peak hours

### Webhook Not Receiving Events

**Symptoms:**
- Webhook configured but no updates
- Products not syncing in real-time

**Solutions:**
1. Verify webhook URL is correct
2. Check webhook is active in your platform
3. Test webhook with manual trigger
4. Verify webhook secret matches
5. Check firewall/security settings

### Invalid Signature Errors

**Symptoms:**
- Webhook events rejected
- "Invalid signature" errors

**Solutions:**
1. Verify webhook secret is correct
2. Check signature format matches expected format
3. Ensure payload is not modified in transit
4. Test signature verification locally

---

## API Reference

### Configure Sync

```http
POST /api/merchants/:merchantId/sync/configure
```

**Request Body:**
```json
{
  "syncType": "scheduled" | "webhook" | "manual",
  "schedule": "hourly" | "daily" | "weekly",
  "source": {
    "type": "api" | "s3" | "ftp",
    "url": "https://your-api.com/products",
    "credentials": {
      "apiKey": "your_api_key"
    }
  },
  "fieldMapping": {
    "sku": "id",
    "title": "name",
    "description": "description",
    "price": "price",
    "imageUrl": "image_url",
    "category": "category"
  },
  "incrementalSync": true,
  "webhookSecret": "your_webhook_secret"
}
```

### Get Sync Status

```http
GET /api/merchants/:merchantId/sync/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "lastSyncAt": "2025-11-01T10:05:23Z",
    "nextSyncAt": "2025-11-02T10:00:00Z",
    "status": "idle",
    "lastSyncResult": {
      "syncId": "sync_1730476800_a1b2c3d4",
      "status": "success",
      "stats": {
        "totalProducts": 150,
        "created": 5,
        "updated": 120,
        "skipped": 25,
        "failed": 0
      }
    }
  }
}
```

### Trigger Manual Sync

```http
POST /api/merchants/:merchantId/sync/trigger
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncId": "sync_1730476800_a1b2c3d4",
    "status": "syncing",
    "message": "Sync started successfully"
  }
}
```

### Get Sync History

```http
GET /api/merchants/:merchantId/sync/history?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "syncId": "sync_1730476800_a1b2c3d4",
      "merchantId": "acme_electronics_2024",
      "status": "success",
      "startedAt": "2025-11-01T10:00:00Z",
      "completedAt": "2025-11-01T10:05:23Z",
      "stats": {
        "totalProducts": 150,
        "created": 5,
        "updated": 120,
        "skipped": 25,
        "failed": 0
      },
      "errors": []
    }
  ]
}
```

### Upload CSV

```http
POST /api/merchants/:merchantId/sync/upload/csv
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV file
- `fieldMapping`: JSON string with field mapping

### Upload JSON

```http
POST /api/merchants/:merchantId/sync/upload/json
```

**Request Body:**
```json
{
  "products": [...],
  "fieldMapping": {...}
}
```

### Process Webhook Event

```http
POST /api/webhooks/products/:merchantId
```

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: sha256=<signature>
```

**Request Body:**
```json
{
  "event": "product.updated",
  "product": {
    "id": "WBH-001",
    "name": "Product Name",
    "description": "Product description",
    "price": 99.99
  }
}
```

---

## Support

Need help with product sync?

- 📚 [API Reference](./api-reference.md)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📧 [Email Support](mailto:support@rag-assistant.com)
- 🎥 [Video Tutorials](./video-tutorials.md) - Watch product sync setup videos

## Next Steps

- [Widget Integration](./widget-integration.md) - Embed the chat widget
- [Webhook Integration](./webhook-integration.md) - Set up event notifications
- [Analytics](./analytics.md) - Monitor product performance
- [Best Practices](./best-practices.md) - Optimize your integration
