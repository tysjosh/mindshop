# SemanticRetrievalService REST API Integration

The SemanticRetrievalService now includes complete REST API integration with MindsDB, providing an alternative to the SQL interface with enhanced features and better performance characteristics.

## ✅ Completed Implementation

### **Core Features**

1. **Direct REST API Calls**: Native integration with MindsDB REST API endpoints
2. **Comprehensive Response Processing**: Handles multiple response formats from MindsDB
3. **Enhanced Caching**: Separate cache keys and TTL for REST vs SQL calls
4. **Automatic Fallback**: Falls back to SQL interface if REST API fails
5. **Rich Explainability**: Additional metadata and performance metrics
6. **Grounding Validation**: Enhanced validation with REST API specific features

### **New Methods Implemented**

#### `retrieveViaREST(params: SemanticRetrievalParams)`
- Makes direct REST API calls to MindsDB predictors
- Uses `/api/predictors/semantic_retriever_{merchantId}/predict` endpoint
- Includes comprehensive error handling and fallback
- Provides enhanced response format with additional metadata

#### `processRESTResponse(restData: any, params: SemanticRetrievalParams)`
- Processes various MindsDB REST API response formats
- Extracts scores, confidence, and metadata
- Generates grounding validation results
- Creates comprehensive explainability information

#### Supporting Methods
- `extractScore()` - Extracts similarity scores from various response fields
- `extractConfidence()` - Extracts confidence values with fallbacks
- `extractSnippet()` - Extracts text content from multiple possible fields
- `extractGroundingReasons()` - Generates grounding validation reasons
- `extractQueryMatches()` - Identifies query term matches
- `calculateContextualRelevance()` - Computes contextual relevance scores
- `generateRetrievalReason()` - Creates human-readable retrieval explanations

## **Usage Examples**

### Basic REST API Call
```typescript
import { getSemanticRetrievalService } from '../services/SemanticRetrievalService';

const service = getSemanticRetrievalService();

const result = await service.retrieveViaREST({
  query: 'wireless headphones with noise cancellation',
  merchantId: 'merchant_123',
  limit: 10,
  threshold: 0.8,
  includeMetadata: true
});

console.log(`Found ${result.totalFound} results in ${result.queryProcessingTime}ms`);
console.log(`Cache hit: ${result.cacheHit}`);
console.log(`Algorithm: ${result.explainability.retrievalStrategy.algorithm}`);
```

### With Document Type Filtering
```typescript
const result = await service.retrieveViaREST({
  query: 'product specifications',
  merchantId: 'merchant_123',
  limit: 5,
  threshold: 0.7,
  documentTypes: ['product', 'specification', 'manual'],
  includeMetadata: true
});
```

### Comparing REST vs SQL Performance
```typescript
// REST API call
const restResult = await service.retrieveViaREST({
  query: 'performance test',
  merchantId: 'merchant_123',
  limit: 5
});

// SQL interface call
const sqlResult = await service.retrieveDocuments({
  query: 'performance test',
  merchantId: 'merchant_123',
  limit: 5
});

console.log(`REST: ${restResult.queryProcessingTime}ms`);
console.log(`SQL: ${sqlResult.queryProcessingTime}ms`);
```

## **Response Format**

### Enhanced Response Structure
```typescript
interface SemanticRetrievalResponse {
  results: EnhancedRetrievalResult[];
  totalFound: number;
  queryProcessingTime: number;
  cacheHit: boolean;
  explainability: {
    queryAnalysis: {
      originalQuery: string;
      processedQuery: string;
      extractedTerms: string[];
      queryIntent: string;
    };
    retrievalStrategy: {
      algorithm: string;
      parameters: Record<string, any>;
      optimizations: string[];
    };
    apiMetrics?: {
      responseTime: number;
      resultCount: number;
      apiEndpoint: string;
      cacheStatus: string;
    };
  };
}
```

### Enhanced Result Structure
```typescript
interface EnhancedRetrievalResult {
  id: string;
  snippet: string;
  score: number;
  confidence: number;
  metadata: {
    sku?: string;
    merchantId: string;
    documentType: string;
    sourceUri?: string;
    title?: string;
    category?: string;
    tags?: string[];
    lastUpdated?: string;
  };
  sourceUri?: string;
  documentType: string;
  groundingPass: boolean;
  groundingValidation: {
    passed: boolean;
    score: number;
    reasons: string[];
    validationMethod: string;
  };
  explainability: {
    queryTermMatches: string[];
    semanticSimilarity: number;
    contextualRelevance: number;
    featureImportance?: Record<string, number>;
    retrievalReason: string;
  };
}
```

## **Caching Strategy**

### Separate Cache Keys
- **REST API**: `semantic_retrieval_rest:{hash}`
- **SQL Interface**: `semantic_retrieval_sql:{hash}`
- **Cache TTL**: 5 minutes for REST responses, 10 minutes for SQL responses

### Cache Key Components
```typescript
{
  apiType: 'rest' | 'sql',
  query: string,
  merchantId: string,
  limit: number,
  threshold: number,
  documentTypes: string[],
  includeMetadata: boolean
}
```

## **Error Handling & Fallback**

### Automatic Fallback Chain
1. **Primary**: REST API call to MindsDB
2. **Fallback**: SQL interface call
3. **Final**: Empty response with error information

### Error Response Format
```typescript
{
  results: [],
  totalFound: 0,
  queryProcessingTime: number,
  cacheHit: false,
  explainability: {
    queryAnalysis: {...},
    retrievalStrategy: {
      algorithm: 'failed_retrieval',
      parameters: {
        error: 'REST API failed: ..., SQL fallback failed: ...'
      },
      optimizations: ['error_handling']
    }
  }
}
```

## **Performance Characteristics**

### REST API Advantages
- **Lower Latency**: Direct API calls without SQL parsing overhead
- **Rich Metadata**: Additional response fields and explainability
- **Better Caching**: Optimized cache keys and TTL
- **Enhanced Features**: Grounding validation, confidence scores

### SQL Interface Advantages
- **Reliability**: More stable and tested interface
- **Complex Queries**: Better support for complex filtering
- **Consistency**: Established patterns and error handling

## **Configuration**

### MindsDB REST API Endpoints
```typescript
// Semantic retrieval predictor
const endpoint = `/api/predictors/semantic_retriever_${merchantId}/predict`;

// Request body format
const requestBody = {
  query: string,
  limit: number,
  threshold: number,
  include_metadata: boolean,
  document_types: string[],
  grounding_validation: true,
  explainability: true,
  merchant_id: string,
  response_format: 'enhanced',
  include_confidence: true,
  include_grounding_reasons: true
};
```

### Environment Variables
```bash
# MindsDB Configuration
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=your_api_key_here
MINDSDB_TIMEOUT=30000

# Cache Configuration
CACHE_TTL=300  # 5 minutes for REST responses
```

## **Monitoring & Observability**

### Metrics Tracked
- Response time for REST vs SQL calls
- Cache hit rates by API type
- Fallback frequency and reasons
- Error rates and types
- Result quality scores

### Logging
```typescript
console.log(`Making REST API call to MindsDB: ${endpoint}`);
console.log(`REST API retrieval completed in ${response.queryProcessingTime}ms`);
console.warn(`REST API call failed, falling back to SQL interface: ${error.message}`);
```

## **Testing**

### Unit Tests
- Response processing for different formats
- Cache key generation
- Error handling and fallback
- Explainability generation

### Integration Tests
- End-to-end REST API calls
- Performance comparison
- Fallback mechanism validation
- Cache behavior verification

## **Migration Guide**

### From SQL-Only to REST API
1. **No Breaking Changes**: Existing `retrieveDocuments()` calls continue to work
2. **Gradual Migration**: Start using `retrieveViaREST()` for new features
3. **Performance Testing**: Compare response times and quality
4. **Monitoring**: Track metrics for both interfaces

### Best Practices
- Use REST API for real-time queries requiring low latency
- Use SQL interface for complex analytical queries
- Monitor cache hit rates and adjust TTL as needed
- Implement proper error handling for both interfaces

## **Future Enhancements**

### Planned Features
- Batch REST API calls for multiple queries
- Streaming responses for large result sets
- Advanced caching strategies (LRU, adaptive TTL)
- Real-time performance optimization
- A/B testing framework for REST vs SQL

### Extensibility
The implementation is designed to be easily extensible:
- Add new response processors for different MindsDB versions
- Implement custom caching strategies
- Add new explainability features
- Support additional REST API endpoints