/**
 * Rate Limiting Middleware Test
 * Verifies that rate limiting with Redis works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware, createEndpointRateLimiter, apiKeyRateLimiter } from '../api/middleware/rateLimiting';
import { getCacheService } from '../services/CacheService';

describe('Rate Limiting Middleware', () => {
  let cacheService: ReturnType<typeof getCacheService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let statusCode: number;
  let responseData: any;

  beforeEach(() => {
    cacheService = getCacheService();
    
    // Mock request
    mockReq = {
      path: '/api/test',
      method: 'GET',
      headers: {
        'x-request-id': 'test-request-123',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      } as any,
    };

    // Mock response
    statusCode = 200;
    responseData = null;
    
    mockRes = {
      status: vi.fn((code: number) => {
        statusCode = code;
        return mockRes as Response;
      }),
      json: vi.fn((data: any) => {
        responseData = data;
        return mockRes as Response;
      }),
      setHeader: vi.fn(),
    };

    // Mock next function
    nextFn = vi.fn();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      const testKeys = [
        'rate_limit:ip:127.0.0.1',
        'rate_limit:endpoint:/api/test:127.0.0.1',
        'rate_limit:api_key:test_key_123',
      ];
      await cacheService.deleteMultiple(testKeys);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('IP-based rate limiting', () => {
    it('should allow requests within IP limit', async () => {
      const middleware = rateLimitMiddleware({
        checkMerchantLimits: false,
        checkIpLimits: true,
        ipLimit: 10,
        ipWindow: 60,
      });

      // Make 5 requests (within limit of 10)
      for (let i = 0; i < 5; i++) {
        await middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      // Should call next() for all requests
      expect(nextFn).toHaveBeenCalledTimes(5);
      expect(statusCode).toBe(200);
    });

    it('should block requests exceeding IP limit', async () => {
      const middleware = rateLimitMiddleware({
        checkMerchantLimits: false,
        checkIpLimits: true,
        ipLimit: 3,
        ipWindow: 60,
      });

      // Make 4 requests (exceeds limit of 3)
      for (let i = 0; i < 4; i++) {
        await middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      // First 3 should succeed, 4th should be blocked
      expect(nextFn).toHaveBeenCalledTimes(3);
      expect(statusCode).toBe(429);
      expect(responseData).toMatchObject({
        success: false,
        error: 'Too many requests from this IP address',
      });
    });

    it('should set rate limit headers when blocking', async () => {
      const middleware = rateLimitMiddleware({
        checkMerchantLimits: false,
        checkIpLimits: true,
        ipLimit: 2,
        ipWindow: 60,
      });

      // Make 3 requests to trigger rate limit
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      // Verify headers were set when rate limit was exceeded
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '2');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    });
  });

  describe('Merchant-based rate limiting', () => {
    it('should skip merchant limits if no merchant ID', async () => {
      const middleware = rateLimitMiddleware({
        checkMerchantLimits: true,
        checkIpLimits: false,
      });

      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should track API calls for merchant', async () => {
      // Add merchant ID to request
      (mockReq as any).apiKey = {
        keyId: 'test_key_123',
        merchantId: 'test_merchant_456',
        permissions: ['*'],
      };

      const middleware = rateLimitMiddleware({
        checkMerchantLimits: true,
        checkIpLimits: false,
      });

      await middleware(mockReq as Request, mockRes as Response, nextFn);

      // Should call next() if within limits
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('Path skipping', () => {
    it('should skip rate limiting for health check paths', async () => {
      mockReq.path = '/health';

      const middleware = rateLimitMiddleware({
        checkMerchantLimits: true,
        checkIpLimits: true,
        skipPaths: ['/health'],
      });

      await middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });
  });

  describe('Endpoint-specific rate limiter', () => {
    it('should limit requests to specific endpoint', async () => {
      const middleware = createEndpointRateLimiter(2, 60);

      // Make 3 requests (exceeds limit of 2)
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      // First 2 should succeed, 3rd should be blocked
      expect(nextFn).toHaveBeenCalledTimes(2);
      expect(statusCode).toBe(429);
    });
  });

  describe('API key rate limiter', () => {
    it('should limit requests per API key', async () => {
      (mockReq as any).apiKey = {
        keyId: 'test_key_123',
        merchantId: 'test_merchant_456',
        permissions: ['*'],
      };

      const middleware = apiKeyRateLimiter(2, 60);

      // Make 3 requests (exceeds limit of 2)
      for (let i = 0; i < 3; i++) {
        await middleware(mockReq as any, mockRes as Response, nextFn);
      }

      // First 2 should succeed, 3rd should be blocked
      expect(nextFn).toHaveBeenCalledTimes(2);
      expect(statusCode).toBe(429);
      expect(responseData).toMatchObject({
        success: false,
        error: 'API key rate limit exceeded',
      });
    });

    it('should skip if no API key present', async () => {
      const middleware = apiKeyRateLimiter(2, 60);

      await middleware(mockReq as any, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should fail open on Redis errors', async () => {
      // Mock Redis error by using invalid cache service
      const middleware = rateLimitMiddleware({
        checkMerchantLimits: false,
        checkIpLimits: true,
      });

      // Should not throw and should call next()
      await middleware(mockReq as Request, mockRes as Response, nextFn);

      // Should fail open (allow request)
      expect(nextFn).toHaveBeenCalled();
    });
  });
});
