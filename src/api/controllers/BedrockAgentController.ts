import { Request, Response } from 'express';
import { BedrockAgentService, SessionManager, createBedrockAgentService, createSessionManager } from '../../services';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { createDatabaseConnection } from '../../database/connection';
import { ApiResponse } from '../../types';
import { sendSuccess, sendError, getRequestId } from '../utils/responseFormatter';
import { v4 as uuidv4 } from 'uuid';

export class BedrockAgentController {
  private bedrockAgentService: BedrockAgentService;
  private sessionManager: SessionManager;

  constructor(bedrockAgentService: BedrockAgentService, sessionManager: SessionManager) {
    this.bedrockAgentService = bedrockAgentService;
    this.sessionManager = sessionManager;
  }

  /**
   * Process chat request through Bedrock Agent
   */
  async chat(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { query, merchant_id, user_id, session_id, user_context } = req.body;

      // Validate required fields
      if (!query || !merchant_id || !user_id) {
        sendError(res, 'Missing required fields: query, merchant_id, user_id', 400, requestId);
        return;
      }

      // Process chat request
      const response = await this.bedrockAgentService.processChat({
        query,
        merchantId: merchant_id,
        userId: user_id,
        sessionId: session_id,
        userContext: user_context,
      });

      sendSuccess(res, response, 200, requestId);

    } catch (error) {
      console.error('Chat processing error:', error);
      sendError(res, error instanceof Error ? error.message : 'Chat processing failed', 500, requestId);
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { sessionId } = req.params;
      const { merchant_id } = req.query;

      if (!sessionId || !merchant_id) {
        sendError(res, 'Missing required parameters: sessionId, merchant_id', 400, requestId);
        return;
      }

      const history = await this.bedrockAgentService.getSessionHistory(
        sessionId,
        merchant_id as string
      );

      sendSuccess(res, {
        session_id: sessionId,
        merchant_id,
        conversation_history: history,
        total_messages: history.length,
      }, 200, requestId);

    } catch (error) {
      console.error('Session history error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to retrieve session history', 500, requestId);
    }
  }

  /**
   * Create new session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchant_id, user_id, context } = req.body;

      if (!merchant_id || !user_id) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['merchant_id', 'user_id'],
        });
        return;
      }

      const session = await this.sessionManager.createSession({
        merchantId: merchant_id,
        userId: user_id,
        context,
      });

      res.status(201).json({
        success: true,
        data: {
          session_id: session.sessionId,
          merchant_id: session.merchantId,
          user_id: session.userId,
          created_at: session.createdAt,
          context: session.context,
        },
      });

    } catch (error) {
      console.error('Session creation error:', error);
      res.status(500).json({
        error: 'Failed to create session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get session details
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchant_id } = req.query;

      if (!sessionId || !merchant_id) {
        res.status(400).json({
          error: 'Missing required parameters',
          required: ['sessionId', 'merchant_id'],
        });
        return;
      }

      const session = await this.sessionManager.getSession(
        sessionId,
        merchant_id as string
      );

      if (!session) {
        res.status(404).json({
          error: 'Session not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          session_id: session.sessionId,
          merchant_id: session.merchantId,
          user_id: session.userId,
          created_at: session.createdAt,
          last_activity: session.lastActivity,
          context: session.context,
          message_count: session.conversationHistory.length,
        },
      });

    } catch (error) {
      console.error('Session retrieval error:', error);
      res.status(500).json({
        error: 'Failed to retrieve session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear session
   */
  async clearSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchant_id } = req.body;

      if (!sessionId || !merchant_id) {
        res.status(400).json({
          error: 'Missing required parameters',
          required: ['sessionId', 'merchant_id'],
        });
        return;
      }

      await this.bedrockAgentService.clearSession(sessionId, merchant_id);

      res.json({
        success: true,
        message: 'Session cleared successfully',
      });

    } catch (error) {
      console.error('Session clear error:', error);
      res.status(500).json({
        error: 'Failed to clear session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = '10' } = req.query;

      if (!userId) {
        res.status(400).json({
          error: 'Missing required parameter: userId',
        });
        return;
      }

      const sessions = await this.sessionManager.getUserSessions(
        userId,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: {
          user_id: userId,
          sessions: sessions.map(session => ({
            session_id: session.sessionId,
            merchant_id: session.merchantId,
            created_at: session.createdAt,
            last_activity: session.lastActivity,
            message_count: session.conversationHistory.length,
          })),
          total_sessions: sessions.length,
        },
      });

    } catch (error) {
      console.error('User sessions error:', error);
      res.status(500).json({
        error: 'Failed to retrieve user sessions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get session statistics for a merchant
   */
  async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      const { merchant_id } = req.query;

      if (!merchant_id) {
        res.status(400).json({
          error: 'Missing required parameter: merchant_id',
        });
        return;
      }

      const stats = await this.bedrockAgentService.getSessionStats(merchant_id as string);

      res.json({
        success: true,
        data: {
          merchant_id,
          ...stats,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('Session stats error:', error);
      res.status(500).json({
        error: 'Failed to retrieve session statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check endpoint
   */
  async health(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.bedrockAgentService.healthCheck();

      res.status(health.status === 'healthy' ? 200 : 503).json({
        success: health.status === 'healthy',
        ...health,
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Parse intent (for debugging/testing)
   */
  async parseIntent(req: Request, res: Response): Promise<void> {
    try {
      const { query, merchant_id, user_context } = req.body;

      if (!query || !merchant_id) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['query', 'merchant_id'],
        });
        return;
      }

      const intent = await this.bedrockAgentService.parseIntent(query, {
        merchantId: merchant_id,
        userContext: user_context,
      });

      res.json({
        success: true,
        data: intent,
      });

    } catch (error) {
      console.error('Intent parsing error:', error);
      res.status(500).json({
        error: 'Failed to parse intent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get detailed session summary with audit information
   */
  async getDetailedSessionSummary(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { merchant_id } = req.query;

      if (!sessionId || !merchant_id) {
        res.status(400).json({
          error: 'Missing required parameters',
          required: ['sessionId', 'merchant_id'],
        });
        return;
      }

      const summary = await this.bedrockAgentService.getDetailedSessionSummary(
        sessionId,
        merchant_id as string
      );

      res.json({
        success: true,
        data: summary,
      });

    } catch (error) {
      console.error('Session summary error:', error);
      res.status(500).json({
        error: 'Failed to get session summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Search audit entries
   */
  async searchAuditEntries(req: Request, res: Response): Promise<void> {
    try {
      const { merchant_id, user_id, session_id, start_date, end_date, limit } = req.query;

      if (!merchant_id) {
        res.status(400).json({
          error: 'Missing required parameter: merchant_id',
        });
        return;
      }

      const query = {
        merchantId: merchant_id as string,
        userId: user_id as string | undefined,
        sessionId: session_id as string | undefined,
        startDate: start_date ? new Date(start_date as string) : undefined,
        endDate: end_date ? new Date(end_date as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      };

      const results = await this.bedrockAgentService.searchAuditEntries(query);

      res.json({
        success: true,
        data: results,
      });

    } catch (error) {
      console.error('Audit search error:', error);
      res.status(500).json({
        error: 'Failed to search audit entries',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const { merchant_id, start_date, end_date } = req.body;

      if (!merchant_id || !start_date || !end_date) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['merchant_id', 'start_date', 'end_date'],
        });
        return;
      }

      const report = await this.bedrockAgentService.generateComplianceReport(
        merchant_id,
        new Date(start_date),
        new Date(end_date)
      );

      res.json({
        success: true,
        data: report,
      });

    } catch (error) {
      console.error('Compliance report error:', error);
      res.status(500).json({
        error: 'Failed to generate compliance report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Factory function to create controller with dependencies
export async function createBedrockAgentController(): Promise<BedrockAgentController> {
  const db = await createDatabaseConnection();
  const auditLogRepository = new AuditLogRepository();
  const sessionManager = createSessionManager();
  const bedrockAgentService = createBedrockAgentService(sessionManager, auditLogRepository);

  return new BedrockAgentController(bedrockAgentService, sessionManager);
}