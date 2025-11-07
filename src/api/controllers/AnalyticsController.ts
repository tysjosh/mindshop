import { Request, Response } from 'express';
import { AnalyticsService } from '../../services/AnalyticsService';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Get analytics overview for a merchant
   * GET /api/merchants/:merchantId/analytics/overview
   * Query params: startDate (optional), endDate (optional)
   */
  async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Parse dates with defaults (last 30 days)
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date();

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

      const overview = await this.analyticsService.getOverview(merchantId, start, end);

      const response: ApiResponse = {
        success: true,
        data: {
          ...overview,
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
      console.error('Get analytics overview error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get analytics overview',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get query time series data
   * GET /api/merchants/:merchantId/analytics/queries
   * Query params: startDate (optional), endDate (optional), groupBy (optional: 'hour' or 'day')
   */
  async getQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { startDate, endDate, groupBy } = req.query;

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

      // Parse dates with defaults (last 30 days)
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date();

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

      // Validate groupBy parameter
      const validGroupBy = ['hour', 'day'];
      const groupByValue = (groupBy as string) || 'day';
      if (!validGroupBy.includes(groupByValue)) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid groupBy parameter. Must be one of: ${validGroupBy.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const queries = await this.analyticsService.getQueryTimeSeries(
        merchantId,
        start,
        end,
        groupByValue as 'hour' | 'day'
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          groupBy: groupByValue,
          queries,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get query analytics error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get query analytics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get top queries for a merchant
   * GET /api/merchants/:merchantId/analytics/top-queries
   * Query params: startDate (optional), endDate (optional), limit (optional, default: 20)
   */
  async getTopQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { startDate, endDate, limit } = req.query;

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

      // Parse dates with defaults (last 30 days)
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date();

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

      // Parse and validate limit
      const limitValue = limit ? parseInt(limit as string) : 20;
      if (isNaN(limitValue) || limitValue < 1 || limitValue > 100) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid limit parameter. Must be a number between 1 and 100',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const topQueries = await this.analyticsService.getTopQueries(
        merchantId,
        start,
        end,
        limitValue
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: limitValue,
          topQueries,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get top queries error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get top queries',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get performance metrics for a merchant
   * GET /api/merchants/:merchantId/analytics/performance
   * Query params: startDate (optional), endDate (optional)
   */
  async getPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Parse dates with defaults (last 30 days)
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date();

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

      const performance = await this.analyticsService.getPerformanceMetrics(
        merchantId,
        start,
        end
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          ...performance,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get performance metrics error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get performance metrics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get intent distribution for queries
   * GET /api/merchants/:merchantId/analytics/intents
   * Query params: startDate (optional), endDate (optional)
   */
  async getIntents(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Parse dates with defaults (last 30 days)
      const start = startDate 
        ? new Date(startDate as string) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const end = endDate 
        ? new Date(endDate as string) 
        : new Date();

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

      const intents = await this.analyticsService.getIntentDistribution(
        merchantId,
        start,
        end
      );

      const response: ApiResponse = {
        success: true,
        data: {
          merchantId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          intents,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get intent distribution error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get intent distribution',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }
}
