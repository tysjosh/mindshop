# MindsDB RAG Assistant Implementation

This document describes the implementation of a RAG (Retrieval-Augmented Generation) assistant using MindsDB's native capabilities.

## Overview

The MindsDB RAG Assistant leverages MindsDB's built-in features to provide:

- **Knowledge Bases**: Semantic document storage and retrieval
- **Agents**: Conversational AI with access to knowledge bases
- **Jobs**: Automated document ingestion and processing
- **Hybrid Search**: Combined semantic and keyword search
- **Document Processing**: Automatic content extraction from PDFs, DOCX, etc.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  RAG Assistant  │───▶│    MindsDB      │
│                 │    │      API        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Document       │    │  Knowledge Base │
                       │  Controller     │    │     Agent       │
                       └─────────────────┘    │     Jobs        │
                              │               └─────────────────┘
                              ▼
                       ┌─────────────────┐
                       │  MindsDB        │
                       │  Service        │
                       └─────────────────┘
```

## Key Components

### 1. MindsDBService

The core service that interfaces with MindsDB:

```typescript
// Initialize RAG system for a merchant
await mindsdbService.setupRAGSystem(merchantId, openaiApiKey);

// Ingest documents
await mindsdbService.ingestDocument(merchantId, {
  id: 'doc_123',
  content: 'Document content...',
  title: 'Document Title',
  source: 'upload',
  document_type: 'pdf'
});

// Ask questions
const answer = await mindsdbService.askQuestion(merchantId, 'What is...?');
```

### 2. SemanticRetrievalService

Enhanced document retrieval with hybrid search:

```typescript
// Semantic search
const results = await retrievalService.retrieveDocuments({
  query: 'search query',
  merchantId: 'merchant_123',
  useHybridSearch: true,
  limit: 10,
  threshold: 0.7
});

// Find similar documents
const similar = await retrievalService.searchSimilarDocuments(
  merchantId, 
  documentId, 
  5
);
```

### 3. DocumentController

RESTful API endpoints for document management:

- `POST /api/merchants/{merchantId}/rag/initialize` - Initialize RAG system
- `POST /api/merchants/{merchantId}/documents` - Ingest documents
- `POST /api/merchants/{merchantId}/documents/upload` - Upload files
- `POST /api/merchants/{merchantId}/documents/search` - Search documents
- `POST /api/merchants/{merchantId}/rag/ask` - Ask questions

## Setup Instructions

### 1. Install MindsDB

```bash
# Setup MindsDB locally
npm run mindsdb:setup

# Or manually with Docker
docker run -d \
  --name mindsdb-rag \
  -p 47334:47334 \
  -p 47335:47335 \
  -v mindsdb_data:/root/mindsdb_storage \
  mindsdb/mindsdb:latest
```

### 2. Configure Environment

Update your `.env` file:

```env
# MindsDB Configuration
MINDSDB_HOST=localhost
MINDSDB_PORT=47334
MINDSDB_ENDPOINT=http://localhost:47334

# OpenAI Configuration (required for RAG)
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Initialize RAG System

```bash
# Start the application
npm run dev

# Initialize RAG for a merchant
curl -X POST http://localhost:3000/api/merchants/demo-merchant/rag/initialize \
  -H "Content-Type: application/json" \
  -d '{"openaiApiKey": "your-openai-api-key"}'
```

### 4. Ingest Documents

```bash
# Ingest text content
curl -X POST http://localhost:3000/api/merchants/demo-merchant/documents \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a sample document about our products...",
    "title": "Product Information",
    "source": "manual_upload",
    "documentType": "product_info"
  }'

# Upload file
curl -X POST http://localhost:3000/api/merchants/demo-merchant/documents/upload \
  -F "document=@/path/to/document.pdf"
```

### 5. Search and Ask Questions

```bash
# Search documents
curl -X POST http://localhost:3000/api/merchants/demo-merchant/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "product information",
    "limit": 5,
    "useHybridSearch": true
  }'

# Ask questions
curl -X POST http://localhost:3000/api/merchants/demo-merchant/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What products do you offer?"
  }'
```

## MindsDB Objects Created

For each merchant, the system creates:

### Knowledge Base
```sql
CREATE KNOWLEDGE_BASE rag_kb_{merchantId}
USING
    embedding_model = {
        "provider": "openai",
        "model_name": "text-embedding-3-large",
        "api_key": "sk-xxx"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-xxx"
    },
    metadata_columns = ['document_type', 'source', 'title', 'created_at'],
    content_columns = ['content'],
    id_column = 'document_id';
```

### Agent
```sql
CREATE AGENT rag_agent_{merchantId}
USING
    model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-xxx"
    },
    data = {
        "knowledge_bases": ["rag_kb_{merchantId}"]
    },
    prompt_template = 'You are a helpful RAG assistant...',
    timeout = 30;
```

### Jobs (Optional)
```sql
CREATE JOB doc_ingestion_{merchantId} (
    INSERT INTO rag_kb_{merchantId}
    SELECT document_id, content, document_type, source, title
    FROM files.uploaded_documents
    WHERE created_at > LAST
)
EVERY 1 hour;
```

## Features

### 1. Hybrid Search

Combines semantic similarity with keyword matching:

```typescript
const results = await retrievalService.retrieveDocuments({
  query: 'ACME-213 product specifications',
  merchantId: 'merchant_123',
  useHybridSearch: true, // Enables hybrid search
  filters: { document_type: 'product_spec' }
});
```

### 2. Document Processing

Automatic content extraction from various file formats:

```typescript
// Extract content using MindsDB's TO_MARKDOWN function
const content = await mindsdbService.extractDocumentContent(filePath);
```

### 3. Conversational AI

Context-aware question answering:

```typescript
const answer = await mindsdbService.askQuestion(
  merchantId, 
  'What are the specifications for product ACME-213?'
);
```

### 4. Automated Ingestion

Jobs for continuous document processing:

```typescript
await mindsdbService.createDocumentIngestionJob(
  'auto_ingestion_job',
  `rag_kb_${merchantId}`,
  'files.uploaded_documents',
  'EVERY 1 hour'
);
```

## API Reference

### Initialize RAG System
```http
POST /api/merchants/{merchantId}/rag/initialize
Content-Type: application/json

{
  "openaiApiKey": "sk-xxx"
}
```

### Ingest Document
```http
POST /api/merchants/{merchantId}/documents
Content-Type: application/json

{
  "content": "Document content...",
  "title": "Document Title",
  "source": "upload",
  "documentType": "pdf"
}
```

### Upload File
```http
POST /api/merchants/{merchantId}/documents/upload
Content-Type: multipart/form-data

document: [file]
```

### Search Documents
```http
POST /api/merchants/{merchantId}/documents/search
Content-Type: application/json

{
  "query": "search query",
  "limit": 10,
  "threshold": 0.7,
  "useHybridSearch": true,
  "filters": {
    "document_type": "product"
  }
}
```

### Ask Question
```http
POST /api/merchants/{merchantId}/rag/ask
Content-Type: application/json

{
  "question": "What is...?"
}
```

### Get RAG Status
```http
GET /api/merchants/{merchantId}/rag/status
```

## Management Commands

```bash
# Setup MindsDB
npm run mindsdb:setup

# Start MindsDB
npm run mindsdb:start

# Stop MindsDB
npm run mindsdb:stop

# View logs
npm run mindsdb:logs

# Test connection
npm run mindsdb:test

# Initialize RAG components
npm run mindsdb:init-rag
```

## Monitoring and Health Checks

### Health Check Endpoint
```http
GET /api/health
```

### RAG System Status
```http
GET /api/merchants/{merchantId}/rag/status
```

### Document Statistics
```http
GET /api/merchants/{merchantId}/documents/stats
```

## Performance Optimization

### 1. Caching
- Results cached for 5 minutes
- Cache keys include query parameters
- Automatic cache invalidation on updates

### 2. Batch Processing
- Batch document insertion
- Parallel embedding generation
- Optimized chunk processing

### 3. Hybrid Search
- Configurable alpha parameter
- Semantic + keyword relevance
- Reranking for improved results

## Security Considerations

### 1. Tenant Isolation
- Separate knowledge bases per merchant
- Merchant ID validation
- Access control enforcement

### 2. Data Privacy
- Encrypted API keys
- Secure document storage
- Audit logging

### 3. Rate Limiting
- API endpoint rate limits
- Resource usage monitoring
- Circuit breaker patterns

## Troubleshooting

### Common Issues

1. **MindsDB Connection Failed**
   ```bash
   # Check MindsDB status
   curl http://localhost:47334/api/status
   
   # View logs
   npm run mindsdb:logs
   ```

2. **Knowledge Base Creation Failed**
   - Verify OpenAI API key
   - Check MindsDB logs for errors
   - Ensure sufficient resources

3. **Document Ingestion Failed**
   - Check file format support
   - Verify content extraction
   - Monitor memory usage

4. **Search Returns No Results**
   - Verify documents are ingested
   - Check relevance threshold
   - Try hybrid search

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
MINDSDB_LOG_LEVEL=DEBUG
```

## Migration from Existing RAG Systems

### From Bedrock-based RAG

1. **Data Migration**
   ```typescript
   // Export existing documents
   const documents = await bedrockService.exportDocuments(merchantId);
   
   // Import to MindsDB
   for (const doc of documents) {
     await mindsdbService.ingestDocument(merchantId, doc);
   }
   ```

2. **API Compatibility**
   - Maintain existing endpoints
   - Gradual migration approach
   - Feature flag switching

3. **Performance Comparison**
   - A/B testing framework
   - Metrics collection
   - Quality assessment

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests
3. Update documentation
4. Ensure security compliance

## License

MIT License - see LICENSE file for details.