# RAG Assistant Widget

Embeddable chat widget for integrating the RAG Assistant into merchant websites.

## Features

- 🎨 Customizable theme (colors, position, fonts)
- 💬 Real-time chat interface
- 🛍️ Product recommendations with images
- 📱 Responsive design (mobile & desktop)
- 💾 Conversation history persistence
- 🔌 Easy integration with callbacks
- 📊 Comprehensive analytics tracking (see [ANALYTICS.md](./ANALYTICS.md))

## Installation

### Via CDN (Recommended)

```html
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
```

### Via NPM

```bash
npm install @rag-assistant/widget
```

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Store</title>
</head>
<body>
  <!-- Your website content -->
  
  <!-- RAG Assistant Widget -->
  <script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
  <script>
    const assistant = new RAGAssistant({
      merchantId: 'your_merchant_id',
      apiKey: 'pk_live_...'
    });
  </script>
</body>
</html>
```

### Advanced Configuration

```javascript
const assistant = new RAGAssistant({
  // Required
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  
  // Optional: Custom API endpoint
  apiBaseUrl: 'https://api.rag-assistant.com',
  
  // Optional: Theme customization
  theme: {
    primaryColor: '#007bff',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '8px',
    position: 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
    zIndex: 9999
  },
  
  // Optional: Behavior settings
  behavior: {
    autoOpen: false,
    greeting: 'Hi! How can I help you today?',
    placeholder: 'Ask me anything...',
    maxRecommendations: 3,
    showTimestamps: false,
    enableSoundNotifications: false
  },
  
  // Optional: Integration callbacks
  integration: {
    // Called when user clicks "Add to Cart"
    addToCartCallback: (product) => {
      console.log('Add to cart:', product);
      // Your add to cart logic here
      // Example: window.myCart.add(product);
    },
    
    // Called when user wants to checkout
    checkoutCallback: (items) => {
      console.log('Checkout:', items);
      // Your checkout logic here
      // Example: window.location.href = '/checkout';
    },
    
    // Called for analytics tracking
    analyticsCallback: (event) => {
      console.log('Analytics event:', event);
      // Your analytics logic here
      // Example: gtag('event', event.event, { ...event });
    }
  }
});
```

## API Reference

### Constructor

```typescript
new RAGAssistant(config: RAGConfig)
```

### Methods

#### `open()`
Opens the chat widget.

```javascript
assistant.open();
```

#### `close()`
Closes the chat widget.

```javascript
assistant.close();
```

#### `clearHistory()`
Clears the conversation history from localStorage.

```javascript
assistant.clearHistory();
```

### Configuration Types

```typescript
interface RAGConfig {
  merchantId: string;
  apiKey: string;
  apiBaseUrl?: string;
  theme?: ThemeConfig;
  behavior?: BehaviorConfig;
  integration?: IntegrationConfig;
}

interface ThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  zIndex?: number;
}

interface BehaviorConfig {
  autoOpen?: boolean;
  greeting?: string;
  placeholder?: string;
  maxRecommendations?: number;
  showTimestamps?: boolean;
  enableSoundNotifications?: boolean;
}

interface IntegrationConfig {
  addToCartCallback?: (product: Product) => void;
  checkoutCallback?: (items: CartItem[]) => void;
  analyticsCallback?: (event: AnalyticsEvent) => void;
}

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  url?: string;
  inStock?: boolean;
  metadata?: Record<string, any>;
}
```

## Examples

### Shopify Integration

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      // Use Shopify Ajax API
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.metadata.variantId,
          quantity: 1
        })
      })
      .then(() => {
        alert('Added to cart!');
      });
    }
  }
});
```

### WooCommerce Integration

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    addToCartCallback: (product) => {
      // Use WooCommerce add to cart
      window.location.href = `?add-to-cart=${product.id}`;
    }
  }
});
```

### Google Analytics Integration

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
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
```

For more analytics integration examples and detailed documentation, see [ANALYTICS.md](./ANALYTICS.md).

## Development

### Setup

```bash
cd widget
npm install
```

### Build

```bash
npm run build
```

This creates `dist/widget.js` ready for deployment.

### Development Mode

```bash
npm run dev
```

This watches for changes and rebuilds automatically.

### Testing

```bash
npm test
```

## Deployment

### Deploy to CDN

The widget can be deployed to AWS CloudFront CDN for global distribution:

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

For detailed deployment instructions, see [CDN_DEPLOYMENT.md](./CDN_DEPLOYMENT.md).

### Manual Deployment

If you're hosting the widget yourself:

1. Build the widget: `npm run build`
2. Upload `dist/widget.js` to your web server
3. Ensure CORS headers are configured
4. Serve over HTTPS

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Support

For support, email support@rag-assistant.com or visit our [documentation](https://docs.rag-assistant.com).
