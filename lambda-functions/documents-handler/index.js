"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("../database/connection");
const SemanticRetrievalService_1 = require("../services/SemanticRetrievalService");
const MindsDBService_1 = require("../services/MindsDBService");
const CacheService_1 = require("../services/CacheService");
const client_s3_1 = require("@aws-sdk/client-s3");
const axios_1 = __importDefault(require("axios"));
// Initialize services
let semanticRetrievalService;
let mindsdbService;
let cacheService;
let s3Client;
let isInitialized = false;
async function initializeServices() {
    if (!isInitialized) {
        // Initialize database connection
        await (0, connection_1.createDatabaseConnection)();
        // Initialize services
        mindsdbService = new MindsDBService_1.MindsDBService();
        semanticRetrievalService = new SemanticRetrievalService_1.SemanticRetrievalService(mindsdbService);
        cacheService = (0, CacheService_1.getCacheService)();
        s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION || 'us-east-2' });
        isInitialized = true;
    }
}
const handler = async (event, context) => {
    console.log('Documents Handler - Event:', JSON.stringify(event, null, 2));
    try {
        await initializeServices();
        const { httpMethod, pathParameters, queryStringParameters } = event;
        const merchantId = pathParameters?.merchantId;
        if (!merchantId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Merchant ID is required'
                })
            };
        }
        // Route to appropriate document function
        switch (httpMethod) {
            case 'POST':
                if (pathParameters?.resource === 'search') {
                    return await handleDocumentSearch(merchantId, event, context);
                }
                else if (pathParameters?.resource === 'url') {
                    return await handleUrlIngestion(merchantId, event, context);
                }
                else {
                    return await handleDocumentCreation(merchantId, event, context);
                }
            case 'GET':
                if (pathParameters?.documentId) {
                    return await handleGetDocument(merchantId, pathParameters.documentId, context);
                }
                else if (pathParameters?.resource === 'stats') {
                    return await handleGetDocumentStats(merchantId, context);
                }
                else {
                    return await handleListDocuments(merchantId, queryStringParameters, context);
                }
            case 'DELETE':
                if (pathParameters?.documentId) {
                    return await handleDeleteDocument(merchantId, pathParameters.documentId, context);
                }
                else {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: 'Document ID is required for deletion' })
                    };
                }
            default:
                return {
                    statusCode: 405,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    }
    catch (error) {
        console.error('Error in Documents Handler:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Document processing failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
};
exports.handler = handler;
/**
 * Handle document creation and ingestion
 */
async function handleDocumentCreation(merchantId, event, context) {
    const body = JSON.parse(event.body || '{}');
    const documentRequest = {
        content: body.content,
        title: body.title || 'Untitled Document',
        document_type: body.document_type || 'text',
        source: body.source || 'api',
        metadata: body.metadata || {}
    };
    if (!documentRequest.content || documentRequest.content.trim().length === 0) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Document content is required' })
        };
    }
    console.log(`Creating document for merchant: ${merchantId}`);
    try {
        // Generate document ID
        const documentId = `doc_${merchantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Store document in S3
        const s3Key = `merchants/${merchantId}/documents/${documentId}.txt`;
        const bucketName = process.env.S3_DOCUMENTS_BUCKET || `mindsdb-rag-documents-${process.env.AWS_ACCOUNT_ID || 'unknown'}-${process.env.AWS_REGION || 'us-east-2'}`;
        await s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: documentRequest.content,
            ContentType: 'text/plain',
            Metadata: {
                merchantId,
                documentId,
                title: documentRequest.title || 'Untitled',
                documentType: documentRequest.document_type || 'text',
                source: documentRequest.source || 'api',
                ...(documentRequest.metadata || {})
            }
        }));
        // Insert document into MindsDB knowledge base
        try {
            await mindsdbService.insertDocumentToKB(`rag_kb_${merchantId}`, {
                id: documentId,
                content: documentRequest.content,
                metadata: {
                    document_id: documentId,
                    document_type: documentRequest.document_type || 'text',
                    source: documentRequest.source || 'api',
                    title: documentRequest.title || 'Untitled',
                    created_at: new Date().toISOString()
                }
            });
            console.log(`Document ${documentId} inserted into MindsDB knowledge base`);
        }
        catch (mindsdbError) {
            console.warn('Failed to insert document into MindsDB:', mindsdbError);
            // Continue - document is still stored in S3
        }
        const documentResponse = {
            document_id: documentId,
            title: documentRequest.title || 'Untitled',
            content_preview: documentRequest.content.substring(0, 200) + (documentRequest.content.length > 200 ? '...' : ''),
            document_type: documentRequest.document_type || 'text',
            source: documentRequest.source || 'api',
            created_at: new Date().toISOString(),
            metadata: documentRequest.metadata || {},
            processing_status: 'completed'
        };
        // Invalidate cache
        await cacheService.delete(`docs:${merchantId}:list`);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: documentResponse,
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
    catch (error) {
        console.error('Document creation failed:', error);
        throw new Error(`Document creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle document search using semantic retrieval
 */
async function handleDocumentSearch(merchantId, event, context) {
    const body = JSON.parse(event.body || '{}');
    const searchRequest = {
        query: body.query,
        limit: body.limit || 10,
        threshold: body.threshold || 0.7,
        filters: body.filters,
        use_hybrid_search: body.use_hybrid_search !== false // Default to true
    };
    if (!searchRequest.query || searchRequest.query.trim().length === 0) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Search query is required' })
        };
    }
    console.log(`Searching documents for merchant: ${merchantId}, query: "${searchRequest.query}"`);
    try {
        const searchParams = {
            query: searchRequest.query,
            merchantId,
            limit: searchRequest.limit,
            threshold: searchRequest.threshold,
            useHybridSearch: searchRequest.use_hybrid_search,
            filters: searchRequest.filters
        };
        const results = await semanticRetrievalService.retrieveDocuments(searchParams);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: {
                    query: searchRequest.query,
                    results: results.map(result => ({
                        document_id: result.id || 'unknown',
                        title: result.metadata?.title || 'Untitled',
                        content_preview: result.snippet?.substring(0, 200) + '...' || 'No content preview',
                        relevance_score: result.score || 0,
                        document_type: result.metadata?.documentType || 'unknown',
                        source: result.metadata?.sourceUri || 'unknown',
                        created_at: result.metadata?.createdAt || new Date().toISOString(),
                        metadata: result.metadata || {}
                    })),
                    total_results: results.length,
                    search_params: {
                        limit: searchRequest.limit,
                        threshold: searchRequest.threshold,
                        hybrid_search: searchRequest.use_hybrid_search
                    }
                },
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
    catch (error) {
        console.error('Document search failed:', error);
        throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle URL-based document ingestion
 */
async function handleUrlIngestion(merchantId, event, context) {
    const body = JSON.parse(event.body || '{}');
    const url = body.url;
    if (!url || !isValidUrl(url)) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Valid URL is required' })
        };
    }
    console.log(`Ingesting document from URL for merchant: ${merchantId}, URL: ${url}`);
    try {
        // Fetch content from URL
        const response = await axios_1.default.get(url, {
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024, // 10MB limit
            headers: {
                'User-Agent': 'MindsDB-RAG-Assistant/1.0'
            }
        });
        let content = response.data;
        let contentType = response.headers['content-type'] || 'text/plain';
        // Basic content extraction for HTML
        if (contentType.includes('text/html')) {
            content = extractTextFromHtml(content);
        }
        // Create document from extracted content
        const documentRequest = {
            content,
            title: body.title || extractTitleFromUrl(url),
            document_type: 'web_page',
            source: 'url_ingestion',
            metadata: {
                original_url: url,
                content_type: contentType,
                ingested_at: new Date().toISOString(),
                ...body.metadata
            }
        };
        // Use the document creation logic
        const createEvent = {
            ...event,
            body: JSON.stringify(documentRequest)
        };
        return await handleDocumentCreation(merchantId, createEvent, context);
    }
    catch (error) {
        console.error('URL ingestion failed:', error);
        if (axios_1.default.isAxiosError(error)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    error: 'Failed to fetch content from URL',
                    message: error.message,
                    url
                })
            };
        }
        throw error;
    }
}
/**
 * Handle getting a specific document
 */
async function handleGetDocument(merchantId, documentId, context) {
    console.log(`Getting document ${documentId} for merchant ${merchantId}`);
    try {
        // TODO: Implement document retrieval from MindsDB/S3
        const document = {
            document_id: documentId,
            title: 'Sample Document',
            content: 'This is sample document content...',
            document_type: 'text',
            source: 'api',
            created_at: new Date().toISOString(),
            metadata: {},
            processing_status: 'completed'
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: document,
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
    catch (error) {
        console.error('Get document failed:', error);
        throw new Error(`Get document failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle getting document statistics
 */
async function handleGetDocumentStats(merchantId, context) {
    console.log(`Getting document stats for merchant ${merchantId}`);
    try {
        // TODO: Implement actual stats retrieval from MindsDB
        const stats = {
            total_documents: 0,
            document_types: {},
            sources: {},
            recent_activity: [],
            storage_usage: {
                total_size_bytes: 0,
                average_document_size: 0
            }
        };
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
    catch (error) {
        console.error('Get document stats failed:', error);
        throw new Error(`Get document stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle listing documents with pagination
 */
async function handleListDocuments(merchantId, queryParams, context) {
    const limit = parseInt(queryParams?.limit || '20');
    const offset = parseInt(queryParams?.offset || '0');
    const documentType = queryParams?.document_type;
    const source = queryParams?.source;
    console.log(`Listing documents for merchant ${merchantId}, limit: ${limit}, offset: ${offset}`);
    try {
        // Check cache
        const cacheKey = `docs:${merchantId}:list:${limit}:${offset}:${documentType || 'all'}:${source || 'all'}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify(cached)
            };
        }
        // TODO: Implement actual document listing from MindsDB
        const documents = [];
        const totalCount = 0;
        const response = {
            success: true,
            data: {
                documents,
                pagination: {
                    limit,
                    offset,
                    total_count: totalCount,
                    has_more: offset + limit < totalCount
                },
                filters: {
                    document_type: documentType,
                    source
                }
            },
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId
        };
        // Cache for 5 minutes
        await cacheService.set(cacheKey, response, 300);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response)
        };
    }
    catch (error) {
        console.error('List documents failed:', error);
        throw new Error(`List documents failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Handle document deletion
 */
async function handleDeleteDocument(merchantId, documentId, context) {
    console.log(`Deleting document ${documentId} for merchant ${merchantId}`);
    try {
        // Delete from S3
        const s3Key = `merchants/${merchantId}/documents/${documentId}.txt`;
        const bucketName = process.env.S3_DOCUMENTS_BUCKET || `mindsdb-rag-documents-${process.env.AWS_ACCOUNT_ID}-${process.env.AWS_REGION}`;
        try {
            await s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: bucketName,
                Key: s3Key
            }));
            console.log(`Document ${documentId} deleted from S3`);
        }
        catch (s3Error) {
            console.warn('Failed to delete document from S3:', s3Error);
        }
        // Delete from MindsDB knowledge base
        try {
            // TODO: Implement document deletion when available
            console.log(`Document ${documentId} should be deleted from MindsDB knowledge base`);
        }
        catch (mindsdbError) {
            console.warn('Failed to delete document from MindsDB:', mindsdbError);
        }
        // Invalidate cache
        await cacheService.delete(`docs:${merchantId}:list`);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: {
                    message: 'Document deleted successfully',
                    documentId,
                    merchantId
                },
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        };
    }
    catch (error) {
        console.error('Document deletion failed:', error);
        throw new Error(`Document deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Helper functions
 */
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function extractTitleFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/').filter(s => s.length > 0);
        return segments.length > 0 ? segments[segments.length - 1] : urlObj.hostname;
    }
    catch {
        return 'Web Page';
    }
}
function extractTextFromHtml(html) {
    // Basic HTML text extraction (remove tags)
    return html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
