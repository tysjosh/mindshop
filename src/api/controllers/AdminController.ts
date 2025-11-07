import { Request, Response } from 'express';
import { getMerchantRepository } from '../../repositories/MerchantRepository';
import { getAuditLogRepository } from '../../repositories/AuditLogRepository';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { healthController } from './HealthController';
import { generateImpersonationToken } from '../middleware/impersonation';

/**
 * AdminController
 * 
 * Handles administrative operations for managing merchants and system health.
 * All endpoints require admin role (enforced by requireRoles middleware).
 * 
 * Implemented Endpoints:
 * - GET /api/admin/merchants - List all merchants with pagination and filtering
 * - GET /api/admin/merchants/:merchantId - Get detailed merchant information
 * - PUT /api/admin/merchants/:merchantId/status - Update merchant status (activate, suspend, delete)
 * - POST /api/admin/merchants/:merchantId/impersonate - Impersonate a merchant for debugging
 * - GET /api/admin/system/health - Get comprehensive system health status
 * - GET /api/admin/system/metrics - Get system metrics and statistics
 * - GET /api/admin/errors - Get system errors and audit logs
 * 
 * @see .kiro/specs/merchant-platform/tasks.md - Task 13.1 Admin API Endpoints
 * @see .kiro/specs/merchant-platform/design.md - Admin Panel Design
 */
export class AdminController {
  private merchantRepository = getMerchantRepository();
  private auditLogRepository = getAuditLogRepository();

  /**
   * Get list of all merchants with pagination and filtering
   * GET /api/admin/merchants
   */
  async getMerchants(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        status,
        search 
      } = req.query;

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Validate pagination parameters
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 100)',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid offset parameter (must be >= 0)',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Get merchants with optional status filter and search
      const merchants = await this.merchantRepository.findAll(
        limitNum,
        offsetNum,
        status as string | undefined,
        search as string | undefined
      );

      // Get total count for pagination
      const totalCount = await this.merchantRepository.count(
        status as string | undefined,
        search as string | undefined
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchants,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: totalCount,
            hasMore: offsetNum + limitNum < totalCount,
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get merchants error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve merchants',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get detailed information about a specific merchant
   * GET /api/admin/merchants/:merchantId
   */
  async getMerchantDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Get merchant details
      const merchant = await this.merchantRepository.findByMerchantId(merchantId);

      if (!merchant) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Get recent audit logs for this merchant
      const recentLogs = await this.auditLogRepository.findByMerchant(merchantId, 20, 0);

      const response: ApiResponse = {
        success: true,
        data: {
          merchant,
          recentActivity: recentLogs,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get merchant details error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve merchant details',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Update merchant status (activate, suspend, delete)
   * PUT /api/admin/merchants/:merchantId/status
   */
  async updateMerchantStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { status, reason } = req.body;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      if (!status) {
        const response: ApiResponse = {
          success: false,
          error: 'Status is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate status value
      const validStatuses = ['pending_verification', 'active', 'suspended', 'deleted'];
      if (!validStatuses.includes(status)) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Check if merchant exists
      const merchant = await this.merchantRepository.findByMerchantId(merchantId);
      if (!merchant) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Update merchant status
      const updatedMerchant = await this.merchantRepository.updateStatus(
        merchantId,
        status as 'pending_verification' | 'active' | 'suspended' | 'deleted'
      );

      // Log the admin action
      await this.auditLogRepository.create({
        merchantId,
        userId: req.user?.userId || 'system',
        sessionId: undefined,
        operation: 'admin.merchant.status_update',
        requestPayloadHash: JSON.stringify({ status, reason }),
        responseReference: updatedMerchant.id,
        outcome: 'success',
        reason: reason || `Status updated to ${status} by admin`,
        actor: req.user?.email || req.user?.userId || 'admin',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const response: ApiResponse = {
        success: true,
        data: {
          merchant: updatedMerchant,
          message: `Merchant status updated to ${status}`,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update merchant status error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to update merchant status',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Impersonate a merchant (for debugging/support)
   * POST /api/admin/merchants/:merchantId/impersonate
   */
  async impersonateMerchant(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Check if merchant exists
      const merchant = await this.merchantRepository.findByMerchantId(merchantId);
      if (!merchant) {
        const response: ApiResponse = {
          success: false,
          error: 'Merchant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Generate impersonation token
      const impersonationToken = generateImpersonationToken({
        adminUserId: req.user?.userId || 'unknown',
        adminEmail: req.user?.email || 'unknown',
        merchantId: merchant.merchantId,
      });

      // Log the impersonation action
      await this.auditLogRepository.create({
        merchantId,
        userId: req.user?.userId || 'system',
        sessionId: undefined,
        operation: 'admin.merchant.impersonate',
        requestPayloadHash: JSON.stringify({ merchantId }),
        responseReference: merchant.id,
        outcome: 'success',
        reason: `Admin ${req.user?.email || req.user?.userId} started impersonating merchant`,
        actor: req.user?.email || req.user?.userId || 'admin',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Return impersonation token and merchant info
      const response: ApiResponse = {
        success: true,
        data: {
          merchantId: merchant.merchantId,
          email: merchant.email,
          companyName: merchant.companyName,
          impersonationToken,
          expiresIn: 3600, // 1 hour in seconds
          message: 'Impersonation session created. Use the X-Impersonation-Token header to act as this merchant.',
          warning: 'All actions will be logged and attributed to the impersonating admin.',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Impersonate merchant error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to impersonate merchant',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get system health status
   * GET /api/admin/system/health
   */
  async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Delegate to the existing health controller
      await healthController.healthCheck(req, res);
    } catch (error: any) {
      console.error('Get system health error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve system health',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get system metrics and statistics
   * GET /api/admin/system/metrics
   */
  async getSystemMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { period = '24h' } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setHours(startDate.getHours() - 24);
      }

      // Get merchant statistics
      const totalMerchants = await this.merchantRepository.count();
      const activeMerchants = await this.merchantRepository.count('active');
      const suspendedMerchants = await this.merchantRepository.count('suspended');
      const pendingMerchants = await this.merchantRepository.count('pending_verification');

      // Get system resource usage
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      const response: ApiResponse = {
        success: true,
        data: {
          period,
          timestamp: new Date().toISOString(),
          merchants: {
            total: totalMerchants,
            active: activeMerchants,
            suspended: suspendedMerchants,
            pending: pendingMerchants,
          },
          system: {
            uptime: uptime,
            memory: {
              rss: memoryUsage.rss,
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
              external: memoryUsage.external,
            },
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get system metrics error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve system metrics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get system errors and audit logs
   * GET /api/admin/errors
   */
  async getErrors(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        limit = 100, 
        offset = 0,
        merchantId,
        startDate,
        endDate 
      } = req.query;

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Validate pagination parameters
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 1000)',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid offset parameter (must be >= 0)',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Parse date parameters if provided
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate as string);
        if (isNaN(start.getTime())) {
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
        end = new Date(endDate as string);
        if (isNaN(end.getTime())) {
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

      // Get all audit logs with filters
      const allLogs = await this.auditLogRepository.findAll(
        limitNum,
        offsetNum,
        merchantId as string | undefined,
        start,
        end
      );

      // Filter for errors only (outcome !== 'success')
      const errorLogs = allLogs.filter(log => log.outcome !== 'success');

      // Get total count of errors with same filters
      const totalCount = await this.auditLogRepository.countAll(
        merchantId as string | undefined,
        start,
        end
      );

      const response: ApiResponse = {
        success: true,
        data: {
          errors: errorLogs,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: totalCount,
            hasMore: offsetNum + limitNum < totalCount,
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get errors error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve errors',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }
}

// Export singleton instance
let adminControllerInstance: AdminController | null = null;

export const getAdminController = (): AdminController => {
  if (!adminControllerInstance) {
    adminControllerInstance = new AdminController();
  }
  return adminControllerInstance;
};
