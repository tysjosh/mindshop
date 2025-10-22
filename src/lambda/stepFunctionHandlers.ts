/**
 * Lambda handlers for Step Functions workflow steps
 * Each handler represents a specific step in the document ingestion pipeline
 */

import { Context, APIGatewayProxyEvent } from 'aws-lambda';
import { getDocumentIngestionService } from '../services/DocumentIngestionService';
import { MindsDBService } from '../services/MindsDBService';
import { getPIIRedactor } from '../services/PIIRedactor';
import { getDocumentRepository } from '../repositories/DocumentRepository';
import { getAuditLogRepository } from '../repositories/AuditLogRepository';
import { Document } from '../models';

/**
 * Validate input parameters for the workflow
 */
export const validateInputHandler = async (event: any, _context: Context) => {
  console.log('Validating input:', JSON.stringify(event, null, 2));
  
  try {
    const { bucket, key, merchantId, contentType, metadata } = event.input || event;
    
    // Validate required fields
    if (!bucket || !key || !merchantId) {
      throw new Error('Missing required fields: bucket, key, or merchantId');
    }
    
    // Validate merchant ID format
    if (!merchantId.match(/^[a-zA-Z0-9_-]+$/)) {
      throw new Error('Invalid merchantId format');
    }
    
    // Validate S3 key format
    if (key.includes('..') || key.startsWith('/')) {
      throw new Error('Invalid S3 key format');
    }
    
    // Check file size limits (would be implemented with S3 metadata)
    // const maxFileSize = 10 * 1024 * 1024; // 10MB - TODO: Implement size validation
    
    // Validate content type if provided
    const allowedContentTypes = [
      'application/json',
      'text/csv',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/pdf',
    ];
    
    if (contentType && !allowedContentTypes.includes(contentType)) {
      console.warn(`Unsupported content type: ${contentType}, will attempt to process as text/plain`);
    }
    
    return {
      statusCode: 200,
      body: {
        valid: true,
        normalizedInput: {
          bucket,
          key,
          merchantId,
          contentType: contentType || 'text/plain',
          metadata: metadata || {},
        },
      },
    };
    
  } catch (error: any) {
    console.error('Input validation failed:', error);
    
    return {
      statusCode: 400,
      body: {
        valid: false,
        error: error.message,
      },
    };
  }
};

/**
 * Download document from S3 and parse content
 */
export const documentParserHandler = async (event: any, _context: Context) => {
  console.log('Parsing document:', JSON.stringify(event, null, 2));
  
  try {
    const ingestionService = getDocumentIngestionService();
    const { bucket, key, merchantId, contentType, metadata } = event;
    
    // Create ingestion event
    const ingestionEvent = {
      bucket,
      key,
      eventName: 'ObjectCreated:Put',
      merchantId,
      contentType,
      metadata,
    };
    
    // Download and parse document
    const parsedDocument = await ingestionService.downloadAndParseDocument(ingestionEvent);
    
    return {
      statusCode: 200,
      body: parsedDocument,
    };
    
  } catch (error: any) {
    console.error('Document parsing failed:', error);
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'document_parsing',
      },
    };
  }
};

/**
 * Sanitize document content for PII
 */
export const piiSanitizationHandler = async (event: any, _context: Context) => {
  console.log('Sanitizing PII:', JSON.stringify(event, null, 2));
  
  try {
    const piiRedactor = getPIIRedactor();
    const { document, merchantId } = event;
    
    if (!document || !merchantId) {
      throw new Error('Missing document or merchantId');
    }
    
    // Sanitize title and body
    const sanitizedTitle = await piiRedactor.redactText(document.title);
    const sanitizedBody = await piiRedactor.redactText(document.body);
    
    const sanitizedDocument = {
      ...document,
      title: sanitizedTitle.sanitizedText,
      body: sanitizedBody.sanitizedText,
      metadata: {
        ...document.metadata,
        pii_tokens: {
          title: sanitizedTitle.tokens,
          body: sanitizedBody.tokens,
        },
        sanitization_timestamp: new Date().toISOString(),
      },
    };
    
    return {
      statusCode: 200,
      body: sanitizedDocument,
    };
    
  } catch (error: any) {
    console.error('PII sanitization failed:', error);
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'pii_sanitization',
      },
    };
  }
};

/**
 * Generate embedding for document using MindsDB
 */
export const embeddingGenerationHandler = async (event: any, _context: Context) => {
  console.log('Generating embedding:', JSON.stringify(event, null, 2));
  
  try {
    const mindsdbService = new MindsDBService();
    const { document, merchantId } = event;
    
    if (!document || !merchantId) {
      throw new Error('Missing document or merchantId');
    }
    
    // Combine title and body for embedding
    const textToEmbed = `${document.title}\n\n${document.body}`;
    
    // Generate embedding
    const embedding = await mindsdbService.generateEmbedding({
      text: textToEmbed,
      merchantId,

    });
    
    return {
      statusCode: 200,
      body: {
        embedding,
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        embeddingDimensions: embedding.length,
        generatedAt: new Date().toISOString(),
      },
    };
    
  } catch (error: any) {
    console.error('Embedding generation failed:', error);
    
    // Return error but allow workflow to continue without embedding
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'embedding_generation',
        embedding: [], // Empty embedding to allow storage without embedding
      },
    };
  }
};

/**
 * Store document in Aurora PostgreSQL
 */
export const documentStorageHandler = async (event: any, _context: Context) => {
  console.log('Storing document:', JSON.stringify(event, null, 2));
  
  try {
    const documentRepository = getDocumentRepository();
    const auditRepository = getAuditLogRepository();
    const { document, embedding, merchantId, sourceUri, embeddingFailed } = event;
    
    if (!document || !merchantId) {
      throw new Error('Missing document or merchantId');
    }
    
    // Create document instance
    const { v4: uuidv4 } = require('uuid');
    const documentToStore = new Document({
      id: uuidv4(),
      merchantId,
      sku: document.sku,
      title: document.title,
      body: document.body,
      metadata: {
        ...document.metadata,
        source_uri: sourceUri,
        ingestion_timestamp: new Date().toISOString(),
        embedding_failed: embeddingFailed || false,
      },
      embedding: embedding?.embedding || embedding || [],
      documentType: document.documentType,
    });
    
    // Store document
    const storedDocument = await documentRepository.create(documentToStore);
    
    // Log successful storage
    await auditRepository.create({
      merchantId,
      operation: 'document_stored',
      requestPayloadHash: generatePayloadHash(storedDocument),
      responseReference: storedDocument.id,
      outcome: 'success',
      actor: 'document_storage_handler',
    });
    
    return {
      statusCode: 200,
      body: {
        documentId: storedDocument.id,
        hasEmbedding: storedDocument.embedding.length > 0,
        storedAt: storedDocument.createdAt,
      },
    };
    
  } catch (error: any) {
    console.error('Document storage failed:', error);
    
    // Log storage failure
    try {
      const auditRepository = getAuditLogRepository();
      await auditRepository.create({
        merchantId: event.merchantId,
        operation: 'document_storage_failed',
        requestPayloadHash: generatePayloadHash(event),
        responseReference: 'error',
        outcome: 'failure',
        reason: error.message,
        actor: 'document_storage_handler',
      });
    } catch (auditError) {
      console.error('Failed to log storage failure:', auditError);
    }
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'document_storage',
      },
    };
  }
};

/**
 * Update vector index after document storage
 */
export const vectorIndexUpdateHandler = async (event: any, _context: Context) => {
  console.log('Updating vector index:', JSON.stringify(event, null, 2));
  
  try {
    const { documentId, merchantId } = event;
    
    if (!documentId || !merchantId) {
      throw new Error('Missing documentId or merchantId');
    }
    
    // In a real implementation, this would:
    // 1. Trigger index optimization if needed
    // 2. Update index statistics
    // 3. Invalidate related caches
    
    // For now, we'll simulate the process
    console.log(`Updating vector index for document ${documentId} in merchant ${merchantId}`);
    
    // Simulate index update delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      statusCode: 200,
      body: {
        indexUpdated: true,
        documentId,
        updatedAt: new Date().toISOString(),
      },
    };
    
  } catch (error: any) {
    console.error('Vector index update failed:', error);
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'vector_index_update',
        indexUpdated: false,
      },
    };
  }
};

/**
 * Handle errors from any step in the workflow
 */
export const errorHandler = async (event: any, _context: Context) => {
  console.log('Handling workflow error:', JSON.stringify(event, null, 2));
  
  try {
    const auditRepository = getAuditLogRepository();
    const { errorType, error, input } = event;
    
    const merchantId = input?.merchantId || 'unknown';
    
    // Log the error
    await auditRepository.create({
      merchantId,
      operation: `workflow_error_${errorType}`,
      requestPayloadHash: generatePayloadHash(event),
      responseReference: 'error',
      outcome: 'failure',
      reason: error?.Error || error?.message || 'Unknown error',
      actor: 'error_handler',
    });
    
    // Determine error severity and response
    const errorResponse = {
      errorType,
      message: error?.Error || error?.message || 'Unknown error',
      recoverable: isRecoverableError(errorType, error),
      timestamp: new Date().toISOString(),
      input: input || {},
    };
    
    // For certain errors, we might want to trigger retry mechanisms
    // or send notifications to administrators
    
    return {
      statusCode: 500,
      body: errorResponse,
    };
    
  } catch (handlerError: any) {
    console.error('Error handler failed:', handlerError);
    
    return {
      statusCode: 500,
      body: {
        errorType: 'error_handler_failure',
        message: handlerError.message,
        originalError: event,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Batch report generation handler
 */
export const batchReportHandler = async (event: any, _context: Context) => {
  console.log('Generating batch report:', JSON.stringify(event, null, 2));
  
  try {
    const { results, batchId, timestamp } = event;
    
    if (!results || !Array.isArray(results)) {
      throw new Error('Invalid results array');
    }
    
    // Analyze batch results
    const totalDocuments = results.length;
    const successful = results.filter(r => r.Output?.result?.status === 'success').length;
    const failed = results.filter(r => r.Output?.result?.status === 'failed').length;
    const partialSuccess = results.filter(r => r.Output?.result?.status === 'partial_success').length;
    
    const report = {
      batchId,
      timestamp,
      summary: {
        totalDocuments,
        successful,
        failed,
        partialSuccess,
        successRate: (successful / totalDocuments) * 100,
      },
      details: results.map((result, index) => ({
        index,
        status: result.Output?.result?.status || 'unknown',
        documentId: result.Output?.documentId?.Payload,
        error: result.Output?.error?.Error,
        executionArn: result.ExecutionArn,
      })),
      generatedAt: new Date().toISOString(),
    };
    
    console.log('Batch processing report:', report);
    
    return {
      statusCode: 200,
      body: report,
    };
    
  } catch (error: any) {
    console.error('Batch report generation failed:', error);
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        step: 'batch_report_generation',
      },
    };
  }
};

/**
 * Health check handler for Step Functions components
 */
export const healthCheckHandler = async (_event: any, _context: Context) => {
  try {
    const ingestionService = getDocumentIngestionService();
    const mindsdbService = new MindsDBService();
    const documentRepository = getDocumentRepository();
    
    // Check all service health
    const [
      ingestionHealth,
      mindsdbHealth,
      repositoryHealth,
    ] = await Promise.allSettled([
      ingestionService.healthCheck(),
      mindsdbService.healthCheck(),
      documentRepository.healthCheck(),
    ]);
    
    const health = {
      ingestion: ingestionHealth.status === 'fulfilled' ? ingestionHealth.value : { error: String(ingestionHealth.reason) },
      mindsdb: mindsdbHealth.status === 'fulfilled' ? mindsdbHealth.value : { error: String(mindsdbHealth.reason) },
      repository: repositoryHealth.status === 'fulfilled' ? repositoryHealth.value : { error: String(repositoryHealth.reason) },
      piiRedactor: true, // Simplified check
      timestamp: new Date().toISOString(),
    };
    
    const isHealthy = Object.values(health).every(service => 
      typeof service === 'boolean' ? service : !(service as any).error
    );
    
    return {
      statusCode: isHealthy ? 200 : 503,
      body: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services: health,
      },
    };
    
  } catch (error: any) {
    return {
      statusCode: 500,
      body: {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Helper function to generate payload hash
 */
function generatePayloadHash(payload: any): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Helper function to determine if an error is recoverable
 */
function isRecoverableError(errorType: string, error: any): boolean {
  const recoverableErrors = [
    'network_timeout',
    'service_unavailable',
    'rate_limit_exceeded',
    'temporary_failure',
  ];
  
  const errorMessage = error?.Error || error?.message || '';
  
  return recoverableErrors.some(recoverable => 
    errorType.includes(recoverable) || errorMessage.toLowerCase().includes(recoverable)
  );
}