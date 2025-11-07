# RAG Assistant Widget - Embed Guide

## Overview

The RAG Assistant widget can be embedded into any website using a simple async loading script. This guide covers all integration methods and best practices.

## Quick Start

### Method 1: Async Snippet (Recommended)

This is the fastest and most reliable way to load the widget. It loads asynchronously without blocking your page.

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

### Method 2: Direct Script Tag

Simple but blocks page rendering until loaded.

```html
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

### Method 3: NPM Package (For React/Vue/Angular)

```bash
npm install @rag-assistant/widget
```

```javascript
import RAGAssistant from '@rag-assistant/widget';

const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...'
});
```

## Configuration Options

### Required Options

```javascript
{
  merchantId: 'your_merchant_id',  // Your unique merchant ID
  apiKey: 'pk_live_...'            // Your API key (get from dashboard)
}
```

### Theme Options

```javascript
{
  theme: {
    primaryColor: '#007bff',        // Main color for buttons, headers
    fontFamily: 'Arial, sans-serif', // Font family
    borderRadius: '8px',            // Border radius for widget
    position: 'bottom-right',       // Widget position: bottom-right, bottom-left, top-right, top-left
    zIndex: 9999                    // Z-index for widget
  }
}
```

### Behavior Options

```javascript
{
  behavior: {
    autoOpen: false,                // Auto-open widget on page load
    greeting: 'Hi! How can I help?', // Initial greeting message
    placeholder: 'Ask me anything...', // Input placeholder text
    maxRecommendations: 3,          // Max product recommendations to show
    showTimestamps: false,          // Show message timestamps
    enableSoundNotifications: false // Play sound on new messages
  }
}
```

### Integration Callbacks

```javascript
{
  integration: {
    // Called when user clicks "Add to Cart" on a product
    addToCartCallback: (product) => {
      console.log('Add to cart:', product);
      // Your cart logic here
      myCart.add(product);
    },
    
    // Called when user wants to checkout
    checkoutCallback: (items) => {
      console.log('Checkout:', items);
      // Your checkout logic here
      window.location.href = '/checkout';
    },
    
    // Called for analytics tracking
    analyticsCallback: (event) => {
      console.log('Analytics:', event);
      // Your analytics logic here
      gtag('event', event.event, event);
    }
  }
}
```

## Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Store</title>
</head>
<body>
  <h1>Welcome to My Store</h1>
  
  <!-- Your page content -->
  
  <!-- RAG Assistant Widget -->
  <script>
    (function(w,d,s,o,f,js,fjs){
      w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
      js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
      js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
    }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
    
    ra('init', {
      merchantId: 'acme_store_2024',
      apiKey: 'pk_live_abc123...',
      
      theme: {
        primaryColor: '#FF6B6B',
        position: 'bottom-right'
      },
      
      behavior: {
        autoOpen: false,
        greeting: 'Hi! 👋 I\'m here to help you find the perfect product!',
        maxRecommendations: 3
      },
      
      integration: {
        addToCartCallback: (product) => {
          // Add to your cart system
          fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
          }).then(() => {
            alert(`Added ${product.title} to cart!`);
          });
        },
        
        checkoutCallback: (items) => {
          // Redirect to checkout
          window.location.href = '/checkout';
        },
        
        analyticsCallback: (event) => {
          // Track with Google Analytics
          if (typeof gtag !== 'undefined') {
            gtag('event', event.event, {
              event_category: 'RAG Assistant',
              event_label: event.query,
              value: event.responseTime
            });
          }
        }
      }
    });
  </script>
</body>
</html>
```

## API Methods

After initialization, you can control the widget programmatically:

### Open Widget

```javascript
ra('open');
```

### Close Widget

```javascript
ra('close');
```

### Send Message Programmatically

```javascript
ra('sendMessage', 'Show me laptops under $1000');
```

### Clear Conversation History

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
  console.log('Current session:', sessionId);
});
```

## Advanced Usage

### Conditional Loading

Load widget only for certain pages or conditions:

```javascript
// Only load on product pages
if (window.location.pathname.includes('/products/')) {
  ra('init', { /* config */ });
}

// Only load for returning visitors
if (localStorage.getItem('returning_visitor')) {
  ra('init', { /* config */ });
}
```

### Custom Triggers

Open widget from custom buttons:

```html
<button onclick="ra('open')">
  Need Help? Chat with us!
</button>
```

### Multiple Instances

You can have different configurations for different pages:

```javascript
// Homepage - auto-open
if (window.location.pathname === '/') {
  ra('init', {
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...',
    behavior: { autoOpen: true }
  });
}

// Product pages - don't auto-open
else if (window.location.pathname.includes('/products/')) {
  ra('init', {
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...',
    behavior: { autoOpen: false }
  });
}
```

## E-commerce Platform Integration

### Shopify

Add to your theme's `theme.liquid` file before `</body>`:

```liquid
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: '{{ shop.metafields.rag_assistant.merchant_id }}',
    apiKey: '{{ shop.metafields.rag_assistant.api_key }}',
    integration: {
      addToCartCallback: (product) => {
        // Use Shopify's AJAX API
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
</script>
```

### WooCommerce

Add to your theme's `footer.php` before `</body>`:

```php
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: '<?php echo get_option('rag_assistant_merchant_id'); ?>',
    apiKey: '<?php echo get_option('rag_assistant_api_key'); ?>',
    integration: {
      addToCartCallback: (product) => {
        // Use WooCommerce AJAX
        jQuery.post('<?php echo admin_url('admin-ajax.php'); ?>', {
          action: 'woocommerce_add_to_cart',
          product_id: product.id,
          quantity: 1
        }, function() {
          window.location.href = '<?php echo wc_get_cart_url(); ?>';
        });
      }
    }
  });
</script>
```

### BigCommerce

Add via Script Manager in your BigCommerce admin:

```javascript
(function(w,d,s,o,f,js,fjs){
  w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
  js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
  js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));

ra('init', {
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      // Use BigCommerce Storefront API
      fetch('/api/storefront/carts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItems: [{
            productId: product.id,
            quantity: 1
          }]
        })
      }).then(() => {
        window.location.href = '/cart.php';
      });
    }
  }
});
```

## Performance Optimization

### Lazy Loading

Load widget only when user scrolls or after a delay:

```javascript
// Load after 3 seconds
setTimeout(function() {
  ra('init', { /* config */ });
}, 3000);

// Load on scroll
let loaded = false;
window.addEventListener('scroll', function() {
  if (!loaded && window.scrollY > 500) {
    loaded = true;
    ra('init', { /* config */ });
  }
});
```

### Preconnect

Add DNS prefetch and preconnect for faster loading:

```html
<link rel="dns-prefetch" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://api.rag-assistant.com">
```

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify your `merchantId` and `apiKey` are correct
3. Ensure the script is loading (check Network tab)
4. Check for JavaScript errors on your page
5. Verify your domain is whitelisted in dashboard

### Widget Loading Slowly

1. Use the async snippet (Method 1)
2. Add preconnect hints
3. Consider lazy loading
4. Check your internet connection
5. Try the CDN fallback URL

### Styling Conflicts

If the widget styling conflicts with your site:

```javascript
ra('init', {
  // ... other config
  theme: {
    zIndex: 999999,  // Increase if widget is behind other elements
    position: 'bottom-left'  // Try different position
  }
});
```

### Console Errors

Enable debug mode:

```javascript
// Add before ra('init')
window.RAG_DEBUG = true;

ra('init', { /* config */ });
```

## Security Best Practices

1. **Never expose your secret API key** - Only use publishable keys (`pk_live_...` or `pk_test_...`)
2. **Use HTTPS** - Always serve your site over HTTPS
3. **Whitelist domains** - Configure allowed domains in your dashboard
4. **Rotate keys** - Regularly rotate your API keys
5. **Monitor usage** - Check your dashboard for unusual activity

## Support

- **Documentation**: https://docs.rag-assistant.com
- **Dashboard**: https://dashboard.rag-assistant.com
- **Support Email**: support@rag-assistant.com
- **Status Page**: https://status.rag-assistant.com

## Version History

- **v1.0.0** (2025-11-02) - Initial release
  - Async loading support
  - Theme customization
  - Integration callbacks
  - Session management
  - Product recommendations
