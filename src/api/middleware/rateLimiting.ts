/**
 * Rate Limiting Middleware
 * 
 * Provides Redis-based rate limiting with multiple strategies:
 * 
 * 1. IP-based rate limiting (DDoS protection)
 * 2. Merchant-based rate limiting (usage limits)
 * 3. Endpoint-specific rate limiting
 * 4. API key-specific rate limiting
 * 
 * Features:
 * - Atomic Redis operations (INCRBY)
 * - Automatic expiration (TTL)
 * - X-RateLimit-* headers
 * - 429 responses with Retry-After
 * - Fail-open on errors (don't block on Redis failures)
 * 
 * Usage:
 * ```typescript
 * // Global rate limiting
 * app.use(rateLimitMiddleware({
 *   checkMerchantLimits: true,
 *   checkIpLimits: true,
 *   ipLimit: 100,
 *   ipWindow: 60
 * }));
 * 
 * // Endpoint-specific rate limiting
 * app.post('/api/login', createEndpointRateLimiter(5, 300), loginHandler);
 * 
 * // API key rate limiting
 * app.use('/api', apiKeyAuth(), apiKeyRateLimiter(1000, 60));
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { getUsageTrackingService } from '../../services/UsageTrackingService';
import { getCacheService } from '../../services/CacheService';
import { ApiResponse } from '../../types';

export interface RateLimitRequest extends Request {
  apiKey?: {
    keyId: string;
    merchantId: string;
    permissions: string[];
  };
  user?: {
    userId: string;
    merchantId: string;
    roles: string[];
    email?: string;
    groups?: string[];
  };
}

export interface RateLimitOptions {
  /**
   * Enable per-merchant rate limiting based on usage limits
   */
  checkMerchantLimits?: boolean;

  /**
   * Enable per-IP rate limiting
   */
  checkIpLimits?: boolean;

  /**
   * Maximum requests per IP per window (default: 100)
   */
  ipLimit?: number;

  /**
   * Time window for IP rate limiting in seconds (default: 60)
   */
  ipWindow?: number;

  /**
   * Skip rate limiting for specific paths
   */
  skipPaths?: string[];
}

/**
 * Rate limiting middleware with Redis-based tracking
 * Implements both merchant-level and IP-level rate limiting
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  const usageService = getUsageTrackingService();
  const cacheService = getCacheService();

  // Default options
  const {
    checkMerchantLimits = true,
    checkIpLimits = true,
    ipLimit = 100,
    ipWindow = 60,
    skipPaths = ['/health', '/api/health'],
  } = options;

  return async (req: RateLimitRequest, res: Response, next: NextFunction) => {
    // Skip rate limiting for specific paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const requestId = (req.headers['x-request-id'] as string) || 'unknown';

    try {
      // 1. Check IP-based rate limiting (DDoS protection)
      if (checkIpLimits) {
        const ipAllowed = await checkIpRateLimit(
          req,
          cacheService,
          ipLimit,
          ipWindow
        );

        if (!ipAllowed) {
          const resetTime = getResetTime(ipWindow);
          res.setHeader('X-RateLimit-Limit', ipLimit.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', resetTime);
          res.setHeader('Retry-After', ipWindow.toString());

          const response: ApiResponse = {
            success: false,
            error: 'Too many requests from this IP address',
            message: 'Rate limit exceeded. Please try again later.',
            timestamp: new Date().toISOString(),
            requestId,
          };

          return res.status(429).json(response);
        }
      }

      // 2. Check merchant-level rate limiting (usage limits)
      if (checkMerchantLimits) {
        // Extract merchant ID from API key or user context
        const merchantId = req.apiKey?.merchantId || req.user?.merchantId;

        if (merchantId) {
          // Check API call limit
          const limit = await usageService.checkLimit(merchantId, 'apiCalls');

          if (!limit.allowed) {
            const resetTime = getResetTime(86400); // 24 hours
            res.setHeader('X-RateLimit-Limit', limit.limit.toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', resetTime);
            res.setHeader('Retry-After', '86400');

            const response: ApiResponse = {
              success: false,
              error: 'Daily API call limit exceeded',
              message: `You have exceeded your daily API call limit of ${limit.limit}. Upgrade your plan for higher limits.`,
              timestamp: new Date().toISOString(),
              requestId,
            };

            return res.status(429).json(response);
          }

          // Track this API call
          await usageService.trackUsage({
            merchantId,
            metricType: 'api_calls',
            value: 1,
            metadata: {
              endpoint: req.path,
              method: req.method,
              timestamp: new Date().toISOString(),
            },
          });

          // Set rate limit headers
          res.setHeader('X-RateLimit-Limit', limit.limit.toString());
          res.setHeader('X-RateLimit-Remaining', limit.remaining.toString());
          res.setHeader('X-RateLimit-Reset', getResetTime(86400));
        }
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Don't block on rate limit errors - fail open
      next();
    }
  };
}

/**
 * Check IP-based rate limiting using Redis
 */
async function checkIpRateLimit(
  req: Request,
  cacheService: ReturnType<typeof getCacheService>,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  // Extract IP address
  const ip = getClientIp(req);
  if (!ip) return true; // Allow if we can't determine IP

  // Create Redis key for this IP
  const key = `rate_limit:ip:${ip}`;

  try {
    // Increment counter atomically
    const count = await cacheService.incrby(key, 1);

    // Set expiration on first request
    if (count === 1) {
      await cacheService.expire(key, windowSeconds);
    }

    // Check if limit exceeded
    return count <= limit;
  } catch (error) {
    console.error('IP rate limit check error:', error);
    return true; // Fail open on errors
  }
}

/**
 * Extract client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string | null {
  // Check X-Forwarded-For header (from proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header (from nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.socket.remoteAddress || null;
}

/**
 * Calculate reset time for rate limit window
 */
function getResetTime(windowSeconds: number): string {
  const resetDate = new Date(Date.now() + windowSeconds * 1000);
  return Math.floor(resetDate.getTime() / 1000).toString();
}

/**
 * Create a simple rate limiter for specific endpoints
 * Useful for protecting sensitive endpoints like login
 */
export function createEndpointRateLimiter(
  maxRequests: number,
  windowSeconds: number = 60
) {
  const cacheService = getCacheService();

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    if (!ip) return next();

    const key = `rate_limit:endpoint:${req.path}:${ip}`;

    try {
      const count = await cacheService.incrby(key, 1);

      if (count === 1) {
        await cacheService.expire(key, windowSeconds);
      }

      const resetTime = getResetTime(windowSeconds);

      if (count > maxRequests) {
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetTime);
        res.setHeader('Retry-After', windowSeconds.toString());

        const response: ApiResponse = {
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded for this endpoint. Please try again in ${windowSeconds} seconds.`,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        };

        return res.status(429).json(response);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', resetTime);

      next();
    } catch (error) {
      console.error('Endpoint rate limit error:', error);
      next(); // Fail open
    }
  };
}

/**
 * Rate limiter for API key-specific limits
 * Allows different rate limits per API key
 */
export function apiKeyRateLimiter(
  maxRequests: number,
  windowSeconds: number = 60
) {
  const cacheService = getCacheService();

  return async (req: RateLimitRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(); // Skip if no API key
    }

    const keyId = req.apiKey.keyId;
    const key = `rate_limit:api_key:${keyId}`;

    try {
      const count = await cacheService.incrby(key, 1);

      if (count === 1) {
        await cacheService.expire(key, windowSeconds);
      }

      const resetTime = getResetTime(windowSeconds);

      if (count > maxRequests) {
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetTime);
        res.setHeader('Retry-After', windowSeconds.toString());

        const response: ApiResponse = {
          success: false,
          error: 'API key rate limit exceeded',
          message: `This API key has exceeded its rate limit of ${maxRequests} requests per ${windowSeconds} seconds.`,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        };

        return res.status(429).json(response);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', resetTime);

      next();
    } catch (error) {
      console.error('API key rate limit error:', error);
      next(); // Fail open
    }
  };
}
