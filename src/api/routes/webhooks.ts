import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissions } from '../middleware/apiKeyAuth';

const router = Router();
const webhookController = new WebhookController();

// All routes require JWT authentication
router.use(authenticateJWT());

/**
 * Create a new webhook
 * POST /api/merchants/:merchantId/webhooks
 * 
 * Body:
 * {
 *   "url": "https://example.com/webhooks/rag-assistant",
 *   "events": ["chat.completed", "document.created"]
 * }
 * 
 * @access Private (requires webhooks:write permission)
 */
router.post('/:merchantId/webhooks', requirePermissions(['webhooks:write']), (req, res) => webhookController.createWebhook(req, res));

/**
 * List all webhooks for a merchant
 * GET /api/merchants/:merchantId/webhooks
 * 
 * Query params:
 * - activeOnly: boolean (default: false)
 * 
 * @access Private (requires webhooks:read permission)
 */
router.get('/:merchantId/webhooks', requirePermissions(['webhooks:read']), (req, res) => webhookController.listWebhooks(req, res));

/**
 * Update a webhook
 * PUT /api/merchants/:merchantId/webhooks/:id
 * 
 * Body:
 * {
 *   "url": "https://example.com/webhooks/new-endpoint",
 *   "events": ["chat.completed"],
 *   "status": "active"
 * }
 * 
 * @access Private (requires webhooks:write permission)
 */
router.put('/:merchantId/webhooks/:id', requirePermissions(['webhooks:write']), (req, res) => webhookController.updateWebhook(req, res));

/**
 * Delete a webhook
 * DELETE /api/merchants/:merchantId/webhooks/:id
 * 
 * @access Private (requires webhooks:write permission)
 */
router.delete('/:merchantId/webhooks/:id', requirePermissions(['webhooks:write']), (req, res) => webhookController.deleteWebhook(req, res));

/**
 * Test a webhook by sending a test event
 * POST /api/merchants/:merchantId/webhooks/:id/test
 * 
 * @access Private (requires webhooks:write permission)
 */
router.post('/:merchantId/webhooks/:id/test', requirePermissions(['webhooks:write']), (req, res) => webhookController.testWebhook(req, res));

/**
 * Get delivery history for a webhook
 * GET /api/merchants/:merchantId/webhooks/:id/deliveries
 * 
 * Query params:
 * - limit: number (default: 100, max: 1000)
 * - offset: number (default: 0)
 * 
 * @access Private (requires webhooks:read permission)
 */
router.get('/:merchantId/webhooks/:id/deliveries', requirePermissions(['webhooks:read']), (req, res) => webhookController.getDeliveries(req, res));

export default router;
