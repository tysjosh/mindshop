import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SemanticRetrievalService } from '../../services/SemanticRetrievalService';
import { SemanticRetrievalParams, ApiResponse } from '../../types';
import { validateRequest } from '../middleware/validation';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { sendSuccess, sendError, getRequestId } from '../utils/responseFormatter';

export class SemanticRetrievalController {
  private semanticRetrievalService = new SemanticRetrievalService();
  private auditLogRepository = new AuditLogRepository();

  /**
   * Deploy semantic retriever predictor for a merchant
   * POST /api/semantic-retrieval/deploy
   */
  async deployPredictor(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.body;
      
      if (!merchantId) {
        sendError(res, 'merchantId is required', 400, requestId);
        return;
      }

      await this.semanticRetrievalService.deploySemanticRetriever(merchantId);

      // Log the deployment
      await this.auditLogRepository.create({
        merchantId,
        operation: 'deploy_semantic_retriever',
        requestPayloadHash: this.hashPayload({ merchantId }),
        responseReference: `predictor:semantic_retriever_${merchantId}`,
        outcome: 'success',
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      sendSuccess(res, {
        predictorName: `semantic_retriever_${merchantId}`,
        merchantId,
        status: 'deployed'
      }, 201, requestId);
    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        operation: 'deploy_semantic_retriever',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      sendError(res, error.message, 500, requestId);
    }
  }

  /**
   * Enhanced semantic document retrieval
   * POST /api/semantic-retrieval/search
   */
  async searchDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const params: SemanticRetrievalParams = {
        query: req.body.query,
        merchantId: req.body.merchantId,
        limit: req.body.limit || 5,
        threshold: req.body.threshold || 0.7,
        includeMetadata: req.body.includeMetadata !== false,
        documentTypes: req.body.documentTypes
      };

      // Validate required parameters
      if (!params.query || !params.merchantId) {
        sendError(res, 'query and merchantId are required', 400, requestId);
        return;
      }

      const result = await this.semanticRetrievalService.retrieveDocuments(params);

      // Log the retrieval
      await this.auditLogRepository.create({
        merchantId: params.merchantId,
        operation: 'semantic_retrieval',
        requestPayloadHash: this.hashPayload(params),
        responseReference: `results:${result.length}`,
        outcome: 'success',
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        operation: 'semantic_retrieval',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * REST API interface for semantic retrieval
   * POST /api/semantic-retrieval/rest-search
   */
  async restSearchDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const params: SemanticRetrievalParams = {
        query: req.body.query,
        merchantId: req.body.merchantId,
        limit: req.body.limit || 5,
        threshold: req.body.threshold || 0.7,
        includeMetadata: req.body.includeMetadata !== false,
        documentTypes: req.body.documentTypes
      };

      if (!params.query || !params.merchantId) {
        res.status(400).json({
          success: false,
          error: 'query and merchantId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      const result = await this.semanticRetrievalService.retrieveViaREST(params);

      await this.auditLogRepository.create({
        merchantId: params.merchantId,
        operation: 'semantic_retrieval_rest',
        requestPayloadHash: this.hashPayload(params),
        responseReference: `results:${result.length}`,
        outcome: 'success',
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        operation: 'semantic_retrieval_rest',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * Validate grounding for retrieved documents
   * POST /api/semantic-retrieval/validate-grounding
   */
  async validateGrounding(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, documents, merchantId } = req.body;

      if (!query || !documents || !merchantId) {
        res.status(400).json({
          success: false,
          error: 'query, documents, and merchantId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      const groundingResults = await this.semanticRetrievalService.validateGrounding(
        query,
        documents
      );

      await this.auditLogRepository.create({
        merchantId,
        operation: 'grounding_validation',
        requestPayloadHash: this.hashPayload({ query, documentsCount: documents.length }),
        responseReference: `validated:${Object.keys(groundingResults).length}`,
        outcome: 'success',
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: {
          groundingResults,
          totalDocuments: documents.length,
          passedCount: Object.values(groundingResults).filter(Boolean).length
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.body.merchantId,
        operation: 'grounding_validation',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'anonymous',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * Get predictor status and health
   * GET /api/semantic-retrieval/status/:merchantId
   */
  async getPredictorStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: 'merchantId is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      const status = await this.semanticRetrievalService.getPredictorStatus(merchantId);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * Update predictor configuration
   * PUT /api/semantic-retrieval/config/:merchantId
   */
  async updatePredictorConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { config } = req.body;

      if (!merchantId || !config) {
        res.status(400).json({
          success: false,
          error: 'merchantId and config are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      await this.semanticRetrievalService.updatePredictorConfig(merchantId, config);

      await this.auditLogRepository.create({
        merchantId,
        operation: 'update_predictor_config',
        requestPayloadHash: this.hashPayload(config),
        responseReference: `predictor:semantic_retriever_${merchantId}`,
        outcome: 'success',
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        data: {
          merchantId,
          predictorName: `semantic_retriever_${merchantId}`,
          configUpdated: true
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      await this.auditLogRepository.create({
        merchantId: req.params.merchantId,
        operation: 'update_predictor_config',
        requestPayloadHash: this.hashPayload(req.body),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: req.user?.userId || 'system',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/semantic-retrieval/health
   */
  async healthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          service: 'SemanticRetrievalService',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
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

export const semanticRetrievalController = new SemanticRetrievalController();