import { Router } from 'express';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const apiKeyController = new ApiKeyController();

// All routes require JWT authentication
router.use(authenticateJWT());

/**
 * Create a new API key
 * POST /api/merchants/:merchantId/api-keys
 * 
 * Body:
 * {
 *   "name": "Production API Key",
 *   "environment": "production",
 *   "permissions": ["chat:read", "documents:write"],
 *   "expiresInDays": 365
 * }
 */
router.post('/:merchantId/api-keys', (req, res) => apiKeyController.createKey(req, res));

/**
 * List all API keys for a merchant
 * GET /api/merchants/:merchantId/api-keys
 * 
 * Query params:
 * - includeRevoked: boolean (default: false)
 */
router.get('/:merchantId/api-keys', (req, res) => apiKeyController.listKeys(req, res));

/**
 * Revoke an API key
 * DELETE /api/merchants/:merchantId/api-keys/:keyId
 */
router.delete('/:merchantId/api-keys/:keyId', (req, res) => apiKeyController.revokeKey(req, res));

/**
 * Rotate an API key (generate new, deprecate old with grace period)
 * POST /api/merchants/:merchantId/api-keys/:keyId/rotate
 * 
 * Body:
 * {
 *   "gracePeriodDays": 7
 * }
 */
router.post('/:merchantId/api-keys/:keyId/rotate', (req, res) => apiKeyController.rotateKey(req, res));

/**
 * Get usage statistics for an API key
 * GET /api/merchants/:merchantId/api-keys/:keyId/usage
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 */
router.get('/:merchantId/api-keys/:keyId/usage', (req, res) => apiKeyController.getKeyUsage(req, res));

export default router;
