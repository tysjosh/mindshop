import { Request, Response } from 'express';
import { getProductSyncService } from '../../services/ProductSyncService';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Custom error class for product sync errors
 */
class ProductSyncError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'ProductSyncError';
  }
}

/**
 * Helper function to determine appropriate HTTP status code from error
 */
function getErrorStatusCode(error: any): number {
  if (error instanceof ProductSyncError) {
    return error.statusCode;
  }
  
  // Handle specific error messages
  if (error.message?.includes('not found')) {
    return 404;
  }
  if (error.message?.includes('already in progress')) {
    return 409; // Conflict
  }
  if (error.message?.includes('Invalid webhook signature')) {
    return 401; // Unauthorized
  }
  if (error.message?.includes('Access denied')) {
    return 403;
  }
  if (error.message?.includes('required') || error.message?.includes('must be')) {
    return 400; // Bad request
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return 503; // Service unavailable
  }
  if (error.code === 'ENOTFOUND') {
    return 502; // Bad gateway
  }
  
  // Default to 500 for unexpected errors
  return 500;
}

/**
 * Helper function to create standardized error response
 */
function createErrorResponse(
  error: any,
  requestId: string,
  context?: string
): ApiResponse {
  const statusCode = getErrorStatusCode(error);
  const isServerError = statusCode >= 500;
  
  // Log error with context
  if (isServerError) {
    console.error(`[ProductSyncController] ${context || 'Error'}:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      requestId,
    });
  } else {
    console.warn(`[ProductSyncController] ${context || 'Error'}:`, {
      message: error.message,
      code: error.code,
      requestId,
    });
  }
  
  return {
    success: false,
    error: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export class ProductSyncController {
  private productSyncService = getProductSyncService();

  /**
   * Configure or update product sync for a merchant
   * Handles both POST and PUT requests
   * POST /api/merchants/:merchantId/sync/configure - Create new configuration
   * PUT /api/merchants/:merchantId/sync/configure - Update existing configuration
   */
  async configureSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { syncType, schedule, source, fieldMapping, incrementalSync, webhookSecret } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!syncType) {
        const response: ApiResponse = {
          success: false,
          error: 'syncType is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate syncType
      if (!['scheduled', 'webhook', 'manual'].includes(syncType)) {
        const response: ApiResponse = {
          success: false,
          error: 'syncType must be one of: scheduled, webhook, manual',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate schedule for scheduled sync
      if (syncType === 'scheduled' && !schedule) {
        const response: ApiResponse = {
          success: false,
          error: 'schedule is required for scheduled sync',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate schedule value
      if (schedule && !['hourly', 'daily', 'weekly'].includes(schedule)) {
        const response: ApiResponse = {
          success: false,
          error: 'schedule must be one of: hourly, daily, weekly',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate fieldMapping
      if (!fieldMapping || typeof fieldMapping !== 'object') {
        const response: ApiResponse = {
          success: false,
          error: 'fieldMapping is required and must be an object',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate required field mappings
      if (!fieldMapping.sku || !fieldMapping.title || !fieldMapping.description) {
        const response: ApiResponse = {
          success: false,
          error: 'fieldMapping must include sku, title, and description',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Check if configuration already exists
      let existingConfig;
      try {
        existingConfig = await this.productSyncService.getSyncConfiguration(merchantId);
      } catch (configError: any) {
        throw new ProductSyncError(
          `Failed to check existing configuration: ${configError.message}`,
          500,
          'CONFIG_CHECK_FAILED'
        );
      }
      
      const isUpdate = existingConfig !== null;

      // Configure sync (creates or updates based on existence)
      try {
        await this.productSyncService.configureSync({
          merchantId,
          syncType,
          schedule,
          source,
          fieldMapping,
          incrementalSync: incrementalSync !== undefined ? incrementalSync : true,
          webhookSecret,
        });
      } catch (syncError: any) {
        throw new ProductSyncError(
          `Failed to ${isUpdate ? 'update' : 'create'} sync configuration: ${syncError.message}`,
          500,
          'CONFIG_SAVE_FAILED'
        );
      }

      const response: ApiResponse = {
        success: true,
        data: {
          message: isUpdate 
            ? 'Product sync configuration updated successfully' 
            : 'Product sync configuration created successfully',
          merchantId,
          syncType,
          schedule,
          isUpdate,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      // Return 201 for creation, 200 for update
      res.status(isUpdate ? 200 : 201).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Configure sync error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Get sync configuration for a merchant
   * GET /api/merchants/:merchantId/sync/configure
   */
  async getSyncConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      let config;
      try {
        config = await this.productSyncService.getSyncConfiguration(merchantId);
      } catch (configError: any) {
        // Handle cache/database errors gracefully
        if (configError.code === 'ECONNREFUSED' || configError.code === 'ETIMEDOUT') {
          throw new ProductSyncError(
            'Unable to retrieve sync configuration. The service is temporarily unavailable.',
            503,
            'SERVICE_UNAVAILABLE'
          );
        }
        throw configError;
      }

      // Return success with null data if no configuration exists
      // This allows the frontend to show an empty form instead of an error
      const response: ApiResponse = {
        success: true,
        data: config || null,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Get sync config error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Get sync status for a merchant
   * GET /api/merchants/:merchantId/sync/status
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      let status;
      try {
        status = await this.productSyncService.getSyncStatus(merchantId);
      } catch (statusError: any) {
        // Handle cache/database errors gracefully
        if (statusError.code === 'ECONNREFUSED' || statusError.code === 'ETIMEDOUT') {
          throw new ProductSyncError(
            'Unable to retrieve sync status. The service is temporarily unavailable.',
            503,
            'SERVICE_UNAVAILABLE'
          );
        }
        throw statusError;
      }

      const response: ApiResponse = {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Get sync status error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Trigger a manual sync
   * POST /api/merchants/:merchantId/sync/trigger
   */
  async triggerSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      let result;
      try {
        result = await this.productSyncService.triggerSync(merchantId);
      } catch (syncError: any) {
        // Handle specific sync errors
        if (syncError.message?.includes('already in progress')) {
          throw new ProductSyncError(
            'A sync is already in progress for this merchant. Please wait for it to complete.',
            409,
            'SYNC_IN_PROGRESS'
          );
        }
        if (syncError.message?.includes('not found')) {
          throw new ProductSyncError(
            'Sync configuration not found. Please configure sync first.',
            404,
            'CONFIG_NOT_FOUND'
          );
        }
        // Re-throw other errors
        throw syncError;
      }

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Trigger sync error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Get sync history for a merchant
   * GET /api/merchants/:merchantId/sync/history
   */
  async getSyncHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate limit
      if (limit < 1 || limit > 100) {
        const response: ApiResponse = {
          success: false,
          error: 'Limit must be between 1 and 100',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      let history;
      try {
        history = await this.productSyncService.getSyncHistory(merchantId, limit);
      } catch (historyError: any) {
        // Handle cache/database errors gracefully
        if (historyError.code === 'ECONNREFUSED' || historyError.code === 'ETIMEDOUT') {
          throw new ProductSyncError(
            'Unable to retrieve sync history. The service is temporarily unavailable.',
            503,
            'SERVICE_UNAVAILABLE'
          );
        }
        throw historyError;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          history: history || [],
          total: history?.length || 0,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Get sync history error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Process webhook event from merchant's e-commerce platform
   * POST /api/webhooks/products/:merchantId
   */
  async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const payload = req.body;
      const signature = req.headers['x-webhook-signature'] as string;

      // Validate required fields
      if (!payload || Object.keys(payload).length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Payload is required and cannot be empty',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate merchantId format
      if (!merchantId || typeof merchantId !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid merchant ID',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      try {
        await this.productSyncService.processWebhookEvent(merchantId, payload, signature);
      } catch (webhookError: any) {
        // Check if it's a signature validation error
        if (webhookError.message?.includes('Invalid webhook signature')) {
          throw new ProductSyncError(
            'Webhook signature verification failed. Please check your webhook secret.',
            401,
            'INVALID_SIGNATURE'
          );
        }
        // Re-throw other errors
        throw webhookError;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Webhook processed successfully',
          merchantId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Process webhook error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Upload and process file (CSV or JSON)
   * POST /api/merchants/:merchantId/sync/upload
   */
  async uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Check if file exists
      if (!req.file) {
        const response: ApiResponse = {
          success: false,
          error: 'No file uploaded',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate file size (max 10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxFileSize) {
        const response: ApiResponse = {
          success: false,
          error: `File size exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(413).json(response); // Payload Too Large
        return;
      }

      // Validate file is not empty
      if (req.file.size === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Uploaded file is empty',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Get field mapping from request body or use defaults
      let fieldMapping;
      try {
        fieldMapping = req.body.fieldMapping 
          ? (typeof req.body.fieldMapping === 'string' 
              ? JSON.parse(req.body.fieldMapping) 
              : req.body.fieldMapping)
          : {
              sku: 'sku',
              title: 'title',
              description: 'description',
            };
      } catch (parseError: any) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid fieldMapping format. Must be valid JSON.',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate fieldMapping
      if (!fieldMapping.sku || !fieldMapping.title || !fieldMapping.description) {
        const response: ApiResponse = {
          success: false,
          error: 'fieldMapping must include sku, title, and description',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Determine file type and process accordingly
      const fileType = req.file.mimetype;
      const fileName = req.file.originalname.toLowerCase();
      let result;

      try {
        if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
          // Process as CSV
          let content: string;
          try {
            content = req.file.buffer.toString('utf-8');
          } catch (encodingError: any) {
            throw new ProductSyncError(
              'Failed to read CSV file. Please ensure the file is UTF-8 encoded.',
              400,
              'ENCODING_ERROR'
            );
          }

          // Validate CSV has content
          if (!content.trim()) {
            throw new ProductSyncError(
              'CSV file is empty or contains only whitespace',
              400,
              'EMPTY_FILE'
            );
          }

          result = await this.productSyncService.processCsvUpload(merchantId, content, fieldMapping);
        } else if (fileType === 'application/json' || fileName.endsWith('.json')) {
          // Process as JSON
          let content: string;
          try {
            content = req.file.buffer.toString('utf-8');
          } catch (encodingError: any) {
            throw new ProductSyncError(
              'Failed to read JSON file. Please ensure the file is UTF-8 encoded.',
              400,
              'ENCODING_ERROR'
            );
          }

          // Validate JSON has content
          if (!content.trim()) {
            throw new ProductSyncError(
              'JSON file is empty or contains only whitespace',
              400,
              'EMPTY_FILE'
            );
          }

          // Validate JSON is parseable
          try {
            JSON.parse(content);
          } catch (jsonError: any) {
            throw new ProductSyncError(
              `Invalid JSON format: ${jsonError.message}`,
              400,
              'INVALID_JSON'
            );
          }

          result = await this.productSyncService.processJsonUpload(merchantId, content, fieldMapping);
        } else {
          const response: ApiResponse = {
            success: false,
            error: 'Unsupported file type. Please upload CSV or JSON.',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(415).json(response); // Unsupported Media Type
          return;
        }
      } catch (processingError: any) {
        // Re-throw to be caught by outer catch block
        throw processingError;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'File processed successfully',
          productsProcessed: result.stats.totalProducts,
          productsCreated: result.stats.created,
          productsUpdated: result.stats.updated,
          productsFailed: result.stats.failed,
          errors: result.errors || [],
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Upload file error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Upload and process CSV file
   * POST /api/merchants/:merchantId/sync/upload/csv
   * @deprecated Use uploadFile instead
   */
  async uploadCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { csvContent, fieldMapping } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!csvContent || !fieldMapping) {
        const response: ApiResponse = {
          success: false,
          error: 'csvContent and fieldMapping are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate fieldMapping
      if (!fieldMapping.sku || !fieldMapping.title || !fieldMapping.description) {
        const response: ApiResponse = {
          success: false,
          error: 'fieldMapping must include sku, title, and description',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.productSyncService.processCsvUpload(
        merchantId,
        csvContent,
        fieldMapping
      );

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Upload CSV error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }

  /**
   * Upload and process JSON file
   * POST /api/merchants/:merchantId/sync/upload/json
   * @deprecated Use uploadFile instead
   */
  async uploadJson(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { jsonContent, fieldMapping } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!jsonContent || !fieldMapping) {
        const response: ApiResponse = {
          success: false,
          error: 'jsonContent and fieldMapping are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate fieldMapping
      if (!fieldMapping.sku || !fieldMapping.title || !fieldMapping.description) {
        const response: ApiResponse = {
          success: false,
          error: 'fieldMapping must include sku, title, and description',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.productSyncService.processJsonUpload(
        merchantId,
        jsonContent,
        fieldMapping
      );

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const response = createErrorResponse(error, requestId, 'Upload JSON error');
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json(response);
    }
  }
}
