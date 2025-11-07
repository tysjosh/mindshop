# RAG Assistant Merchant Platform Documentation

## Welcome

The RAG Assistant Merchant Platform enables e-commerce businesses to integrate an AI-powered shopping assistant into their websites. This documentation will help you get started, integrate the platform, and optimize your implementation.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./getting-started.md)** - Quick start guide to get up and running in minutes
- **[Authentication Guide](./authentication.md)** - Learn about JWT tokens and API keys
- **[API Reference](./api-reference.md)** - Complete API documentation with examples

### Integration Guides
- **[Widget Integration](./widget-integration.md)** - Embed the chat widget on your site
- **[Best Practices](./best-practices.md)** - Optimize your integration for performance and security
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

### Advanced Topics
- **[Product Sync](./product-sync.md)** - Automate product data synchronization
- **[Webhook Integration](./webhook-integration.md)** - Real-time event notifications
- **[Billing Guide](./billing-guide.md)** - Subscription management and billing
- **[Best Practices](./best-practices.md)** - Optimize your integration for performance and security

### Administration
- **[Admin Guide](./admin-guide.md)** - Platform administration and merchant management

### Platform-Specific
- **[Shopify Integration](./platforms/shopify.md)** - Integrate with Shopify stores
- **[WooCommerce Integration](./platforms/woocommerce.md)** - Integrate with WooCommerce sites
- **[Custom Integration](./platforms/custom.md)** - Integrate with custom e-commerce platforms

## 🚀 Quick Start

### 1. Create Account

```bash
# Register via API
curl -X POST https://api.rag-assistant.com/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acme.com",
    "password": "SecurePass123!",
    "companyName": "ACME Electronics",
    "website": "https://acme.com"
  }'
```

Or visit [Developer Portal](https://portal.rag-assistant.com/register)

### 2. Generate API Key

```bash
# Login first
curl -X POST https://api.rag-assistant.com/api/merchants/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acme.com",
    "password": "SecurePass123!"
  }'

# Generate API key
curl -X POST https://api.rag-assistant.com/api/merchants/acme_electronics_2024/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "environment": "production",
    "permissions": ["*"]
  }'
```

### 3. Upload Products

```bash
curl -X POST https://api.rag-assistant.com/api/documents/bulk \
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \
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

### 4. Embed Widget

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'acme_electronics_2024',
    apiKey: 'pk_live_YOUR_API_KEY',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    }
  });
</script>
```

## 🎯 Key Features

### AI-Powered Product Recommendations
- Natural language understanding
- Semantic search across your catalog
- Context-aware recommendations
- Multi-turn conversations

### Easy Integration
- Embeddable JavaScript widget
- RESTful API
- Webhooks for real-time events
- Platform-specific integrations (Shopify, WooCommerce)

### Developer-Friendly
- Comprehensive API documentation
- Code examples in multiple languages
- Interactive API playground
- SDKs for popular languages

### Analytics & Insights
- Query analytics
- Performance metrics
- Top queries and trends
- Conversion tracking

### Enterprise-Ready
- 99.9% uptime SLA
- Auto-scaling infrastructure
- SOC 2 compliant
- GDPR compliant

## 📖 Core Concepts

### Merchants
A merchant represents your business account. Each merchant has:
- Unique merchant ID
- API keys for authentication
- Product catalog
- Usage limits based on plan

### API Keys
API keys authenticate your requests:
- **Test keys** (`pk_test_...`) - For development
- **Live keys** (`pk_live_...`) - For production
- Granular permissions
- Rotation support

### Sessions
Sessions maintain conversation context:
- Unique session ID per user
- Conversation history
- User preferences
- Expires after 24 hours of inactivity

### Documents
Documents represent your content:
- **Products** - Your product catalog
- **FAQs** - Frequently asked questions
- **Policies** - Return policies, shipping info
- **Reviews** - Customer reviews

## 🔐 Authentication

### JWT Tokens (Portal Access)
```javascript
// Login
const response = await fetch('https://api.rag-assistant.com/api/merchants/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@acme.com',
    password: 'SecurePass123!'
  })
});

const { accessToken } = await response.json();

// Use token
await fetch('https://api.rag-assistant.com/api/merchants/acme/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### API Keys (Programmatic Access)
```javascript
// Use API key
await fetch('https://api.rag-assistant.com/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pk_live_YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'wireless headphones',
    sessionId: 'session_abc123',
    merchantId: 'acme_electronics_2024'
  })
});
```

## 📊 Pricing

### Starter - $99/month
- 1,000 queries/month
- 100 documents
- 5,000 API calls/day
- Email support
- 7-day data retention

### Professional - $499/month
- 10,000 queries/month
- 1,000 documents
- 50,000 API calls/day
- Priority support
- 30-day data retention
- Custom branding

### Enterprise - Custom
- Unlimited queries
- Unlimited documents
- Unlimited API calls
- 24/7 support
- Unlimited retention
- SLA guarantees
- Dedicated account manager

## 🛠️ SDKs & Tools

### Official SDKs
- **JavaScript/TypeScript**: `npm install @rag-assistant/sdk`
- **Python**: `pip install rag-assistant`
- **PHP**: `composer require rag-assistant/sdk`
- **Ruby**: `gem install rag_assistant`

### Tools
- **CLI**: `npm install -g @rag-assistant/cli`
- **Postman Collection**: [Download](https://www.postman.com/rag-assistant)
- **VS Code Extension**: [Install](https://marketplace.visualstudio.com/items?itemName=rag-assistant)

## 📈 Analytics

Track key metrics in the Developer Portal:

### Overview Dashboard
- Total queries
- Active sessions
- Average response time
- Success rate

### Query Analytics
- Query volume over time
- Popular queries
- Intent distribution
- Confidence scores

### Performance Metrics
- Response time (p50, p95, p99)
- Cache hit rate
- Error rate
- Uptime

## 🔗 Integrations

### E-commerce Platforms
- **Shopify** - [Integration Guide](./platforms/shopify.md)
- **WooCommerce** - [Integration Guide](./platforms/woocommerce.md)
- **BigCommerce** - [Integration Guide](./platforms/bigcommerce.md)
- **Magento** - [Integration Guide](./platforms/magento.md)

### Analytics
- Google Analytics 4
- Facebook Pixel
- Segment
- Mixpanel

### CRM
- Salesforce
- HubSpot
- Zendesk

## 🆘 Support

### Documentation
- 📚 [Full Documentation](./README.md)
- 🎥 [Video Tutorials](./video-tutorials.md) - Complete video tutorial library
- 📖 [API Reference](./api-reference.md)

### Community
- 💬 [Community Forum](https://community.rag-assistant.com)
- 💡 [Feature Requests](https://feedback.rag-assistant.com)
- 🐛 [Report Bug](https://github.com/rag-assistant/issues)

### Direct Support
- 📧 Email: support@rag-assistant.com
- 🚨 Emergency: emergency@rag-assistant.com (Enterprise only)
- 📊 Status: [status.rag-assistant.com](https://status.rag-assistant.com)

### Response Times
- **Starter**: 24-48 hours
- **Professional**: 12-24 hours
- **Enterprise**: 4-8 hours

## 🔒 Security

### Compliance
- SOC 2 Type II certified
- GDPR compliant
- CCPA compliant
- PCI DSS compliant (for payment data)

### Security Features
- API key encryption
- JWT token authentication
- IP whitelisting
- Domain whitelisting
- Rate limiting
- DDoS protection

### Best Practices
- Rotate API keys every 90 days
- Use environment variables for keys
- Enable MFA for portal access
- Monitor API usage for anomalies
- Implement client-side rate limiting

## 📝 Changelog

### v1.2.0 (2025-11-01)
- Added webhook support
- Improved query performance (30% faster)
- New analytics dashboard
- Mobile SDK beta

### v1.1.0 (2025-10-01)
- Added Shopify integration
- Improved product recommendations
- New widget customization options
- Bug fixes and performance improvements

### v1.0.0 (2025-09-01)
- Initial release
- Core chat API
- JavaScript widget
- Developer portal
- Basic analytics

## 🗺️ Roadmap

### Q4 2025
- [ ] Mobile SDKs (iOS, Android)
- [ ] Advanced analytics
- [ ] A/B testing framework
- [ ] Multi-language support

### Q1 2026
- [ ] Voice assistant integration
- [ ] Image search
- [ ] Personalization engine
- [ ] Advanced ML models

## 📄 License

The RAG Assistant platform is proprietary software. See [Terms of Service](https://rag-assistant.com/terms) for details.

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📞 Contact

- **Website**: [https://rag-assistant.com](https://rag-assistant.com)
- **Email**: hello@rag-assistant.com
- **Twitter**: [@RAGAssistant](https://twitter.com/RAGAssistant)
- **LinkedIn**: [RAG Assistant](https://linkedin.com/company/rag-assistant)

---

**Ready to get started?** Follow our [Getting Started Guide](./getting-started.md) to integrate the RAG Assistant in minutes!
