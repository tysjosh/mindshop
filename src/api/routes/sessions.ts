import { Router } from 'express';
import Joi from 'joi';
import { sessionController } from '../controllers/SessionController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissions } from '../middleware/apiKeyAuth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT());

// Apply rate limiting
const sessionRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many session requests from this IP, please try again later.',
});

const analyticsRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 analytics requests per minute per IP
  message: 'Too many analytics requests from this IP, please try again later.',
});

// Validation schemas
const createSessionSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    userId: Joi.string().required().min(1).max(100),
    context: Joi.object({
      preferences: Joi.object().optional(),
      purchaseHistory: Joi.array().items(Joi.string()).optional(),
      currentCart: Joi.array().items(
        Joi.object({
          sku: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0).required(),
        })
      ).optional(),
      demographics: Joi.object().optional(),
    }).optional(),
  }),
};

const sessionIdParamSchema = {
  params: Joi.object({
    sessionId: Joi.string().required().uuid(),
  }),
};

const userIdParamSchema = {
  params: Joi.object({
    userId: Joi.string().required().min(1).max(100),
  }),
};

const merchantIdQuerySchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const updateContextSchema = {
  body: Joi.object({
    context: Joi.object({
      preferences: Joi.object().optional(),
      purchaseHistory: Joi.array().items(Joi.string()).optional(),
      currentCart: Joi.array().items(
        Joi.object({
          sku: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0).required(),
        })
      ).optional(),
      demographics: Joi.object().optional(),
    }).required(),
  }),
};

const deleteSessionSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const analyticsQuerySchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    startDate: Joi.string().optional().isoDate(),
    endDate: Joi.string().optional().isoDate(),
    userId: Joi.string().optional().min(1).max(100),
  }),
};

const billingQuerySchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    startDate: Joi.string().required().isoDate(),
    endDate: Joi.string().required().isoDate(),
  }),
};

const trackUsageSchema = {
  body: Joi.object({
    sessionId: Joi.string().required().uuid(),
    merchantId: Joi.string().required().min(3).max(100),
    userId: Joi.string().required().min(1).max(100),
    messageCount: Joi.number().integer().min(0).optional(),
    ragQueries: Joi.number().integer().min(0).optional(),
    llmTokensUsed: Joi.number().integer().min(0).optional(),
    cacheHits: Joi.number().integer().min(0).optional(),
    cacheMisses: Joi.number().integer().min(0).optional(),
    avgResponseTime: Joi.number().min(0).optional(),
    errors: Joi.number().integer().min(0).optional(),
  }),
};

const getUserSessionsSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    merchantId: Joi.string().optional().min(3).max(100),
  }),
};

const getSessionMessagesSchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

const cleanupSessionsSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

/**
 * @route GET /api/sessions/health
 * @desc Health check endpoint
 * @access Public
 */
router.get(
  '/health',
  asyncHandler(sessionController.healthCheck.bind(sessionController))
);

/**
 * @route GET /api/sessions/analytics
 * @desc Get session analytics for a merchant
 * @access Private (requires authentication + analytics:read permission)
 */
router.get(
  '/analytics',
  analyticsRateLimit,
  requirePermissions(['analytics:read']),
  validateRequest(analyticsQuerySchema),
  asyncHandler(sessionController.getSessionAnalytics.bind(sessionController))
);

/**
 * @route GET /api/sessions/billing
 * @desc Get billing data for a merchant
 * @access Private (requires authentication + analytics:read permission)
 */
router.get(
  '/billing',
  analyticsRateLimit,
  requirePermissions(['analytics:read']),
  validateRequest(billingQuerySchema),
  asyncHandler(sessionController.getBillingData.bind(sessionController))
);

/**
 * @route GET /api/sessions/users/:userId
 * @desc Get user sessions
 * @access Private (requires authentication + sessions:read permission)
 */
router.get(
  '/users/:userId',
  sessionRateLimit,
  requirePermissions(['sessions:read']),
  validateRequest({
    ...userIdParamSchema,
    ...getUserSessionsSchema,
  }),
  asyncHandler(sessionController.getUserSessions.bind(sessionController))
);

/**
 * @route POST /api/sessions
 * @desc Create a new session
 * @access Private (requires authentication + sessions:write permission)
 */
router.post(
  '/',
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest(createSessionSchema),
  asyncHandler(sessionController.createSession.bind(sessionController))
);

/**
 * @route POST /api/sessions/cleanup
 * @desc Cleanup expired sessions for a merchant
 * @access Private (requires authentication + sessions:write permission)
 */
router.post(
  '/cleanup',
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest(cleanupSessionsSchema),
  asyncHandler(sessionController.cleanupExpiredSessions.bind(sessionController))
);

/**
 * @route POST /api/sessions/track-usage
 * @desc Track session usage for billing
 * @access Private (requires authentication + sessions:write permission)
 */
router.post(
  '/track-usage',
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest(trackUsageSchema),
  asyncHandler(sessionController.trackUsage.bind(sessionController))
);

/**
 * @route GET /api/sessions/:sessionId
 * @desc Get session details
 * @access Private (requires authentication + sessions:read permission)
 */
router.get(
  '/:sessionId',
  sessionRateLimit,
  requirePermissions(['sessions:read']),
  validateRequest({
    ...sessionIdParamSchema,
    ...merchantIdQuerySchema,
  }),
  asyncHandler(sessionController.getSession.bind(sessionController))
);

/**
 * @route GET /api/sessions/:sessionId/messages
 * @desc Get session conversation history with pagination
 * @access Private (requires authentication + sessions:read permission)
 */
router.get(
  '/:sessionId/messages',
  sessionRateLimit,
  requirePermissions(['sessions:read']),
  validateRequest({
    ...sessionIdParamSchema,
    ...getSessionMessagesSchema,
  }),
  asyncHandler(sessionController.getSessionMessages.bind(sessionController))
);

/**
 * @route PUT /api/sessions/:sessionId/context
 * @desc Update session context
 * @access Private (requires authentication + sessions:write permission)
 */
router.put(
  '/:sessionId/context',
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest({
    ...sessionIdParamSchema,
    ...updateContextSchema,
    query: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
  }),
  asyncHandler(sessionController.updateSessionContext.bind(sessionController))
);

/**
 * @route DELETE /api/sessions/:sessionId
 * @desc Delete session
 * @access Private (requires authentication + sessions:write permission)
 */
router.delete(
  '/:sessionId',
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest({
    ...sessionIdParamSchema,
    ...deleteSessionSchema,
  }),
  asyncHandler(sessionController.deleteSession.bind(sessionController))
);

export default router;