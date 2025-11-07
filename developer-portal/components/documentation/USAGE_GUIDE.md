# API Playground - Usage Guide

## Quick Start

The API Playground is located in the Developer Portal at `/documentation` under the "API Playground" tab.

## Step-by-Step Guide

### 1. Access the Playground

Navigate to: **Dashboard → Documentation → API Playground tab**

### 2. Select an Endpoint

Use the **Endpoint** dropdown to choose which API endpoint you want to test:

```
Available Endpoints:
- POST /api/chat - Send chat queries
- POST /api/documents - Create documents  
- GET /api/documents/search - Search documents
- GET /api/merchants/:merchantId/usage/current - Get usage
- GET /api/merchants/:merchantId/analytics/overview - Get analytics
```

### 3. Choose Environment

Select your target environment from the **Base URL** dropdown:

- **Production**: `https://api.rag-assistant.com` - Live production API
- **Development**: `https://api-dev.rag-assistant.com` - Staging environment
- **Local**: `http://localhost:3000` - Local development

### 4. Add Authentication

#### For API Key Endpoints (chat, documents):
1. Go to the **API Keys** page
2. Create a new API key (or use existing)
3. Copy the key (starts with `pk_live_` or `pk_test_`)
4. Paste into the **API Key** field in the playground

#### For JWT Endpoints (usage, analytics):
1. Login to the Developer Portal
2. Your JWT token is automatically used
3. Or manually paste a JWT token if testing

### 5. Configure Parameters

#### Path Parameters (e.g., `:merchantId`)
- Input fields appear automatically
- Enter your merchant ID
- Example: `acme_electronics_2024`

#### Query Parameters (for GET requests)
- Fill in optional parameters
- Example for search: `q=headphones`, `limit=10`

#### Request Body (for POST/PUT)
- Pre-filled with example JSON
- Edit as needed
- Must be valid JSON

### 6. Send Request

Click the **Send Request** button:
- Button shows "Sending..." with spinner
- Request is sent to the API
- Response appears in the right panel

### 7. View Response

#### Response Tab
- **Status Badge**: Shows HTTP status (200 OK, 400 Bad Request, etc.)
- **Response Body**: Formatted JSON with syntax highlighting
- **Response Headers**: All HTTP headers returned
- **Copy Button**: Copy response to clipboard

#### cURL Tab
- See the equivalent cURL command
- Copy and run in terminal
- Share with team members

## Example Workflows

### Testing Chat Endpoint

1. Select: `POST /api/chat`
2. Environment: `Production`
3. API Key: `pk_live_abc123...`
4. Request Body:
```json
{
  "query": "Show me wireless headphones under $200",
  "sessionId": "session_abc123",
  "merchantId": "your_merchant_id",
  "userId": "user_xyz789"
}
```
5. Click **Send Request**
6. View AI response with product recommendations

### Creating a Document

1. Select: `POST /api/documents`
2. Environment: `Production`
3. API Key: `pk_live_abc123...`
4. Request Body:
```json
{
  "type": "product",
  "title": "Wireless Bluetooth Headphones",
  "content": "Premium noise-cancelling headphones",
  "metadata": {
    "sku": "WBH-001",
    "price": 199.99,
    "inStock": true
  }
}
```
5. Click **Send Request**
6. Document created and ID returned

### Checking Usage

1. Select: `GET /api/merchants/:merchantId/usage/current`
2. Environment: `Production`
3. JWT Token: (automatically used if logged in)
4. Parameters:
   - `merchantId`: `your_merchant_id`
5. Click **Send Request**
6. View current usage statistics

### Searching Documents

1. Select: `GET /api/documents/search`
2. Environment: `Production`
3. API Key: `pk_live_abc123...`
4. Parameters:
   - `q`: `headphones`
   - `limit`: `10`
5. Click **Send Request**
6. View search results

## Tips & Tricks

### 💡 Quick Testing
- Use **Development** environment for testing
- Use `pk_test_` keys to avoid affecting production data
- Keep the playground open while developing

### 💡 Debugging
- Check **Response Headers** for rate limit info
- Look for `X-RateLimit-Remaining` header
- Inspect error responses for details

### 💡 Code Generation
- Switch to **cURL** tab
- Copy the command
- Use in scripts or CI/CD pipelines

### 💡 JSON Editing
- Use a JSON validator if unsure
- Playground validates before sending
- Error message shows what's wrong

### 💡 Sharing
- Copy cURL command to share with team
- Include in bug reports
- Use in documentation examples

## Common Issues

### ❌ "Invalid or expired API key"
**Solution**: 
- Check key is correct (no extra spaces)
- Verify key is active in API Keys page
- Ensure using correct environment (test vs live)

### ❌ "Invalid JSON in request body"
**Solution**:
- Check for missing commas
- Ensure quotes are correct
- Use a JSON validator

### ❌ "Missing required parameters"
**Solution**:
- Fill in all fields marked with *
- Check parameter names match exactly
- Verify merchantId is correct

### ❌ "Rate limit exceeded"
**Solution**:
- Wait for rate limit to reset
- Check `X-RateLimit-Reset` header
- Upgrade plan if needed

### ❌ "CORS error"
**Solution**:
- Use correct base URL
- Check API server is running (for local)
- Verify CORS is configured on server

## Keyboard Shortcuts

- `Tab` - Navigate between fields
- `Enter` - Submit form (when focused on input)
- `Ctrl/Cmd + C` - Copy (when text selected)
- `Ctrl/Cmd + V` - Paste

## Best Practices

### ✅ DO
- Test with development keys first
- Validate JSON before sending
- Check response status codes
- Read error messages carefully
- Use appropriate environment

### ❌ DON'T
- Share API keys publicly
- Use production keys for testing
- Ignore rate limits
- Send sensitive data in playground
- Test with real customer data

## Security Notes

- API keys are **not stored** (only in memory)
- Requests go directly to API (not logged)
- Use HTTPS in production
- Rotate keys regularly
- Revoke compromised keys immediately

## Getting Help

If you encounter issues:

1. Check this guide
2. Review error message
3. Try cURL command in terminal
4. Check API documentation
5. Contact support with:
   - Endpoint being tested
   - Request body (sanitized)
   - Error message
   - cURL command

## Additional Resources

- [API Reference](./api-reference.md) - Complete endpoint documentation
- [Authentication Guide](./authentication.md) - Auth setup
- [Best Practices](./best-practices.md) - Integration tips
- [Troubleshooting](./troubleshooting.md) - Common issues

## Feedback

Help us improve the API Playground:
- Report bugs via support
- Suggest new features
- Share use cases
- Contribute examples

---

**Happy Testing! 🚀**
