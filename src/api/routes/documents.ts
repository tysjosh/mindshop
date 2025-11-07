import { Router } from 'express';
import Joi from 'joi';
import { documentController } from '../controllers/DocumentController';
import { authenticateJWT } from '../middleware/auth';
import { apiKeyAuth, requirePermissions } from '../middleware/apiKeyAuth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT());

// Apply rate limiting
const documentRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many document requests from this IP, please try again later.',
});

const bulkUploadRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 bulk uploads per minute per IP
  message: 'Too many bulk upload requests from this IP, please try again later.',
});

// Validation schemas
const createDocumentSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    content: Joi.string().required().min(1).max(10000),
    title: Joi.string().optional().min(1).max(500),
    source: Joi.string().optional().min(1).max(200),
    document_type: Joi.string().optional().valid('product', 'faq', 'policy', 'review', 'text'),
  }),
};

const updateDocumentSchema = {
  body: Joi.object({
    title: Joi.string().optional().min(1).max(500),
    body: Joi.string().optional().min(1).max(10000),
    metadata: Joi.object().optional(),
  }),
};

const documentIdParamSchema = {
  params: Joi.object({
    documentId: Joi.string().required().uuid(),
  }),
};

const merchantIdParamsSchema = {
  params: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const merchantIdQuerySchema = {
  query: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

const searchDocumentsSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    query: Joi.string().required().min(1).max(1000),
    limit: Joi.number().integer().min(1).max(100).optional(),
    threshold: Joi.number().min(0).max(1).optional(),
    useHybridSearch: Joi.boolean().optional(),
    filters: Joi.object().optional(),
  }),
};

const bulkUploadSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
    documents: Joi.array().required().min(1).max(100).items(
      Joi.object({
        sku: Joi.string().optional().min(1).max(100),
        title: Joi.string().required().min(1).max(500),
        body: Joi.string().required().min(1).max(10000),
        documentType: Joi.string().required().valid('product', 'faq', 'policy', 'review'),
        metadata: Joi.object().optional(),
      })
    ),
  }),
};

const deleteDocumentSchema = {
  body: Joi.object({
    merchantId: Joi.string().required().min(3).max(100),
  }),
};

/**
 * @route GET /api/documents/health
 * @desc Health check endpoint
 * @access Public
 */
router.get(
  '/health',
  asyncHandler(documentController.healthCheck.bind(documentController))
);

/**
 * @route POST /api/documents/search
 * @desc Search documents
 * @access Private (requires authentication + documents:read permission)
 */
router.post(
  '/search',
  documentRateLimit,
  requirePermissions(['documents:read']),
  validateRequest(searchDocumentsSchema),
  asyncHandler(documentController.searchDocuments.bind(documentController))
);

/**
 * @route GET /api/documents/stats
 * @desc Get document statistics for a merchant
 * @access Private (requires authentication + documents:read permission)
 */
router.get(
  '/stats',
  documentRateLimit,
  requirePermissions(['documents:read']),
  validateRequest(merchantIdQuerySchema),
  asyncHandler(documentController.getDocumentStats.bind(documentController))
);

/**
 * @route POST /api/documents
 * @desc Create a new document
 * @access Private (requires authentication + documents:write permission)
 */
router.post(
  '/',
  documentRateLimit,
  requirePermissions(['documents:write']),
  validateRequest(createDocumentSchema),
  asyncHandler(documentController.createDocument.bind(documentController))
);

/**
 * @route POST /api/documents/bulk
 * @desc Bulk upload documents
 * @access Private (requires authentication + documents:write permission)
 */
router.post(
  '/bulk',
  bulkUploadRateLimit,
  requirePermissions(['documents:write']),
  validateRequest(bulkUploadSchema),
  asyncHandler(documentController.bulkUploadDocuments.bind(documentController))
);

/**
 * @route GET /api/documents/:documentId
 * @desc Get document by ID
 * @access Private (requires authentication + documents:read permission)
 */
router.get(
  '/:documentId',
  documentRateLimit,
  requirePermissions(['documents:read']),
  validateRequest({
    ...documentIdParamSchema,
    ...merchantIdQuerySchema,
  }),
  asyncHandler(documentController.getDocument.bind(documentController))
);

/**
 * @route PUT /api/documents/:documentId
 * @desc Update document
 * @access Private (requires authentication + documents:write permission)
 */
router.put(
  '/:documentId',
  documentRateLimit,
  requirePermissions(['documents:write']),
  validateRequest({
    ...documentIdParamSchema,
    ...updateDocumentSchema,
    query: Joi.object({
      merchantId: Joi.string().required().min(3).max(100),
    }),
  }),
  asyncHandler(documentController.updateDocument.bind(documentController))
);

/**
 * @route DELETE /api/documents/:documentId
 * @desc Delete document
 * @access Private (requires authentication + documents:delete permission)
 */
router.delete(
  '/:documentId',
  documentRateLimit,
  requirePermissions(['documents:delete']),
  validateRequest({
    ...documentIdParamSchema,
    ...deleteDocumentSchema,
  }),
  asyncHandler(documentController.deleteDocument.bind(documentController))
);

export default router;