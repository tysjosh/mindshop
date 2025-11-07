/**
 * Tests for authentication error handling and security logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthErrorCode,
  createAuthErrorResponse,
  getHttpStatusForError,
  parseJwtVerificationError,
  shouldAlertOnError,
} from '../api/middleware/authErrors';

describe('Authentication Error Handling', () => {
  describe('createAuthErrorResponse', () => {
    it('should create standardized error response for missing auth', () => {
      const response = createAuthErrorResponse(
        AuthErrorCode.AUTH_MISSING,
        'test-request-123'
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.details?.code).toBe(AuthErrorCode.AUTH_MISSING);
      expect(response.requestId).toBe('test-request-123');
      expect(response.timestamp).toBeDefined();
    });

    it('should create error response for expired token', () => {
      const response = createAuthErrorResponse(
        AuthErrorCode.TOKEN_EXPIRED,
        'test-request-456'
      );

      expect(response.success).toBe(false);
      expect(response.details?.code).toBe(AuthErrorCode.TOKEN_EXPIRED);
      expect(response.error).toContain('session has expired');
    });

    it('should include additional details when provided', () => {
      const response = createAuthErrorResponse(
        AuthErrorCode.TOKEN_MISSING_CLAIMS,
        'test-request-789',
        { missingClaim: 'merchant_id' }
      );

      expect(response.details?.missingClaim).toBe('merchant_id');
    });
  });

  describe('getHttpStatusForError', () => {
    it('should return 401 for authentication errors', () => {
      expect(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).toBe(401);
      expect(getHttpStatusForError(AuthErrorCode.TOKEN_EXPIRED)).toBe(401);
      expect(getHttpStatusForError(AuthErrorCode.TOKEN_INVALID)).toBe(401);
    });

    it('should return 403 for authorization errors', () => {
      expect(getHttpStatusForError(AuthErrorCode.ACCESS_DENIED)).toBe(403);
      expect(getHttpStatusForError(AuthErrorCode.INSUFFICIENT_PERMISSIONS)).toBe(403);
    });

    it('should return 429 for rate limit errors', () => {
      expect(getHttpStatusForError(AuthErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
    });

    it('should return 500 for system errors', () => {
      expect(getHttpStatusForError(AuthErrorCode.AUTH_SYSTEM_ERROR)).toBe(500);
    });
  });

  describe('shouldAlertOnError', () => {
    it('should alert on security-critical errors', () => {
      expect(shouldAlertOnError(AuthErrorCode.TOKEN_SIGNATURE_INVALID)).toBe(true);
      expect(shouldAlertOnError(AuthErrorCode.TOKEN_MISSING_CLAIMS)).toBe(true);
      expect(shouldAlertOnError(AuthErrorCode.ACCESS_DENIED)).toBe(true);
      expect(shouldAlertOnError(AuthErrorCode.RATE_LIMIT_EXCEEDED)).toBe(true);
    });

    it('should not alert on routine errors', () => {
      expect(shouldAlertOnError(AuthErrorCode.AUTH_MISSING)).toBe(false);
      expect(shouldAlertOnError(AuthErrorCode.TOKEN_EXPIRED)).toBe(false);
      expect(shouldAlertOnError(AuthErrorCode.API_KEY_EXPIRED)).toBe(false);
    });
  });

  describe('parseJwtVerificationError', () => {
    it('should parse expired token error', () => {
      const error = new Error('Token expired at 2024-01-01');
      expect(parseJwtVerificationError(error)).toBe(AuthErrorCode.TOKEN_EXPIRED);
    });

    it('should parse signature verification error', () => {
      const error = new Error('Invalid signature');
      expect(parseJwtVerificationError(error)).toBe(AuthErrorCode.TOKEN_SIGNATURE_INVALID);
    });

    it('should parse missing claims error', () => {
      const error = new Error('Missing required claim: sub');
      expect(parseJwtVerificationError(error)).toBe(AuthErrorCode.TOKEN_MISSING_CLAIMS);
    });

    it('should parse malformed token error', () => {
      const error = new Error('Malformed JWT token');
      expect(parseJwtVerificationError(error)).toBe(AuthErrorCode.TOKEN_INVALID);
    });

    it('should default to TOKEN_INVALID for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(parseJwtVerificationError(error)).toBe(AuthErrorCode.TOKEN_INVALID);
    });
  });

  describe('Error Response Format', () => {
    it('should have consistent structure across all error types', () => {
      const errorCodes = [
        AuthErrorCode.AUTH_MISSING,
        AuthErrorCode.TOKEN_EXPIRED,
        AuthErrorCode.ACCESS_DENIED,
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
      ];

      errorCodes.forEach(code => {
        const response = createAuthErrorResponse(code, 'test-request');
        
        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('error');
        expect(response).toHaveProperty('message');
        expect(response).toHaveProperty('details');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('requestId');
        
        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(typeof response.message).toBe('string');
        expect(typeof response.timestamp).toBe('string');
      });
    });

    it('should provide user-friendly error messages', () => {
      const response = createAuthErrorResponse(
        AuthErrorCode.TOKEN_EXPIRED,
        'test-request'
      );

      // User-friendly message should not contain technical jargon
      expect(response.error).not.toContain('JWT');
      expect(response.error).not.toContain('payload');
      expect(response.error).toContain('session');
    });
  });
});
