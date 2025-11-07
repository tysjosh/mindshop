# Widget Integration Guide

## Overview

The RAG Assistant Widget is an embeddable chat interface that provides AI-powered product recommendations directly on your e-commerce site. This guide covers installation, configuration, and customization.

## Quick Start

Add this code snippet before the closing `</body>` tag:

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'YOUR_MERCHANT_ID',
    apiKey: 'pk_live_YOUR_API_KEY'
  });
</script>
```

## Configuration Options

### Basic Configuration

```javascript
ra('init', {
  merchantId: 'acme_electronics_2024',
  apiKey: 'pk_live_abc123',
  
  // Theme customization
  theme: {
    primaryColor: '#007bff',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '8px',
    position: 'bottom-right' // bottom-right, bottom-left, top-right, top-left
  },
  
  // Behavior settings
  behavior: {
    autoOpen: false,
    greeting: 'Hi! How can I help you today?',
    placeholder: 'Ask me anything...',
    maxRecommendations: 3
  }
});
```

### Advanced Configuration

```javascript
ra('init', {
  merchantId: 'acme_electronics_2024',
  apiKey: 'pk_live_abc123',
  
  theme: {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    backgroundColor: '#ffffff',
    textColor: '#333333',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    position: 'bottom-right',
    offset: {
      bottom: '20px',
      right: '20px'
    },
    zIndex: 9999
  },
  
  behavior: {
    autoOpen: false,
    autoOpenDelay: 3000, // ms
    greeting: 'Hi! How can I help you find the perfect product?',
    placeholder: 'Ask me anything...',
    maxRecommendations: 3,
    showTypingIndicator: true,
    persistHistory: true,
    enableSoundEffects: false
  },
  
  // Integration callbacks
  integration: {
    addToCartCallback: function(product) {
      // Your add to cart logic
      console.log('Adding to cart:', product);
      window.myCart.add(product);
    },
    
    checkoutCallback: function(items) {
      // Your checkout logic
      console.log('Proceeding to checkout:', items);
      window.location.href = '/checkout';
    },
    
    analyticsCallback: function(event) {
      // Track events in your analytics
      console.log('Analytics event:', event);
      gtag('event', event.type, event.data);
    }
  }
});
```

## Theme Customization

### Color Schemes

#### Modern Blue (Default)
```javascript
theme: {
  primaryColor: '#007bff',
  secondaryColor: '#6c757d',
  backgroundColor: '#ffffff',
  textColor: '#333333'
}
```

#### Dark Mode
```javascript
theme: {
  primaryColor: '#4a9eff',
  secondaryColor: '#8b95a1',
  backgroundColor: '#1a1a1a',
  textColor: '#e0e0e0'
}
```

#### E-commerce Green
```javascript
theme: {
  primaryColor: '#28a745',
  secondaryColor: '#6c757d',
  backgroundColor: '#ffffff',
  textColor: '#333333'
}
```

### Position Options

```javascript
// Bottom right (default)
theme: {
  position: 'bottom-right',
  offset: { bottom: '20px', right: '20px' }
}

// Bottom left
theme: {
  position: 'bottom-left',
  offset: { bottom: '20px', left: '20px' }
}

// Top right
theme: {
  position: 'top-right',
  offset: { top: '20px', right: '20px' }
}

// Custom position
theme: {
  position: 'custom',
  offset: { bottom: '100px', right: '50px' }
}
```

## Integration Callbacks

### Add to Cart

Integrate with your existing cart system:

```javascript
integration: {
  addToCartCallback: function(product) {
    // Shopify example
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: product.variantId,
        quantity: 1
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Added to cart:', data);
      // Update cart UI
      updateCartCount();
    });
  }
}
```

### Checkout

Redirect to checkout with selected items:

```javascript
integration: {
  checkoutCallback: function(items) {
    // WooCommerce example
    const params = items.map(item => 
      `add-to-cart=${item.productId}`
    ).join('&');
    
    window.location.href = `/checkout?${params}`;
  }
}
```

### Analytics Tracking

Track widget interactions:

```javascript
integration: {
  analyticsCallback: function(event) {
    // Google Analytics 4
    gtag('event', event.type, {
      event_category: 'RAG Assistant',
      event_label: event.query,
      value: event.responseTime
    });
    
    // Facebook Pixel
    fbq('trackCustom', 'RAGAssistantQuery', {
      query: event.query,
      recommendations: event.recommendationCount
    });
    
    // Custom analytics
    window.myAnalytics.track('rag_assistant_query', {
      query: event.query,
      sessionId: event.sessionId,
      timestamp: event.timestamp
    });
  }
}
```

## API Methods

### Initialize Widget

```javascript
ra('init', config);
```

### Open Widget

```javascript
ra('open');
```

### Close Widget

```javascript
ra('close');
```

### Toggle Widget

```javascript
ra('toggle');
```

### Send Message Programmatically

```javascript
ra('sendMessage', 'Show me wireless headphones under $200');
```

### Clear History

```javascript
ra('clearHistory');
```

### Update Configuration

```javascript
ra('updateConfig', {
  theme: {
    primaryColor: '#ff0000'
  }
});
```

### Get Session ID

```javascript
ra('getSessionId', function(sessionId) {
  console.log('Current session:', sessionId);
});
```

## Events

Listen to widget events:

```javascript
// Widget opened
ra('on', 'open', function() {
  console.log('Widget opened');
});

// Widget closed
ra('on', 'close', function() {
  console.log('Widget closed');
});

// Message sent
ra('on', 'message:sent', function(data) {
  console.log('User query:', data.query);
});

// Message received
ra('on', 'message:received', function(data) {
  console.log('Assistant response:', data.answer);
  console.log('Recommendations:', data.recommendations);
});

// Product clicked
ra('on', 'product:clicked', function(product) {
  console.log('Product clicked:', product);
});

// Add to cart clicked
ra('on', 'addToCart:clicked', function(product) {
  console.log('Add to cart:', product);
});

// Error occurred
ra('on', 'error', function(error) {
  console.error('Widget error:', error);
});
```

## Responsive Design

The widget automatically adapts to mobile devices:

### Mobile Behavior

- Full-screen on screens < 768px
- Slide-up animation
- Touch-optimized controls
- Swipe to close

### Custom Mobile Configuration

```javascript
behavior: {
  mobile: {
    fullScreen: true,
    position: 'bottom',
    showCloseButton: true,
    swipeToClose: true
  }
}
```

## Localization

Support multiple languages:

```javascript
ra('init', {
  merchantId: 'acme_electronics_2024',
  apiKey: 'pk_live_abc123',
  
  locale: 'es', // en, es, fr, de, it, pt, ja, zh
  
  messages: {
    greeting: '¡Hola! ¿Cómo puedo ayudarte?',
    placeholder: 'Pregúntame cualquier cosa...',
    sendButton: 'Enviar',
    clearButton: 'Limpiar',
    closeButton: 'Cerrar',
    errorMessage: 'Lo siento, algo salió mal.',
    addToCart: 'Añadir al carrito',
    viewProduct: 'Ver producto'
  }
});
```

## Performance Optimization

### Lazy Loading

Load the widget only when needed:

```javascript
// Load widget on user interaction
document.getElementById('chat-button').addEventListener('click', function() {
  if (!window.RAGAssistant) {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://cdn.rag-assistant.com/v1/widget.js';
    script.async = true;
    script.onload = function() {
      ra('init', config);
      ra('open');
    };
    document.body.appendChild(script);
  } else {
    ra('open');
  }
});
```

### Preconnect

Improve loading performance:

```html
<link rel="preconnect" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://api.rag-assistant.com">
```

### Resource Hints

```html
<link rel="dns-prefetch" href="https://cdn.rag-assistant.com">
<link rel="preload" href="https://cdn.rag-assistant.com/v1/widget.js" as="script">
```

## Platform-Specific Integration

### Shopify

```liquid
<!-- Add to theme.liquid before </body> -->
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
      addToCartCallback: function(product) {
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: product.metadata.variantId,
            quantity: 1
          })
        })
        .then(() => window.location.href = '/cart');
      }
    }
  });
</script>
```

### WooCommerce

```php
<!-- Add to footer.php -->
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
      addToCartCallback: function(product) {
        jQuery.post('<?php echo admin_url('admin-ajax.php'); ?>', {
          action: 'woocommerce_add_to_cart',
          product_id: product.metadata.productId,
          quantity: 1
        }, function() {
          window.location.href = '<?php echo wc_get_cart_url(); ?>';
        });
      }
    }
  });
</script>
```

### React

```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://cdn.rag-assistant.com/v1/widget.js';
    script.async = true;
    script.onload = () => {
      window.ra('init', {
        merchantId: process.env.REACT_APP_MERCHANT_ID,
        apiKey: process.env.REACT_APP_API_KEY,
        integration: {
          addToCartCallback: (product) => {
            // Your React cart logic
            dispatch(addToCart(product));
          }
        }
      });
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  return <div className="App">...</div>;
}
```

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify API key is correct
3. Ensure script is loaded (Network tab)
4. Check domain whitelist in settings

### Styling Conflicts

If the widget conflicts with your site's CSS:

```javascript
theme: {
  cssReset: true, // Reset widget styles
  customCSS: `
    .rag-widget {
      font-family: inherit !important;
    }
  `
}
```

### CORS Issues

Ensure your domain is whitelisted:
1. Go to Developer Portal > Settings
2. Add your domain to "Allowed Domains"
3. Save changes

### Performance Issues

1. Enable lazy loading
2. Reduce `maxRecommendations`
3. Disable `persistHistory` if not needed
4. Use CDN for faster loading

## Best Practices

1. **Test in Development First**: Use test API keys before going live
2. **Monitor Performance**: Track widget load times and response times
3. **Customize for Your Brand**: Match your site's design
4. **Track Analytics**: Monitor user interactions
5. **Handle Errors Gracefully**: Provide fallback UI
6. **Keep Updated**: Use the latest widget version
7. **Optimize for Mobile**: Test on various devices

## Security

- Never expose API keys in client-side code (use environment variables)
- Whitelist your domains in the Developer Portal
- Use HTTPS only
- Implement Content Security Policy (CSP)

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' https://cdn.rag-assistant.com;">
```

## Support

- 📚 [Widget API Reference](./widget-api.md)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📧 [Email Support](mailto:support@rag-assistant.com)
- 🎥 [Video Tutorials](./video-tutorials.md) - Watch widget installation and customization videos

### 🎬 Related Video Tutorials

**Learn widget integration visually:**

- **[Widget Installation in 5 Minutes](./video-tutorials.md#3-widget-installation-in-5-minutes)** (5 min) - Basic installation
- **[Widget Customization & Theming](./video-tutorials.md#5-widget-customization--theming)** (8 min) - Match your brand
- **[Shopify Integration](./video-tutorials.md#7-shopify-integration)** (8 min) - Shopify-specific guide
- **[WooCommerce Integration](./video-tutorials.md#8-woocommerce-integration)** (8 min) - WordPress/WooCommerce guide
- **[Custom E-commerce Integration](./video-tutorials.md#9-custom-e-commerce-integration)** (10 min) - Advanced integration

📺 [View All Video Tutorials](./video-tutorials.md)
