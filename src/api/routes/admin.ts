import { Router } from 'express';
import { getAdminController } from '../controllers/AdminController';
import { authenticateJWT, requireRoles } from '../middleware/auth';

const router = Router();
const adminController = getAdminController();

/**
 * Admin Routes
 * All routes require authentication and admin role
 */

// Apply authentication and admin role requirement to all routes
router.use(authenticateJWT());
router.use(requireRoles(['admin', 'super_admin']));

/**
 * Merchant Management
 */

// Get list of all merchants
router.get('/merchants', (req, res) => adminController.getMerchants(req, res));

// Get detailed information about a specific merchant
router.get('/merchants/:merchantId', (req, res) => adminController.getMerchantDetails(req, res));

// Update merchant status
router.put('/merchants/:merchantId/status', (req, res) => adminController.updateMerchantStatus(req, res));

// Impersonate a merchant
router.post('/merchants/:merchantId/impersonate', (req, res) => adminController.impersonateMerchant(req, res));

/**
 * System Management
 */

// Get system health status
router.get('/system/health', (req, res) => adminController.getSystemHealth(req, res));

// Get system metrics and statistics
router.get('/system/metrics', (req, res) => adminController.getSystemMetrics(req, res));

// Get system errors and audit logs
router.get('/errors', (req, res) => adminController.getErrors(req, res));

export default router;
