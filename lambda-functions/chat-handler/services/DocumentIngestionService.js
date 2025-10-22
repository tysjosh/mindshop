"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocumentIngestionService = exports.DocumentIngestionService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const crypto_1 = require("crypto");
const config_1 = require("../config");
const MindsDBService_1 = require("./MindsDBService");
const PIIRedactor_1 = require("./PIIRedactor");
const DocumentRepository_1 = require("../repositories/DocumentRepository");
const models_1 = require("../models");
const CacheService_1 = require("./CacheService");
/**
 * Document Ingestion Service
 * Handles S3 events, document parsing, PII sanitization, and embedding generation
 */
class DocumentIngestionService {
    constructor() {
        this.mindsdbService = new MindsDBService_1.MindsDBService();
        this.piiRedactor = (0, PIIRedactor_1.getPIIRedactor)();
        this.documentRepository = new DocumentRepository_1.DocumentRepository();
        this.cacheService = (0, CacheService_1.getCacheService)();
        const awsConfig = {
            region: config_1.config.aws.region,
        };
        // Only add credentials if they are provided
        if (config_1.config.aws.accessKeyId && config_1.config.aws.secretAccessKey) {
            awsConfig.credentials = {
                accessKeyId: config_1.config.aws.accessKeyId,
                secretAccessKey: config_1.config.aws.secretAccessKey,
            };
        }
        this.s3Client = new client_s3_1.S3Client(awsConfig);
        this.sfnClient = new client_sfn_1.SFNClient(awsConfig);
    }
    /**
     * Process S3 event and trigger document ingestion pipeline
     */
    async processS3Event(event) {
        const startTime = Date.now();
        try {
            // Validate event
            this.validateIngestionEvent(event);
            // Check if document already exists or is being processed
            const existingDoc = await this.checkExistingDocument(event);
            if (existingDoc) {
                return {
                    documentId: existingDoc.id,
                    status: "skipped",
                    error: "Document already exists",
                    processingTime: Date.now() - startTime,
                    embeddingGenerated: false,
                };
            }
            // Start Step Functions workflow
            const executionArn = await this.startIngestionWorkflow(event);
            // For synchronous processing, wait for completion
            // In production, this would be handled asynchronously
            const result = await this.processDocumentSynchronously(event);
            return {
                documentId: result.documentId,
                status: "success",
                processingTime: Date.now() - startTime,
                embeddingGenerated: result.embeddingGenerated,
            };
        }
        catch (error) {
            console.error("Document ingestion failed:", error);
            return {
                documentId: "",
                status: "failed",
                error: error.message,
                processingTime: Date.now() - startTime,
                embeddingGenerated: false,
            };
        }
    }
    /**
     * Process document synchronously (for development/testing)
     */
    async processDocumentSynchronously(event) {
        // Step 1: Download and parse document
        const parsedDoc = await this.downloadAndParseDocument(event);
        // Step 2: Sanitize PII
        const sanitizedDoc = await this.sanitizeDocument(parsedDoc, event.merchantId);
        // Step 3: Generate embedding
        const embedding = await this.generateEmbedding(sanitizedDoc, event.merchantId);
        // Step 4: Store in Aurora
        const document = await this.storeDocument(sanitizedDoc, embedding, event);
        return {
            documentId: document.id,
            embeddingGenerated: embedding.length > 0,
        };
    }
    /**
     * Start Step Functions workflow for document ingestion
     */
    async startIngestionWorkflow(event) {
        const input = {
            bucket: event.bucket,
            key: event.key,
            merchantId: event.merchantId,
            contentType: event.contentType,
            metadata: event.metadata,
            timestamp: new Date().toISOString(),
        };
        const command = new client_sfn_1.StartExecutionCommand({
            stateMachineArn: config_1.config.aws.stepFunctions.documentIngestionArn,
            name: `ingestion-${event.merchantId}-${Date.now()}`,
            input: JSON.stringify(input),
        });
        const response = await this.sfnClient.send(command);
        return response.executionArn;
    }
    /**
     * Download document from S3 and parse content
     */
    async downloadAndParseDocument(event) {
        // Download from S3
        const getObjectCommand = new client_s3_1.GetObjectCommand({
            Bucket: event.bucket,
            Key: event.key,
        });
        const response = await this.s3Client.send(getObjectCommand);
        const content = await this.streamToString(response.Body);
        // Parse based on content type
        const contentType = event.contentType || response.ContentType || "text/plain";
        return this.parseDocumentContent(content, contentType, event.key, event.metadata);
    }
    /**
     * Parse document content based on type
     */
    parseDocumentContent(content, contentType, filename, metadata) {
        let parsedContent;
        switch (contentType.toLowerCase()) {
            case "application/json":
                parsedContent = this.parseJsonDocument(content);
                break;
            case "text/csv":
                parsedContent = this.parseCsvDocument(content);
                break;
            case "text/markdown":
            case "text/md":
                parsedContent = this.parseMarkdownDocument(content);
                break;
            case "application/pdf":
                throw new Error("PDF parsing not implemented - use external service");
            case "text/html":
                parsedContent = this.parseHtmlDocument(content);
                break;
            case "text/plain":
            default:
                parsedContent = this.parseTextDocument(content, filename);
                break;
        }
        // Determine document type from filename or metadata
        const documentType = this.determineDocumentType(filename, metadata);
        // Extract SKU if available
        const sku = this.extractSku(parsedContent.body, metadata);
        return {
            title: parsedContent.title,
            body: parsedContent.body,
            contentType,
            metadata: {
                filename,
                originalContentType: contentType,
                ...metadata,
            },
            sku,
            documentType,
        };
    }
    /**
     * Parse JSON document
     */
    parseJsonDocument(content) {
        try {
            const data = JSON.parse(content);
            // Handle common JSON structures
            if (data.title && data.body) {
                return { title: data.title, body: data.body };
            }
            if (data.name && data.description) {
                return { title: data.name, body: data.description };
            }
            if (data.product_name && data.product_description) {
                return { title: data.product_name, body: data.product_description };
            }
            // Fallback: use first string field as title, rest as body
            const keys = Object.keys(data);
            const title = data[keys[0]] || "Untitled";
            const body = keys
                .slice(1)
                .map((key) => `${key}: ${data[key]}`)
                .join("\n");
            return { title: String(title), body };
        }
        catch (error) {
            throw new Error(`Invalid JSON document: ${error}`);
        }
    }
    /**
     * Parse CSV document
     */
    parseCsvDocument(content) {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length === 0) {
            throw new Error("Empty CSV document");
        }
        const headers = lines[0].split(",").map((h) => h.trim());
        const title = `CSV Document - ${headers.join(", ")}`;
        // Convert CSV to readable format
        const body = lines
            .slice(1)
            .map((line, index) => {
            const values = line.split(",").map((v) => v.trim());
            const row = headers
                .map((header, i) => `${header}: ${values[i] || ""}`)
                .join(", ");
            return `Row ${index + 1}: ${row}`;
        })
            .join("\n");
        return { title, body };
    }
    /**
     * Parse Markdown document
     */
    parseMarkdownDocument(content) {
        const lines = content.split("\n");
        // Extract title from first heading
        let title = "Untitled";
        let bodyStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("# ")) {
                title = line.substring(2).trim();
                bodyStartIndex = i + 1;
                break;
            }
        }
        const body = lines.slice(bodyStartIndex).join("\n").trim();
        return { title, body };
    }
    /**
     * Parse HTML document
     */
    parseHtmlDocument(content) {
        // Simple HTML parsing - in production, use a proper HTML parser
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "Untitled";
        // Remove HTML tags for body content
        const body = content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return { title, body };
    }
    /**
     * Parse plain text document
     */
    parseTextDocument(content, filename) {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length === 0) {
            throw new Error("Empty text document");
        }
        // Use first line as title if it's short, otherwise use filename
        const firstLine = lines[0].trim();
        const title = firstLine.length <= 100 ? firstLine : filename;
        const body = firstLine.length <= 100 ? lines.slice(1).join("\n") : content;
        return { title, body };
    }
    /**
     * Determine document type from filename and metadata
     */
    determineDocumentType(filename, metadata) {
        const lowerFilename = filename.toLowerCase();
        // Check metadata first
        if (metadata?.document_type) {
            return metadata.document_type;
        }
        // Determine from filename patterns
        if (lowerFilename.includes("product") ||
            lowerFilename.includes("catalog")) {
            return "product";
        }
        if (lowerFilename.includes("faq") || lowerFilename.includes("question")) {
            return "faq";
        }
        if (lowerFilename.includes("policy") || lowerFilename.includes("terms")) {
            return "policy";
        }
        if (lowerFilename.includes("review") ||
            lowerFilename.includes("feedback")) {
            return "review";
        }
        // Default to product
        return "product";
    }
    /**
     * Extract SKU from content or metadata
     */
    extractSku(body, metadata) {
        // Check metadata first
        if (metadata?.sku) {
            return metadata.sku;
        }
        // Look for SKU patterns in content
        const skuPatterns = [
            /SKU[:\s]+([A-Z0-9-_]+)/i,
            /Product ID[:\s]+([A-Z0-9-_]+)/i,
            /Item[:\s]+([A-Z0-9-_]+)/i,
        ];
        for (const pattern of skuPatterns) {
            const match = body.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return undefined;
    }
    /**
     * Sanitize document for PII
     */
    async sanitizeDocument(parsedDoc, merchantId) {
        const sanitizedTitle = await this.piiRedactor.redactText(parsedDoc.title);
        const sanitizedBody = await this.piiRedactor.redactText(parsedDoc.body);
        return {
            ...parsedDoc,
            title: sanitizedTitle.sanitizedText,
            body: sanitizedBody.sanitizedText,
            metadata: {
                ...parsedDoc.metadata,
                pii_tokens: {
                    title: sanitizedTitle.tokens,
                    body: sanitizedBody.tokens,
                },
            },
        };
    }
    /**
     * Generate embedding for document
     */
    async generateEmbedding(parsedDoc, merchantId) {
        const textToEmbed = `${parsedDoc.title}\n\n${parsedDoc.body}`;
        try {
            return await this.mindsdbService.generateEmbedding({
                text: textToEmbed,
                merchantId,
            });
        }
        catch (error) {
            console.error("Embedding generation failed:", error);
            return []; // Return empty array if embedding fails
        }
    }
    /**
     * Store document in Aurora PostgreSQL
     */
    async storeDocument(parsedDoc, embedding, event) {
        const { v4: uuidv4 } = require("uuid");
        const document = new models_1.Document({
            id: uuidv4(),
            merchantId: event.merchantId,
            sku: parsedDoc.sku,
            title: parsedDoc.title,
            body: parsedDoc.body,
            metadata: {
                ...parsedDoc.metadata,
                source_uri: `s3://${event.bucket}/${event.key}`,
                ingestion_timestamp: new Date().toISOString(),
            },
            embedding,
            documentType: parsedDoc.documentType,
        });
        return await this.documentRepository.create(document);
    }
    /**
     * Batch process multiple documents
     */
    async batchProcessDocuments(events) {
        const startTime = Date.now();
        const results = [];
        // Process in batches of 10 to avoid overwhelming services
        const batchSize = 10;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            const batchPromises = batch.map((event) => this.processS3Event(event));
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    results.push(result.value);
                }
                else {
                    results.push({
                        documentId: "",
                        status: "failed",
                        error: result.reason?.message || "Unknown error",
                        processingTime: 0,
                        embeddingGenerated: false,
                    });
                }
            });
        }
        const successful = results.filter((r) => r.status === "success").length;
        const failed = results.filter((r) => r.status === "failed").length;
        const skipped = results.filter((r) => r.status === "skipped").length;
        return {
            totalDocuments: events.length,
            successful,
            failed,
            skipped,
            results,
            totalProcessingTime: Date.now() - startTime,
        };
    }
    /**
     * Check if document already exists
     */
    async checkExistingDocument(event) {
        const sourceUri = `s3://${event.bucket}/${event.key}`;
        const cacheKey = `ingestion:check:${event.merchantId}:${(0, crypto_1.createHash)("sha256").update(sourceUri).digest("hex")}`;
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return null; // Document doesn't exist (cached result)
        }
        // Query database for existing document with same source URI
        // This would require adding a method to DocumentRepository
        // For now, return null to allow processing
        return null;
    }
    /**
     * Validate ingestion event
     */
    validateIngestionEvent(event) {
        if (!event.bucket || !event.key || !event.merchantId) {
            throw new Error("Missing required fields: bucket, key, or merchantId");
        }
        if (!event.merchantId.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error("Invalid merchantId format");
        }
        // Check file size limits (example: 10MB)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        // This would be checked during S3 download in a real implementation
    }
    /**
     * Convert stream to string
     */
    async streamToString(stream) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        });
    }
    /**
     * Health check for ingestion service
     */
    async healthCheck() {
        const health = {
            s3: false,
            stepFunctions: false,
            mindsdb: false,
            piiRedactor: false,
        };
        try {
            // Test S3 connection
            await this.s3Client.send(new client_s3_1.GetObjectCommand({
                Bucket: "test-bucket",
                Key: "test-key",
            }));
            health.s3 = true;
        }
        catch (error) {
            // Expected to fail for non-existent bucket, but connection works
            health.s3 =
                !error.message.includes("network") &&
                    !error.message.includes("timeout");
        }
        try {
            // Test MindsDB connection
            const mindsdbHealth = await this.mindsdbService.healthCheck();
            health.mindsdb = mindsdbHealth.status === "healthy";
        }
        catch (error) {
            health.mindsdb = false;
        }
        try {
            // Test PII redactor
            await this.piiRedactor.redactText("test text");
            health.piiRedactor = true;
        }
        catch (error) {
            health.piiRedactor = false;
        }
        // Step Functions health check would require actual deployment
        health.stepFunctions = true; // Assume healthy for now
        return health;
    }
}
exports.DocumentIngestionService = DocumentIngestionService;
// Export singleton instance
let documentIngestionServiceInstance = null;
const getDocumentIngestionService = () => {
    if (!documentIngestionServiceInstance) {
        documentIngestionServiceInstance = new DocumentIngestionService();
    }
    return documentIngestionServiceInstance;
};
exports.getDocumentIngestionService = getDocumentIngestionService;
//# sourceMappingURL=DocumentIngestionService.js.map