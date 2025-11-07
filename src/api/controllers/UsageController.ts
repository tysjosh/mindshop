import { Request, Response } from 'express';
import { getUsageTrackingService } from '../../services/UsageTrackingService';
import { getUsageLimitsRepository } from '../../repositories/UsageLimitsRepository';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class UsageController {
  private usageTrackingService = getUsageTrackingService();
  private usageLimitsRepository = getUsageLimitsRepository();

  /**
   * Get current usage for a merchant
   * GET /api/merchants/:merchantId/usage/current
   * Query params: startDate (optional), endDate (optional)
   */
  async getCurrentUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
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

      // Parse dates with defaults (current billing period)
      let start: Date;
      let end: Date;

      if (startDate || endDate) {
        // If any date is provided, parse both
        start = startDate 
          ? new Date(startDate as string) 
          : new Date(new Date().setDate(1)); // Default: start of current month
        
        end = endDate 
          ? new Date(endDate as string) 
          : new Date(); // Default: now

        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          const response: ApiResponse = {
            success: false,
            error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }

        if (start > end) {
          const response: ApiResponse = {
            success: false,
            error: 'startDate must be before endDate',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || 'unknown',
          };
          res.status(400).json(response);
          return;
        }
      } else {
        // Default to current billing period (start of month to now)
        start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
      }

      const usage = await this.usageTrackingService.getCurrentUsage(merchantId, start, end);

      const response: ApiResponse = {
        success: true,
        data: {
          ...usage,
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get current usage error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get current usage',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get usage history for a merchant
   * GET /api/merchants/:merchantId/usage/history
   * Query params: metricType, startDate, endDate
   */
  async getUsageHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { metricType, startDate, endDate } = req.query;

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

      // Validate required parameters
      if (!metricType) {
        const response: ApiResponse = {
          success: false,
          error: 'metricType query parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate metricType
      const validMetricTypes = ['queries', 'documents', 'api_calls', 'storage_gb'];
      if (!validMetricTypes.includes(metricType as string)) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid metricType. Must be one of: ${validMetricTypes.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Parse dates with defaults
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30)); // Default: 30 days ago
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date(); // Default: now

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      if (start > end) {
        const response: ApiResponse = {
          success: false,
          error: 'startDate must be before endDate',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const history = await this.usageTrackingService.getUsageHistory(
        merchantId,
        metricType as string,
        start,
        end
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          metricType,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          history,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get usage history error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get usage history',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get usage forecast for a merchant
   * GET /api/merchants/:merchantId/usage/forecast
   * Query params: metricType
   */
  async getUsageForecast(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { metricType } = req.query;

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

      // Validate required parameters
      if (!metricType) {
        const response: ApiResponse = {
          success: false,
          error: 'metricType query parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate metricType
      const validMetricTypes = ['queries', 'documents', 'api_calls', 'storage_gb'];
      if (!validMetricTypes.includes(metricType as string)) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid metricType. Must be one of: ${validMetricTypes.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const forecast = await this.usageTrackingService.getUsageForecast(
        merchantId,
        metricType as string
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          metricType,
          ...forecast,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get usage forecast error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get usage forecast',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Set or update usage limits for a merchant (admin only)
   * POST /api/merchants/:merchantId/usage/limits
   */
  async setUsageLimits(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { plan, queriesPerMonth, documentsMax, apiCallsPerDay, storageGbMax } = req.body;

      // Validate admin access
      if (!req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Admin access required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!plan || queriesPerMonth === undefined || documentsMax === undefined || 
          apiCallsPerDay === undefined || storageGbMax === undefined) {
        const response: ApiResponse = {
          success: false,
          error: 'All limit fields are required: plan, queriesPerMonth, documentsMax, apiCallsPerDay, storageGbMax',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate plan
      const validPlans = ['starter', 'professional', 'enterprise'];
      if (!validPlans.includes(plan)) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid plan. Must be one of: ${validPlans.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate numeric values
      if (queriesPerMonth < 0 || documentsMax < 0 || apiCallsPerDay < 0 || storageGbMax < 0) {
        const response: ApiResponse = {
          success: false,
          error: 'All limit values must be non-negative numbers',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Upsert usage limits
      const limits = await this.usageLimitsRepository.upsert(merchantId, {
        plan,
        queriesPerMonth,
        documentsMax,
        apiCallsPerDay,
        storageGbMax,
      });

      const response: ApiResponse = {
        success: true,
        data: limits,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Set usage limits error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to set usage limits',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }
}
