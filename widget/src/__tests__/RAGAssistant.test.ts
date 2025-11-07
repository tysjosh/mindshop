/**
 * Tests for RAGAssistant configuration merging
 */

import { RAGAssistant } from '../RAGAssistant';
import { RAGConfig } from '../types';

// Mock the dependencies
jest.mock('../services/ApiClient');
jest.mock('../services/Storage');
jest.mock('../components/ChatWidget');

describe('RAGAssistant Configuration Merging', () => {
  const baseConfig: RAGConfig = {
    merchantId: 'test_merchant',
    apiKey: 'test_key'
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Default Configuration', () => {
    it('should apply default theme values when no theme is provided', () => {
      const assistant = new RAGAssistant(baseConfig);
      const config = (assistant as any).config;

      expect(config.theme).toEqual({
        primaryColor: '#007bff',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '8px',
        position: 'bottom-right',
        zIndex: 9999
      });
    });

    it('should apply default behavior values when no behavior is provided', () => {
      const assistant = new RAGAssistant(baseConfig);
      const config = (assistant as any).config;

      expect(config.behavior).toEqual({
        autoOpen: false,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 3,
        showTimestamps: false,
        enableSoundNotifications: false
      });
    });

    it('should apply default apiBaseUrl when not provided', () => {
      const assistant = new RAGAssistant(baseConfig);
      const config = (assistant as any).config;

      expect(config.apiBaseUrl).toBe('https://api.rag-assistant.com');
    });
  });

  describe('Partial Configuration Override', () => {
    it('should merge partial theme configuration with defaults', () => {
      const configWithTheme: RAGConfig = {
        ...baseConfig,
        theme: {
          primaryColor: '#ff0000',
          position: 'top-left'
        }
      };

      const assistant = new RAGAssistant(configWithTheme);
      const config = (assistant as any).config;

      expect(config.theme).toEqual({
        primaryColor: '#ff0000',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '8px',
        position: 'top-left',
        zIndex: 9999
      });
    });

    it('should merge partial behavior configuration with defaults', () => {
      const configWithBehavior: RAGConfig = {
        ...baseConfig,
        behavior: {
          autoOpen: true,
          maxRecommendations: 5
        }
      };

      const assistant = new RAGAssistant(configWithBehavior);
      const config = (assistant as any).config;

      expect(config.behavior).toEqual({
        autoOpen: true,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 5,
        showTimestamps: false,
        enableSoundNotifications: false
      });
    });

    it('should override apiBaseUrl when provided', () => {
      const configWithUrl: RAGConfig = {
        ...baseConfig,
        apiBaseUrl: 'https://custom-api.example.com'
      };

      const assistant = new RAGAssistant(configWithUrl);
      const config = (assistant as any).config;

      expect(config.apiBaseUrl).toBe('https://custom-api.example.com');
    });
  });

  describe('Complete Configuration Override', () => {
    it('should use all provided theme values', () => {
      const configWithFullTheme: RAGConfig = {
        ...baseConfig,
        theme: {
          primaryColor: '#00ff00',
          fontFamily: 'Helvetica, sans-serif',
          borderRadius: '12px',
          position: 'bottom-left',
          zIndex: 10000
        }
      };

      const assistant = new RAGAssistant(configWithFullTheme);
      const config = (assistant as any).config;

      expect(config.theme).toEqual({
        primaryColor: '#00ff00',
        fontFamily: 'Helvetica, sans-serif',
        borderRadius: '12px',
        position: 'bottom-left',
        zIndex: 10000
      });
    });

    it('should use all provided behavior values', () => {
      const configWithFullBehavior: RAGConfig = {
        ...baseConfig,
        behavior: {
          autoOpen: true,
          greeting: 'Welcome! How may I assist you?',
          placeholder: 'Type your question here...',
          maxRecommendations: 10,
          showTimestamps: true,
          enableSoundNotifications: true
        }
      };

      const assistant = new RAGAssistant(configWithFullBehavior);
      const config = (assistant as any).config;

      expect(config.behavior).toEqual({
        autoOpen: true,
        greeting: 'Welcome! How may I assist you?',
        placeholder: 'Type your question here...',
        maxRecommendations: 10,
        showTimestamps: true,
        enableSoundNotifications: true
      });
    });
  });

  describe('Integration Callbacks', () => {
    it('should preserve integration callbacks when provided', () => {
      const addToCartCallback = jest.fn();
      const checkoutCallback = jest.fn();
      const analyticsCallback = jest.fn();

      const configWithCallbacks: RAGConfig = {
        ...baseConfig,
        integration: {
          addToCartCallback,
          checkoutCallback,
          analyticsCallback
        }
      };

      const assistant = new RAGAssistant(configWithCallbacks);
      const config = (assistant as any).config;

      expect(config.integration.addToCartCallback).toBe(addToCartCallback);
      expect(config.integration.checkoutCallback).toBe(checkoutCallback);
      expect(config.integration.analyticsCallback).toBe(analyticsCallback);
    });

    it('should set integration callbacks to undefined when not provided', () => {
      const assistant = new RAGAssistant(baseConfig);
      const config = (assistant as any).config;

      expect(config.integration.addToCartCallback).toBeUndefined();
      expect(config.integration.checkoutCallback).toBeUndefined();
      expect(config.integration.analyticsCallback).toBeUndefined();
    });
  });

  describe('Deep Merge Behavior', () => {
    it('should not affect unrelated configuration sections', () => {
      const configWithTheme: RAGConfig = {
        ...baseConfig,
        theme: {
          primaryColor: '#ff0000'
        }
      };

      const assistant = new RAGAssistant(configWithTheme);
      const config = (assistant as any).config;

      // Behavior should still have all defaults
      expect(config.behavior).toEqual({
        autoOpen: false,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 3,
        showTimestamps: false,
        enableSoundNotifications: false
      });
    });

    it('should handle nested object merging correctly', () => {
      const configWithMixed: RAGConfig = {
        ...baseConfig,
        theme: {
          primaryColor: '#ff0000'
        },
        behavior: {
          greeting: 'Hello!'
        }
      };

      const assistant = new RAGAssistant(configWithMixed);
      const config = (assistant as any).config;

      // Theme should have one override and rest defaults
      expect(config.theme.primaryColor).toBe('#ff0000');
      expect(config.theme.fontFamily).toBe('Arial, sans-serif');

      // Behavior should have one override and rest defaults
      expect(config.behavior.greeting).toBe('Hello!');
      expect(config.behavior.autoOpen).toBe(false);
    });
  });

  describe('Required Fields', () => {
    it('should throw error when merchantId is missing', () => {
      expect(() => {
        new RAGAssistant({ apiKey: 'test_key' } as RAGConfig);
      }).toThrow('merchantId is required');
    });

    it('should throw error when apiKey is missing', () => {
      expect(() => {
        new RAGAssistant({ merchantId: 'test_merchant' } as RAGConfig);
      }).toThrow('apiKey is required');
    });

    it('should not throw error when both required fields are provided', () => {
      expect(() => {
        new RAGAssistant(baseConfig);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty theme object', () => {
      const configWithEmptyTheme: RAGConfig = {
        ...baseConfig,
        theme: {}
      };

      const assistant = new RAGAssistant(configWithEmptyTheme);
      const config = (assistant as any).config;

      expect(config.theme).toEqual({
        primaryColor: '#007bff',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '8px',
        position: 'bottom-right',
        zIndex: 9999
      });
    });

    it('should handle empty behavior object', () => {
      const configWithEmptyBehavior: RAGConfig = {
        ...baseConfig,
        behavior: {}
      };

      const assistant = new RAGAssistant(configWithEmptyBehavior);
      const config = (assistant as any).config;

      expect(config.behavior).toEqual({
        autoOpen: false,
        greeting: 'Hi! How can I help you today?',
        placeholder: 'Ask me anything...',
        maxRecommendations: 3,
        showTimestamps: false,
        enableSoundNotifications: false
      });
    });

    it('should handle zero values correctly', () => {
      const configWithZero: RAGConfig = {
        ...baseConfig,
        behavior: {
          maxRecommendations: 0
        },
        theme: {
          zIndex: 0
        }
      };

      const assistant = new RAGAssistant(configWithZero);
      const config = (assistant as any).config;

      expect(config.behavior.maxRecommendations).toBe(0);
      expect(config.theme.zIndex).toBe(0);
    });

    it('should handle false boolean values correctly', () => {
      const configWithFalse: RAGConfig = {
        ...baseConfig,
        behavior: {
          autoOpen: false,
          showTimestamps: false,
          enableSoundNotifications: false
        }
      };

      const assistant = new RAGAssistant(configWithFalse);
      const config = (assistant as any).config;

      expect(config.behavior.autoOpen).toBe(false);
      expect(config.behavior.showTimestamps).toBe(false);
      expect(config.behavior.enableSoundNotifications).toBe(false);
    });
  });
});
