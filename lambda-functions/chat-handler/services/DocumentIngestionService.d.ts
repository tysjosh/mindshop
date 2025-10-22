export interface DocumentIngestionEvent {
    bucket: string;
    key: string;
    eventName: string;
    merchantId: string;
    contentType?: string;
    metadata?: Record<string, any>;
}
export interface ParsedDocument {
    title: string;
    body: string;
    contentType: string;
    metadata: Record<string, any>;
    sku?: string;
    documentType: "product" | "faq" | "policy" | "review";
}
export interface IngestionResult {
    documentId: string;
    status: "success" | "failed" | "skipped";
    error?: string;
    processingTime: number;
    embeddingGenerated: boolean;
}
export interface BatchIngestionResult {
    totalDocuments: number;
    successful: number;
    failed: number;
    skipped: number;
    results: IngestionResult[];
    totalProcessingTime: number;
}
/**
 * Document Ingestion Service
 * Handles S3 events, document parsing, PII sanitization, and embedding generation
 */
export declare class DocumentIngestionService {
    private s3Client;
    private sfnClient;
    private mindsdbService;
    private piiRedactor;
    private documentRepository;
    private cacheService;
    constructor();
    /**
     * Process S3 event and trigger document ingestion pipeline
     */
    processS3Event(event: DocumentIngestionEvent): Promise<IngestionResult>;
    /**
     * Process document synchronously (for development/testing)
     */
    private processDocumentSynchronously;
    /**
     * Start Step Functions workflow for document ingestion
     */
    private startIngestionWorkflow;
    /**
     * Download document from S3 and parse content
     */
    downloadAndParseDocument(event: DocumentIngestionEvent): Promise<ParsedDocument>;
    /**
     * Parse document content based on type
     */
    private parseDocumentContent;
    /**
     * Parse JSON document
     */
    private parseJsonDocument;
    /**
     * Parse CSV document
     */
    private parseCsvDocument;
    /**
     * Parse Markdown document
     */
    private parseMarkdownDocument;
    /**
     * Parse HTML document
     */
    private parseHtmlDocument;
    /**
     * Parse plain text document
     */
    private parseTextDocument;
    /**
     * Determine document type from filename and metadata
     */
    private determineDocumentType;
    /**
     * Extract SKU from content or metadata
     */
    private extractSku;
    /**
     * Sanitize document for PII
     */
    private sanitizeDocument;
    /**
     * Generate embedding for document
     */
    private generateEmbedding;
    /**
     * Store document in Aurora PostgreSQL
     */
    private storeDocument;
    /**
     * Batch process multiple documents
     */
    batchProcessDocuments(events: DocumentIngestionEvent[]): Promise<BatchIngestionResult>;
    /**
     * Check if document already exists
     */
    private checkExistingDocument;
    /**
     * Validate ingestion event
     */
    private validateIngestionEvent;
    /**
     * Convert stream to string
     */
    private streamToString;
    /**
     * Health check for ingestion service
     */
    healthCheck(): Promise<{
        s3: boolean;
        stepFunctions: boolean;
        mindsdb: boolean;
        piiRedactor: boolean;
    }>;
}
export declare const getDocumentIngestionService: () => DocumentIngestionService;
//# sourceMappingURL=DocumentIngestionService.d.ts.map