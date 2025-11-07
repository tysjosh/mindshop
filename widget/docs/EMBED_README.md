# RAG Assistant Widget - Embed Script

## Overview

The RAG Assistant embed script provides an async loading mechanism that allows merchants to easily integrate the chat widget into their websites without blocking page load.

## Files

- **`embed.js`** - Standalone async loader script
- **`EMBED_GUIDE.md`** - Complete integration guide
- **`examples/embed-async.html`** - Async loading example
- **`examples/embed-ecommerce.html`** - Platform-specific examples
- **`examples/embed-generator.html`** - Interactive code generator

## Quick Start

### Basic Integration

Add this snippet before the closing `</body>` tag:

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

## How It Works

### 1. Async Loading Pattern

The embed script uses the same pattern as Google Analytics and other popular services:

```javascript
(function(w,d,s,o,f,js,fjs){
  // Create a queue for commands
  w['RAGAssistant']=o;
  w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
  
  // Load script asynchronously
  js=d.createElement(s);
  fjs=d.getElementsByTagName(s)[0];
  js.id=o;
  js.src=f;
  js.async=1;
  fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
```

**Benefits:**
- ✅ Non-blocking - page loads immediately
- ✅ Fault-tolerant - site works even if widget fails
- ✅ SEO-friendly - doesn't delay content rendering
- ✅ Better UX - users can interact with site while widget loads

### 2. Command Queue

Commands are queued until the widget loads:

```javascript
ra('init', { /* config */ });  // Queued
ra('open');                     // Queued
ra('sendMessage', 'Hello');     // Queued

// When widget loads, all commands execute in order
```

### 3. Widget Initialization

Once loaded, the widget processes all queued commands:

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  theme: { primaryColor: '#007bff' },
  behavior: { autoOpen: false }
});
```

## API Methods

### Initialize Widget

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  // ... other options
});
```

### Open Widget

```javascript
ra('open');
```

### Close Widget

```javascript
ra('close');
```

### Send Message

```javascript
ra('sendMessage', 'Show me laptops under $1000');
```

### Clear History

```javascript
ra('clearHistory');
```

### Reset Session

```javascript
ra('resetSession');
```

### Get Session ID

```javascript
ra('getSessionId', function(sessionId) {
  console.log('Session ID:', sessionId);
});
```

## Configuration Options

### Required

```javascript
{
  merchantId: 'your_merchant_id',  // Required
  apiKey: 'pk_live_...'            // Required
}
```

### Theme

```javascript
{
  theme: {
    primaryColor: '#007bff',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '8px',
    position: 'bottom-right',  // bottom-right, bottom-left, top-right, top-left
    zIndex: 9999
  }
}
```

### Behavior

```javascript
{
  behavior: {
    autoOpen: false,
    greeting: 'Hi! How can I help?',
    placeholder: 'Ask me anything...',
    maxRecommendations: 3,
    showTimestamps: false,
    enableSoundNotifications: false
  }
}
```

### Integration Callbacks

```javascript
{
  integration: {
    addToCartCallback: (product) => {
      // Handle add to cart
      console.log('Add to cart:', product);
    },
    checkoutCallback: (items) => {
      // Handle checkout
      window.location.href = '/checkout';
    },
    analyticsCallback: (event) => {
      // Track analytics
      gtag('event', event.event, event);
    }
  }
}
```

## Platform-Specific Integration

### Shopify

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.variantId,
          quantity: 1
        })
      }).then(() => {
        window.location.href = '/cart';
      });
    }
  }
});
```

### WooCommerce

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      jQuery.post(wc_add_to_cart_params.ajax_url, {
        action: 'woocommerce_add_to_cart',
        product_id: product.id,
        quantity: 1
      }, function() {
        window.location.href = wc_cart_params.cart_url;
      });
    }
  }
});
```

### BigCommerce

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      fetch('/api/storefront/carts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: [{ productId: product.id, quantity: 1 }]
        })
      }).then(() => {
        window.location.href = '/cart.php';
      });
    }
  }
});
```

## Advanced Usage

### Conditional Loading

```javascript
// Only load on product pages
if (window.location.pathname.includes('/products/')) {
  ra('init', { /* config */ });
}
```

### Lazy Loading

```javascript
// Load after 3 seconds
setTimeout(() => {
  ra('init', { /* config */ });
}, 3000);

// Load on scroll
let loaded = false;
window.addEventListener('scroll', () => {
  if (!loaded && window.scrollY > 500) {
    loaded = true;
    ra('init', { /* config */ });
  }
});
```

### Custom Triggers

```html
<button onclick="ra('open')">
  Need Help? Chat with us!
</button>
```

### Development Mode

```javascript
ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_test_...',
  widgetUrl: 'http://localhost:8080/widget.js',  // Local development
  apiBaseUrl: 'http://localhost:3000'            // Local API
});
```

## Performance Optimization

### Preconnect

Add these tags to `<head>` for faster loading:

```html
<link rel="dns-prefetch" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://api.rag-assistant.com">
```

### Resource Hints

```html
<link rel="preload" href="https://cdn.rag-assistant.com/v1/widget.js" as="script">
```

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify `merchantId` and `apiKey` are correct
3. Check Network tab to see if script loaded
4. Verify domain is whitelisted in dashboard

### Widget Loading Slowly

1. Use async snippet (recommended)
2. Add preconnect hints
3. Consider lazy loading
4. Check CDN status

### Styling Conflicts

```javascript
ra('init', {
  theme: {
    zIndex: 999999,  // Increase if behind other elements
    position: 'bottom-left'  // Try different position
  }
});
```

### Debug Mode

```javascript
window.RAG_DEBUG = true;  // Enable before ra('init')
```

## Security

### Best Practices

1. **Never expose secret keys** - Only use publishable keys (`pk_live_...` or `pk_test_...`)
2. **Use HTTPS** - Always serve your site over HTTPS
3. **Whitelist domains** - Configure allowed domains in dashboard
4. **Rotate keys** - Regularly rotate API keys
5. **Monitor usage** - Check dashboard for unusual activity

### Content Security Policy (CSP)

If using CSP, add these directives:

```
script-src 'self' https://cdn.rag-assistant.com;
connect-src 'self' https://api.rag-assistant.com;
img-src 'self' https://cdn.rag-assistant.com data:;
style-src 'self' 'unsafe-inline';
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## CDN Hosting

### Production

```
https://cdn.rag-assistant.com/v1/widget.js
https://cdn.rag-assistant.com/v1/widget.min.js
```

### Versioned URLs

```
https://cdn.rag-assistant.com/v1.0.0/widget.js
https://cdn.rag-assistant.com/v1.0.0/widget.min.js
```

### Integrity Hashes

```html
<script 
  src="https://cdn.rag-assistant.com/v1/widget.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

## Testing

### Test Mode

Use test API keys for development:

```javascript
ra('init', {
  merchantId: 'test_merchant',
  apiKey: 'pk_test_...'  // Test key
});
```

### Local Development

```javascript
ra('init', {
  merchantId: 'dev_merchant',
  apiKey: 'pk_test_...',
  widgetUrl: 'http://localhost:8080/widget.js',
  apiBaseUrl: 'http://localhost:3000'
});
```

## Examples

See the `examples/` directory for complete working examples:

- **`embed-async.html`** - Async loading demonstration
- **`embed-ecommerce.html`** - Platform-specific integrations
- **`embed-generator.html`** - Interactive code generator

## Support

- **Documentation**: https://docs.rag-assistant.com
- **Dashboard**: https://dashboard.rag-assistant.com
- **Support**: support@rag-assistant.com
- **Status**: https://status.rag-assistant.com

## License

MIT License - See LICENSE file for details
