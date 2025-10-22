import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiting middleware
 */
export const rateLimitMiddleware = (options: RateLimitOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message || 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: options.standardHeaders !== false,
    legacyHeaders: options.legacyHeaders !== false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use merchant ID + IP for more granular rate limiting
      const merchantId = req.body?.merchantId || req.params?.merchantId || 'unknown';
      const ip = ipKeyGenerator(req.ip || '');
      return `${ip}:${merchantId}`;
    }),
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

/**
 * Default rate limiting configurations
 */
export const defaultRateLimits = {
  // General API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many requests from this IP, please try again later.'
  },
  
  // Search/retrieval endpoints (more restrictive)
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many search requests, please slow down.'
  },
  
  // Deployment endpoints (very restrictive)
  deployment: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 deployments per hour
    message: 'Too many deployment requests, please wait before trying again.'
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 auth attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.'
  }
};

/**
 * Merchant-specific rate limiting
 */
export const merchantRateLimit = (options: RateLimitOptions & { 
  merchantLimits?: Record<string, number> 
}) => {
  return rateLimit({
    ...options,
    max: (req: Request) => {
      const merchantId = req.body?.merchantId || req.params?.merchantId;
      if (merchantId && options.merchantLimits?.[merchantId]) {
        return options.merchantLimits[merchantId];
      }
      return options.max;
    },
    keyGenerator: (req: Request) => {
      const merchantId = req.body?.merchantId || req.params?.merchantId || 'unknown';
      const ip = ipKeyGenerator(req.ip || '');
      return `merchant:${merchantId}:${ip}`;
    }
  });
};