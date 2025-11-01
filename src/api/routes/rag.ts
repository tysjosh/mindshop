import { Router } from 'express';
import { documentController } from '../controllers/DocumentController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT());

// RAG System Management Routes
router.post('/merchants/:merchantId/rag/initialize', documentController.initializeRAGSystem.bind(documentController));
router.get('/merchants/:merchantId/rag/status', documentController.getRAGSystemStatus.bind(documentController));

// Document Management Routes
router.post('/merchants/:merchantId/documents', documentController.ingestDocument.bind(documentController));
router.post('/merchants/:merchantId/documents/url', documentController.ingestDocumentFromUrl.bind(documentController));
router.post('/merchants/:merchantId/documents/search', documentController.searchDocuments.bind(documentController));
router.get('/merchants/:merchantId/documents/stats', documentController.getDocumentStats.bind(documentController));

// Document Operations Routes
router.get('/merchants/:merchantId/documents/:documentId', documentController.getDocument.bind(documentController));
router.get('/merchants/:merchantId/documents/:documentId/similar', documentController.findSimilarDocuments.bind(documentController));
router.delete('/merchants/:merchantId/documents/:documentId', documentController.deleteDocument.bind(documentController));

// Question Answering Routes
router.post('/merchants/:merchantId/rag/ask', documentController.askQuestion.bind(documentController));

// Health Check
router.get('/health', documentController.healthCheck.bind(documentController));

export default router;