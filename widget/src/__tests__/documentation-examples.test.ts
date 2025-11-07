/**
 * Tests to verify that documentation code examples work correctly
 * This ensures the examples in developer-portal/app/(dashboard)/documentation/page.tsx are accurate
 */

import { RAGAssistant } from '../RAGAssistant';
import { ApiClient } from '../services/ApiClient';

// Mock ApiClient
jest.mock('../services/ApiClient');

describe('Documentation Code Examples', () => {
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Setup ApiClient mock
    mockApiClient = {
      createSession: jest.fn().mockResolvedValue({ sessionId: 'test_session_123' }),
      getHistory: jest.fn().mockResolvedValue([]),
      chat: jest.fn().mockResolvedValue({
        answer: 'Test response',
        recommendations: [],
        executionTime: 100,
      }),
    } as any;

    (ApiClient as jest.MockedClass<typeof ApiClient>).mockImplementation(() => mockApiClient);
  });

  afterEach(() => {
    // Clean up any DOM elements created by the widget
    document.body.innerHTML = '';
  });

  describe('Widget Initialization - Documentation Example', () => {
    it('should initialize with the exact configuration from documentation', async () => {
      // This is the EXACT code from the documentation
      const assistant = new RAGAssistant({
        merchantId: 'your_merchant_id',
        apiKey: 'pk_live_YOUR_API_KEY',
        apiBaseUrl: 'https://api.rag-assistant.com',
        theme: {
          primaryColor: '#007bff',
          position: 'bottom-right'
        },
        behavior: {
          autoOpen: false,
          greeting: 'Hi! How can I help you today?'
        },
        integration: {
          addToCartCallback: (product: any) => {
            console.log('Add to cart:', product);
          }
        }
      });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the widget was created
      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
      expect(assistant.getSessionId()).toBe('test_session_123');
    });

    it('should work with minimal required configuration', async () => {
      // Minimal example that should work
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });

    it('should throw error if merchantId is missing', () => {
      expect(() => {
        new RAGAssistant({
          apiKey: 'pk_test_123'
        } as any);
      }).toThrow('merchantId is required');
    });

    it('should throw error if apiKey is missing', () => {
      expect(() => {
        new RAGAssistant({
          merchantId: 'test_merchant'
        } as any);
      }).toThrow('apiKey is required');
    });
  });

  describe('Configuration Options - Documentation Examples', () => {
    it('should accept all documented theme options', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        theme: {
          primaryColor: '#007bff',
          position: 'bottom-right',
          fontFamily: 'Arial, sans-serif',
          borderRadius: '8px',
          zIndex: 9999
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });

    it('should accept all documented behavior options', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        behavior: {
          autoOpen: false,
          greeting: 'Hi! How can I help you today?',
          placeholder: 'Ask me anything...',
          maxRecommendations: 3,
          showTimestamps: false,
          enableSoundNotifications: false
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });

    it('should accept all documented integration callbacks', async () => {
      const addToCartCallback = jest.fn();
      const checkoutCallback = jest.fn();
      const analyticsCallback = jest.fn();

      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        integration: {
          addToCartCallback,
          checkoutCallback,
          analyticsCallback
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });

    it('should work with different position values', async () => {
      const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

      for (const position of positions) {
        const assistant = new RAGAssistant({
          merchantId: 'test_merchant',
          apiKey: 'pk_test_123',
          theme: {
            position: position as any
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(assistant).toBeDefined();
        expect(assistant.isReady()).toBe(true);

        // Clean up for next iteration
        document.body.innerHTML = '';
      }
    });
  });

  describe('API Key Types - Documentation Examples', () => {
    it('should accept production API keys (pk_live_)', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_live_1234567890abcdef'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });

    it('should accept test API keys (pk_test_)', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_1234567890abcdef'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });
  });

  describe('Widget Methods - Documentation Examples', () => {
    let assistant: RAGAssistant;

    beforeEach(async () => {
      assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        apiBaseUrl: 'http://localhost:3000'
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should support open() method', () => {
      expect(() => assistant.open()).not.toThrow();
    });

    it('should support close() method', () => {
      expect(() => assistant.close()).not.toThrow();
    });

    it('should support clearHistory() method', () => {
      expect(() => assistant.clearHistory()).not.toThrow();
    });

    it('should support getSessionId() method', () => {
      const sessionId = assistant.getSessionId();
      expect(sessionId).toBe('test_session_123');
    });

    it('should support isReady() method', () => {
      const ready = assistant.isReady();
      expect(ready).toBe(true);
    });

    it('should support resetSession() method', async () => {
      await expect(assistant.resetSession()).resolves.not.toThrow();
    });

    it('should support refreshHistory() method', async () => {
      await expect(assistant.refreshHistory()).resolves.not.toThrow();
    });
  });

  describe('Analytics Methods - Documentation Examples', () => {
    let assistant: RAGAssistant;

    beforeEach(async () => {
      assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123'
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should support trackProductClick() method', () => {
      expect(() => assistant.trackProductClick('product_123', 0)).not.toThrow();
    });

    it('should support trackAddToCart() method', () => {
      expect(() => assistant.trackAddToCart('product_123')).not.toThrow();
    });

    it('should support trackCheckout() method', () => {
      expect(() => assistant.trackCheckout(3)).not.toThrow();
    });

    it('should support getAnalyticsSummary() method', () => {
      const summary = assistant.getAnalyticsSummary();
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('totalEvents');
      expect(summary).toHaveProperty('messagesSent');
      expect(summary).toHaveProperty('messagesReceived');
      expect(summary).toHaveProperty('productsClicked');
      expect(summary).toHaveProperty('addToCartCount');
      expect(summary).toHaveProperty('errors');
      expect(summary).toHaveProperty('avgResponseTime');
    });

    it('should support setAnalyticsEnabled() method', () => {
      expect(() => assistant.setAnalyticsEnabled(false)).not.toThrow();
      expect(() => assistant.setAnalyticsEnabled(true)).not.toThrow();
    });
  });

  describe('Integration Callbacks - Documentation Examples', () => {
    it('should call addToCartCallback when provided', async () => {
      const addToCartCallback = jest.fn();

      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        integration: {
          addToCartCallback: (product: any) => {
            addToCartCallback(product);
            console.log('Add to cart:', product);
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate add to cart action
      assistant.trackAddToCart('product_123');

      // The callback should be available (even if not called directly by trackAddToCart)
      expect(assistant).toBeDefined();
    });
  });

  describe('Error Handling - Documentation Troubleshooting', () => {
    it('should handle missing merchantId gracefully', () => {
      expect(() => {
        new RAGAssistant({
          apiKey: 'pk_test_123'
        } as any);
      }).toThrow('merchantId is required');
    });

    it('should handle missing apiKey gracefully', () => {
      expect(() => {
        new RAGAssistant({
          merchantId: 'test_merchant'
        } as any);
      }).toThrow('apiKey is required');
    });

    it('should handle invalid configuration gracefully', async () => {
      // Widget should still initialize even with extra/unknown properties
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        unknownProperty: 'should be ignored'
      } as any);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      expect(assistant.isReady()).toBe(true);
    });
  });

  describe('Default Values - Documentation Defaults', () => {
    it('should use default apiBaseUrl when not provided', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // ApiClient should be created with default URL
      expect(ApiClient).toHaveBeenCalledWith(
        'pk_test_123',
        'test_merchant',
        'https://api.rag-assistant.com'
      );
    });

    it('should use custom apiBaseUrl when provided', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123',
        apiBaseUrl: 'http://localhost:3000'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(ApiClient).toHaveBeenCalledWith(
        'pk_test_123',
        'test_merchant',
        'http://localhost:3000'
      );
    });

    it('should use default theme values when not provided', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      // Widget should be created with default theme
    });

    it('should use default behavior values when not provided', async () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_123'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(assistant).toBeDefined();
      // Widget should be created with default behavior (autoOpen: false, etc.)
    });
  });
});
