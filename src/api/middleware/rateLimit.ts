import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

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
 * Create rate limiting middleware with custom headers
 */
export const rateLimitMiddleware = (options: RateLimitOptions) => {
  const limiter = rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message || 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true, // Enable RateLimit-* headers (draft-6)
    legacyHeaders: false, // Disable legacy X-RateLimit-* headers
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use merchant ID + IP for more granular rate limiting
      const merchantId = req.body?.merchantId || req.params?.merchantId || 'unknown';
      const ip = ipKeyGenerator(req.ip || '');
      return `${ip}:${merchantId}`;
    }),
    handler: (req: Request, res: Response) => {
      // Calculate reset time
      const resetTime = Date.now() + options.windowMs;
      
      // Set custom rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
      
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });

  // Wrap the limiter to add custom headers on all requests
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original end function
    const originalEnd = res.end;
    let headersSet = false;

    // Override end to ensure headers are set
    res.end = function(this: Response, ...args: any[]): Response {
      if (!headersSet) {
        // Set default headers if not already set by rate limiter
        if (!res.getHeader('X-RateLimit-Limit')) {
          const resetTime = Date.now() + options.windowMs;
          res.setHeader('X-RateLimit-Limit', options.max.toString());
          res.setHeader('X-RateLimit-Remaining', options.max.toString());
          res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
        }
        headersSet = true;
      }
      return originalEnd.apply(this, args as any);
    };

    // Call the actual rate limiter
    limiter(req, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      
      // Extract rate limit info from standard headers if available
      const rateLimitInfo = res.getHeader('RateLimit-Limit');
      const rateLimitRemaining = res.getHeader('RateLimit-Remaining');
      const rateLimitReset = res.getHeader('RateLimit-Reset');
      
      // Calculate reset time
      const resetTime = Date.now() + options.windowMs;
      const resetTimestamp = Math.floor(resetTime / 1000);
      
      // Set custom X-RateLimit-* headers
      if (!res.getHeader('X-RateLimit-Limit')) {
        res.setHeader('X-RateLimit-Limit', options.max.toString());
      }
      if (rateLimitRemaining !== undefined && !res.getHeader('X-RateLimit-Remaining')) {
        res.setHeader('X-RateLimit-Remaining', rateLimitRemaining.toString());
      }
      if (!res.getHeader('X-RateLimit-Reset')) {
        res.setHeader('X-RateLimit-Reset', resetTimestamp.toString());
      }
      
      headersSet = true;
      next();
    });
  };
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