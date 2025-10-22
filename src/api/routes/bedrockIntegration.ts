import { Router } from 'express';
import { bedrockIntegrationController } from '../controllers/BedrockIntegrationController';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from 'express-rate-limit';
import Joi from 'joi';

const router = Router();

// Rate limiting for Bedrock integration endpoints
const bedrockRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  message: {
    error: 'Too many Bedrock integration requests',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const initializeBedrockSchema = Joi.object({
  // Option 1: Direct credentials (for merchant-specific AWS accounts)
  awsAccessKeyId: Joi.string().optional(),
  awsSecretAccessKey: Joi.string().optional(),
  
  // Option 2: Credential reference (for secure storage)
  credentialId: Joi.string().optional(),
  
  // Option 3: Use service defaults (for single AWS account)
  useServiceDefaults: Joi.boolean().default(false),
  
  // Configuration
  awsRegion: Joi.string().default('us-east-2'),
  modelId: Joi.string().default('amazon.nova-micro-v1:0'),
  mode: Joi.string().valid('default', 'conversational').default('default'),
  maxTokens: Joi.number().min(1).max(8000).default(4096),
  temperature: Joi.number().min(0).max(1).default(0.7)
}).or('awsAccessKeyId', 'credentialId', 'useServiceDefaults'); // At least one credential method required

const storeCredentialsSchema = Joi.object({
  credentialId: Joi.string().required().min(3).max(50),
  awsAccessKeyId: Joi.string().required(),
  awsSecretAccessKey: Joi.string().required(),
  awsRegion: Joi.string().default('us-east-2'),
  description: Joi.string().optional().max(200)
});

const askWithBedrockSchema = Joi.object({
  question: Joi.string().required(),
  useBedrockIntegration: Joi.boolean().default(true),
  bedrockModelName: Joi.string().optional(),
  includeContext: Joi.boolean().default(true),
  maxDocuments: Joi.number().min(1).max(20).default(5)
});

const queryWithBedrockSchema = Joi.object({
  query: Joi.string().required(),
  useHybridSearch: Joi.boolean().default(true),
  maxResults: Joi.number().min(1).max(20).default(5),
  threshold: Joi.number().min(0).max(1).default(0.7),
  includeExplainability: Joi.boolean().default(true)
});

const testBedrockSchema = Joi.object({
  testQuery: Joi.string().default('Hello, can you help me?')
});

/**
 * Store AWS credentials securely for a merchant
 * POST /api/merchants/:merchantId/bedrock/credentials
 */
router.post(
  '/merchants/:merchantId/bedrock/credentials',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    }),
    body: storeCredentialsSchema
  }),
  async (req, res) => {
    await bedrockIntegrationController.storeCredentials(req, res);
  }
);

/**
 * Initialize Bedrock integration for a merchant
 * POST /api/merchants/:merchantId/bedrock/initialize
 */
router.post(
  '/merchants/:merchantId/bedrock/initialize',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    }),
    body: initializeBedrockSchema
  }),
  async (req, res) => {
    await bedrockIntegrationController.initializeBedrockIntegration(req, res);
  }
);

/**
 * Get Bedrock integration status
 * GET /api/merchants/:merchantId/bedrock/status
 */
router.get(
  '/merchants/:merchantId/bedrock/status',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    })
  }),
  async (req, res) => {
    await bedrockIntegrationController.getBedrockIntegrationStatus(req, res);
  }
);

/**
 * Ask question using Bedrock integration
 * POST /api/merchants/:merchantId/bedrock/ask
 */
router.post(
  '/merchants/:merchantId/bedrock/ask',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    }),
    body: askWithBedrockSchema
  }),
  async (req, res) => {
    await bedrockIntegrationController.askWithBedrock(req, res);
  }
);

/**
 * Query using Bedrock RAG integration
 * POST /api/merchants/:merchantId/bedrock/query
 */
router.post(
  '/merchants/:merchantId/bedrock/query',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    }),
    body: queryWithBedrockSchema
  }),
  async (req, res) => {
    await bedrockIntegrationController.queryWithBedrockRAG(req, res);
  }
);

/**
 * List available Bedrock models
 * GET /api/bedrock/models
 */
router.get(
  '/bedrock/models',
  bedrockRateLimit,
  async (req, res) => {
    await bedrockIntegrationController.listBedrockModels(req, res);
  }
);

/**
 * Test Bedrock integration
 * POST /api/merchants/:merchantId/bedrock/test
 */
router.post(
  '/merchants/:merchantId/bedrock/test',
  bedrockRateLimit,
  validateRequest({
    params: Joi.object({
      merchantId: Joi.string().required().min(3).max(100)
    }),
    body: testBedrockSchema
  }),
  async (req, res) => {
    await bedrockIntegrationController.testBedrockIntegration(req, res);
  }
);

export default router;