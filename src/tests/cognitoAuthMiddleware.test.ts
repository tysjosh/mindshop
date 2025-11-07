/**
 * Unit Tests for Cognito Auth Middleware
 * Tests JWT token verification, merchant access validation, and dual auth support
 * 
 * Requirements: 10.2, 10.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  requireMerchantAccess,
  requireRoles,
  AuthenticatedRequest,
} from '../api/middleware/auth';

// Mock aws-jwt-verify
const mockVerify = vi.fn();
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: vi.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Mock auth security logger
const mockLogAuthSuccess = vi.fn();
const mockLogAuthFailure = vi.fn();
const mockLogAccessDenied = vi.fn();
const mockIsRateLimitExceeded = vi.fn();
const mockLogRateLimitExceeded = vi.fn();

vi.mock('../api/middleware/authSecurityLogger', () => ({
  getAuthSecurityLogger: vi.fn(() => ({
    logAuthSuccess: mockLogAuthSuccess,
    logAuthFailure: mockLogAuthFailure,
    logAccessDenied: mockLogAccessDenied,
    isRateLimitExceeded: mockIsRateLimitExceeded,
    logRateLimitExceeded: mockLogRateLimitExceeded,
  })),
}));

describe('Cognito Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
    mockIsRateLimitExceeded.mockReturnValue(false);
  });

  describe('Valid JWT Token Verification', () => {
    it('should verify valid access token and attach user to request', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        clientId: 'test-client-id',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
        'x-request-id': 'test-request-123',
      };

      // Mock successful token verification
      mockVerify.mockResolvedValue({
        sub: 'user-123',
        'custom:merchant_id': 'merchant-456',
        email: 'test@example.com',
        'custom:roles': 'merchant_user,merchant_admin',
        'cognito:groups': [],
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Verify user was attached to request
      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        merchantId: 'merchant-456',
        email: 'test@example.com',
        roles: ['merchant_user', 'merchant_admin'],
        groups: [],
      });

      expect(mockRequest.authMethod).toBe('jwt');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should verify valid ID token when access token verification fails', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        clientId: 'test-client-id',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer valid.id.token',
      };

      // Mock access token verification failure, then ID token success
      mockVerify
        .mockRejectedValueOnce(new Error('Invalid access token'))
        .mockResolvedValueOnce({
          sub: 'user-789',
          'custom:merchant_id': 'merchant-abc',
          email: 'user@example.com',
          'custom:roles': 'merchant_user',
        });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe('user-789');
      expect(mockRequest.user?.merchantId).toBe('merchant-abc');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract merchant_id from various token claim locations', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.with.merchant',
      };

      // Test with merchant_id in different locations
      mockVerify.mockResolvedValue({
        sub: 'user-123',
        merchant_id: 'merchant-from-root',
        email: 'test@example.com',
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user?.merchantId).toBe('merchant-from-root');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract roles from custom:roles attribute', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.with.roles',
      };

      mockVerify.mockResolvedValue({
        sub: 'user-123',
        'custom:merchant_id': 'merchant-123',
        'custom:roles': 'admin,super_admin,merchant_user',
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user?.roles).toEqual(['admin', 'super_admin', 'merchant_user']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract roles from cognito:groups', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.with.groups',
      };

      mockVerify.mockResolvedValue({
        sub: 'user-123',
        'custom:merchant_id': 'merchant-123',
        'cognito:groups': ['admin', 'developers'],
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user?.roles).toContain('admin');
      expect(mockRequest.user?.roles).toContain('developers');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Expired Token Rejection', () => {
    it('should reject expired JWT token', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer expired.jwt.token',
        'x-request-id': 'test-request-expired',
      };

      // Mock token expiration error
      const expiredError = new Error('Token expired at 2024-01-01');
      mockVerify.mockRejectedValue(expiredError);

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('expired'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log expired token failure', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer expired.token',
      };

      mockVerify.mockRejectedValue(new Error('Token expired'));

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockLogAuthFailure).toHaveBeenCalled();
    });
  });

  describe('Invalid Signature Rejection', () => {
    it('should reject token with invalid signature', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer invalid.signature.token',
      };

      // Mock signature verification error
      mockVerify.mockRejectedValue(new Error('Invalid signature'));

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed JWT token', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer malformed-token',
      };

      mockVerify.mockRejectedValue(new Error('Malformed JWT token'));

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Missing Claims Handling', () => {
    it('should reject token missing userId claim', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.without.sub',
        'x-request-id': 'test-request-no-sub',
      };

      // Mock token without sub claim
      mockVerify.mockResolvedValue({
        'custom:merchant_id': 'merchant-123',
        email: 'test@example.com',
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          details: expect.objectContaining({
            missingClaim: 'userId',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token missing merchant_id claim', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.without.merchant',
      };

      // Mock token without merchant_id
      mockVerify.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          details: expect.objectContaining({
            code: 'MERCHANT_ID_MISSING',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log missing claims error', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer token.missing.claims',
      };

      mockVerify.mockResolvedValue({
        sub: 'user-123',
        // Missing merchant_id
      });

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockLogAuthFailure).toHaveBeenCalled();
    });
  });

  describe('Missing Authorization Header', () => {
    it('should reject request without authorization header', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {};

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('authorization'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Basic username:password',
      };

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should reject request when rate limit is exceeded', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'us-east-2_TestPool',
        region: 'us-east-2',
      });

      mockRequest.headers = {
        authorization: 'Bearer valid.token',
      };

      mockIsRateLimitExceeded.mockReturnValue(true);

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockLogRateLimitExceeded).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Mock Auth Mode', () => {
    it('should use mock authentication when enabled', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'dev-pool',
        region: 'us-east-2',
        enableMockAuth: true,
      });

      mockRequest.headers = {
        authorization: 'Bearer user123:merchant456',
      };

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe('user123');
      expect(mockRequest.user?.merchantId).toBe('merchant456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use default mock user when token format is invalid', async () => {
      const middleware = createAuthMiddleware({
        userPoolId: 'dev-pool',
        region: 'us-east-2',
        enableMockAuth: true,
      });

      mockRequest.headers = {
        authorization: 'Bearer simple-token',
      };

      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.merchantId).toBe('test-merchant-123');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('requireMerchantAccess Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('should allow access when user merchant matches requested merchant', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_user'],
    };

    mockRequest.params = {
      merchantId: 'merchant-456',
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should deny access when user merchant does not match requested merchant', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_user'],
    };

    mockRequest.params = {
      merchantId: 'merchant-789',
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        details: expect.objectContaining({
          code: 'ACCESS_DENIED',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow admin users to access any merchant', async () => {
    mockRequest.user = {
      userId: 'admin-user',
      merchantId: 'merchant-123',
      roles: ['admin'],
    };

    mockRequest.params = {
      merchantId: 'merchant-789',
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow super_admin users to access any merchant', async () => {
    mockRequest.user = {
      userId: 'super-admin',
      merchantId: 'merchant-123',
      roles: ['super_admin'],
    };

    mockRequest.body = {
      merchantId: 'merchant-999',
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 400 when merchant ID is not provided', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_user'],
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Merchant ID is required'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockRequest.params = {
      merchantId: 'merchant-456',
    };

    await requireMerchantAccess(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('requireRoles Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
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

  it('should allow access when user has required role', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_admin', 'merchant_user'],
    };

    const middleware = requireRoles(['merchant_admin']);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow access when user has any of the required roles', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_user'],
    };

    const middleware = requireRoles(['merchant_admin', 'merchant_user']);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should deny access when user does not have required role', async () => {
    mockRequest.user = {
      userId: 'user-123',
      merchantId: 'merchant-456',
      roles: ['merchant_user'],
    };

    const middleware = requireRoles(['admin']);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('permissions'),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not authenticated', async () => {
    const middleware = requireRoles(['admin']);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
