# 🔑 API Key Setup Guide

## ⚠️ Important: Replace Demo Credentials

All example files in this directory use **demo credentials** that work with the local development environment. Before deploying to production or using with your own backend, you **must replace** these credentials with your own.

## Current Demo Credentials

```javascript
merchantId: 'demo_store_2024'
apiKey: 'pk_test_279f4099f6e3e961f8fbf465680baece06a4f361e134563f046bad8820d41cd8'
```

**These credentials:**
- ✅ Work with `http://localhost:3000` (local development)
- ✅ Allow you to test all widget features immediately
- ❌ Will NOT work with production API
- ❌ Should NOT be used in production

## How to Get Your Own Credentials

### Option 1: Using the Script (Recommended for Development)

If you're running the backend locally, you can generate test credentials:

```bash
# From the project root
npx ts-node scripts/create-test-api-key.ts
```

This will output:
```
✅ Test API key created successfully!

📋 API Key Details:
   Merchant ID: demo_store_2024
   API Key: pk_test_xxxxxxxxxxxxx
   Environment: development

💡 Update your widget configuration:
   apiKey: 'pk_test_xxxxxxxxxxxxx'
   merchantId: 'demo_store_2024'
```

### Option 2: Using the Dashboard (Production)

1. **Sign up** at [https://dashboard.rag-assistant.com](https://dashboard.rag-assistant.com)
2. **Navigate** to Settings → API Keys
3. **Click** "Create New API Key"
4. **Copy** your Merchant ID and API Key
5. **Replace** in your widget configuration

## Updating Examples

Find and replace in any example file:

### Before:
```javascript
const assistant = new RAGAssistant({
  merchantId: 'demo_store_2024',
  apiKey: 'pk_test_279f4099f6e3e961f8fbf465680baece06a4f361e134563f046bad8820d41cd8',
  // ...
});
```

### After:
```javascript
const assistant = new RAGAssistant({
  merchantId: 'YOUR_MERCHANT_ID',        // ← Replace this
  apiKey: 'YOUR_API_KEY',                // ← Replace this
  // ...
});
```

## API Key Types

### Test Keys (`pk_test_...`)
- For development and testing
- Can be regenerated freely
- Limited rate limits
- Use with `http://localhost:3000` or staging environment

### Live Keys (`pk_live_...`)
- For production use
- Should be kept secret
- Higher rate limits
- Use with production API endpoint

## Security Best Practices

### ✅ DO:
- Keep API keys in environment variables
- Use test keys for development
- Rotate keys regularly
- Monitor API key usage
- Revoke compromised keys immediately

### ❌ DON'T:
- Commit API keys to version control
- Share API keys publicly
- Use production keys in client-side code without restrictions
- Hardcode keys in your application

## Environment-Specific Configuration

### Development
```javascript
const assistant = new RAGAssistant({
  merchantId: process.env.MERCHANT_ID || 'demo_store_2024',
  apiKey: process.env.API_KEY || 'pk_test_...',
  apiBaseUrl: 'http://localhost:3000',
});
```

### Production
```javascript
const assistant = new RAGAssistant({
  merchantId: process.env.MERCHANT_ID,
  apiKey: process.env.API_KEY,
  // apiBaseUrl defaults to production API
});
```

## Troubleshooting

### "Invalid or expired API key"
- ✓ Check that you copied the full API key
- ✓ Verify the key hasn't been revoked
- ✓ Ensure you're using the correct environment (test vs live)
- ✓ Check that the API key belongs to the merchant ID

### "Access denied to merchant resources"
- ✓ Verify merchantId matches the API key
- ✓ Check API key permissions
- ✓ Ensure the merchant account is active

### Widget not loading
- ✓ Check browser console for errors
- ✓ Verify API endpoint is accessible
- ✓ Check CORS configuration
- ✓ Ensure widget.js is loaded correctly

## Need Help?

- 📖 [Full Documentation](https://docs.rag-assistant.com)
- 💬 [Support](mailto:support@rag-assistant.com)
- 🐛 [Report Issues](https://github.com/your-repo/issues)

---

**Remember:** The demo credentials in these examples are for **local testing only**. Always use your own credentials for production deployments!
