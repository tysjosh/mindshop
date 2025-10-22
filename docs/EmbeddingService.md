# EmbeddingService Documentation

The `EmbeddingService` provides text-to-vector conversion using MindsDB embedding models with built-in PII protection and batch processing capabilities.

## Features

- **PII Protection**: Automatically redacts personally identifiable information before embedding generation
- **Batch Processing**: Efficiently processes multiple texts with configurable batch sizes and concurrency
- **Document Integration**: Seamlessly integrates with DocumentRepository for embedding updates
- **Caching**: Intelligent caching to improve performance and reduce API calls
- **Health Monitoring**: Comprehensive health checks for all service dependencies
- **Multiple Models**: Support for various embedding models including sentence-transformers and OpenAI models

## Quick Start

```typescript
import { getEmbeddingService } from './src/services/EmbeddingService';

const embeddingService = getEmbeddingService();

// Generate a single embedding with PII protection
const result = await embeddingService.generateEmbedding({
  text: 'Contact us at support@example.com for help',
  merchantId: 'your-merchant-id',
});

console.log('Embedding:', result.embedding);
console.log('Sanitized text:', result.sanitizedText);
```

## API Reference

### generateEmbedding(request: EmbeddingRequest)

Generates an embedding for a single text with optional PII protection.

**Parameters:**
- `text` (string): The text to embed (max 8192 characters)
- `merchantId` (string): Merchant identifier for tenant isolation
- `documentId` (string, optional): Associated document ID
- `model` (string, optional): Embedding model to use
- `skipPIIRedaction` (boolean, optional): Skip PII redaction if true

**Returns:** `EmbeddingResult`
- `embedding` (number[]): The generated embedding vector
- `originalText` (string): Original input text
- `sanitizedText` (string): Text after PII redaction
- `tokenMap` (Map<string, string>, optional): PII token mappings
- `processingTime` (number): Processing time in milliseconds
- `model` (string): Model used for embedding generation

### generateBatchEmbeddings(request: BatchEmbeddingRequest)

Generates embeddings for multiple texts with batch processing.

**Parameters:**
- `texts` (string[]): Array of texts to embed (max 1000 texts)
- `merchantId` (string): Merchant identifier
- `documentIds` (string[], optional): Associated document IDs
- `model` (string, optional): Embedding model to use
- `skipPIIRedaction` (boolean, optional): Skip PII redaction if true
- `batchSize` (number, optional): Batch size for processing (default: 10)

**Returns:** `BatchEmbeddingResult`
- `results` (EmbeddingResult[]): Array of embedding results
- `totalProcessingTime` (number): Total processing time
- `successCount` (number): Number of successful embeddings
- `failureCount` (number): Number of failed embeddings
- `errors` (Array): Array of error details

### updateDocumentEmbedding(request: EmbeddingUpdateRequest)

Updates the embedding for a specific document in the repository.

**Parameters:**
- `documentId` (string): Document UUID
- `merchantId` (string): Merchant identifier
- `forceRegenerate` (boolean, optional): Force regeneration even if embedding exists
- `model` (string, optional): Embedding model to use

### batchUpdateDocumentEmbeddings(request: BatchEmbeddingUpdateRequest)

Updates embeddings for multiple documents with controlled concurrency.

**Parameters:**
- `updates` (EmbeddingUpdateRequest[]): Array of update requests
- `batchSize` (number, optional): Batch size for processing
- `concurrency` (number, optional): Maximum concurrent operations

### processDocumentsForMerchant(merchantId: string, options?)

Processes all documents for a merchant and updates their embeddings.

**Parameters:**
- `merchantId` (string): Merchant identifier
- `options` (object, optional):
  - `forceRegenerate` (boolean): Force regeneration of existing embeddings
  - `model` (string): Embedding model to use
  - `batchSize` (number): Batch size for processing
  - `concurrency` (number): Maximum concurrent operations
  - `documentType` (string): Filter by document type

### getEmbeddingStats(merchantId: string)

Returns embedding statistics for a merchant.

**Returns:**
- `totalDocuments` (number): Total number of documents
- `documentsWithEmbeddings` (number): Documents that have embeddings
- `documentsWithoutEmbeddings` (number): Documents missing embeddings
- `embeddingCoverage` (number): Percentage of documents with embeddings
- `averageEmbeddingDimensions` (number): Average embedding vector size

### healthCheck()

Performs health checks on all service dependencies.

**Returns:**
- `mindsdb` (boolean): MindsDB service health
- `piiRedactor` (boolean): PII redactor health
- `documentRepository` (boolean): Document repository health
- `cache` (boolean): Cache service health

## Configuration

The service can be configured through environment variables:

```bash
# MindsDB Configuration
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=your-api-key
MINDSDB_TIMEOUT=30000
MINDSDB_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
MINDSDB_BATCH_SIZE=10
MINDSDB_MAX_CONCURRENCY=5
```

## PII Protection

The service automatically detects and redacts the following types of PII:

- Email addresses
- Phone numbers (US format)
- Credit card numbers
- Social Security Numbers
- Street addresses
- Sensitive user data fields

PII redaction can be disabled by setting `skipPIIRedaction: true` in the request.

## Supported Models

- `sentence-transformers/all-MiniLM-L6-v2` (default)
- `sentence-transformers/all-mpnet-base-v2`
- `text-embedding-ada-002`
- `text-embedding-3-small`
- `text-embedding-3-large`

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Invalid input parameters
- **MindsDB Errors**: API failures or timeouts
- **PII Redaction Errors**: Issues with text sanitization
- **Repository Errors**: Database or cache failures

All errors include descriptive messages and are logged for debugging.

## Performance Considerations

- **Caching**: Embeddings are cached for 1 hour to reduce API calls
- **Batch Processing**: Use batch operations for multiple texts
- **Concurrency Control**: Configurable concurrency limits prevent overwhelming the service
- **Circuit Breaker**: Built-in circuit breaker pattern for resilience

## Examples

See `examples/embedding-service-usage.ts` for comprehensive usage examples including:

- Single embedding generation with PII protection
- Batch processing multiple texts
- Document embedding updates
- Merchant-wide document processing
- Health monitoring and statistics

## Integration with DocumentRepository

The service seamlessly integrates with the DocumentRepository:

```typescript
// Update embeddings for all documents without embeddings
await embeddingService.processDocumentsForMerchant('merchant-123', {
  forceRegenerate: false,
  documentType: 'product',
});

// Update a specific document's embedding
await embeddingService.updateDocumentEmbedding({
  documentId: 'doc-uuid',
  merchantId: 'merchant-123',
});
```

## Security

- **Tenant Isolation**: All operations require a valid merchant ID
- **PII Protection**: Automatic redaction of sensitive information
- **Input Validation**: Comprehensive validation of all inputs
- **Rate Limiting**: Built-in batch size and concurrency limits