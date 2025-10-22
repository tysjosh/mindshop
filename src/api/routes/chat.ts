import { Router } from 'express';
import Joi from 'joi';
import { chatController } from '../controllers/ChatController';
import { authenticateJWT } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { costTrackingMiddleware } from '../middleware/costTracking';

const router = Router();

// Apply authentication middleware to protected routes
router.use('/chat', authenticateJWT);
router.use('/sessions', authenticateJWT);

// Apply rate limiting
const chatRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: 'Too many chat requests from this IP, please try again later.',
});

const sessionRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many session requests from this IP, please try again later.',
});

// Validation schemas
const chatRequestSchema = {
  body: Joi.object({
    query: Joi.string().required().min(1).max(2000),
    sessionId: Joi.string().optional().uuid(),
    merchantId: Joi.string().required().min(3).max(100),
    userId: Joi.string().optional().min(1).max(100),
    userContext: Joi.object({
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
    includeExplainability: Joi.boolean().optional(),
    maxResults: Joi.number().integer().min(1).max(20).optional(),
  }),
};

const sessionIdParamSchema = {
  params: Joi.object({
    sessionId: Joi.string().required().uuid(),
  }),
};

const merchantIdQuerySchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

const deleteSessionSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

/**
 * @route POST /api/chat
 * @desc Main chat endpoint with RAGService integration
 * @access Private (requires authentication)
 */
router.post(
  '/chat',
  chatRateLimit,
  costTrackingMiddleware('chat'),
  validateRequest(chatRequestSchema),
  asyncHandler(chatController.chat.bind(chatController))
);

/**
 * @route GET /api/chat/sessions/:sessionId/history
 * @desc Get chat history for a session
 * @access Private (requires authentication)
 */
router.get(
  '/sessions/:sessionId/history',
  sessionRateLimit,
  validateRequest({
    ...sessionIdParamSchema,
    query: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
  }),
  asyncHandler(chatController.getChatHistory.bind(chatController))
);

/**
 * @route DELETE /api/chat/sessions/:sessionId
 * @desc Clear chat session
 * @access Private (requires authentication)
 */
router.delete(
  '/sessions/:sessionId',
  sessionRateLimit,
  validateRequest({
    ...sessionIdParamSchema,
    ...deleteSessionSchema,
  }),
  asyncHandler(chatController.clearSession.bind(chatController))
);

/**
 * @route GET /api/chat/analytics
 * @desc Get chat analytics for a merchant
 * @access Private (requires authentication)
 */
router.get(
  '/analytics',
  sessionRateLimit,
  validateRequest({
    query: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
      startDate: Joi.string().optional().isoDate(),
      endDate: Joi.string().optional().isoDate(),
      limit: Joi.number().integer().min(1).max(1000).optional(),
    }),
  }),
  asyncHandler(chatController.getChatAnalytics.bind(chatController))
);

/**
 * @route GET /api/chat/health
 * @desc Health check endpoint
 * @access Public
 */
router.get(
  '/health',
  asyncHandler(chatController.healthCheck.bind(chatController))
);

export default router;