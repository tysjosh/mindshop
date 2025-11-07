import { RAGConfig, Message } from '../types';
import { ProductCard } from './ProductCard';

/**
 * Message list component for displaying chat messages
 */
export class MessageList {
  private config: RAGConfig;
  private container: HTMLElement | null = null;
  private messages: Message[] = [];
  private productCard: ProductCard;

  constructor(config: RAGConfig) {
    this.config = config;
    this.productCard = new ProductCard(config);
  }

  /**
   * Render the message list
   */
  render(container: HTMLElement): void {
    this.container = container;
    this.container.className = 'rag-message-list';
    this.updateView();
  }

  /**
   * Add a message to the list
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    this.updateView();
    this.scrollToBottom();
  }

  /**
   * Show typing indicator
   */
  showTyping(): void {
    if (!this.container) return;

    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'rag-typing-indicator';
    typingIndicator.className = 'rag-message rag-message-assistant';
    typingIndicator.innerHTML = `
      <div class="rag-message-content">
        <div class="rag-typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    this.container.appendChild(typingIndicator);
    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTyping(): void {
    if (!this.container) return;

    const typingIndicator = this.container.querySelector('#rag-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.messages = [];
    this.updateView();
  }

  /**
   * Update the view with current messages
   */
  private updateView(): void {
    if (!this.container) return;

    // Clear container (except typing indicator)
    const typingIndicator = this.container.querySelector('#rag-typing-indicator');
    this.container.innerHTML = '';

    // Render messages
    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      this.container!.appendChild(messageElement);
    });

    // Re-add typing indicator if it existed
    if (typingIndicator) {
      this.container.appendChild(typingIndicator);
    }
  }

  /**
   * Create a message element
   */
  private createMessageElement(message: Message): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `rag-message rag-message-${message.role}`;

    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'rag-message-content';
    contentDiv.textContent = message.content;

    messageDiv.appendChild(contentDiv);

    // Timestamp (if enabled)
    if (this.config.behavior?.showTimestamps) {
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'rag-message-timestamp';
      timestampDiv.textContent = this.formatTimestamp(message.timestamp);
      messageDiv.appendChild(timestampDiv);
    }

    // Product recommendations (if any)
    if (message.recommendations && message.recommendations.length > 0) {
      const maxRecommendations = this.config.behavior?.maxRecommendations || 3;
      const recommendations = message.recommendations.slice(0, maxRecommendations);

      const recommendationsDiv = document.createElement('div');
      recommendationsDiv.className = 'rag-message-recommendations';

      recommendations.forEach(product => {
        const productElement = this.productCard.create(product);
        recommendationsDiv.appendChild(productElement);
      });

      messageDiv.appendChild(recommendationsDiv);

      // Add checkout button if multiple products and checkout callback is configured
      if (recommendations.length > 1 && this.config.integration?.checkoutCallback) {
        const checkoutButton = document.createElement('button');
        checkoutButton.className = 'rag-checkout-button';
        checkoutButton.textContent = 'Checkout All';
        checkoutButton.onclick = () => this.handleCheckoutAll(recommendations);
        recommendationsDiv.appendChild(checkoutButton);
      }
    }

    return messageDiv;
  }

  /**
   * Handle checkout all products from recommendations
   */
  private handleCheckoutAll(products: any[]): void {
    console.log('[RAG Widget] Checkout all products:', products.length);

    // Convert products to cart items with quantity 1
    const cartItems = products.map(product => ({
      product: product,
      quantity: 1
    }));

    // Call merchant's checkout callback if configured
    if (this.config.integration?.checkoutCallback) {
      try {
        this.config.integration.checkoutCallback(cartItems);
        console.log('[RAG Widget] checkoutCallback executed successfully');
      } catch (error) {
        console.error('[RAG Widget] Error in checkoutCallback:', error);
      }
    }

    // Track analytics
    if (this.config.integration?.analyticsCallback) {
      try {
        this.config.integration.analyticsCallback({
          event: 'checkout_all_recommendations',
          timestamp: new Date(),
          metadata: {
            itemCount: cartItems.length,
            totalValue: cartItems.reduce((sum, item) => sum + item.product.price, 0)
          }
        });
      } catch (error) {
        console.error('[RAG Widget] Error in analyticsCallback:', error);
      }
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Scroll to bottom of message list
   */
  private scrollToBottom(): void {
    if (!this.container) return;

    setTimeout(() => {
      this.container!.scrollTop = this.container!.scrollHeight;
    }, 100);
  }
}
