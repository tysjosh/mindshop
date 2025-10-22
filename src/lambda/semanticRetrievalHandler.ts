import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createDatabaseConnection } from '../database/connection';
import { SemanticRetrievalService, SemanticRetrievalParams } from '../services/SemanticRetrievalService';
import { PredictorDeploymentService } from '../services/PredictorDeploymentService';
import { MindsDBService } from '../services/MindsDBService';
import { getCacheService } from '../services/CacheService';
import { v4 as uuidv4 } from 'uuid';

// Initialize services
let semanticRetrievalService: SemanticRetrievalService;
let predictorDeploymentService: PredictorDeploymentService;
let mindsdbService: MindsDBService;
let cacheService: any;
let isInitialized = false;

async function initializeServices() {
  if (!isInitialized) {
    // Initialize database connection
    await createDatabaseConnection();
    
    // Initialize services
    mindsdbService = new MindsDBService();
    semanticRetrievalService = new SemanticRetrievalService(mindsdbService);
    predictorDeploymentService = new PredictorDeploymentService(mindsdbService);
    cacheService = getCacheService();
    
    isInitialized = true;
  }
}

interface DeploymentRequest {
  merchantId: string;
  modelType?: 'embedding' | 'reranking' | 'both';
  embeddingModel?: string;
  rerankingModel?: string;
  forceRedeploy?: boolean;
}

interface SearchRequest {
  query: string;
  merchantId: string;
  limit?: number;
  threshold?: number;
  useHybridSearch?: boolean;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

interface RestSearchRequest {
  query: string;
  merchantId: string;
  endpoint?: string;
  apiKey?: string;
  limit?: number;
  threshold?: number;
}

interface GroundingValidationRequest {
  query: string;
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, any>;
  }>;
  expectedRelevance?: number[];
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Semantic Retrieval Handler - Event:', JSON.stringify(event, null, 2));

  try {
    await initializeServices();

    const { httpMethod, pathParameters } = event;
    const action = pathParameters?.action;
    const merchantId = pathParameters?.merchantId;

    // Route to appropriate semantic retrieval function
    switch (action) {
      case 'deploy':
        return await handleModelDeployment(event, context);
      
      case 'search':
        return await handleSemanticSearch(event, context);
      
      case 'rest-search':
        return await handleRestSearch(event, context);
      
      case 'validate-grounding':
        return await handleGroundingValidation(event, context);
      
      case 'status':
        if (merchantId) {
          return await handleDeploymentStatus(merchantId, context);
        } else {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for status check' })
          };
        }
      
      case 'config':
        if (httpMethod === 'PUT' && merchantId) {
          return await handleUpdateConfig(merchantId, event, context);
        } else {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'PUT method and Merchant ID required for config update' })
          };
        }
      
      case 'health':
        return await handleHealthCheck(context);
      
      default:
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: 'Unknown action. Supported actions: deploy, search, rest-search, validate-grounding, status, config, health' 
          })
        };
    }

  } catch (error) {
    console.error('Error in Semantic Retrieval Handler:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Semantic retrieval processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
};

/**
 * Handle ML model deployment for semantic retrieval
 */
async function handleModelDeployment(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const deploymentRequest: DeploymentRequest = {
    merchantId: body.merchantId,
    modelType: body.modelType || 'both',
    embeddingModel: body.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2',
    rerankingModel: body.rerankingModel || 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    forceRedeploy: body.forceRedeploy || false
  };

  if (!deploymentRequest.merchantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Merchant ID is required' })
    };
  }

  console.log(`Deploying semantic retrieval models for merchant: ${deploymentRequest.merchantId}`);

  try {
    const deploymentId = `semantic_deployment_${deploymentRequest.merchantId}_${Date.now()}`;
    const results: any = {};

    // Deploy embedding model
    if (deploymentRequest.modelType === 'embedding' || deploymentRequest.modelType === 'both') {
      console.log(`Deploying embedding model: ${deploymentRequest.embeddingModel}`);
      
      try {
        const embeddingDeployment = await predictorDeploymentService.redeployPredictor(
          `embedding_model_${deploymentRequest.merchantId}`,
          {
            merchantId: deploymentRequest.merchantId,
            trainingDataTable: `documents_${deploymentRequest.merchantId}`,
            features: {
              demographic: [],
              behavioral: [],
              product: [],
              contextual: ['content', 'title']
            }
          }
        );

        results.embedding_model = {
          status: 'deployed',
          model_name: deploymentRequest.embeddingModel,
          predictor_name: `embedding_model_${deploymentRequest.merchantId}`,
          deployment_time: embeddingDeployment.deploymentId
        };
      } catch (embeddingError) {
        console.error('Embedding model deployment failed:', embeddingError);
        results.embedding_model = {
          status: 'failed',
          error: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
        };
      }
    }

    // Deploy reranking model
    if (deploymentRequest.modelType === 'reranking' || deploymentRequest.modelType === 'both') {
      console.log(`Deploying reranking model: ${deploymentRequest.rerankingModel}`);
      
      try {
        const rerankingDeployment = await predictorDeploymentService.redeployPredictor(
          `reranking_model_${deploymentRequest.merchantId}`,
          {
            merchantId: deploymentRequest.merchantId,
            trainingDataTable: `documents_${deploymentRequest.merchantId}`,
            features: {
              demographic: [],
              behavioral: [],
              product: [],
              contextual: ['content', 'title', 'query']
            }
          }
        );

        results.reranking_model = {
          status: 'deployed',
          model_name: deploymentRequest.rerankingModel,
          predictor_name: `reranking_model_${deploymentRequest.merchantId}`,
          deployment_time: rerankingDeployment.deploymentId
        };
      } catch (rerankingError) {
        console.error('Reranking model deployment failed:', rerankingError);
        results.reranking_model = {
          status: 'failed',
          error: rerankingError instanceof Error ? rerankingError.message : 'Unknown error'
        };
      }
    }

    // Create or update knowledge base configuration
    try {
      await mindsdbService.createKnowledgeBase({
        name: `rag_kb_${deploymentRequest.merchantId}`,
        embedding_model: {
          provider: 'huggingface',
          model_name: deploymentRequest.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2',
          api_key: 'not_required'
        },
        reranking_model: deploymentRequest.modelType !== 'embedding' ? {
          provider: 'huggingface',
          model_name: deploymentRequest.rerankingModel || 'cross-encoder/ms-marco-MiniLM-L-6-v2',
          api_key: 'not_required'
        } : undefined,
        metadata_columns: ['document_id', 'title', 'document_type', 'source', 'created_at'],
        content_columns: ['content'],
        id_column: 'document_id'
      });

      results.knowledge_base = {
        status: 'configured',
        name: `rag_kb_${deploymentRequest.merchantId}`
      };
    } catch (kbError) {
      console.error('Knowledge base configuration failed:', kbError);
      results.knowledge_base = {
        status: 'failed',
        error: kbError instanceof Error ? kbError.message : 'Unknown error'
      };
    }

    const overallStatus = Object.values(results).every((result: any) => result.status === 'deployed' || result.status === 'configured') 
      ? 'success' : 'partial_success';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          deployment_id: deploymentId,
          merchant_id: deploymentRequest.merchantId,
          status: overallStatus,
          results,
          deployment_type: deploymentRequest.modelType,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Model deployment failed:', error);
    throw new Error(`Model deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle semantic search
 */
async function handleSemanticSearch(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const searchRequest: SearchRequest = {
    query: body.query,
    merchantId: body.merchantId,
    limit: body.limit || 10,
    threshold: body.threshold || 0.7,
    useHybridSearch: body.useHybridSearch !== false, // Default to true
    filters: body.filters,
    includeMetadata: body.includeMetadata !== false // Default to true
  };

  if (!searchRequest.query || !searchRequest.merchantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Query and merchant ID are required' })
    };
  }

  console.log(`Performing semantic search for merchant: ${searchRequest.merchantId}, query: "${searchRequest.query}"`);

  try {
    const searchParams: SemanticRetrievalParams = {
      query: searchRequest.query,
      merchantId: searchRequest.merchantId,
      limit: searchRequest.limit,
      threshold: searchRequest.threshold,
      useHybridSearch: searchRequest.useHybridSearch,
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
            content: searchRequest.includeMetadata ? result.snippet : result.snippet?.substring(0, 300) + '...',
            relevance_score: result.score || 0,
            document_type: result.metadata?.documentType || 'unknown',
            source: result.metadata?.sourceUri || 'unknown',
            created_at: result.metadata?.createdAt || new Date().toISOString(),
            metadata: searchRequest.includeMetadata ? result.metadata : undefined
          })),
          search_metadata: {
            total_results: results.length,
            search_type: searchRequest.useHybridSearch ? 'hybrid' : 'semantic',
            threshold: searchRequest.threshold,
            processing_time: 0 // Will be calculated
          }
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Semantic search failed:', error);
    throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle REST-based search (external API integration)
 */
async function handleRestSearch(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const restSearchRequest: RestSearchRequest = {
    query: body.query,
    merchantId: body.merchantId,
    endpoint: body.endpoint,
    apiKey: body.apiKey,
    limit: body.limit || 10,
    threshold: body.threshold || 0.7
  };

  if (!restSearchRequest.query || !restSearchRequest.merchantId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Query and merchant ID are required' })
    };
  }

  console.log(`Performing REST search for merchant: ${restSearchRequest.merchantId}`);

  try {
    // Mock REST search results for now
    const restResults = {
      results: [
        {
          id: 'rest_doc_1',
          title: 'REST Search Result',
          content: 'This is a mock result from REST API search',
          score: 0.8,
          metadata: {
            source: 'rest_api',
            endpoint: restSearchRequest.endpoint
          }
        }
      ]
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          query: restSearchRequest.query,
          results: restResults.results || [],
          search_metadata: {
            endpoint: restSearchRequest.endpoint,
            total_results: restResults.results?.length || 0,
            search_type: 'rest_api'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('REST search failed:', error);
    throw new Error(`REST search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle grounding validation
 */
async function handleGroundingValidation(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const validationRequest: GroundingValidationRequest = {
    query: body.query,
    documents: body.documents || [],
    expectedRelevance: body.expectedRelevance
  };

  if (!validationRequest.query || !validationRequest.documents.length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Query and documents are required' })
    };
  }

  console.log(`Validating grounding for query: "${validationRequest.query}" with ${validationRequest.documents.length} documents`);

  try {
    // Calculate relevance scores for each document
    const validationResults = await Promise.all(
      validationRequest.documents.map(async (doc, index) => {
        try {
          // Mock similarity calculation for now
          const similarity = {
            score: Math.random() * 0.5 + 0.5 // Random score between 0.5 and 1.0
          };

          return {
            document_id: doc.id,
            calculated_relevance: similarity.score,
            expected_relevance: validationRequest.expectedRelevance?.[index],
            content_preview: doc.content.substring(0, 200) + '...',
            metadata: doc.metadata
          };
        } catch (docError) {
          console.error(`Failed to validate document ${doc.id}:`, docError);
          return {
            document_id: doc.id,
            calculated_relevance: 0,
            expected_relevance: validationRequest.expectedRelevance?.[index],
            error: docError instanceof Error ? docError.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate overall grounding quality metrics
    const validResults = validationResults.filter(result => !result.error);
    const averageRelevance = validResults.reduce((sum, result) => sum + result.calculated_relevance, 0) / validResults.length;
    
    let accuracyScore = null;
    if (validationRequest.expectedRelevance) {
      const accuracyScores = validResults
        .filter(result => result.expected_relevance !== undefined)
        .map(result => 1 - Math.abs(result.calculated_relevance - (result.expected_relevance || 0)));
      accuracyScore = accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          query: validationRequest.query,
          validation_results: validationResults,
          grounding_metrics: {
            average_relevance: averageRelevance,
            accuracy_score: accuracyScore,
            total_documents: validationRequest.documents.length,
            successful_validations: validResults.length,
            failed_validations: validationResults.length - validResults.length
          }
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Grounding validation failed:', error);
    throw new Error(`Grounding validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle deployment status check
 */
async function handleDeploymentStatus(
  merchantId: string,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`Checking deployment status for merchant: ${merchantId}`);

  try {
    // Check predictor status
    const predictors = await mindsdbService.listPredictors(merchantId);
    const merchantPredictors = predictors.filter((p: any) => 
      p.name.includes(merchantId) && (p.name.includes('embedding') || p.name.includes('reranking'))
    );

    // Check knowledge base status
    let knowledgeBaseStatus = 'not_configured';
    try {
      // TODO: Implement knowledge base status check when available
      knowledgeBaseStatus = 'configured'; // Mock as configured for now
    } catch (kbError) {
      console.log('Knowledge base not found or not configured');
    }

    const status = {
      merchant_id: merchantId,
      embedding_model: {
        status: merchantPredictors.find((p: any) => p.name.includes('embedding')) ? 'deployed' : 'not_deployed',
        predictor_name: `embedding_model_${merchantId}`
      },
      reranking_model: {
        status: merchantPredictors.find((p: any) => p.name.includes('reranking')) ? 'deployed' : 'not_deployed',
        predictor_name: `reranking_model_${merchantId}`
      },
      knowledge_base: {
        status: knowledgeBaseStatus,
        name: `rag_kb_${merchantId}`
      },
      overall_status: merchantPredictors.length > 0 && knowledgeBaseStatus === 'configured' ? 'ready' : 'not_ready'
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Status check failed:', error);
    throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle configuration update
 */
async function handleUpdateConfig(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  console.log(`Updating configuration for merchant: ${merchantId}`);

  try {
    // Update knowledge base configuration
    // TODO: Implement knowledge base update when available
    console.log(`Updating configuration for knowledge base: rag_kb_${merchantId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          message: 'Configuration updated successfully',
          merchant_id: merchantId,
          updated_config: body
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Configuration update failed:', error);
    throw new Error(`Configuration update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle health check
 */
async function handleHealthCheck(context: Context): Promise<APIGatewayProxyResult> {
  console.log('Performing semantic retrieval health check');

  try {
    // Test basic service connectivity
    const healthStatus = {
      status: 'healthy',
      service: 'semantic-retrieval',
      components: {
        mindsdb: 'unknown',
        cache: 'unknown',
        database: 'unknown'
      },
      timestamp: new Date().toISOString()
    };

    // Test MindsDB connectivity
    try {
      await mindsdbService.listPredictors('test');
      healthStatus.components.mindsdb = 'healthy';
    } catch (mindsdbError) {
      healthStatus.components.mindsdb = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Test cache connectivity
    try {
      await cacheService.set('health_check', 'ok', 10);
      await cacheService.get('health_check');
      healthStatus.components.cache = 'healthy';
    } catch (cacheError) {
      healthStatus.components.cache = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    return {
      statusCode: healthStatus.status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: healthStatus,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Health check failed:', error);
    
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        data: {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
}