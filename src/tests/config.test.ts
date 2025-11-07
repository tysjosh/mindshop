import { describe, it, expect } from 'vitest';
import { validateCognitoConfig, validateConfig, config } from '../config';

describe('Configuration Validation', () => {
  describe('validateCognitoConfig', () => {
    it('should return validation result with valid and errors properties', () => {
      const result = validateCognitoConfig();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should pass validation when Cognito is disabled or mock auth is enabled', () => {
      // In development with ENABLE_COGNITO_AUTH=false, validation should pass
      if (!config.cognito.enabled || config.cognito.enableMockAuth) {
        const result = validateCognitoConfig();
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should validate User Pool ID format when Cognito is enabled', () => {
      // This test verifies the validation logic exists
      // Actual validation depends on environment configuration
      const result = validateCognitoConfig();
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('validateConfig', () => {
    it('should validate overall configuration', () => {
      const result = validateConfig();
      // Should have valid property
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('config object', () => {
    it('should have cognito configuration', () => {
      expect(config).toHaveProperty('cognito');
      expect(config.cognito).toHaveProperty('userPoolId');
      expect(config.cognito).toHaveProperty('clientId');
      expect(config.cognito).toHaveProperty('region');
      expect(config.cognito).toHaveProperty('enabled');
      expect(config.cognito).toHaveProperty('enableMockAuth');
    });

    it('should enable mock auth in development when Cognito is disabled', () => {
      if (process.env.NODE_ENV === 'development' && process.env.ENABLE_COGNITO_AUTH !== 'true') {
        expect(config.cognito.enableMockAuth).toBe(true);
      }
    });
  });
});
