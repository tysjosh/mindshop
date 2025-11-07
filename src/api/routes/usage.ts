import { Router } from 'express';
import { UsageController } from '../controllers/UsageController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissions } from '../middleware/apiKeyAuth';

const router = Router();
const usageController = new UsageController();

/**
 * Usage API Routes
 * All routes require JWT authentication + analytics:read permission
 */

// Get current usage for a merchant
router.get(
  '/:merchantId/usage/current',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => usageController.getCurrentUsage(req, res)
);

// Get usage history for a merchant
router.get(
  '/:merchantId/usage/history',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => usageController.getUsageHistory(req, res)
);

// Get usage forecast for a merchant
router.get(
  '/:merchantId/usage/forecast',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => usageController.getUsageForecast(req, res)
);

// Set usage limits (admin only)
router.post(
  '/:merchantId/usage/limits',
  authenticateJWT(),
  (req, res) => usageController.setUsageLimits(req, res)
);

export default router;
