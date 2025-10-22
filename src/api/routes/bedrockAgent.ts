import { Router } from "express";
import {
  BedrockAgentController,
  createBedrockAgentController,
} from "../controllers/BedrockAgentController";
import { validateRequest } from "../middleware/validation";
import { rateLimit } from "express-rate-limit";
import Joi from "joi";

const router = Router();

// Rate limiting for chat endpoints
const chatRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    error: "Too many chat requests",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: "Too many session requests",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const chatRequestSchema = {
  body: Joi.object({
    query: Joi.string().required().min(1).max(2000),
    merchant_id: Joi.string().required().uuid(),
    user_id: Joi.string().required(),
    session_id: Joi.string().optional().uuid(),
    user_context: Joi.object().optional(),
  }),
};

const createSessionSchema = {
  body: Joi.object({
    merchant_id: Joi.string().required().uuid(),
    user_id: Joi.string().required(),
    context: Joi.object().optional(),
  }),
};

const clearSessionSchema = {
  body: Joi.object({
    merchant_id: Joi.string().required().uuid(),
  }),
};

const parseIntentSchema = {
  body: Joi.object({
    query: Joi.string().required().min(1).max(2000),
    merchant_id: Joi.string().required().uuid(),
    user_context: Joi.object().optional(),
  }),
};

// Initialize controller
let controller: BedrockAgentController;

async function getController(): Promise<BedrockAgentController> {
  if (!controller) {
    controller = await createBedrockAgentController();
  }
  return controller;
}

/**
 * @route POST /api/bedrock-agent/chat
 * @desc Process chat request through Bedrock Agent
 * @access Public (with rate limiting)
 */
router.post(
  "/chat",
  chatRateLimit,
  validateRequest(chatRequestSchema),
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.chat(req, res);
  }
);

/**
 * @route POST /api/bedrock-agent/sessions
 * @desc Create new session
 * @access Public (with rate limiting)
 */
router.post(
  "/sessions",
  sessionRateLimit,
  validateRequest(createSessionSchema),
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.createSession(req, res);
  }
);

/**
 * @route GET /api/bedrock-agent/sessions/:sessionId
 * @desc Get session details
 * @access Public (with rate limiting)
 */
router.get("/sessions/:sessionId", sessionRateLimit, async (req, res) => {
  const ctrl = await getController();
  await ctrl.getSession(req, res);
});

/**
 * @route GET /api/bedrock-agent/sessions/:sessionId/history
 * @desc Get session conversation history
 * @access Public (with rate limiting)
 */
router.get(
  "/sessions/:sessionId/history",
  sessionRateLimit,
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.getSessionHistory(req, res);
  }
);

/**
 * @route DELETE /api/bedrock-agent/sessions/:sessionId
 * @desc Clear session
 * @access Public (with rate limiting)
 */
router.delete(
  "/sessions/:sessionId",
  sessionRateLimit,
  validateRequest(clearSessionSchema),
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.clearSession(req, res);
  }
);

/**
 * @route GET /api/bedrock-agent/users/:userId/sessions
 * @desc Get user sessions
 * @access Public (with rate limiting)
 */
router.get("/users/:userId/sessions", sessionRateLimit, async (req, res) => {
  const ctrl = await getController();
  await ctrl.getUserSessions(req, res);
});

/**
 * @route GET /api/bedrock-agent/stats
 * @desc Get session statistics for a merchant
 * @access Public (with rate limiting)
 */
router.get("/stats", sessionRateLimit, async (req, res) => {
  const ctrl = await getController();
  await ctrl.getSessionStats(req, res);
});

/**
 * @route GET /api/bedrock-agent/health
 * @desc Health check endpoint
 * @access Public
 */
router.get("/health", async (req, res) => {
  const ctrl = await getController();
  await ctrl.health(req, res);
});

/**
 * @route POST /api/bedrock-agent/parse-intent
 * @desc Parse user intent (for debugging/testing)
 * @access Public (with rate limiting)
 */
router.post(
  "/parse-intent",
  sessionRateLimit,
  validateRequest(parseIntentSchema),
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.parseIntent(req, res);
  }
);

/**
 * @route GET /api/bedrock-agent/sessions/:sessionId/summary
 * @desc Get detailed session summary with audit information
 * @access Public (with rate limiting)
 */
router.get(
  "/sessions/:sessionId/summary",
  sessionRateLimit,
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.getDetailedSessionSummary(req, res);
  }
);

/**
 * @route GET /api/bedrock-agent/audit/search
 * @desc Search audit entries
 * @access Public (with rate limiting)
 */
router.get("/audit/search", sessionRateLimit, async (req, res) => {
  const ctrl = await getController();
  await ctrl.searchAuditEntries(req, res);
});

/**
 * @route POST /api/bedrock-agent/compliance/report
 * @desc Generate compliance report
 * @access Public (with rate limiting)
 */
router.post(
  "/compliance/report",
  sessionRateLimit,
  validateRequest({
    body: Joi.object({
      merchant_id: Joi.string().required().uuid(),
      start_date: Joi.string().required().isoDate(),
      end_date: Joi.string().required().isoDate(),
    }),
  }),
  async (req, res) => {
    const ctrl = await getController();
    await ctrl.generateComplianceReport(req, res);
  }
);

export default router;
