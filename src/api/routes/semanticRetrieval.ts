import { Router } from "express";
import Joi from "joi";
import { semanticRetrievalController } from "../controllers/SemanticRetrievalController";
import { authenticateJWT } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { rateLimitMiddleware } from "../middleware/rateLimit";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT());

// Apply rate limiting
router.use(
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: "Too many requests from this IP, please try again later.",
  })
);

/**
 * Deploy semantic retriever predictor
 * POST /api/semantic-retrieval/deploy
 */
router.post(
  "/deploy",
  validateRequest({
    body: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
  }),
  semanticRetrievalController.deployPredictor.bind(semanticRetrievalController)
);

/**
 * Enhanced semantic document retrieval (SQL interface)
 * POST /api/semantic-retrieval/search
 */
router.post(
  "/search",
  validateRequest({
    body: Joi.object({
      query: Joi.string().required().min(1).max(1000),
      merchantId: Joi.string().required().min(3).max(100),
      limit: Joi.number().min(1).max(50).optional(),
      threshold: Joi.number().min(0).max(1).optional(),
      includeMetadata: Joi.boolean().optional(),
      documentTypes: Joi.array().items(Joi.string()).optional(),
    }),
  }),
  semanticRetrievalController.searchDocuments.bind(semanticRetrievalController)
);

/**
 * REST API interface for semantic retrieval
 * POST /api/semantic-retrieval/rest-search
 */
router.post(
  "/rest-search",
  validateRequest({
    body: Joi.object({
      query: Joi.string().required().min(1).max(1000),
      merchantId: Joi.string().required().min(3).max(100),
      limit: Joi.number().min(1).max(50).optional(),
      threshold: Joi.number().min(0).max(1).optional(),
      includeMetadata: Joi.boolean().optional(),
      documentTypes: Joi.array().items(Joi.string()).optional(),
    }),
  }),
  semanticRetrievalController.restSearchDocuments.bind(
    semanticRetrievalController
  )
);

/**
 * Validate grounding for retrieved documents
 * POST /api/semantic-retrieval/validate-grounding
 */
router.post(
  "/validate-grounding",
  validateRequest({
    body: Joi.object({
      query: Joi.string().required().min(1).max(1000),
      merchantId: Joi.string().required().min(3).max(100),
      documents: Joi.array()
        .required()
        .min(1)
        .max(20)
        .items(
          Joi.object({
            id: Joi.string().required(),
            snippet: Joi.string().required(),
            score: Joi.number().required(),
          })
        ),
    }),
  }),
  semanticRetrievalController.validateGrounding.bind(
    semanticRetrievalController
  )
);

/**
 * Get predictor status and health
 * GET /api/semantic-retrieval/status/:merchantId
 */
router.get(
  "/status/:merchantId",
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
  }),
  semanticRetrievalController.getPredictorStatus.bind(
    semanticRetrievalController
  )
);

/**
 * Update predictor configuration
 * PUT /api/semantic-retrieval/config/:merchantId
 */
router.put(
  "/config/:merchantId",
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
    body: Joi.object({
      config: Joi.object({
        threshold: Joi.number().min(0).max(1).optional(),
        maxResults: Joi.number().min(1).max(100).optional(),
        groundingValidation: Joi.boolean().optional(),
        explainability: Joi.boolean().optional(),
        embeddingModel: Joi.string().optional(),
      }).required(),
    }),
  }),
  semanticRetrievalController.updatePredictorConfig.bind(
    semanticRetrievalController
  )
);

/**
 * Health check endpoint
 * GET /api/semantic-retrieval/health
 */
router.get(
  "/health",
  semanticRetrievalController.healthCheck.bind(semanticRetrievalController)
);

export default router;
