import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import compression from 'compression';

/**
 * ETag middleware for conditional requests
 * Generates ETags for responses and handles If-None-Match headers
 */
export function etagMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (body: any): Response {
      // Only generate ETags for GET requests
      if (req.method === 'GET' && body) {
        const etag = generateETag(body);
        res.setHeader('ETag', etag);

        // Check If-None-Match header
        const clientETag = req.headers['if-none-match'];
        if (clientETag === etag) {
          res.status(304);
          return originalSend.call(this, '');
        }
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Generate ETag from response body
 */
function generateETag(body: any): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Cache-Control middleware for different resource types
 */
export function cacheControlMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set cache headers based on route patterns
    const path = req.path;

    if (path.includes('/analytics') || path.includes('/usage')) {
      // Analytics data - cache for 5 minutes
      res.setHeader('Cache-Control', 'private, max-age=300');
    } else if (path.includes('/api-keys') || path.includes('/merchants')) {
      // Sensitive data - no cache
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    } else if (path.includes('/documents') && req.method === 'GET') {
      // Document data - cache for 1 hour
      res.setHeader('Cache-Control', 'private, max-age=3600');
    } else {
      // Default - cache for 1 minute
      res.setHeader('Cache-Control', 'private, max-age=60');
    }

    next();
  };
}

/**
 * Response time tracking middleware
 */
export function responseTimeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Set header before response is sent
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      return originalSend.call(this, data);
    };

    // Track when response finishes for logging
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log slow requests (> 1 second)
      if (duration > 1000) {
        console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  };
}

/**
 * Compression middleware with optimized settings
 */
export function optimizedCompression() {
  return compression({
    // Only compress responses larger than 1KB
    threshold: 1024,
    // Compression level (0-9, 6 is default, good balance)
    level: 6,
    // Filter function to determine what to compress
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Use compression filter
      return compression.filter(req, res);
    },
  });
}

/**
 * Request timeout middleware
 */
export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout for the request
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request took longer than ${timeoutMs}ms`,
        });
      }
    });

    // Set timeout for the response
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Gateway timeout',
          message: `Response took longer than ${timeoutMs}ms`,
        });
      }
    });

    next();
  };
}

/**
 * Pagination helper middleware
 * Adds pagination parameters to request
 */
export function paginationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
    const offset = (page - 1) * limit;

    // Add to request object
    (req as any).pagination = {
      page,
      limit,
      offset,
    };

    next();
  };
}

/**
 * Response size limiter
 * Prevents sending extremely large responses
 */
export function responseSizeLimiter(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (body: any): Response {
      const content = typeof body === 'string' ? body : JSON.stringify(body);
      const size = Buffer.byteLength(content, 'utf8');

      if (size > maxSizeBytes) {
        console.error(`Response too large: ${size} bytes for ${req.method} ${req.path}`);
        res.status(413);
        return originalSend.call(this, JSON.stringify({
          success: false,
          error: 'Response too large',
          message: 'The response payload exceeds the maximum allowed size',
        }));
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Memory usage monitoring middleware
 */
export function memoryMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    // Log warning if memory usage is high (> 80% of heap)
    if (heapUsedMB / heapTotalMB > 0.8) {
      console.warn(`High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round((heapUsedMB / heapTotalMB) * 100)}%)`);
    }

    // Add memory info to response headers (for debugging)
    res.setHeader('X-Memory-Usage', `${heapUsedMB}MB`);

    next();
  };
}
