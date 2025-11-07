import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissions } from '../middleware/apiKeyAuth';

const router = Router();
const analyticsController = new AnalyticsController();

/**
 * Analytics routes for merchant usage analytics
 * All routes require JWT authentication + analytics:read permission
 */

// GET /api/merchants/:merchantId/analytics/overview
router.get(
  '/:merchantId/analytics/overview',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => analyticsController.getOverview(req, res)
);

// GET /api/merchants/:merchantId/analytics/queries
router.get(
  '/:merchantId/analytics/queries',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => analyticsController.getQueries(req, res)
);

// GET /api/merchants/:merchantId/analytics/top-queries
router.get(
  '/:merchantId/analytics/top-queries',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => analyticsController.getTopQueries(req, res)
);

// GET /api/merchants/:merchantId/analytics/performance
router.get(
  '/:merchantId/analytics/performance',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => analyticsController.getPerformance(req, res)
);

// GET /api/merchants/:merchantId/analytics/intents
router.get(
  '/:merchantId/analytics/intents',
  authenticateJWT(),
  requirePermissions(['analytics:read']),
  (req, res) => analyticsController.getIntents(req, res)
);

export default router;
