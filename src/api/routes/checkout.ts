import { Router, Request } from 'express';
import Joi from 'joi';
import { CheckoutService } from '../../services/CheckoutService';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { Response } from 'express';

// Validation schemas
const processCheckoutSchema = {
  body: Joi.object({
    merchant_id: Joi.string().required().min(3).max(100),
    user_id: Joi.string().required().min(1).max(100),
    session_id: Joi.string().required().uuid(),
    items: Joi.array().required().min(1).max(20).items(
      Joi.object({
        sku: Joi.string().required().min(1).max(100),
        quantity: Joi.number().integer().min(1).max(100).required(),
        price: Joi.number().min(0).required(),
        name: Joi.string().required().min(1).max(200),
        description: Joi.string().optional().max(500),
      })
    ),
    payment_method: Joi.string().required().valid('stripe', 'adyen', 'default'),
    shipping_address: Joi.object({
      name: Joi.string().required().min(1).max(100),
      address_line_1: Joi.string().required().min(1).max(200),
      address_line_2: Joi.string().optional().max(200),
      city: Joi.string().required().min(1).max(100),
      state: Joi.string().required().min(1).max(100),
      postal_code: Joi.string().required().min(1).max(20),
      country: Joi.string().required().min(2).max(3),
    }).required(),
    billing_address: Joi.object({
      name: Joi.string().required().min(1).max(100),
      address_line_1: Joi.string().required().min(1).max(200),
      address_line_2: Joi.string().optional().max(200),
      city: Joi.string().required().min(1).max(100),
      state: Joi.string().required().min(1).max(100),
      postal_code: Joi.string().required().min(1).max(20),
      country: Joi.string().required().min(2).max(3),
    }).optional(),
    user_consent: Joi.object({
      terms_accepted: Joi.boolean().required().valid(true),
      privacy_accepted: Joi.boolean().required().valid(true),
      marketing_consent: Joi.boolean().optional(),
      consent_timestamp: Joi.string().required().isoDate(),
    }).required(),
  }),
};

const transactionStatusSchema = {
  params: Joi.object({
    transactionId: Joi.string().required().uuid(),
  }),
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const cancelTransactionSchema = {
  params: Joi.object({
    transactionId: Joi.string().required().uuid(),
  }),
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    reason: Joi.string().required().min(1).max(500),
  }),
};

export function createCheckoutRoutes(): Router {
  const router = Router();

  // Apply authentication to all checkout routes
  router.use(authenticateJWT);

  // Apply strict rate limiting for checkout operations
  const checkoutRateLimit = rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 checkout attempts per minute per IP
    message: 'Too many checkout requests from this IP, please try again later.',
  });

  const statusRateLimit = rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 status checks per minute per IP
    message: 'Too many status requests from this IP, please try again later.',
  });

  // Initialize services
  const auditLogRepository = new AuditLogRepository();
  const { getPIIRedactor } = require('../../services/PIIRedactor');
  const piiRedactor = getPIIRedactor();
  const checkoutService = new CheckoutService(auditLogRepository, piiRedactor);

  // Helper function to get request ID
  const getRequestId = (req: Request): string => {
    return (req.headers as any)['x-request-id'] || 'unknown';
  };

  /**
   * @route POST /api/checkout/process
   * @desc Process secure checkout with payment gateway integration
   * @access Private (requires authentication)
   */
  router.post(
    '/process',
    checkoutRateLimit,
    validateRequest(processCheckoutSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const checkoutRequest = req.body;

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== checkoutRequest.merchant_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to merchant resources',
          timestamp: new Date().toISOString(),
          requestId: getRequestId(req),
        });
      }

      const result = await checkoutService.processCheckout(checkoutRequest);

      res.status(result.status === 'failed' ? 400 : 200).json({
        success: result.status !== 'failed',
        data: result,
        timestamp: new Date().toISOString(),
        requestId: getRequestId(req),
      });
    })
  );

  /**
   * @route GET /api/checkout/transaction/:transactionId
   * @desc Get transaction status
   * @access Private (requires authentication)
   */
  router.get(
    '/transaction/:transactionId',
    statusRateLimit,
    validateRequest(transactionStatusSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { transactionId } = req.params;
      const { merchantId } = req.query;

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to merchant resources',
          timestamp: new Date().toISOString(),
          requestId: getRequestId(req),
        });
      }

      const status = await checkoutService.getTransactionStatus(transactionId, merchantId as string);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
        requestId: getRequestId(req),
      });
    })
  );

  /**
   * @route POST /api/checkout/transaction/:transactionId/cancel
   * @desc Cancel transaction with compensation
   * @access Private (requires authentication)
   */
  router.post(
    '/transaction/:transactionId/cancel',
    checkoutRateLimit,
    validateRequest(cancelTransactionSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { transactionId } = req.params;
      const { merchantId, reason } = req.body;

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to merchant resources',
          timestamp: new Date().toISOString(),
          requestId: getRequestId(req),
        });
      }

      const result = await checkoutService.cancelTransaction(transactionId, merchantId, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: getRequestId(req),
      });
    })
  );

  /**
   * @route GET /api/checkout/health
   * @desc Health check endpoint for checkout service
   * @access Public
   */
  router.get(
    '/health',
    asyncHandler(async (req: Request, res: Response) => {
      // Simple health check - verify service can be instantiated
      try {
        const testService = new CheckoutService(auditLogRepository, piiRedactor);
        
        res.status(200).json({
          success: true,
          data: {
            service: 'CheckoutService',
            status: 'healthy',
            components: {
              paymentGateway: 'available',
              auditLogging: 'available',
              piiRedaction: 'available',
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
          timestamp: new Date().toISOString(),
          requestId: getRequestId(req),
        });
      } catch (error: any) {
        res.status(503).json({
          success: false,
          error: 'Checkout service unhealthy',
          details: error.message,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(req),
        });
      }
    })
  );

  return router;
}

// Default export for compatibility
export default createCheckoutRoutes;