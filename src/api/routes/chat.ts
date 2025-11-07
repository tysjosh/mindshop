import { Router, Request, Response } from "express";
import Joi from "joi";
import { chatController } from "../controllers/ChatController";
import { apiKeyAuth, requirePermissions } from "../middleware/apiKeyAuth";
import { validateRequest } from "../middleware/validation";
import { rateLimitMiddleware } from "../middleware/rateLimit";
import { asyncHandler } from "../middleware/errorHandler";
import { costTrackingMiddleware } from "../middleware/costTracking";

const router = Router();

// Apply API key authentication middleware to all routes
router.use(apiKeyAuth());

// Apply rate limiting
const chatRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: "Too many chat requests from this IP, please try again later.",
});

const sessionRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many session requests from this IP, please try again later.",
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
      currentCart: Joi.array()
        .items(
          Joi.object({
            sku: Joi.string().required(),
            quantity: Joi.number().integer().min(1).required(),
            price: Joi.number().min(0).required(),
          })
        )
        .optional(),
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
 * @access Private (requires authentication + chat:write permission)
 */
router.post(
  "/",
  chatRateLimit,
  requirePermissions(['chat:write']),
  costTrackingMiddleware("chat"),
  validateRequest(chatRequestSchema),
  asyncHandler(chatController.chat.bind(chatController))
);

/**
 * @route GET /api/chat/sessions/:sessionId/history
 * @desc Get chat history for a session
 * @access Private (requires authentication + chat:read permission)
 */
router.get(
  "/sessions/:sessionId/history",
  sessionRateLimit,
  requirePermissions(['chat:read']),
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
 * @access Private (requires authentication + sessions:write permission)
 */
router.delete(
  "/sessions/:sessionId",
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest({
    ...sessionIdParamSchema,
    ...deleteSessionSchema,
  }),
  asyncHandler(chatController.clearSession.bind(chatController))
);

/**
 * @route GET /api/chat/analytics
 * @desc Get chat analytics for a merchant
 * @access Private (requires authentication + analytics:read permission)
 */
router.get(
  "/analytics",
  sessionRateLimit,
  requirePermissions(['analytics:read']),
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
  "/health",
  asyncHandler(chatController.healthCheck.bind(chatController))
);

/**
 * @route POST /api/chat/sessions
 * @desc Create a new chat session
 * @access Private (requires authentication + sessions:write permission)
 */
router.post(
  "/sessions",
  sessionRateLimit,
  requirePermissions(['sessions:write']),
  validateRequest({
    body: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
      userId: Joi.string().optional().min(1).max(100),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, userId } = req.body;
    const { UserSessionRepository } = require('../../repositories/UserSessionRepository');
    const sessionRepository = new UserSessionRepository();
    const crypto = require('crypto');
    
    const sessionId = crypto.randomUUID();
    // Generate anonymous user ID if not provided
    const finalUserId = userId || `anonymous_${crypto.randomUUID()}`;
    
    // Create session in database
    await sessionRepository.create({
      sessionId,
      merchantId,
      userId: finalUserId,
      metadata: {},
    });
    
    res.json({
      success: true,
      data: {
        sessionId,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

export default router;
