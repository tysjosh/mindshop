import { RAGConfig, Message } from './types';
import { ApiClient } from './services/ApiClient';
import { Storage } from './services/Storage';
import { Analytics } from './services/Analytics';
import { ChatWidget } from './components/ChatWidget';

/**
 * Main RAG Assistant class
 * Entry point for the widget
 */
export class RAGAssistant {
  private config: RAGConfig;
  private apiClient: ApiClient;
  private storage: Storage;
  private analytics: Analytics;
  private widget: ChatWidget;
  private sessionId: string | null = null;
  private isInitialized: boolean = false;
  private widgetOpenedAt: number | null = null;

  constructor(config: RAGConfig) {
    // Validate required config
    if (!config.merchantId) {
      throw new Error('merchantId is required');
    }
    if (!config.apiKey) {
      throw new Error('apiKey is required');
    }

    this.config = this.mergeWithDefaults(config);
    this.apiClient = new ApiClient(
      this.config.apiKey,
      this.config.merchantId,
      this.config.apiBaseUrl
    );
    this.storage = new Storage(this.config.merchantId);
    this.analytics = new Analytics(
      this.config.merchantId,
      this.config.integration?.analyticsCallback
    );
    this.widget = new ChatWidget(this.config, this.sendMessage.bind(this));

    // Initialize asynchronously
    this.init().catch(error => {
      console.error('[RAG Widget] Initialization failed:', error);
      this.analytics.trackError('initialization_failed', error.message);
    });
  }

  /**
   * Initialize the widget
   */
  private async init(): Promise<void> {
    try {
      // Check if localStorage is available
      if (!Storage.isAvailable()) {
        console.warn('[RAG Widget] localStorage is not available. History will not be persisted.');
      }

      // Load or create session with validation (this also loads history from server if restoring)
      await this.initializeSession();

      // Render widget first
      this.widget.render();

      // Load conversation history from storage (already synced with server if session was restored)
      const history = this.storage.getHistory();
      if (history.length > 0) {
        console.log('[RAG Widget] Loading', history.length, 'messages from history');
        this.widget.loadHistory(history);
      }

      // Auto-open if configured
      if (this.config.behavior?.autoOpen) {
        this.widget.open();
      }

      this.isInitialized = true;
      console.log('[RAG Widget] Initialized successfully with session:', this.sessionId);

      // Track widget initialization
      this.analytics.trackWidgetInit();
    } catch (error) {
      console.error('[RAG Widget] Initialization error:', error);
      this.analytics.trackError('initialization_error', (error as Error).message);
      throw error;
    }
  }

  /**
   * Initialize or restore session
   */
  private async initializeSession(): Promise<void> {
    // Try to restore existing session
    const existingSessionId = this.storage.getSessionId();
    const sessionCreatedAt = this.storage.getSessionCreatedAt();

    if (existingSessionId && sessionCreatedAt) {
      // Check if session is still valid (not expired)
      const sessionAge = Date.now() - sessionCreatedAt.getTime();
      const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge < maxSessionAge) {
        // Session is still valid, try to verify it and load history
        const isValid = await this.verifySessionAndLoadHistory(existingSessionId);
        if (isValid) {
          this.sessionId = existingSessionId;
          this.analytics.setSessionId(existingSessionId);
          const history = this.storage.getHistory();
          this.analytics.trackSessionRestored(existingSessionId, history.length);
          console.log('[RAG Widget] Restored existing session:', existingSessionId);
          return;
        } else {
          console.warn('[RAG Widget] Existing session is invalid, creating new session');
        }
      } else {
        console.log('[RAG Widget] Session expired, creating new session');
      }
    }

    // Create new session if no valid session exists
    this.sessionId = await this.createSession();
    this.storage.setSessionId(this.sessionId);
    this.storage.setSessionCreatedAt(new Date());
    this.analytics.setSessionId(this.sessionId);
    this.analytics.trackSessionCreated(this.sessionId);
    console.log('[RAG Widget] Created new session:', this.sessionId);
  }

  /**
   * Verify if a session is still valid and load its history
   */
  private async verifySessionAndLoadHistory(sessionId: string): Promise<boolean> {
    try {
      // Try to fetch session history to verify it exists
      const serverHistory = await this.apiClient.getHistory(sessionId, this.config.merchantId);
      
      // Sync server history with local storage
      await this.syncHistory(serverHistory);
      
      return true;
    } catch (error) {
      console.warn('[RAG Widget] Session verification failed:', error);
      return false;
    }
  }

  /**
   * Sync server history with local storage
   * Merges server history with local history, preferring server as source of truth
   */
  private async syncHistory(serverHistory: any[]): Promise<void> {
    try {
      // Get local history
      const localHistory = this.storage.getHistory();
      
      // Convert server history to Message format
      const serverMessages: Message[] = serverHistory.map(item => ({
        role: item.role || 'assistant',
        content: item.answer || item.content || item.query || '',
        recommendations: item.recommendations,
        timestamp: new Date(item.timestamp || item.createdAt || Date.now()),
        metadata: item.metadata
      }));

      // If server has messages, decide whether to sync
      if (serverMessages.length > 0) {
        const lastServerTimestamp = serverMessages[serverMessages.length - 1].timestamp.getTime();
        const lastLocalTimestamp = localHistory.length > 0 
          ? localHistory[localHistory.length - 1].timestamp.getTime() 
          : 0;

        if (lastServerTimestamp > lastLocalTimestamp || serverMessages.length !== localHistory.length) {
          // Server is more up-to-date or has different message count, replace local history
          console.log('[RAG Widget] Syncing history from server:', serverMessages.length, 'messages');
          
          // Replace local history with server history (more efficient)
          this.storage.setHistory(serverMessages);
          
          console.log('[RAG Widget] History synced successfully');
        } else {
          console.log('[RAG Widget] Local history is up-to-date');
        }
      } else if (localHistory.length > 0) {
        // Server has no history but local does - keep local
        console.log('[RAG Widget] Server has no history, keeping local history');
      }
    } catch (error) {
      console.error('[RAG Widget] Failed to sync history:', error);
      // Don't throw - continue with local history if sync fails
    }
  }

  /**
   * Send a message
   */
  async sendMessage(query: string): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[RAG Widget] Widget not initialized yet');
      return;
    }

    if (!this.sessionId) {
      console.error('[RAG Widget] No session ID available');
      this.widget.showError('Session error. Please refresh the page.');
      this.analytics.trackError('no_session', 'No session ID available');
      return;
    }

    // Add user message to UI
    this.widget.addMessage({
      role: 'user',
      content: query,
      timestamp: new Date()
    });

    // Show typing indicator
    this.widget.showTyping();

    const startTime = Date.now();

    try {
      // Call API
      const response = await this.apiClient.chat({
        query,
        sessionId: this.sessionId,
        merchantId: this.config.merchantId
      });

      const responseTime = Date.now() - startTime;

      // Hide typing indicator
      this.widget.hideTyping();

      // Add assistant response
      this.widget.addMessage({
        role: 'assistant',
        content: response.answer,
        recommendations: response.recommendations,
        timestamp: new Date()
      });

      // Save to storage
      this.storage.addMessage({
        role: 'user',
        content: query,
        timestamp: new Date()
      });
      this.storage.addMessage({
        role: 'assistant',
        content: response.answer,
        recommendations: response.recommendations,
        timestamp: new Date()
      });

      // Track analytics
      this.analytics.trackMessageSent(query, responseTime);
      this.analytics.trackMessageReceived(
        responseTime,
        !!(response.recommendations && response.recommendations.length > 0)
      );
    } catch (error: any) {
      this.widget.hideTyping();
      
      // Track error
      this.analytics.trackError('message_send_failed', error.message);
      
      // Check if session expired or invalid
      if (error.message?.includes('session') || error.message?.includes('401')) {
        console.warn('[RAG Widget] Session may be invalid, attempting recovery');
        await this.recoverSession();
        this.widget.showError('Session expired. Please try your message again.');
      } else {
        this.widget.showError(
          error.message || 'Sorry, something went wrong. Please try again.'
        );
      }
      
      console.error('[RAG Widget] Send message error:', error);
    }
  }

  /**
   * Recover from session errors by creating a new session
   */
  private async recoverSession(): Promise<void> {
    try {
      console.log('[RAG Widget] Attempting session recovery');
      
      // Clear old session
      this.storage.clearSession();
      
      // Create new session
      this.sessionId = await this.createSession();
      this.storage.setSessionId(this.sessionId);
      this.storage.setSessionCreatedAt(new Date());
      this.analytics.setSessionId(this.sessionId);
      this.analytics.trackSessionCreated(this.sessionId);
      
      console.log('[RAG Widget] Session recovered successfully:', this.sessionId);
    } catch (error) {
      console.error('[RAG Widget] Session recovery failed:', error);
      this.analytics.trackError('session_recovery_failed', (error as Error).message);
      throw new Error('Unable to recover session. Please refresh the page.');
    }
  }

  /**
   * Open the widget
   */
  open(): void {
    this.widget.open();
    this.widgetOpenedAt = Date.now();
    this.analytics.trackWidgetOpened();
  }

  /**
   * Close the widget
   */
  close(): void {
    this.widget.close();
    
    // Track duration if widget was opened
    if (this.widgetOpenedAt) {
      const duration = Date.now() - this.widgetOpenedAt;
      this.analytics.trackWidgetClosed(duration);
      this.widgetOpenedAt = null;
    } else {
      this.analytics.trackWidgetClosed();
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.storage.clearHistory();
    this.widget.clearMessages();
    this.analytics.trackHistoryCleared();
    console.log('[RAG Widget] History cleared');
  }

  /**
   * Reset session (clear history and create new session)
   */
  async resetSession(): Promise<void> {
    try {
      console.log('[RAG Widget] Resetting session');
      
      // Clear storage
      this.storage.clearSession();
      this.storage.clearHistory();
      
      // Create new session
      this.sessionId = await this.createSession();
      this.storage.setSessionId(this.sessionId);
      this.storage.setSessionCreatedAt(new Date());
      
      // Clear UI
      this.widget.clearMessages();
      
      console.log('[RAG Widget] Session reset successfully:', this.sessionId);
    } catch (error) {
      console.error('[RAG Widget] Failed to reset session:', error);
      throw error;
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if widget is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.sessionId !== null;
  }

  /**
   * Track product click (for recommendations)
   */
  trackProductClick(productId: string, position: number): void {
    this.analytics.trackProductClicked(productId, position);
  }

  /**
   * Track add to cart action
   */
  trackAddToCart(productId: string): void {
    this.analytics.trackAddToCart(productId);
  }

  /**
   * Track checkout initiated
   */
  trackCheckout(itemCount: number): void {
    this.analytics.trackCheckout(itemCount);
  }

  /**
   * Get analytics summary for current session
   */
  getAnalyticsSummary(): {
    totalEvents: number;
    messagesSent: number;
    messagesReceived: number;
    productsClicked: number;
    addToCartCount: number;
    errors: number;
    avgResponseTime: number;
  } {
    return this.analytics.getSessionSummary();
  }

  /**
   * Enable or disable analytics tracking
   */
  setAnalyticsEnabled(enabled: boolean): void {
    this.analytics.setEnabled(enabled);
  }

  /**
   * Refresh message history from server
   * Useful for syncing across multiple tabs or after network reconnection
   */
  async refreshHistory(): Promise<void> {
    if (!this.sessionId) {
      console.warn('[RAG Widget] Cannot refresh history: no active session');
      return;
    }

    try {
      console.log('[RAG Widget] Refreshing history from server');
      
      // Fetch latest history from server
      const serverHistory = await this.apiClient.getHistory(this.sessionId, this.config.merchantId);
      
      // Sync with local storage
      await this.syncHistory(serverHistory);
      
      // Reload UI with updated history
      const history = this.storage.getHistory();
      this.widget.clearMessages();
      this.widget.loadHistory(history);
      
      console.log('[RAG Widget] History refreshed successfully');
    } catch (error) {
      console.error('[RAG Widget] Failed to refresh history:', error);
      throw error;
    }
  }

  /**
   * Create a new session
   */
  private async createSession(): Promise<string> {
    try {
      const response = await this.apiClient.createSession({
        merchantId: this.config.merchantId,
        userId: this.storage.getUserId() || undefined
      });
      return response.sessionId;
    } catch (error) {
      console.error('[RAG Widget] Failed to create session:', error);
      // Generate a temporary session ID as fallback
      return `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
  }

  /**
   * Merge user config with defaults
   * Performs deep merge to ensure all nested properties are properly combined
   */
  private mergeWithDefaults(config: RAGConfig): RAGConfig {
    const defaults: Required<RAGConfig> = {
      merchantId: config.merchantId,
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl || 'https://api.rag-assistant.com',
      theme: {
        primaryColor: '#007bff',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '8px',
        position: 'bottom-right',
        zIndex: 9999
      },
      behavior: {
        autoOpen: false,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 3,
        showTimestamps: false,
        enableSoundNotifications: false
      },
      integration: {
        addToCartCallback: undefined,
        checkoutCallback: undefined,
        analyticsCallback: undefined
      }
    };

    return this.deepMerge(defaults, config);
  }

  /**
   * Deep merge two objects
   * User-provided values override defaults at all levels
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        // If both are objects (and not null/array), merge recursively
        if (
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          result[key] = this.deepMerge(targetValue, sourceValue) as T[Extract<keyof T, string>];
        } else if (sourceValue !== undefined) {
          // Otherwise, use source value if defined
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }

    return result;
  }
}

// Export for global access
export default RAGAssistant;
