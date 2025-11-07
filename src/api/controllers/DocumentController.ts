import { Request, Response } from 'express';
import { MindsDBService } from '../../services/MindsDBService';
import { SemanticRetrievalService } from '../../services/SemanticRetrievalService';
import { getCacheService } from '../../services/CacheService';
import { ApiResponse } from '../../types';
import { sendSuccess, sendError, getRequestId } from '../utils/responseFormatter';
import path from 'path';
import fs from 'fs/promises';

export class DocumentController {
  private mindsdbService: MindsDBService;
  private semanticRetrievalService: SemanticRetrievalService;
  private cacheService = getCacheService();

  constructor() {
    this.mindsdbService = new MindsDBService();
    this.semanticRetrievalService = new SemanticRetrievalService(this.mindsdbService);
  }

  // Initialize RAG system for a merchant
  async initializeRAGSystem(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;
      const { openaiApiKey } = req.body;

      if (!merchantId) {
        sendError(res, 'merchantId is required', 400, requestId);
        return;
      }

      if (!openaiApiKey) {
        sendError(res, 'openaiApiKey is required for RAG system setup', 400, requestId);
        return;
      }

      await this.mindsdbService.setupRAGSystem(merchantId, openaiApiKey);

      sendSuccess(res, {
        message: 'RAG system initialized successfully',
        merchantId,
        components: {
          knowledgeBase: `rag_kb_${merchantId}`,
          agent: `rag_agent_${merchantId}`,
          status: 'ready'
        }
      }, 200, requestId);
    } catch (error) {
      console.error('RAG system initialization error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to initialize RAG system', 500, requestId);
    }
  }

  // Ingest document from text content
  async ingestDocument(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;
      const { content, title, source, documentType = 'text' } = req.body;

      if (!merchantId || !content) {
        sendError(res, 'merchantId and content are required', 400, requestId);
        return;
      }

      const documentId = `doc_${merchantId}_${Date.now()}`;

      await this.mindsdbService.ingestDocument(merchantId, {
        id: documentId,
        content,
        title: title || 'Untitled Document',
        source: source || 'api_upload',
        document_type: documentType
      });

      sendSuccess(res, {
        message: 'Document ingested successfully',
        documentId,
        merchantId,
        metadata: {
          title: title || 'Untitled Document',
          source: source || 'api_upload',
          documentType,
          createdAt: new Date().toISOString()
        }
      }, 200, requestId);
    } catch (error) {
      console.error('Document ingestion error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to ingest document', 500, requestId);
    }
  }

  // Ingest document from URL
  async ingestDocumentFromUrl(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;
      const { url, title, documentType = 'url' } = req.body;

      if (!merchantId || !url) {
        sendError(res, 'merchantId and url are required', 400, requestId);
        return;
      }

      // Extract content using MindsDB's TO_MARKDOWN function
      const content = await this.mindsdbService.extractDocumentContent(url);
      
      if (!content || content.trim().length === 0) {
        sendError(res, 'Could not extract content from the provided URL', 400, requestId);
        return;
      }

      const documentId = `doc_${merchantId}_${Date.now()}`;

      await this.mindsdbService.ingestDocument(merchantId, {
        id: documentId,
        content,
        title: title || `Document from ${url}`,
        source: url,
        document_type: documentType
      });

      sendSuccess(res, {
        message: 'Document ingested successfully from URL',
        documentId,
        merchantId,
        metadata: {
          title: title || `Document from ${url}`,
          source: url,
          documentType,
          createdAt: new Date().toISOString()
        }
      }, 200, requestId);
    } catch (error) {
      console.error('URL document ingestion error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to ingest document from URL', 500, requestId);
    }
  }

  // Search documents using semantic search
  async searchDocuments(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { 
        merchantId,
        query, 
        limit = 10, 
        threshold = 0.7, 
        useHybridSearch = true,
        filters 
      } = req.body;

      if (!merchantId || !query) {
        sendError(res, 'merchantId and query are required', 400, requestId);
        return;
      }

      const results = await this.semanticRetrievalService.retrieveDocuments({
        query,
        merchantId,
        limit: parseInt(limit),
        threshold: parseFloat(threshold),
        useHybridSearch,
        filters
      });

      sendSuccess(res, {
        results,
        totalFound: results.length,
        searchParams: {
          query,
          limit: parseInt(limit),
          threshold: parseFloat(threshold),
          useHybridSearch,
          filters
        }
      }, 200, requestId);
    } catch (error) {
      console.error('Document search error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to search documents', 500, requestId);
    }
  }

  // Ask a question using the RAG agent
  async askQuestion(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;
      const { question } = req.body;

      if (!merchantId || !question) {
        sendError(res, 'merchantId and question are required', 400, requestId);
        return;
      }

      const answer = await this.mindsdbService.askQuestion(merchantId, question);

      sendSuccess(res, {
        question,
        answer,
        merchantId
      }, 200, requestId);
    } catch (error) {
      console.error('Question answering error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to answer question', 500, requestId);
    }
  }

  // Get document by ID
  async getDocument(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId, documentId } = req.params;

      if (!merchantId || !documentId) {
        sendError(res, 'merchantId and documentId are required', 400, requestId);
        return;
      }

      const document = await this.semanticRetrievalService.getDocumentById(merchantId, documentId);

      if (!document) {
        sendError(res, 'Document not found', 404, requestId);
        return;
      }

      sendSuccess(res, document, 200, requestId);
    } catch (error) {
      console.error('Document retrieval error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to retrieve document', 500, requestId);
    }
  }

  // Find similar documents
  async findSimilarDocuments(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId, documentId } = req.params;
      const { limit = 5 } = req.query;

      if (!merchantId || !documentId) {
        sendError(res, 'merchantId and documentId are required', 400, requestId);
        return;
      }

      const similarDocuments = await this.semanticRetrievalService.searchSimilarDocuments(
        merchantId,
        documentId,
        parseInt(limit as string)
      );

      sendSuccess(res, {
        referenceDocumentId: documentId,
        similarDocuments,
        totalFound: similarDocuments.length
      }, 200, requestId);
    } catch (error) {
      console.error('Similar documents search error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to find similar documents', 500, requestId);
    }
  }

  // Delete document
  async deleteDocument(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId, documentId } = req.params;

      if (!merchantId || !documentId) {
        sendError(res, 'merchantId and documentId are required', 400, requestId);
        return;
      }

      const success = await this.semanticRetrievalService.deleteDocument(merchantId, documentId);

      if (!success) {
        sendError(res, 'Document not found or could not be deleted', 404, requestId);
        return;
      }

      sendSuccess(res, {
        message: 'Document deleted successfully',
        documentId,
        merchantId
      }, 200, requestId);
    } catch (error) {
      console.error('Document deletion error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to delete document', 500, requestId);
    }
  }

  // Get document statistics
  async getDocumentStats(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.query;

      if (!merchantId || typeof merchantId !== 'string') {
        sendError(res, 'merchantId is required', 400, requestId);
        return;
      }

      const stats = await this.semanticRetrievalService.getDocumentStats(merchantId);

      sendSuccess(res, {
        merchantId,
        stats
      }, 200, requestId);
    } catch (error) {
      console.error('Document stats error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to get document statistics', 500, requestId);
    }
  }

  // Get RAG system status
  async getRAGSystemStatus(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        sendError(res, 'merchantId is required', 400, requestId);
        return;
      }

      const [knowledgeBases, agents, jobs] = await Promise.all([
        this.mindsdbService.listKnowledgeBases(),
        this.mindsdbService.listAgents(),
        this.mindsdbService.listJobs()
      ]);

      const merchantKB = knowledgeBases.find(kb => kb.name === `rag_kb_${merchantId}`);
      const merchantAgent = agents.find(agent => agent.name === `rag_agent_${merchantId}`);
      const merchantJobs = jobs.filter(job => job.name.includes(merchantId));

      sendSuccess(res, {
        merchantId,
        status: {
          knowledgeBase: merchantKB ? 'active' : 'not_found',
          agent: merchantAgent ? 'active' : 'not_found',
          jobs: merchantJobs.length,
          initialized: !!(merchantKB && merchantAgent)
        },
        components: {
          knowledgeBase: merchantKB,
          agent: merchantAgent,
          jobs: merchantJobs
        }
      }, 200, requestId);
    } catch (error) {
      console.error('RAG system status error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to get RAG system status', 500, requestId);
    }
  }

  // Health check
  async healthCheck(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const health = await this.mindsdbService.healthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      const response: ApiResponse = {
        success: health.status === 'healthy',
        data: {
          service: 'DocumentController',
          mindsdb: health
        },
        timestamp: new Date().toISOString(),
        requestId
      };
      res.status(statusCode).json(response);
    } catch (error) {
      console.error('Health check error:', error);
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        data: {
          service: 'DocumentController',
          status: 'unhealthy'
        },
        timestamp: new Date().toISOString(),
        requestId
      };
      res.status(503).json(response);
    }
  }
  /**
   * Create a new document
   */
  async createDocument(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId, content, title, source, document_type } = req.body;

      if (!merchantId || !content) {
        sendError(res, 'merchantId and content are required', 400, requestId);
        return;
      }

      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.mindsdbService.ingestDocument(merchantId, {
        id: documentId,
        content,
        title: title || 'Untitled',
        source: source || 'api',
        document_type: document_type || 'text'
      });

      sendSuccess(res, {
        documentId,
        message: 'Document created successfully'
      }, 201, requestId);
    } catch (error) {
      console.error('Document creation error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to create document', 500, requestId);
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId, documentId } = req.params;
      const { content, title, source, document_type } = req.body;

      if (!merchantId || !documentId) {
        sendError(res, 'merchantId and documentId are required', 400, requestId);
        return;
      }

      // For now, we'll treat update as a new ingestion
      await this.mindsdbService.ingestDocument(merchantId, {
        id: documentId,
        content: content || '',
        title: title || 'Updated Document',
        source: source || 'api_update',
        document_type: document_type || 'text'
      });

      sendSuccess(res, {
        documentId,
        message: 'Document updated successfully'
      }, 200, requestId);
    } catch (error) {
      console.error('Document update error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to update document', 500, requestId);
    }
  }

  /**
   * Bulk upload documents
   */
  async bulkUploadDocuments(req: Request, res: Response): Promise<void> {
    const requestId = getRequestId(req);
    try {
      const { merchantId } = req.params;
      const { documents } = req.body;

      if (!merchantId || !Array.isArray(documents)) {
        sendError(res, 'merchantId and documents array are required', 400, requestId);
        return;
      }

      const results = [];
      for (const doc of documents) {
        try {
          const documentId = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await this.mindsdbService.ingestDocument(merchantId, {
            id: documentId,
            content: doc.content || '',
            title: doc.title || 'Bulk Upload Document',
            source: doc.source || 'bulk_upload',
            document_type: doc.document_type || 'text'
          });

          results.push({
            documentId,
            status: 'success'
          });
        } catch (error) {
          results.push({
            documentId: doc.id || 'unknown',
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      sendSuccess(res, {
        processed: results.length,
        results
      }, 200, requestId);
    } catch (error) {
      console.error('Bulk upload error:', error);
      sendError(res, error instanceof Error ? error.message : 'Failed to bulk upload documents', 500, requestId);
    }
  }}


export const documentController = new DocumentController();