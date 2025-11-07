import { Message, StorageData } from '../types';

/**
 * LocalStorage management for widget state persistence
 */
export class Storage {
  private storageKey: string;
  private merchantId: string;

  constructor(merchantId: string) {
    this.merchantId = merchantId;
    this.storageKey = `rag_assistant_${merchantId}`;
  }

  /**
   * Get session ID from storage
   */
  getSessionId(): string | null {
    const data = this.getData();
    return data?.sessionId || null;
  }

  /**
   * Set session ID in storage
   */
  setSessionId(sessionId: string): void {
    const data = this.getData() || this.getEmptyData();
    data.sessionId = sessionId;
    data.lastUpdated = new Date();
    this.setData(data);
  }

  /**
   * Get session created at timestamp
   */
  getSessionCreatedAt(): Date | null {
    const data = this.getData();
    return data?.sessionCreatedAt ? new Date(data.sessionCreatedAt) : null;
  }

  /**
   * Set session created at timestamp
   */
  setSessionCreatedAt(date: Date): void {
    const data = this.getData() || this.getEmptyData();
    data.sessionCreatedAt = date;
    data.lastUpdated = new Date();
    this.setData(data);
  }

  /**
   * Clear session data (but keep history)
   */
  clearSession(): void {
    const data = this.getData() || this.getEmptyData();
    data.sessionId = null;
    data.sessionCreatedAt = null;
    data.lastUpdated = new Date();
    this.setData(data);
  }

  /**
   * Get user ID from storage
   */
  getUserId(): string | null {
    const data = this.getData();
    return data?.userId || null;
  }

  /**
   * Set user ID in storage
   */
  setUserId(userId: string): void {
    const data = this.getData() || this.getEmptyData();
    data.userId = userId;
    data.lastUpdated = new Date();
    this.setData(data);
  }

  /**
   * Get conversation history from storage
   */
  getHistory(): Message[] {
    const data = this.getData();
    if (!data || !data.history) {
      return [];
    }

    // Convert stored dates back to Date objects
    return data.history.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  }

  /**
   * Add a message to history
   */
  addMessage(message: Message): void {
    const data = this.getData() || this.getEmptyData();
    data.history.push(message);
    data.lastUpdated = new Date();

    // Keep only last 50 messages to avoid storage limits
    if (data.history.length > 50) {
      data.history = data.history.slice(-50);
    }

    this.setData(data);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    const data = this.getData() || this.getEmptyData();
    data.history = [];
    data.lastUpdated = new Date();
    this.setData(data);
  }

  /**
   * Replace entire conversation history
   * More efficient than clearing and adding messages one by one
   */
  setHistory(messages: Message[]): void {
    const data = this.getData() || this.getEmptyData();
    data.history = messages;
    data.lastUpdated = new Date();

    // Keep only last 50 messages to avoid storage limits
    if (data.history.length > 50) {
      data.history = data.history.slice(-50);
    }

    this.setData(data);
  }

  /**
   * Clear all storage data
   */
  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('[RAG Widget] Failed to clear storage:', error);
    }
  }

  /**
   * Get all data from storage
   */
  private getData(): StorageData | null {
    try {
      const item = localStorage.getItem(this.storageKey);
      if (!item) {
        return null;
      }

      const data = JSON.parse(item) as StorageData;

      // Check if data is stale (older than 7 days)
      const lastUpdated = new Date(data.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 7) {
        this.clear();
        return null;
      }

      return data;
    } catch (error) {
      console.error('[RAG Widget] Failed to get storage data:', error);
      return null;
    }
  }

  /**
   * Set data in storage
   */
  private setData(data: StorageData): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('[RAG Widget] Failed to set storage data:', error);
      
      // If quota exceeded, clear old data and retry
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clear();
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (retryError) {
          console.error('[RAG Widget] Failed to set storage data after clearing:', retryError);
        }
      }
    }
  }

  /**
   * Get empty storage data structure
   */
  private getEmptyData(): StorageData {
    return {
      sessionId: null,
      userId: null,
      sessionCreatedAt: null,
      history: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}
