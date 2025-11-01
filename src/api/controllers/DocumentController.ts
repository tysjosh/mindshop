import { Request, Response } from 'express';
import { MindsDBService } from '../../services/MindsDBService';
import { SemanticRetrievalService } from '../../services/SemanticRetrievalService';
import { getCacheService } from '../../services/CacheService';
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
    try {
      const { merchantId } = req.params;
      const { openaiApiKey } = req.body;

      if (!merchantId) {
        res.status(400).json({
          error: 'merchantId is required'
        });
        return;
      }

      if (!openaiApiKey) {
        res.status(400).json({
          error: 'openaiApiKey is required for RAG system setup'
        });
        return;
      }

      await this.mindsdbService.setupRAGSystem(merchantId, openaiApiKey);

      res.status(200).json({
        message: 'RAG system initialized successfully',
        merchantId,
        components: {
          knowledgeBase: `rag_kb_${merchantId}`,
          agent: `rag_agent_${merchantId}`,
          status: 'ready'
        }
      });
    } catch (error) {
      console.error('RAG system initialization error:', error);
      res.status(500).json({
        error: 'Failed to initialize RAG system',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Ingest document from text content
  async ingestDocument(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { content, title, source, documentType = 'text' } = req.body;

      if (!merchantId || !content) {
        res.status(400).json({
          error: 'merchantId and content are required'
        });
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

      res.status(200).json({
        message: 'Document ingested successfully',
        documentId,
        merchantId,
        metadata: {
          title: title || 'Untitled Document',
          source: source || 'api_upload',
          documentType,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Document ingestion error:', error);
      res.status(500).json({
        error: 'Failed to ingest document',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Ingest document from URL
  async ingestDocumentFromUrl(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { url, title, documentType = 'url' } = req.body;

      if (!merchantId || !url) {
        res.status(400).json({
          error: 'merchantId and url are required'
        });
        return;
      }

      // Extract content using MindsDB's TO_MARKDOWN function
      const content = await this.mindsdbService.extractDocumentContent(url);
      
      if (!content || content.trim().length === 0) {
        res.status(400).json({
          error: 'Could not extract content from the provided URL'
        });
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

      res.status(200).json({
        message: 'Document ingested successfully from URL',
        documentId,
        merchantId,
        metadata: {
          title: title || `Document from ${url}`,
          source: url,
          documentType,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('URL document ingestion error:', error);
      res.status(500).json({
        error: 'Failed to ingest document from URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Search documents using semantic search
  async searchDocuments(req: Request, res: Response): Promise<void> {
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
        res.status(400).json({
          error: 'merchantId and query are required'
        });
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

      res.status(200).json({
        results,
        totalFound: results.length,
        searchParams: {
          query,
          limit: parseInt(limit),
          threshold: parseFloat(threshold),
          useHybridSearch,
          filters
        }
      });
    } catch (error) {
      console.error('Document search error:', error);
      res.status(500).json({
        error: 'Failed to search documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Ask a question using the RAG agent
  async askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { question } = req.body;

      if (!merchantId || !question) {
        res.status(400).json({
          error: 'merchantId and question are required'
        });
        return;
      }

      const answer = await this.mindsdbService.askQuestion(merchantId, question);

      res.status(200).json({
        question,
        answer,
        merchantId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Question answering error:', error);
      res.status(500).json({
        error: 'Failed to answer question',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get document by ID
  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId, documentId } = req.params;

      if (!merchantId || !documentId) {
        res.status(400).json({
          error: 'merchantId and documentId are required'
        });
        return;
      }

      const document = await this.semanticRetrievalService.getDocumentById(merchantId, documentId);

      if (!document) {
        res.status(404).json({
          error: 'Document not found'
        });
        return;
      }

      res.status(200).json(document);
    } catch (error) {
      console.error('Document retrieval error:', error);
      res.status(500).json({
        error: 'Failed to retrieve document',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Find similar documents
  async findSimilarDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId, documentId } = req.params;
      const { limit = 5 } = req.query;

      if (!merchantId || !documentId) {
        res.status(400).json({
          error: 'merchantId and documentId are required'
        });
        return;
      }

      const similarDocuments = await this.semanticRetrievalService.searchSimilarDocuments(
        merchantId,
        documentId,
        parseInt(limit as string)
      );

      res.status(200).json({
        referenceDocumentId: documentId,
        similarDocuments,
        totalFound: similarDocuments.length
      });
    } catch (error) {
      console.error('Similar documents search error:', error);
      res.status(500).json({
        error: 'Failed to find similar documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete document
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId, documentId } = req.params;

      if (!merchantId || !documentId) {
        res.status(400).json({
          error: 'merchantId and documentId are required'
        });
        return;
      }

      const success = await this.semanticRetrievalService.deleteDocument(merchantId, documentId);

      if (!success) {
        res.status(404).json({
          error: 'Document not found or could not be deleted'
        });
        return;
      }

      res.status(200).json({
        message: 'Document deleted successfully',
        documentId,
        merchantId
      });
    } catch (error) {
      console.error('Document deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get document statistics
  async getDocumentStats(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.query;

      if (!merchantId || typeof merchantId !== 'string') {
        res.status(400).json({
          error: 'merchantId is required'
        });
        return;
      }

      const stats = await this.semanticRetrievalService.getDocumentStats(merchantId);

      res.status(200).json({
        merchantId,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Document stats error:', error);
      res.status(500).json({
        error: 'Failed to get document statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get RAG system status
  async getRAGSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        res.status(400).json({
          error: 'merchantId is required'
        });
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

      res.status(200).json({
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
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('RAG system status error:', error);
      res.status(500).json({
        error: 'Failed to get RAG system status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Health check
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.mindsdbService.healthCheck();
      
      res.status(health.status === 'healthy' ? 200 : 503).json({
        service: 'DocumentController',
        mindsdb: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        service: 'DocumentController',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
  /**
   * Create a new document
   */
  async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId, content, title, source, document_type } = req.body;

      if (!merchantId || !content) {
        res.status(400).json({
          error: 'merchantId and content are required'
        });
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

      res.json({
        success: true,
        data: {
          documentId,
          message: 'Document created successfully'
        }
      });
    } catch (error) {
      console.error('Document creation error:', error);
      res.status(500).json({
        error: 'Failed to create document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId, documentId } = req.params;
      const { content, title, source, document_type } = req.body;

      if (!merchantId || !documentId) {
        res.status(400).json({
          error: 'merchantId and documentId are required'
        });
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

      res.json({
        success: true,
        data: {
          documentId,
          message: 'Document updated successfully'
        }
      });
    } catch (error) {
      console.error('Document update error:', error);
      res.status(500).json({
        error: 'Failed to update document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Bulk upload documents
   */
  async bulkUploadDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { documents } = req.body;

      if (!merchantId || !Array.isArray(documents)) {
        res.status(400).json({
          error: 'merchantId and documents array are required'
        });
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

      res.json({
        success: true,
        data: {
          processed: results.length,
          results
        }
      });
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({
        error: 'Failed to bulk upload documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }}


export const documentController = new DocumentController();