# Getting Started with RAG Assistant Merchant Platform

## Welcome!

The RAG Assistant Merchant Platform enables you to integrate an AI-powered shopping assistant into your e-commerce site. This guide will help you get started in minutes.

## What You'll Build

By the end of this guide, you'll have:
- ✅ A merchant account
- ✅ API keys for development and production
- ✅ A working chat widget on your site
- ✅ Product data synced to the RAG system

## Prerequisites

- An existing e-commerce website (Shopify, WooCommerce, or custom)
- Basic knowledge of HTML/JavaScript
- Product catalog ready for import

## Step 1: Create Your Account

1. Visit [https://portal.rag-assistant.com/register](https://portal.rag-assistant.com/register)
2. Fill in your company information:
   - Email address
   - Company name
   - Website URL
   - Industry
3. Click "Create Account"
4. Check your email for verification link
5. Click the verification link to activate your account

## Step 2: Generate API Keys

1. Log in to the [Developer Portal](https://portal.rag-assistant.com/login)
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Fill in the details:
   - **Name**: "Development Key" (or any descriptive name)
   - **Environment**: Development
   - **Permissions**: Select all (for testing)
5. Click **Generate Key**
6. **Important**: Copy and save your API key immediately - it won't be shown again!

```
pk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

## Step 3: Upload Your Products

You can upload products via API or CSV file.

### Option A: Via API

```bash
curl -X POST https://api.rag-assistant.com/api/documents/bulk \
  -H "Authorization: Bearer pk_test_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "type": "product",
        "title": "Wireless Bluetooth Headphones",
        "content": "Premium noise-cancelling headphones with 30-hour battery life",
        "metadata": {
          "sku": "WBH-001",
          "price": 199.99,
          "category": "Electronics",
          "inStock": true,
          "imageUrl": "https://example.com/images/headphones.jpg"
        }
      }
    ]
  }'
```

### Option B: Via Developer Portal

1. Go to **Product Sync** in the sidebar
2. Click **Upload CSV**
3. Download the [CSV template](https://portal.rag-assistant.com/templates/products.csv)
4. Fill in your product data
5. Upload the file
6. Review and confirm the import

## Step 4: Embed the Widget

Add this code snippet to your website, just before the closing `</body>` tag:

```html
<!-- RAG Assistant Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'YOUR_MERCHANT_ID',
    apiKey: 'pk_test_YOUR_API_KEY',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    },
    behavior: {
      greeting: 'Hi! How can I help you find the perfect product today?',
      autoOpen: false
    }
  });
</script>
```

**Replace:**
- `YOUR_MERCHANT_ID` with your merchant ID (found in Settings)
- `pk_test_YOUR_API_KEY` with your API key from Step 2

## Step 5: Test the Integration

1. Open your website in a browser
2. Look for the chat widget in the bottom-right corner
3. Click to open the widget
4. Try asking: "Show me wireless headphones under $200"
5. The assistant should respond with relevant products

## Step 6: Monitor Usage

1. Return to the [Developer Portal](https://portal.rag-assistant.com/dashboard)
2. View your **Dashboard** to see:
   - Queries today
   - Active sessions
   - Response times
   - Success rate
3. Navigate to **Analytics** for detailed insights

## Next Steps

Now that you have the basics working:

- 📖 Read the [Widget Integration Guide](./widget-integration.md) for customization options
- 🔐 Learn about [Authentication](./authentication.md) for secure API access
- 📊 Explore [Analytics](./analytics.md) to optimize performance
- 🎨 Customize the [Widget Appearance](./widget-customization.md)
- 🔄 Set up [Automatic Product Sync](./product-sync.md)

## Need Help?

- 📚 [Full Documentation](./README.md)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📧 [Email Support](mailto:support@rag-assistant.com)
- 🎥 [Video Tutorials](./video-tutorials.md) - Step-by-step video guides

### 🎬 Recommended Video Tutorials

**New to RAG Assistant?** Watch these videos to get started:

1. **[Platform Overview](./video-tutorials.md#1-platform-overview)** (3 min) - Understand what RAG Assistant can do
2. **[Account Setup & First API Key](./video-tutorials.md#2-account-setup--first-api-key)** (5 min) - Create your account and generate API keys
3. **[Widget Installation in 5 Minutes](./video-tutorials.md#3-widget-installation-in-5-minutes)** (5 min) - Get the widget on your site
4. **[Uploading Your First Products](./video-tutorials.md#4-uploading-your-first-products)** (7 min) - Add your product catalog

📺 [View All Video Tutorials](./video-tutorials.md)

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors (F12)
2. Verify your API key is correct
3. Ensure the script is loaded (check Network tab)
4. Confirm your domain is whitelisted (in Settings)

### No Product Recommendations

1. Verify products were uploaded successfully (check Product Sync page)
2. Wait 2-3 minutes for indexing to complete
3. Try a more specific query
4. Check that products have proper metadata (title, description, price)

### API Key Invalid

1. Ensure you're using the correct environment (test vs. live)
2. Check that the key hasn't been revoked
3. Verify the Authorization header format: `Bearer pk_test_...`

---

**Ready to go live?** Check out our [Production Deployment Guide](./production-deployment.md) when you're ready to switch to production API keys.
