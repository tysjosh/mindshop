import { RAGConfig, Product, CartItem } from '../types';

/**
 * Product card component for displaying product recommendations
 */
export class ProductCard {
  private config: RAGConfig;
  private cart: Map<string, CartItem> = new Map();

  constructor(config: RAGConfig) {
    this.config = config;
  }

  /**
   * Create a product card element
   */
  create(product: Product): HTMLElement {
    const card = document.createElement('div');
    card.className = 'rag-product-card';

    // Product image
    if (product.imageUrl) {
      const imageDiv = document.createElement('div');
      imageDiv.className = 'rag-product-image';
      
      const img = document.createElement('img');
      img.src = product.imageUrl;
      img.alt = product.title;
      img.loading = 'lazy';
      
      imageDiv.appendChild(img);
      card.appendChild(imageDiv);
    }

    // Product details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'rag-product-details';

    // Title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'rag-product-title';
    titleDiv.textContent = product.title;
    detailsDiv.appendChild(titleDiv);

    // Description (if available)
    if (product.description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'rag-product-description';
      descDiv.textContent = this.truncateText(product.description, 100);
      detailsDiv.appendChild(descDiv);
    }

    // Price and stock
    const priceStockDiv = document.createElement('div');
    priceStockDiv.className = 'rag-product-price-stock';

    const priceDiv = document.createElement('div');
    priceDiv.className = 'rag-product-price';
    priceDiv.textContent = this.formatPrice(product.price, product.currency);
    priceStockDiv.appendChild(priceDiv);

    if (product.inStock !== undefined) {
      const stockDiv = document.createElement('div');
      stockDiv.className = `rag-product-stock ${product.inStock ? 'in-stock' : 'out-of-stock'}`;
      stockDiv.textContent = product.inStock ? 'In Stock' : 'Out of Stock';
      priceStockDiv.appendChild(stockDiv);
    }

    detailsDiv.appendChild(priceStockDiv);
    card.appendChild(detailsDiv);

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'rag-product-actions';

    // View button
    if (product.url) {
      const viewButton = document.createElement('a');
      viewButton.href = product.url;
      viewButton.target = '_blank';
      viewButton.rel = 'noopener noreferrer';
      viewButton.className = 'rag-product-button rag-product-button-secondary';
      viewButton.textContent = 'View';
      actionsDiv.appendChild(viewButton);
    }

    // Add to cart button
    if (product.inStock !== false) {
      const addToCartButton = document.createElement('button');
      addToCartButton.className = 'rag-product-button rag-product-button-primary';
      addToCartButton.textContent = 'Add to Cart';
      addToCartButton.onclick = () => this.handleAddToCart(product);
      actionsDiv.appendChild(addToCartButton);
    }

    card.appendChild(actionsDiv);

    return card;
  }

  /**
   * Handle add to cart action
   */
  private handleAddToCart(product: Product): void {
    console.log('[RAG Widget] Add to cart:', product.id);

    // Update internal cart state
    const existingItem = this.cart.get(product.id);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.set(product.id, {
        product: product,
        quantity: 1
      });
    }

    // Call merchant's callback if configured
    if (this.config.integration?.addToCartCallback) {
      try {
        this.config.integration.addToCartCallback(product);
        console.log('[RAG Widget] addToCartCallback executed successfully');
      } catch (error) {
        console.error('[RAG Widget] Error in addToCartCallback:', error);
      }
    } else {
      console.warn('[RAG Widget] No addToCartCallback configured');
      // Show a user-friendly message
      this.showNotification('Added to cart! Configure addToCartCallback to integrate with your cart.');
    }

    // Track analytics
    if (this.config.integration?.analyticsCallback) {
      try {
        this.config.integration.analyticsCallback({
          event: 'add_to_cart',
          productId: product.id,
          timestamp: new Date(),
          metadata: {
            productTitle: product.title,
            price: product.price,
            currency: product.currency
          }
        });
      } catch (error) {
        console.error('[RAG Widget] Error in analyticsCallback:', error);
      }
    }
  }

  /**
   * Handle checkout action
   */
  private handleCheckout(): void {
    console.log('[RAG Widget] Checkout initiated');

    const cartItems = Array.from(this.cart.values());

    if (cartItems.length === 0) {
      this.showNotification('Your cart is empty');
      return;
    }

    // Call merchant's checkout callback if configured
    if (this.config.integration?.checkoutCallback) {
      try {
        this.config.integration.checkoutCallback(cartItems);
        console.log('[RAG Widget] checkoutCallback executed successfully');
        
        // Clear cart after successful checkout
        this.cart.clear();
      } catch (error) {
        console.error('[RAG Widget] Error in checkoutCallback:', error);
        this.showNotification('Checkout failed. Please try again.');
      }
    } else {
      console.warn('[RAG Widget] No checkoutCallback configured');
      this.showNotification('Configure checkoutCallback to enable checkout.');
    }

    // Track analytics
    if (this.config.integration?.analyticsCallback) {
      try {
        this.config.integration.analyticsCallback({
          event: 'checkout_initiated',
          timestamp: new Date(),
          metadata: {
            itemCount: cartItems.length,
            totalValue: cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
          }
        });
      } catch (error) {
        console.error('[RAG Widget] Error in analyticsCallback:', error);
      }
    }
  }

  /**
   * Get current cart items
   */
  getCartItems(): CartItem[] {
    return Array.from(this.cart.values());
  }

  /**
   * Clear the cart
   */
  clearCart(): void {
    this.cart.clear();
  }

  /**
   * Show a notification to the user
   */
  private showNotification(message: string): void {
    // Create a simple toast notification
    const notification = document.createElement('div');
    notification.className = 'rag-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Format price for display
   */
  private formatPrice(price: number, currency: string = 'USD'): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(price);
    } catch (error) {
      return `$${price.toFixed(2)}`;
    }
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength).trim() + '...';
  }
}
