import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// Configure Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mindsdb-rag-assistant' },
  transports: [
    // File transports will be added when logs directory is created
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }

  const requestId = req.headers['x-request-id'] as string;
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    merchantId: req.body?.merchantId || req.query?.merchantId || req.params?.merchantId,
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing response', {
      requestId,
      statusCode: res.statusCode,
      duration,
      success: body?.success,
      error: body?.error,
    });

    return originalJson.call(this, body);
  };

  next();
};

export const auditLogger = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    const merchantId = req.body?.merchantId || req.query?.merchantId || req.params?.merchantId;
    const userId = (req as any).user?.userId;

    logger.info('Audit log', {
      requestId,
      operation,
      merchantId,
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    next();
  };
};

// Export alias for compatibility
export const loggingMiddleware = requestLogger;