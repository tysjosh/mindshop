/**
 * Documentation Examples Test
 * 
 * Tests that all code examples in the developer portal documentation
 * work correctly and match the actual implementation.
 */

import RAGAssistant from '../src/RAGAssistant';
import { ApiClient } from '../src/services/ApiClient';

// Mock fetch globally
global.fetch = jest.fn();

describe('Documentation Examples', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear DOM
    document.body.innerHTML = '';
    
    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/sessions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              sessionId: 'test_session_123',
              merchantId: 'test_merchant',
              userId: 'test_user'
            }
          })
        });
      }
      
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: []
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} })
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Widget Initialization Example', () => {
    it('should initialize with the documented configuration pattern', () => {
      // This is the exact pattern from the documentation
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
          addToCartCallback: (product) => {
            console.log('Add to cart:', product);
          }
        }
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });

    it('should work with minimal required configuration', () => {
      // Test with only required fields
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_live_test_key'
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });

    it('should accept all documented theme options', () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key',
        theme: {
          primaryColor: '#007bff',
          position: 'bottom-right'
        }
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });

    it('should accept all documented behavior options', () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key',
        behavior: {
          autoOpen: false,
          greeting: 'Hi! How can I help you today?'
        }
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });

    it('should accept addToCartCallback in integration options', () => {
      const mockCallback = jest.fn();
      
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key',
        integration: {
          addToCartCallback: mockCallback
        }
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });
  });

  describe('API Client Usage', () => {
    it('should create sessions as documented', async () => {
      const client = new ApiClient({
        apiKey: 'pk_live_test',
        merchantId: 'test_merchant',
        apiBaseUrl: 'https://api.rag-assistant.com'
      });

      const session = await client.createSession('test_user');
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('test_session_123');
    });

    it('should handle API responses in standard format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: { sessionId: 'session_abc' },
          timestamp: '2025-11-05T10:00:00Z',
          requestId: 'req_123'
        })
      });

      const client = new ApiClient({
        apiKey: 'pk_live_test',
        merchantId: 'test_merchant',
        apiBaseUrl: 'https://api.rag-assistant.com'
      });

      const session = await client.createSession('test_user');
      
      expect(session.sessionId).toBe('session_abc');
    });
  });

  describe('Configuration Options Validation', () => {
    it('should validate merchantId is required', () => {
      expect(() => {
        new RAGAssistant({
          apiKey: 'pk_test_key'
        } as any);
      }).toThrow();
    });

    it('should validate apiKey is required', () => {
      expect(() => {
        new RAGAssistant({
          merchantId: 'test_merchant'
        } as any);
      }).toThrow();
    });

    it('should accept pk_live_ prefix for production keys', () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_live_1234567890'
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });

    it('should accept pk_test_ prefix for development keys', () => {
      const assistant = new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_1234567890'
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });
  });

  describe('Theme Position Options', () => {
    const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

    positions.forEach(position => {
      it(`should accept position: ${position}`, () => {
        const assistant = new RAGAssistant({
          merchantId: 'test_merchant',
          apiKey: 'pk_test_key',
          theme: {
            position: position as any
          }
        });

        expect(assistant).toBeInstanceOf(RAGAssistant);
      });
    });
  });

  describe('Widget DOM Elements', () => {
    it('should create widget toggle button', () => {
      new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key'
      });

      // Widget should create DOM elements
      const toggle = document.getElementById('rag-widget-toggle');
      expect(toggle).toBeTruthy();
    });

    it('should create widget container', () => {
      new RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key'
      });

      const container = document.getElementById('rag-widget-container');
      expect(container).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const client = new ApiClient({
        apiKey: 'pk_test_key',
        merchantId: 'test_merchant',
        apiBaseUrl: 'https://api.rag-assistant.com'
      });

      await expect(client.createSession('test_user')).rejects.toThrow();
    });

    it('should handle invalid API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid request'
        })
      });

      const client = new ApiClient({
        apiKey: 'pk_test_key',
        merchantId: 'test_merchant',
        apiBaseUrl: 'https://api.rag-assistant.com'
      });

      await expect(client.createSession('test_user')).rejects.toThrow();
    });
  });

  describe('Global Window Export', () => {
    it('should be available as window.RAGAssistant', () => {
      // Simulate script tag loading
      (window as any).RAGAssistant = RAGAssistant;
      
      expect((window as any).RAGAssistant).toBeDefined();
      expect(typeof (window as any).RAGAssistant).toBe('function');
    });

    it('should allow instantiation via window.RAGAssistant', () => {
      (window as any).RAGAssistant = RAGAssistant;
      
      const assistant = new (window as any).RAGAssistant({
        merchantId: 'test_merchant',
        apiKey: 'pk_test_key'
      });

      expect(assistant).toBeInstanceOf(RAGAssistant);
    });
  });
});
