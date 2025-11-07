import { AnalyticsEvent } from '../types';

/**
 * Analytics tracking service for widget events
 * Handles both internal tracking and external callback integration
 */
export class Analytics {
  private merchantId: string;
  private sessionId: string | null = null;
  private callback?: (event: AnalyticsEvent) => void;
  private eventQueue: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;

  constructor(merchantId: string, callback?: (event: AnalyticsEvent) => void) {
    this.merchantId = merchantId;
    this.callback = callback;
  }

  /**
   * Set the current session ID for tracking
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Enable or disable analytics tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Track widget initialization
   */
  trackWidgetInit(): void {
    this.track({
      event: 'widget_initialized',
      timestamp: new Date(),
      metadata: {
        merchantId: this.merchantId,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
      }
    });
  }

  /**
   * Track widget opened
   */
  trackWidgetOpened(): void {
    this.track({
      event: 'widget_opened',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Track widget closed
   */
  trackWidgetClosed(duration?: number): void {
    this.track({
      event: 'widget_closed',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        durationMs: duration
      }
    });
  }

  /**
   * Track message sent by user
   */
  trackMessageSent(query: string, responseTime?: number): void {
    this.track({
      event: 'message_sent',
      query,
      responseTime,
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        queryLength: query.length
      }
    });
  }

  /**
   * Track message received from assistant
   */
  trackMessageReceived(responseTime: number, hasRecommendations: boolean): void {
    this.track({
      event: 'message_received',
      responseTime,
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        hasRecommendations
      }
    });
  }

  /**
   * Track product recommendation clicked
   */
  trackProductClicked(productId: string, position: number): void {
    this.track({
      event: 'product_clicked',
      productId,
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        position
      }
    });
  }

  /**
   * Track add to cart action
   */
  trackAddToCart(productId: string): void {
    this.track({
      event: 'add_to_cart',
      productId,
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Track checkout initiated
   */
  trackCheckout(itemCount: number): void {
    this.track({
      event: 'checkout_initiated',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        itemCount
      }
    });
  }

  /**
   * Track error occurred
   */
  trackError(errorType: string, errorMessage: string): void {
    this.track({
      event: 'error_occurred',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        errorType,
        errorMessage: errorMessage.substring(0, 200) // Limit error message length
      }
    });
  }

  /**
   * Track session created
   */
  trackSessionCreated(sessionId: string): void {
    this.track({
      event: 'session_created',
      timestamp: new Date(),
      metadata: {
        sessionId
      }
    });
  }

  /**
   * Track session restored
   */
  trackSessionRestored(sessionId: string, messageCount: number): void {
    this.track({
      event: 'session_restored',
      timestamp: new Date(),
      metadata: {
        sessionId,
        messageCount
      }
    });
  }

  /**
   * Track history cleared
   */
  trackHistoryCleared(): void {
    this.track({
      event: 'history_cleared',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Track typing started
   */
  trackTypingStarted(): void {
    this.track({
      event: 'typing_started',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Track user engagement (time spent)
   */
  trackEngagement(durationMs: number, messageCount: number): void {
    this.track({
      event: 'engagement',
      timestamp: new Date(),
      metadata: {
        sessionId: this.sessionId,
        durationMs,
        messageCount
      }
    });
  }

  /**
   * Core tracking method
   */
  private track(event: AnalyticsEvent): void {
    if (!this.isEnabled) {
      return;
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Add to queue
    this.eventQueue.push(event);

    // Limit queue size
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift();
    }

    // Call external callback if provided
    if (this.callback) {
      try {
        this.callback(event);
      } catch (error) {
        console.error('[RAG Widget] Analytics callback error:', error);
      }
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[RAG Widget] Analytics:', event.event, event);
    }
  }

  /**
   * Get all tracked events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear event queue
   */
  clearEvents(): void {
    this.eventQueue = [];
  }

  /**
   * Get event count by type
   */
  getEventCount(eventType: string): number {
    return this.eventQueue.filter(e => e.event === eventType).length;
  }

  /**
   * Get session summary
   */
  getSessionSummary(): {
    totalEvents: number;
    messagesSent: number;
    messagesReceived: number;
    productsClicked: number;
    addToCartCount: number;
    errors: number;
    avgResponseTime: number;
  } {
    const messagesSent = this.getEventCount('message_sent');
    const messagesReceived = this.getEventCount('message_received');
    const productsClicked = this.getEventCount('product_clicked');
    const addToCartCount = this.getEventCount('add_to_cart');
    const errors = this.getEventCount('error_occurred');

    // Calculate average response time
    const responseTimeEvents = this.eventQueue.filter(
      e => e.event === 'message_received' && e.responseTime
    );
    const avgResponseTime = responseTimeEvents.length > 0
      ? responseTimeEvents.reduce((sum, e) => sum + (e.responseTime || 0), 0) / responseTimeEvents.length
      : 0;

    return {
      totalEvents: this.eventQueue.length,
      messagesSent,
      messagesReceived,
      productsClicked,
      addToCartCount,
      errors,
      avgResponseTime: Math.round(avgResponseTime)
    };
  }
}
