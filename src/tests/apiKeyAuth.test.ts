/**
 * API Key Authentication Middleware Tests
 * Tests the apiKeyAuth() and requirePermissions() middleware functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth, requirePermissions, ApiKeyRequest } from '../api/middleware/apiKeyAuth';
import { getApiKeyService } from '../services/ApiKeyService';

// Create mock functions
const mockValidateKey = vi.fn();
const mockCreateUsage = vi.fn();

// Mock the ApiKeyService
vi.mock('../services/ApiKeyService', () => ({
  getApiKeyService: vi.fn(() => ({
    validateKey: mockValidateKey,
  })),
}));

// Mock the ApiKeyUsageRepository
vi.mock('../repositories/ApiKeyUsageRepository', () => ({
  getApiKeyUsageRepository: vi.fn(() => ({
    create: mockCreateUsage,
  })),
}));

describe('apiKeyAuth Middleware', () => {
  let mockRequest: Partial<ApiKeyRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock request
    mockRequest = {
      headers: {},
      path: '/api/test',
      method: 'GET',
    };

    // Setup mock response
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      on: vi.fn(),
      statusCode: 200,
    };

    // Setup mock next function
    mockNext = vi.fn();
  });

  describe('Missing Authorization Header', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing or invalid API key',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      mockRequest.headers = { authorization: 'Basic abc123' };

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing or invalid API key',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Valid API Key', () => {
    it('should attach API key info to request and call next() for valid key', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_validkey123' };

      mockValidateKey.mockResolvedValue({
        valid: true,
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read', 'documents:write'],
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockValidateKey).toHaveBeenCalledWith('pk_test_validkey123');
      expect(mockRequest.apiKey).toEqual({
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read', 'documents:write'],
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Invalid API Key', () => {
    it('should return 401 for invalid API key', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_invalidkey' };

      mockValidateKey.mockResolvedValue({
        valid: false,
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid or expired API key',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for expired API key', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_expiredkey' };

      mockValidateKey.mockResolvedValue({
        valid: false,
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when validation throws an error', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_errorkey' };

      mockValidateKey.mockRejectedValue(new Error('Database error'));

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication failed',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Request ID Handling', () => {
    it('should include request ID in error response when provided', async () => {
      mockRequest.headers = { 
        authorization: 'Bearer pk_test_invalidkey',
        'x-request-id': 'req_12345'
      };

      mockValidateKey.mockResolvedValue({
        valid: false,
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req_12345',
        })
      );
    });

    it('should use "unknown" as request ID when not provided', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_invalidkey' };

      mockValidateKey.mockResolvedValue({
        valid: false,
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        })
      );
    });
  });

  describe('Permissions Handling', () => {
    it('should handle empty permissions array', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_validkey123' };

      mockValidateKey.mockResolvedValue({
        valid: true,
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: undefined,
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockRequest.apiKey).toEqual({
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: [],
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Usage Tracking', () => {
    it('should track API key usage for valid requests', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_validkey123' };

      mockValidateKey.mockResolvedValue({
        valid: true,
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read'],
      });

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should not break request if usage tracking fails', async () => {
      mockRequest.headers = { authorization: 'Bearer pk_test_validkey123' };

      mockValidateKey.mockResolvedValue({
        valid: true,
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read'],
      });

      mockCreateUsage.mockRejectedValue(new Error('Database error'));

      const middleware = apiKeyAuth();
      await middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('requirePermissions Middleware', () => {
  let mockRequest: Partial<ApiKeyRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('No API Key Attached', () => {
    it('should return 401 when no API key is attached to request', () => {
      const middleware = requirePermissions(['chat:read']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Wildcard Permission', () => {
    it('should allow access with wildcard permission', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['*'],
      };

      const middleware = requirePermissions(['chat:read', 'documents:write']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Specific Permissions', () => {
    it('should allow access when API key has all required permissions', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read', 'documents:write', 'analytics:read'],
      };

      const middleware = requirePermissions(['chat:read', 'documents:write']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access when API key is missing required permissions', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read'],
      };

      const middleware = requirePermissions(['chat:read', 'documents:write']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Insufficient permissions',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access when API key has no permissions', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: [],
      };

      const middleware = requirePermissions(['chat:read']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access when requiring single permission that exists', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read', 'documents:read'],
      };

      const middleware = requirePermissions(['chat:read']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should include required permissions in error message', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read'],
      };

      const middleware = requirePermissions(['documents:write', 'analytics:read']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('documents:write, analytics:read'),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should allow access when no permissions are required', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: [],
      };

      const middleware = requirePermissions([]);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should include request ID in permission error when provided', () => {
      mockRequest.apiKey = {
        keyId: 'key_123',
        merchantId: 'merchant_456',
        permissions: ['chat:read'],
      };
      mockRequest.headers = { 'x-request-id': 'req_67890' };

      const middleware = requirePermissions(['documents:write']);
      middleware(mockRequest as ApiKeyRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req_67890',
        })
      );
    });
  });
});
