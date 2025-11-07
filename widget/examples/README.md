# RAG Assistant Widget - Integration Examples

This directory contains comprehensive integration examples for the RAG Assistant widget. Each example demonstrates different integration methods and use cases.

## 📋 Quick Navigation

Open [index.html](./index.html) in your browser to see all examples with descriptions and links.

## 🚀 Getting Started Examples

### [Basic Integration](./basic.html)
The simplest way to integrate the widget using a direct script tag. Perfect for beginners and static websites.

**Features:**
- Direct script tag integration
- Minimal configuration
- Product cards and cart integration
- Works with any website

### [Async Loading](./embed-async.html) ⭐ Recommended
The recommended way to integrate the widget using asynchronous loading. This ensures your page loads fast without blocking.

**Features:**
- Non-blocking async loading
- Faster page load times
- Better SEO
- Production-ready approach

### [Code Generator](./embed-generator.html)
Interactive tool to generate custom embed code with visual customization.

**Features:**
- Visual theme customizer
- Platform-specific code generation
- Live preview
- Copy & paste ready code

## ⚛️ Framework Integration Examples

### [React Integration](./react-integration.html)
Complete guide for integrating with React applications.

**Covers:**
- useEffect hook integration
- Custom hooks
- Redux integration
- Context API
- Programmatic control
- TypeScript support

### [Vue Integration](./vue-integration.html)
Complete guide for integrating with Vue applications.

**Covers:**
- Composition API (Vue 3)
- Options API
- Vuex integration
- Pinia integration
- Composables
- Plugin pattern

### [Angular Integration](./angular-integration.html)
Complete guide for integrating with Angular applications.

**Covers:**
- Component integration
- Angular services
- NgRx integration
- Dependency injection
- Module pattern
- TypeScript support

## 🛍️ E-commerce Platform Examples

### [Platform Integration](./embed-ecommerce.html)
Ready-to-use code snippets for popular e-commerce platforms.

**Includes:**
- Shopify integration
- WooCommerce integration
- BigCommerce integration
- Magento integration
- Custom platform integration

## 🔧 Advanced Examples

### [Callback Integration](./callback-integration.html) ⭐ New
Complete demonstration of e-commerce callback integration with live cart and event logging.

**Features:**
- Add to cart callback implementation
- Checkout callback implementation
- Analytics callback tracking
- Real-time cart state management
- Live event logging
- Complete working example

### [Analytics Integration](./analytics-integration.html) ⭐ New
Real-time analytics dashboard demonstrating comprehensive event tracking and integration with analytics services.

**Features:**
- Real-time analytics dashboard
- All tracked events visualization
- Integration examples (Google Analytics, Mixpanel, Segment)
- Session metrics and summaries
- Event log with filtering
- Custom analytics endpoint integration

### [Advanced Callbacks](./advanced-callbacks.html)
Complete guide to all widget callbacks and events with live event logging.

**Covers:**
- Add to cart callback
- Checkout callback
- Analytics callback
- Error callback
- Message events
- Widget state events
- Complete integration example

### [Mobile Responsive](./mobile-responsive.html)
Demonstration of how the widget adapts to different screen sizes.

**Features:**
- Mobile optimization
- Tablet support
- Desktop layout
- Touch gestures
- Performance optimization
- Responsive behavior examples

### [Testing & Debug](./embed-test.html)
Test page with debugging tools and status monitoring.

**Features:**
- Load status tracking
- Console logging
- Test controls
- Error detection
- Performance metrics

## 📱 Additional Examples

### [ChatWidget Demo](./chatwidget-demo.html)
Demonstration of the ChatWidget component and its features.

**Shows:**
- All UI components
- Feature showcase
- Implementation status

## 🎯 Usage

1. **For Static Websites:**
   - Start with [basic.html](./basic.html) or [embed-async.html](./embed-async.html)
   - Copy the embed code
   - Paste before `</body>` tag
   - Replace with your credentials

2. **For React Apps:**
   - See [react-integration.html](./react-integration.html)
   - Install: `npm install @rag-assistant/widget`
   - Follow the examples for hooks, Redux, or Context

3. **For Vue Apps:**
   - See [vue-integration.html](./vue-integration.html)
   - Install: `npm install @rag-assistant/widget`
   - Follow the examples for Composition API, Vuex, or Pinia

4. **For Angular Apps:**
   - See [angular-integration.html](./angular-integration.html)
   - Install: `npm install @rag-assistant/widget`
   - Follow the examples for services, NgRx, or modules

5. **For E-commerce Platforms:**
   - See [embed-ecommerce.html](./embed-ecommerce.html)
   - Find your platform (Shopify, WooCommerce, etc.)
   - Copy the platform-specific code
   - Follow the installation instructions

## 🔑 Getting Your Credentials

⚠️ **Important:** All examples use demo credentials for local testing. See [API_KEY_SETUP.md](./API_KEY_SETUP.md) for details.

### For Local Development (Current Setup)
The examples are pre-configured with working credentials for `http://localhost:3000`:
- Merchant ID: `demo_store_2024`
- API Key: `pk_test_279f4099f6e3e961f8fbf465680baece06a4f361e134563f046bad8820d41cd8`

### For Production
1. Log in to your [RAG Assistant Dashboard](https://dashboard.rag-assistant.com)
2. Navigate to **API Keys**
3. Copy your **Merchant ID** and **API Key**
4. Replace the demo credentials in the examples

📖 **Full guide:** [API_KEY_SETUP.md](./API_KEY_SETUP.md)

## 🎨 Customization

All examples can be customized with:

```javascript
{
  theme: {
    primaryColor: '#667eea',      // Your brand color
    position: 'bottom-right',     // Widget position
    fontFamily: 'Arial',          // Font family
    borderRadius: '8px',          // Border radius
    zIndex: 9999                  // Z-index
  },
  
  behavior: {
    autoOpen: false,              // Auto-open on load
    greeting: 'Hi! 👋',           // Greeting message
    maxRecommendations: 3,        // Max products to show
    showTimestamps: false,        // Show message times
    enableSoundNotifications: false // Sound notifications
  }
}
```

## 🧪 Testing

1. **Local Testing:**
   - Open any example HTML file in your browser
   - The widget will load from `../dist/widget.js`
   - Make sure you've built the widget first: `npm run build`

2. **Production Testing:**
   - Use `pk_test_...` keys for testing
   - Use `pk_live_...` keys for production
   - Test on different devices and browsers

## 📚 Documentation

- [Complete Embed Guide](../EMBED_GUIDE.md) - Detailed integration instructions
- [Quick Start Guide](../INTEGRATION_QUICKSTART.md) - Get started in 3 steps
- [Widget Documentation](../README.md) - Full API reference
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute

## 🆘 Need Help?

- **Documentation**: https://docs.rag-assistant.com
- **Dashboard**: https://dashboard.rag-assistant.com
- **Support Email**: support@rag-assistant.com
- **GitHub Issues**: Report bugs or request features

## ✅ Checklist

Before deploying to production:

- [ ] Tested widget on your site
- [ ] Replaced test credentials with production keys
- [ ] Tested on mobile devices
- [ ] Tested cart integration callbacks
- [ ] Verified analytics tracking
- [ ] Checked browser console for errors
- [ ] Tested on different browsers
- [ ] Optimized for performance
- [ ] Added error handling
- [ ] Configured CORS if needed

## 🎉 You're Ready!

Choose the example that best fits your use case, follow the instructions, and you'll have the RAG Assistant widget integrated in minutes!

**Pro Tip:** Start with the [Code Generator](./embed-generator.html) to quickly generate custom code for your specific needs.
