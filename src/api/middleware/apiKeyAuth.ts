import { Request, Response, NextFunction } from 'express';
import { getApiKeyService } from '../../services/ApiKeyService';
import { getApiKeyUsageRepository } from '../../repositories/ApiKeyUsageRepository';
import { ApiResponse, Permission, hasAllPermissions } from '../../types';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    keyId: string;
    merchantId: string;
    permissions: string[];
  };
}

/**
 * Middleware to authenticate requests using API keys
 * Validates the API key from the Authorization header and attaches merchant info to the request
 */
export function apiKeyAuth() {
  const apiKeyService = getApiKeyService();

  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing or invalid API key',
        message: 'Authorization header must be in the format: Bearer <api_key>',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(401).json(response);
    }

    // Extract API key from Authorization header
    const apiKey = authHeader.substring(7);

    try {
      // Validate the API key
      const validation = await apiKeyService.validateKey(apiKey);

      if (!validation.valid) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired API key',
          message: 'The provided API key is invalid, expired, or has been revoked',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        return res.status(401).json(response);
      }

      // Attach API key info to request (including permissions loaded from database)
      req.apiKey = {
        keyId: validation.keyId!,
        merchantId: validation.merchantId!,
        permissions: validation.permissions || [] // Permissions loaded from api_keys table
      };

      // Track API key usage (async, don't wait)
      trackApiKeyUsage(req, res, validation.keyId!).catch(error => {
        console.error('Failed to track API key usage:', error);
      });

      next();
    } catch (error: any) {
      console.error('API key validation error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Authentication failed',
        message: 'An error occurred while validating the API key',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(500).json(response);
    }
  };
}

/**
 * Middleware to require specific permissions for an API key
 * Must be used after apiKeyAuth() middleware
 */
export function requirePermissions(requiredPermissions: Permission[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      const response: ApiResponse = {
        success: false,
        error: 'Authentication required',
        message: 'API key authentication is required for this endpoint',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(401).json(response);
    }

    // Check if API key has all required permissions (handles wildcard internally)
    const hasPermissions = hasAllPermissions(req.apiKey.permissions, requiredPermissions);

    if (!hasPermissions) {
      const response: ApiResponse = {
        success: false,
        error: 'Insufficient permissions',
        message: `This API key does not have the required permissions: ${requiredPermissions.join(', ')}`,
        details: {
          requiredPermissions,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(403).json(response);
    }

    next();
  };
}

/**
 * Track API key usage for analytics and monitoring
 */
async function trackApiKeyUsage(req: ApiKeyRequest, res: Response, keyId: string): Promise<void> {
  try {
    const apiKeyUsageRepository = getApiKeyUsageRepository();
    const startTime = Date.now();

    // Store the start time for response time calculation
    res.on('finish', async () => {
      const responseTime = Date.now() - startTime;

      await apiKeyUsageRepository.create({
        keyId,
        merchantId: req.apiKey!.merchantId,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: responseTime,
        timestamp: new Date(),
        date: new Date(),
      });
    });
  } catch (error) {
    // Don't throw - tracking failures shouldn't break the request
    console.error('Error tracking API key usage:', error);
  }
}
