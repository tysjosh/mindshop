import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { ProductSyncController } from '../controllers/ProductSyncController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissions } from '../middleware/apiKeyAuth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const controller = new ProductSyncController();

// Apply JWT authentication middleware to all routes
router.use(authenticateJWT());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json'];
    const allowedExtensions = ['.csv', '.json'];
    
    const hasValidMimeType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload CSV or JSON.'));
    }
  },
});

// Rate limiting configurations
const syncRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many sync requests from this IP, please try again later.',
});

const uploadRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: 'Too many upload requests from this IP, please try again later.',
});

// Validation schemas
const configureSyncSchema = {
  params: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
  body: Joi.object({
    syncType: Joi.string().valid('scheduled', 'webhook', 'manual').required(),
    schedule: Joi.string().valid('hourly', 'daily', 'weekly').optional(),
    sourceType: Joi.string().valid('api', 'ftp', 's3', 'csv').required(),
    sourceUrl: Joi.string().uri().optional(),
    fieldMapping: Joi.object({
      sku: Joi.string().required(),
      title: Joi.string().required(),
      description: Joi.string().required(),
      price: Joi.string().optional(),
      imageUrl: Joi.string().optional(),
      category: Joi.string().optional(),
      inStock: Joi.string().optional(),
    }).required(),
    incrementalSync: Joi.boolean().optional(),
    webhookSecret: Joi.string().optional(),
  }),
};

const merchantIdParamSchema = {
  params: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const syncHistorySchema = {
  params: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

/**
 * @route POST /api/merchants/:merchantId/sync/configure
 * @desc Create or update product sync configuration
 * @access Private (requires JWT authentication + sync:write permission)
 */
router.post(
  '/:merchantId/sync/configure',
  syncRateLimit,
  requirePermissions(['sync:write']),
  validateRequest(configureSyncSchema),
  asyncHandler(controller.configureSync.bind(controller))
);

/**
 * @route PUT /api/merchants/:merchantId/sync/configure
 * @desc Update product sync configuration (alias for POST)
 * @access Private (requires JWT authentication + sync:write permission)
 */
router.put(
  '/:merchantId/sync/configure',
  syncRateLimit,
  requirePermissions(['sync:write']),
  validateRequest(configureSyncSchema),
  asyncHandler(controller.configureSync.bind(controller))
);

/**
 * @route GET /api/merchants/:merchantId/sync/configure
 * @desc Get product sync configuration
 * @access Private (requires JWT authentication + sync:read permission)
 */
router.get(
  '/:merchantId/sync/configure',
  requirePermissions(['sync:read']),
  validateRequest(merchantIdParamSchema),
  asyncHandler(controller.getSyncConfig.bind(controller))
);

/**
 * @route POST /api/merchants/:merchantId/sync/trigger
 * @desc Trigger a manual product sync
 * @access Private (requires JWT authentication + sync:write permission)
 */
router.post(
  '/:merchantId/sync/trigger',
  syncRateLimit,
  requirePermissions(['sync:write']),
  validateRequest(merchantIdParamSchema),
  asyncHandler(controller.triggerSync.bind(controller))
);

/**
 * @route GET /api/merchants/:merchantId/sync/status
 * @desc Get current sync status
 * @access Private (requires JWT authentication + sync:read permission)
 */
router.get(
  '/:merchantId/sync/status',
  requirePermissions(['sync:read']),
  validateRequest(merchantIdParamSchema),
  asyncHandler(controller.getSyncStatus.bind(controller))
);

/**
 * @route GET /api/merchants/:merchantId/sync/history
 * @desc Get sync history for a merchant
 * @access Private (requires JWT authentication + sync:read permission)
 */
router.get(
  '/:merchantId/sync/history',
  requirePermissions(['sync:read']),
  validateRequest(syncHistorySchema),
  asyncHandler(controller.getSyncHistory.bind(controller))
);

/**
 * @route POST /api/merchants/:merchantId/sync/upload
 * @desc Upload and process product file (CSV or JSON)
 * @access Private (requires JWT authentication + sync:write permission)
 */
router.post(
  '/:merchantId/sync/upload',
  uploadRateLimit,
  requirePermissions(['sync:write']),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err.message && (err.message.includes('Unsupported file type') || err.message.includes('Invalid file type'))) {
          return res.status(415).json({
            success: false,
            error: err.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'File size exceeds maximum allowed size of 10MB',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          });
        }
        // Other multer errors
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        });
      }
      next();
    });
  },
  validateRequest(merchantIdParamSchema),
  asyncHandler(controller.uploadFile.bind(controller))
);

/**
 * @route POST /api/merchants/:merchantId/sync/webhook
 * @desc Receive webhook events from merchant's e-commerce platform
 * @access Public (webhook signature verification in controller)
 */
router.post(
  '/:merchantId/sync/webhook',
  validateRequest(merchantIdParamSchema),
  asyncHandler(controller.processWebhook.bind(controller))
);

export default router;
