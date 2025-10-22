import { Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DocumentIngestionService } from '../services/DocumentIngestionService';
import { LoggingService } from '../services/LoggingService';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const documentIngestionService = new DocumentIngestionService();
const loggingService = new LoggingService({
  logGroupName: 'document-ingestion',
  region: process.env.AWS_REGION || 'us-east-1'
});

interface DocumentIngestionEvent {
  bucket: string;
  key: string;
  merchantId: string;
  userId: string;
  executionId: string;
}

interface DocumentIngestionResult {
  documentId: string;
  content: string;
  metadata: {
    fileName: string;
    fileSize: number;
    contentType: string;
    uploadedAt: string;
    extractedAt: string;
  };
}

/**
 * Lambda handler for document ingestion step in Step Functions workflow
 * Extracts text and metadata from documents stored in S3
 */
export const handler: Handler<DocumentIngestionEvent, DocumentIngestionResult> = async (event) => {
  const startTime = Date.now();
  
  try {
    await loggingService.logInfo('Document ingestion started', {
      merchantId: event.merchantId,
      userId: event.userId,
      bucket: event.bucket,
      key: event.key,
      executionId: event.executionId,
    });

    // Validate input
    if (!event.bucket || !event.key || !event.merchantId) {
      throw new Error('Missing required parameters: bucket, key, or merchantId');
    }

    // Get object from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: event.bucket,
      Key: event.key,
    });

    const s3Object = await s3Client.send(getObjectCommand);
    
    if (!s3Object.Body) {
      throw new Error('Document body is empty');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = s3Object.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks);
    
    // Extract text content based on file type
    const contentType = s3Object.ContentType || 'application/octet-stream';
    const fileName = event.key.split('/').pop() || 'unknown';
    
    let extractedText: string;
    
    try {
      extractedText = await extractTextFromDocument(buffer, contentType, fileName);
    } catch (extractionError) {
      await loggingService.logError(extractionError as Error, {
        merchantId: event.merchantId,
        operation: 'text_extraction',
        fileName,
        contentType,
      });
      throw new Error(`Failed to extract text from document: ${(extractionError as Error).message}`);
    }

    // Generate document ID
    const documentId = `doc_${event.merchantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare result
    const result: DocumentIngestionResult = {
      documentId,
      content: extractedText,
      metadata: {
        fileName,
        fileSize: buffer.length,
        contentType,
        uploadedAt: s3Object.LastModified?.toISOString() || new Date().toISOString(),
        extractedAt: new Date().toISOString(),
      },
    };

    const executionTime = Date.now() - startTime;

    await loggingService.logInfo('Document ingestion completed', {
      merchantId: event.merchantId,
      documentId,
      fileName,
      contentLength: extractedText.length,
      executionTime,
    });

    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    await loggingService.logError(error as Error, {
      merchantId: event.merchantId,
      operation: 'document_ingestion',
      bucket: event.bucket,
      key: event.key,
      executionTime,
    });

    throw error;
  }
};

/**
 * Extract text from document based on content type
 */
async function extractTextFromDocument(buffer: Buffer, contentType: string, fileName: string): Promise<string> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  
  switch (contentType) {
    case 'text/plain':
      return buffer.toString('utf-8');
    
    case 'application/json':
      try {
        const jsonData = JSON.parse(buffer.toString('utf-8'));
        return JSON.stringify(jsonData, null, 2);
      } catch {
        return buffer.toString('utf-8');
      }
    
    case 'text/csv':
    case 'application/csv':
      return buffer.toString('utf-8');
    
    case 'text/html':
    case 'application/xhtml+xml':
      // Basic HTML text extraction (remove tags)
      return buffer.toString('utf-8')
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    case 'application/xml':
    case 'text/xml':
      // Basic XML text extraction
      return buffer.toString('utf-8')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    case 'application/pdf':
      // For PDF files, we would need a PDF parsing library
      // For now, return a placeholder
      throw new Error('PDF parsing not implemented. Please use a PDF parsing service.');
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      // For Word documents, we would need a Word parsing library
      throw new Error('Word document parsing not implemented. Please use a document parsing service.');
    
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      // For Excel files, we would need an Excel parsing library
      throw new Error('Excel parsing not implemented. Please use a spreadsheet parsing service.');
    
    default:
      // Try to parse as text for unknown types
      const text = buffer.toString('utf-8');
      
      // Check if it's valid UTF-8 text
      if (isValidText(text)) {
        return text;
      }
      
      // If not valid text, try base64 encoding for binary files
      if (fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(fileExtension)) {
        throw new Error(`Unsupported file type: ${contentType}. File extension: ${fileExtension}`);
      }
      
      // Last resort: return as text
      return text;
  }
}

/**
 * Check if text is valid UTF-8
 */
function isValidText(text: string): boolean {
  // Check for control characters (except common ones like newline, tab)
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  
  if (controlCharRegex.test(text)) {
    return false;
  }
  
  // Check if text has reasonable length and printable characters
  if (text.length === 0) {
    return false;
  }
  
  // Check for reasonable ratio of printable characters
  const printableChars = text.replace(/[\s\n\r\t]/g, '').length;
  const totalChars = text.length;
  
  if (printableChars / totalChars < 0.1) {
    return false;
  }
  
  return true;
}

/**
 * Health check handler for the Lambda function
 */
export const healthHandler: Handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'healthy',
      service: 'document-ingestion',
      timestamp: new Date().toISOString(),
    }),
  };
};