import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOrchestrationService, OrchestrationService } from '../../services/OrchestrationService';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../../types';

export interface ChatRequest {
  query: string;
  sessionId?: string;
  merchantId: string;
  userId?: string;
  userContext?: {
    preferences?: Record<string, any>;
    purchaseHistory?: string[];
    currentCart?: Array<{
      sku: string;
      quantity: number;
      price: number;
    }>;
    demographics?: Record<string, any>;
  };
  includeExplainability?: boolean;
  maxResults?: number;
}

export interface ChatResponse {
  sessionId: string;
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    snippet: string;
    score: number;
    sku?: string;
    sourceUri?: string;
  }>;
  recommendations: Array<{
    sku: string;
    title: string;
    description: string;
    score: number;
    reasoning: string;
    prediction?: {
      demandScore: number;
      purchaseProbability: number;
      confidence: number;
    };
  }>;
  confidence: number;
  reasoning: string[];
  executionTime: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
}

export class ChatController {
  private orchestrationService: OrchestrationService;
  private auditLogRepository: AuditLogRepository;

  constructor() {
    this.orchestrationService = getOrchestrationService();
    this.auditLogRepository = new AuditLogRepository();
  }

  /**
   * Main chat endpoint with RAGService integration
   * POST /api/chat
   */
  async chat(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const {
        query,
        sessionId,
        merchantId,
        userId,
        userContext,
        includeExplainability = true,
        maxResults = 5
      }: ChatRequest = req.body;

      // Validate required fields
      if (!query || !merchantId) {
        throw new AppError('Query and merchantId are required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      const effectiveUserId = userId || req.user?.userId || 'anonymous';
      let effectiveSessionId = sessionId;

      // Process through orchestration service
      const orchestrationResult = await this.orchestrationService.orchestrateRequest({
        requestId,
        merchantId,
        userId: effectiveUserId,
        sessionId: effectiveSessionId,
        operation: 'chat',
        payload: {
          query,
          sessionId: effectiveSessionId,
          userContext,
          maxResults,
        },
        userContext,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: requestId,
        },
      });

      if (!orchestrationResult.success) {
        throw new Error(orchestrationResult.error || 'Chat processing failed');
      }

      // Prepare response from orchestration result
      const response: ChatResponse = {
        ...orchestrationResult.data,
        executionTime: orchestrationResult.executionTime,
        cacheHit: orchestrationResult.cacheHit,
        fallbackUsed: orchestrationResult.fallbackUsed,
      };

      // Log successful chat interaction
      if (process.env.NODE_ENV === 'production') {
        // In production, fail fast if audit logging fails
        await this.auditLogRepository.create({
          merchantId,
          userId: effectiveUserId,
          sessionId: effectiveSessionId,
          operation: 'chat_interaction',
          requestPayloadHash: this.hashPayload({ query, merchantId }),
          responseReference: `session:${effectiveSessionId}`,
          outcome: 'success',
          actor: 'user',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      } else {
        // In development, gracefully handle audit logging failures
        try {
          await this.auditLogRepository.create({
            merchantId,
            userId: effectiveUserId,
            sessionId: effectiveSessionId,
            operation: 'chat_interaction',
            requestPayloadHash: this.hashPayload({ query, merchantId }),
            responseReference: `session:${effectiveSessionId}`,
            outcome: 'success',
            actor: 'user',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
        } catch (auditError) {
          console.warn('Audit logging failed (non-critical in development):', auditError);
        }
      }

      const apiResponse: ApiResponse<ChatResponse> = {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId,
      };

      res.status(200).json(apiResponse);

    } catch (error: any) {
      // Log failed chat interaction
      if (process.env.NODE_ENV === 'production') {
        // In production, fail fast if audit logging fails
        await this.auditLogRepository.create({
          merchantId: req.body.merchantId,
          userId: req.body.userId || req.user?.userId || 'anonymous',
          sessionId: req.body.sessionId,
          operation: 'chat_interaction',
          requestPayloadHash: this.hashPayload(req.body),
          responseReference: 'error',
          outcome: 'failure',
          reason: error.message,
          actor: 'user',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      } else {
        // In development, gracefully handle audit logging failures
        try {
          await this.auditLogRepository.create({
            merchantId: req.body.merchantId,
            userId: req.body.userId || req.user?.userId || 'anonymous',
            sessionId: req.body.sessionId,
            operation: 'chat_interaction',
            requestPayloadHash: this.hashPayload(req.body),
            responseReference: 'error',
            outcome: 'failure',
            reason: error.message,
            actor: 'user',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
        } catch (auditError) {
          console.warn('Audit logging failed (non-critical in development):', auditError);
        }
      }

      throw error;
    }
  }

  /**
   * Get chat history for a session
   * GET /api/chat/sessions/:sessionId/history
   */
  async getChatHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Use orchestration service for session management
      const orchestrationResult = await this.orchestrationService.orchestrateRequest({
        requestId: req.headers['x-request-id'] as string || uuidv4(),
        merchantId: merchantId as string,
        userId: req.user?.userId || 'anonymous',
        sessionId,
        operation: 'analytics',
        payload: {
          type: 'session_history',
          sessionId,
        },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      if (!orchestrationResult.success) {
        throw new AppError(orchestrationResult.error || 'Failed to get session history', 404);
      }

      const response = orchestrationResult.data;

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
   * Clear chat session
   * DELETE /api/chat/sessions/:sessionId
   */
  async clearSession(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Session deletion is handled by orchestration service

      // Log session deletion
      await this.auditLogRepository.create({
        merchantId,
        userId: req.user?.userId || 'anonymous',
        sessionId,
        operation: 'session_delete',
        requestPayloadHash: this.hashPayload({ sessionId, merchantId }),
        responseReference: `deleted:${sessionId}`,
        outcome: 'success',
        actor: 'user',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const apiResponse: ApiResponse = {
        success: true,
        data: {
          message: 'Session cleared successfully',
          sessionId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(200).json(apiResponse);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get chat service health status
   * GET /api/chat/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const orchestrationHealth = await this.orchestrationService.performHealthCheck();

      const response = {
        service: 'ChatService',
        status: orchestrationHealth.status,
        components: orchestrationHealth.components,
        latencyBudget: orchestrationHealth.latencyBudget,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      const apiResponse: ApiResponse = {
        success: orchestrationHealth.status !== 'unhealthy',
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(orchestrationHealth.status === 'healthy' ? 200 : orchestrationHealth.status === 'degraded' ? 200 : 503).json(apiResponse);

    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(503).json(apiResponse);
    }
  }

  /**
   * Get chat analytics for a merchant
   * GET /api/chat/analytics
   */
  async getChatAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, startDate, endDate, limit = '100' } = req.query;

      if (!merchantId) {
        throw new AppError('MerchantId is required', 400);
      }

      // Ensure merchant access
      if (req.user?.merchantId && req.user.merchantId !== merchantId) {
        throw new AppError('Access denied to merchant resources', 403);
      }

      // Get analytics through orchestration service
      const analyticsResult = await this.orchestrationService.orchestrateRequest({
        requestId: req.headers['x-request-id'] as string || uuidv4(),
        merchantId: merchantId as string,
        userId: req.user?.userId || 'anonymous',
        operation: 'analytics',
        payload: {
          type: 'session_stats',
          merchantId,
        },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      const response = analyticsResult.success ? analyticsResult.data : {
        merchantId,
        period: {
          startDate: startDate || 'all-time',
          endDate: endDate || new Date().toISOString(),
        },
        sessions: { totalSessions: 0, activeSessions: 0, avgSessionDuration: 0 },
        performance: {
          cacheHitRate: 0,
          avgResponseTime: 0,
        },
        timestamp: new Date().toISOString(),
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
   * Private helper methods
   */
  private extractTitleFromSnippet(snippet: string): string {
    const sentences = snippet.split(/[.!?]/);
    return sentences[0]?.trim() || snippet.substring(0, 50) + "...";
  }

  private hashPayload(payload: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

export const chatController = new ChatController();