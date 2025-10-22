import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createSessionManager, SessionManager } from '../../services/SessionManager';
import { getSessionAnalyticsService, SessionAnalyticsService } from '../../services/SessionAnalyticsService';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse, UserSession, UserContext } from '../../types';

export interface CreateSessionRequest {
  merchantId: string;
  userId: string;
  context?: UserContext;
}

export interface UpdateSessionContextRequest {
  context: Partial<UserContext>;
}

export interface SessionAnalyticsRequest {
  merchantId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export class SessionController {
  private sessionManager: SessionManager;
  private sessionAnalyticsService: SessionAnalyticsService;
  private auditLogRepository: AuditLogRepository;

  constructor() {
    this.sessionManager = createSessionManager();
    this.sessionAnalyticsService = getSessionAnalyticsService();
    this.auditLogRepository = new AuditLogRepository();
  }

  /**
   * Create a new session
   * POST /api/sessions
   */
  async createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, userId, context }: CreateSessionRequest = req.body;

      // Validate required fields
      if (!merchantId || !userId) {
        throw new AppError('MerchantId and userId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      // Create session
      const session = await this.sessionManager.createSession({
        merchantId,
        userId,
        context,
      });

      // Log session creation
      await this.auditLogRepository.create({
        merchantId,
        userId,
        sessionId: session.sessionId,
        operation: 'session_create',
        requestPayloadHash: this.hashPayload({ merchantId, userId }),
        responseReference: `session:${session.sessionId}`,
        outcome: 'success',
        actor: req.user?.userId || userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response = {
        sessionId: session.sessionId,
        merchantId: session.merchantId,
        userId: session.userId,
        createdAt: session.createdAt,
        context: session.context,
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(201).json(apiResponse);

    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        userId: req.body.userId,
        operation: 'session_create',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || req.body.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw error;
    }
  }

  /**
   * Get session details
   * GET /api/sessions/:sessionId
   */
  async getSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchantId } = req.query;

      if (!sessionId || !merchantId) {
        throw new AppError('SessionId and merchantId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      const session = await this.sessionManager.getSession(sessionId, merchantId as string);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      const response = {
        sessionId: session.sessionId,
        merchantId: session.merchantId,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        context: session.context,
        messageCount: session.conversationHistory.length,
        conversationHistory: session.conversationHistory,
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update session context
   * PUT /api/sessions/:sessionId/context
   */
  async updateSessionContext(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchantId } = req.query;
      const { context }: UpdateSessionContextRequest = req.body;

      if (!sessionId || !merchantId || !context) {
        throw new AppError('SessionId, merchantId, and context are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      // Check if session exists
      const existingSession = await this.sessionManager.getSession(sessionId, merchantId as string);
      if (!existingSession) {
        throw new AppError('Session not found', 404);
      }

      // Update session context
      await this.sessionManager.updateSession({
        sessionId,
        merchantId: merchantId as string,
        context,
      });

      // Get updated session
      const updatedSession = await this.sessionManager.getSession(sessionId, merchantId as string);

      // Log context update
      await this.auditLogRepository.create({
        merchantId: merchantId as string,
        userId: existingSession.userId,
        sessionId,
        operation: 'session_context_update',
        requestPayloadHash: this.hashPayload({ sessionId, context }),
        responseReference: `session:${sessionId}`,
        outcome: 'success',
        actor: req.user?.userId || existingSession.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response = {
        sessionId: updatedSession!.sessionId,
        merchantId: updatedSession!.merchantId,
        userId: updatedSession!.userId,
        lastActivity: updatedSession!.lastActivity,
        context: updatedSession!.context,
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.query.merchantId as string,
        userId: req.user?.userId || 'unknown',
        sessionId: req.params.sessionId,
        operation: 'session_context_update',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'unknown',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw error;
    }
  }

  /**
   * Delete session
   * DELETE /api/sessions/:sessionId
   */
  async deleteSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchantId } = req.body;

      if (!sessionId || !merchantId) {
        throw new AppError('SessionId and merchantId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      // Check if session exists
      const existingSession = await this.sessionManager.getSession(sessionId, merchantId);
      if (!existingSession) {
        throw new AppError('Session not found', 404);
      }

      // Delete session
      await this.sessionManager.deleteSession(sessionId, merchantId);

      // Log session deletion
      await this.auditLogRepository.create({
        merchantId,
        userId: existingSession.userId,
        sessionId,
        operation: 'session_delete',
        requestPayloadHash: this.hashPayload({ sessionId, merchantId }),
        responseReference: `deleted:${sessionId}`,
        outcome: 'success',
        actor: req.user?.userId || existingSession.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const apiResponse: ApiResponse = {
        success: true,
        data: {
          message: 'Session deleted successfully',
          sessionId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        userId: req.user?.userId || 'unknown',
        sessionId: req.params.sessionId,
        operation: 'session_delete',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'unknown',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw error;
    }
  }

  /**
   * Get user sessions
   * GET /api/sessions/users/:userId
   */
  async getUserSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = '10', merchantId } = req.query;

      if (!userId) {
        throw new AppError('UserId is required', 400);
      }

      // Ensure user can only access their own sessions or admin access
      if (req.user?.userId && req.user.userId !== userId && !req.user.roles?.includes('admin')) {
        throw new AppError('Access denied to user sessions', 403);
      }

      // Ensure merchant access if specified
      if (merchantId && req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      const sessions = await this.sessionManager.getUserSessions(userId, parseInt(limit as string, 10));

      // Filter by merchant if specified
      const filteredSessions = merchantId 
        ? sessions.filter(session => session.merchantId === merchantId)
        : sessions;

      const response = {
        userId,
        merchantId: merchantId || 'all',
        sessions: filteredSessions.map(session => ({
          sessionId: session.sessionId,
          merchantId: session.merchantId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          messageCount: session.conversationHistory.length,
        })),
        totalSessions: filteredSessions.length,
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get session analytics for a merchant
   * GET /api/sessions/analytics
   */
  async getSessionAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, startDate, endDate, userId }: SessionAnalyticsRequest = req.query as any;

      if (!merchantId) {
        throw new AppError('MerchantId is required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      let analytics: any;

      if (startDate && endDate) {
        // Get comprehensive analytics for date range
        analytics = await this.sessionAnalyticsService.getSessionAnalytics(
          merchantId,
          new Date(startDate),
          new Date(endDate)
        );
      } else {
        // Get basic session statistics
        const sessionStats = await this.sessionManager.getSessionStats(merchantId);

        // Get user-specific sessions if userId provided
        let userSessions: UserSession[] = [];
        if (userId) {
          const allUserSessions = await this.sessionManager.getUserSessions(userId, 100);
          userSessions = allUserSessions.filter(session => session.merchantId === merchantId);
        }

        analytics = {
          merchantId,
          period: {
            startDate: startDate || 'all-time',
            endDate: endDate || new Date().toISOString(),
          },
          overview: {
            totalSessions: sessionStats.totalSessions,
            activeSessions: sessionStats.activeSessions,
            avgSessionDuration: sessionStats.avgSessionDuration,
          },
          userSpecific: userId ? {
            userId,
            sessionCount: userSessions.length,
            avgMessagesPerSession: userSessions.length > 0 
              ? userSessions.reduce((sum, s) => sum + s.conversationHistory.length, 0) / userSessions.length 
              : 0,
            lastActivity: userSessions.length > 0 
              ? Math.max(...userSessions.map(s => s.lastActivity.getTime()))
              : null,
          } : undefined,
          timestamp: new Date().toISOString(),
        };
      }

      const apiResponse: ApiResponse = {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup expired sessions for a merchant
   * POST /api/sessions/cleanup
   */
  async cleanupExpiredSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.body;

      if (!merchantId) {
        throw new AppError('MerchantId is required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      // Cleanup expired sessions
      const cleanedCount = await this.sessionManager.cleanupExpiredSessions(merchantId);

      // Log cleanup operation
      await this.auditLogRepository.create({
        merchantId,
        userId: req.user?.userId || 'system',
        operation: 'session_cleanup',
        requestPayloadHash: this.hashPayload({ merchantId }),
        responseReference: `cleaned:${cleanedCount}`,
        outcome: 'success',
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response = {
        merchantId,
        cleanedSessions: cleanedCount,
        message: `Successfully cleaned up ${cleanedCount} expired sessions`,
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        userId: req.user?.userId || 'system',
        operation: 'session_cleanup',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw error;
    }
  }

  /**
   * Get session conversation history with pagination
   * GET /api/sessions/:sessionId/messages
   */
  async getSessionMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchantId, limit = '50', offset = '0' } = req.query;

      if (!sessionId || !merchantId) {
        throw new AppError('SessionId and merchantId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      const session = await this.sessionManager.getSession(sessionId, merchantId as string);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Paginate conversation history
      const messages = session.conversationHistory.slice(offsetNum, offsetNum + limitNum);
      const totalMessages = session.conversationHistory.length;

      const response = {
        sessionId: session.sessionId,
        merchantId: session.merchantId,
        userId: session.userId,
        messages,
        pagination: {
          total: totalMessages,
          limit: limitNum,
          offset: offsetNum,
          hasMore: totalMessages > offsetNum + limitNum,
        },
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Health check endpoint
   * GET /api/sessions/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test session manager connectivity
      const testMerchantId = 'health-check-merchant';
      const testUserId = 'health-check-user';

      // Try to create and delete a test session
      const testSession = await this.sessionManager.createSession({
        merchantId: testMerchantId,
        userId: testUserId,
      });

      await this.sessionManager.deleteSession(testSession.sessionId, testMerchantId);

      const response = {
        service: 'SessionService',
        status: 'healthy',
        components: {
          sessionManager: 'healthy',
          dynamodb: 'healthy',
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      const response = {
        service: 'SessionService',
        status: 'unhealthy',
        components: {
          sessionManager: 'unhealthy',
          dynamodb: 'unhealthy',
        },
        error: error.message,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      const apiResponse: ApiResponse = {
        success: false,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(503).json(apiResponse);
    }
  }

  /**
   * Get billing data for a merchant
   * GET /api/sessions/billing
   */
  async getBillingData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, startDate, endDate } = req.query;

      if (!merchantId || !startDate || !endDate) {
        throw new AppError('MerchantId, startDate, and endDate are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      const billingData = await this.sessionAnalyticsService.generateBillingData(
        merchantId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      const apiResponse: ApiResponse = {
        success: true,
        data: billingData,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Track session usage for billing
   * POST /api/sessions/track-usage
   */
  async trackUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        sessionId,
        merchantId,
        userId,
        messageCount,
        ragQueries,
        llmTokensUsed,
        cacheHits,
        cacheMisses,
        avgResponseTime,
        errors = 0
      } = req.body;

      if (!sessionId || !merchantId || !userId) {
        throw new AppError('SessionId, merchantId, and userId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      await this.sessionAnalyticsService.trackSessionUsage({
        sessionId,
        merchantId,
        userId,
        startTime: new Date(),
        messageCount: messageCount || 0,
        ragQueries: ragQueries || 0,
        llmTokensUsed: llmTokensUsed || 0,
        cacheHits: cacheHits || 0,
        cacheMisses: cacheMisses || 0,
        totalCost: 0, // Will be calculated by the service
        avgResponseTime: avgResponseTime || 0,
        errors,
      });

      const apiResponse: ApiResponse = {
        success: true,
        data: {
          message: 'Usage tracked successfully',
          sessionId,
          merchantId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        userId: req.user?.userId || 'system',
        sessionId: req.body.sessionId,
        operation: 'usage_tracking',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private hashPayload(payload: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

export const sessionController = new SessionController();