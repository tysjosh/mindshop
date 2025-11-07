# Callback Integration Guide

This guide explains how to integrate the RAG Assistant widget with your e-commerce platform using callbacks for cart and checkout functionality.

## Overview

The RAG Assistant widget provides three main callbacks to integrate with your e-commerce platform:

1. **`addToCartCallback`** - Called when a user adds a product to their cart
2. **`checkoutCallback`** - Called when a user initiates checkout
3. **`analyticsCallback`** - Called for tracking user interactions and events

## Quick Start

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  
  integration: {
    addToCartCallback: (product) => {
      // Add product to your cart
      myCart.add(product);
    },
    
    checkoutCallback: (items) => {
      // Process checkout with items
      myCheckout.process(items);
    },
    
    analyticsCallback: (event) => {
      // Track analytics
      analytics.track(event);
    }
  }
});
```

## Callback Reference

### addToCartCallback

Called when a user clicks "Add to Cart" on a product recommendation.

**Signature:**
```typescript
addToCartCallback: (product: Product) => void
```

**Product Object:**
```typescript
interface Product {
  id: string;           // Unique product identifier
  title: string;        // Product name
  description?: string; // Product description
  price: number;        // Product price
  currency?: string;    // Currency code (default: 'USD')
  imageUrl?: string;    // Product image URL
  url?: string;         // Product page URL
  inStock?: boolean;    // Stock availability
  metadata?: Record<string, any>; // Additional data
}
```

**Example Implementation:**
```javascript
addToCartCallback: (product) => {
  console.log('Adding to cart:', product);
  
  // Add to your cart system
  if (window.myShopifyCart) {
    window.myShopifyCart.add({
      id: product.id,
      quantity: 1,
      properties: {
        _ragAssistant: true
      }
    });
  }
  
  // Show confirmation
  showNotification(`Added ${product.title} to cart!`);
  
  // Update cart UI
  updateCartCount();
}
```

### checkoutCallback

Called when a user initiates checkout with one or more items.

**Signature:**
```typescript
checkoutCallback: (items: CartItem[]) => void
```

**CartItem Object:**
```typescript
interface CartItem {
  product: Product;  // Product details
  quantity: number;  // Quantity to checkout
}
```

**Example Implementation:**
```javascript
checkoutCallback: (items) => {
  console.log('Checkout initiated:', items);
  
  // Calculate total
  const total = items.reduce((sum, item) => 
    sum + (item.product.price * item.quantity), 0
  );
  
  // Redirect to checkout
  const itemIds = items.map(item => item.product.id).join(',');
  window.location.href = `/checkout?items=${itemIds}`;
  
  // Or use your checkout API
  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
}
```

### analyticsCallback

Called for tracking user interactions and events.

**Signature:**
```typescript
analyticsCallback: (event: AnalyticsEvent) => void
```

**AnalyticsEvent Object:**
```typescript
interface AnalyticsEvent {
  event: string;              // Event name
  query?: string;             // User query (for message events)
  responseTime?: number;      // Response time in ms
  productId?: string;         // Product ID (for product events)
  timestamp?: Date;           // Event timestamp
  metadata?: Record<string, any>; // Additional event data
}
```

**Event Types:**
- `message_sent` - User sent a message
- `add_to_cart` - User added product to cart
- `checkout_initiated` - User started checkout
- `checkout_all_recommendations` - User checked out all recommendations

**Example Implementation:**
```javascript
analyticsCallback: (event) => {
  console.log('Analytics event:', event);
  
  // Google Analytics
  if (window.gtag) {
    gtag('event', event.event, {
      event_category: 'RAG Assistant',
      event_label: event.productId || event.query,
      value: event.metadata?.totalValue
    });
  }
  
  // Segment
  if (window.analytics) {
    analytics.track(event.event, {
      ...event.metadata,
      source: 'rag_assistant'
    });
  }
  
  // Custom analytics
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}
```

## Platform-Specific Examples

### Shopify

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
          id: product.id,
          quantity: 1,
          properties: {
            _rag_assistant: 'true'
          }
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Added to Shopify cart:', data);
        // Update cart drawer
        if (window.theme && window.theme.cart) {
          window.theme.cart.refresh();
        }
      });
    },
    
    checkoutCallback: (items) => {
      // Redirect to Shopify checkout
      const variantIds = items.map(item => 
        `${item.product.id}:${item.quantity}`
      ).join(',');
      window.location.href = `/cart/${variantIds}`;
    }
  }
});
```

### WooCommerce

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  
  integration: {
    addToCartCallback: (product) => {
      // Use WooCommerce AJAX
      jQuery.post(wc_add_to_cart_params.ajax_url, {
        action: 'woocommerce_add_to_cart',
        product_id: product.id,
        quantity: 1
      }, function(response) {
        if (response.error) {
          console.error('WooCommerce add to cart error:', response);
        } else {
          // Trigger WooCommerce event
          jQuery(document.body).trigger('added_to_cart', [
            response.fragments,
            response.cart_hash
          ]);
        }
      });
    },
    
    checkoutCallback: (items) => {
      // Redirect to WooCommerce checkout
      window.location.href = '/checkout/';
    }
  }
});
```

### Custom Platform

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  
  integration: {
    addToCartCallback: async (product) => {
      try {
        // Call your custom cart API
        const response = await fetch('/api/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          },
          body: JSON.stringify({
            productId: product.id,
            quantity: 1,
            source: 'rag_assistant'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to add to cart');
        }
        
        const data = await response.json();
        
        // Update your cart UI
        updateCartUI(data.cart);
        
        // Show success message
        showToast(`Added ${product.title} to cart!`);
        
      } catch (error) {
        console.error('Add to cart error:', error);
        showToast('Failed to add to cart. Please try again.');
      }
    },
    
    checkoutCallback: async (items) => {
      try {
        // Create checkout session
        const response = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          },
          body: JSON.stringify({
            items: items.map(item => ({
              productId: item.product.id,
              quantity: item.quantity
            })),
            source: 'rag_assistant'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create checkout');
        }
        
        const data = await response.json();
        
        // Redirect to checkout
        window.location.href = data.checkoutUrl;
        
      } catch (error) {
        console.error('Checkout error:', error);
        showToast('Failed to start checkout. Please try again.');
      }
    },
    
    analyticsCallback: (event) => {
      // Send to your analytics service
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: event.event,
          properties: {
            ...event.metadata,
            timestamp: event.timestamp,
            source: 'rag_assistant'
          }
        })
      });
    }
  }
});
```

## Best Practices

### 1. Error Handling

Always wrap callback code in try-catch blocks:

```javascript
addToCartCallback: async (product) => {
  try {
    await addToCart(product);
    showSuccess('Added to cart!');
  } catch (error) {
    console.error('Add to cart failed:', error);
    showError('Failed to add to cart. Please try again.');
  }
}
```

### 2. User Feedback

Provide immediate feedback to users:

```javascript
addToCartCallback: (product) => {
  // Show loading state
  showLoading('Adding to cart...');
  
  addToCart(product)
    .then(() => {
      hideLoading();
      showSuccess(`Added ${product.title} to cart!`);
    })
    .catch(error => {
      hideLoading();
      showError('Failed to add to cart');
    });
}
```

### 3. Analytics Tracking

Track all important events:

```javascript
analyticsCallback: (event) => {
  // Track in multiple systems
  trackGoogleAnalytics(event);
  trackSegment(event);
  trackCustomAnalytics(event);
  
  // Log for debugging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics:', event);
  }
}
```

### 4. Cart State Management

Maintain cart state consistency:

```javascript
let cartState = [];

addToCartCallback: (product) => {
  // Update local state
  const existingItem = cartState.find(item => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartState.push({ ...product, quantity: 1 });
  }
  
  // Sync with server
  syncCartWithServer(cartState);
  
  // Update UI
  updateCartDisplay(cartState);
}
```

### 5. Security

Validate and sanitize data:

```javascript
addToCartCallback: (product) => {
  // Validate product data
  if (!product.id || !product.price) {
    console.error('Invalid product data:', product);
    return;
  }
  
  // Sanitize before sending to server
  const sanitizedProduct = {
    id: String(product.id),
    quantity: 1,
    price: Number(product.price)
  };
  
  addToCart(sanitizedProduct);
}
```

## Testing

### Test Callbacks Locally

```javascript
// Create test callbacks
const testCallbacks = {
  addToCartCallback: (product) => {
    console.log('TEST: Add to cart', product);
    alert(`Would add ${product.title} to cart`);
  },
  
  checkoutCallback: (items) => {
    console.log('TEST: Checkout', items);
    alert(`Would checkout ${items.length} items`);
  },
  
  analyticsCallback: (event) => {
    console.log('TEST: Analytics', event);
  }
};

// Initialize with test callbacks
const assistant = new RAGAssistant({
  merchantId: 'test_merchant',
  apiKey: 'pk_test_...',
  integration: testCallbacks
});
```

### Debug Mode

Enable detailed logging:

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_test_...',
  
  integration: {
    addToCartCallback: (product) => {
      console.group('Add to Cart Callback');
      console.log('Product:', product);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
      
      // Your implementation
      addToCart(product);
    }
  }
});
```

## Troubleshooting

### Callback Not Firing

1. Check if callback is properly configured:
```javascript
console.log('Callbacks:', assistant.config.integration);
```

2. Verify product has required fields:
```javascript
addToCartCallback: (product) => {
  console.log('Product received:', product);
  if (!product.id) {
    console.error('Product missing ID!');
    return;
  }
  // Continue...
}
```

### Cart Not Updating

1. Check for JavaScript errors in console
2. Verify your cart API is responding
3. Test cart functionality outside the widget
4. Check CORS settings if using external API

### Analytics Not Tracking

1. Verify analytics library is loaded:
```javascript
analyticsCallback: (event) => {
  if (!window.gtag) {
    console.warn('Google Analytics not loaded');
    return;
  }
  gtag('event', event.event);
}
```

2. Check network tab for analytics requests
3. Verify analytics credentials are correct

## Examples

See the [callback-integration.html](./examples/callback-integration.html) example for a complete working demonstration with:

- Live cart display
- Event logging
- Multiple callback implementations
- Error handling
- User feedback

## Support

Need help with callback integration?

- **Documentation**: https://docs.rag-assistant.com/callbacks
- **Examples**: See `widget/examples/callback-integration.html`
- **Support**: support@rag-assistant.com
- **GitHub**: Open an issue with the `callback` label

## Next Steps

1. Review the [callback-integration.html](./examples/callback-integration.html) example
2. Implement callbacks for your platform
3. Test thoroughly in development
4. Deploy to production
5. Monitor analytics and user behavior

Happy integrating! 🚀
