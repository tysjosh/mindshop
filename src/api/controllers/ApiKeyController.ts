import { Request, Response } from 'express';
import { getApiKeyService } from '../../services/ApiKeyService';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class ApiKeyController {
  private apiKeyService = getApiKeyService();

  /**
   * Create a new API key
   * POST /api/merchants/:merchantId/api-keys
   */
  async createKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { name, environment, permissions, expiresInDays } = req.body;

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
      if (!name || !environment) {
        const response: ApiResponse = {
          success: false,
          error: 'Name and environment are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate environment
      if (environment !== 'development' && environment !== 'production') {
        const response: ApiResponse = {
          success: false,
          error: 'Environment must be either "development" or "production"',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate expiresInDays if provided
      if (expiresInDays !== undefined && (typeof expiresInDays !== 'number' || expiresInDays <= 0)) {
        const response: ApiResponse = {
          success: false,
          error: 'expiresInDays must be a positive number',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.apiKeyService.generateKey({
        merchantId,
        name,
        environment,
        permissions,
        expiresInDays,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...result,
          warning: 'This is the only time the full API key will be shown. Please store it securely.',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create API key error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to create API key',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * List all API keys for a merchant
   * GET /api/merchants/:merchantId/api-keys
   */
  async listKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const includeRevoked = req.query.includeRevoked === 'true';

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

      const keys = await this.apiKeyService.listKeys(merchantId, includeRevoked);

      // Remove sensitive data (keyHash) from response
      const sanitizedKeys = keys.map(key => ({
        keyId: key.keyId,
        name: key.name,
        keyPrefix: key.keyPrefix,
        environment: key.environment,
        permissions: key.permissions,
        status: key.status,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }));

      const response: ApiResponse = {
        success: true,
        data: {
          keys: sanitizedKeys,
          total: sanitizedKeys.length,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('List API keys error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to list API keys',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Revoke an API key
   * DELETE /api/merchants/:merchantId/api-keys/:keyId
   */
  async revokeKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, keyId } = req.params;

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

      const revokedKey = await this.apiKeyService.revokeKey(keyId);

      // Verify the key belongs to the merchant
      if (revokedKey.merchantId !== merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          keyId: revokedKey.keyId,
          status: revokedKey.status,
          message: 'API key revoked successfully',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Revoke API key error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to revoke API key',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Rotate an API key
   * POST /api/merchants/:merchantId/api-keys/:keyId/rotate
   */
  async rotateKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, keyId } = req.params;
      const { gracePeriodDays = 7 } = req.body;

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

      // Validate gracePeriodDays if provided
      if (gracePeriodDays !== undefined && (typeof gracePeriodDays !== 'number' || gracePeriodDays < 0)) {
        const response: ApiResponse = {
          success: false,
          error: 'gracePeriodDays must be a non-negative number',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const newKey = await this.apiKeyService.rotateKey(keyId, gracePeriodDays);

      const response: ApiResponse = {
        success: true,
        data: {
          ...newKey,
          oldKeyId: keyId,
          gracePeriodDays,
          message: `New API key generated. Old key will expire in ${gracePeriodDays} days.`,
          warning: 'This is the only time the full API key will be shown. Please store it securely.',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Rotate API key error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to rotate API key',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get usage statistics for an API key
   * GET /api/merchants/:merchantId/api-keys/:keyId/usage
   */
  async getKeyUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, keyId } = req.params;
      const { startDate, endDate } = req.query;

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

      // Parse dates if provided
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        parsedStartDate = new Date(startDate as string);
        if (isNaN(parsedStartDate.getTime())) {
          const response: ApiResponse = {
            success: false,
            error: 'Invalid startDate format',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }
      }

      if (endDate) {
        parsedEndDate = new Date(endDate as string);
        if (isNaN(parsedEndDate.getTime())) {
          const response: ApiResponse = {
            success: false,
            error: 'Invalid endDate format',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }
      }

      const usage = await this.apiKeyService.getKeyUsage(keyId, parsedStartDate, parsedEndDate);

      const response: ApiResponse = {
        success: true,
        data: {
          keyId,
          usage,
          period: {
            startDate: parsedStartDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: parsedEndDate || new Date(),
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get API key usage error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get API key usage',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }
}
