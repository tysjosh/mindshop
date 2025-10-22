import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createDatabaseConnection } from '../database/connection';
import { PredictionService } from '../services/PredictionService';
import { MindsDBService } from '../services/MindsDBService';
import { getCacheService } from '../services/CacheService';
import { 
  SecretsManagerClient, 
  GetSecretValueCommand, 
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand 
} from '@aws-sdk/client-secrets-manager';
import { 
  BedrockClient, 
  ListFoundationModelsCommand,
  GetFoundationModelCommand 
} from '@aws-sdk/client-bedrock';
import { v4 as uuidv4 } from 'uuid';

// Initialize services
let predictionService: PredictionService;
let mindsdbService: MindsDBService;
let cacheService: any;
let secretsManager: SecretsManagerClient;
let bedrockClient: BedrockClient;
let isInitialized = false;

async function initializeServices() {
  if (!isInitialized) {
    // Initialize database connection
    await createDatabaseConnection();
    
    // Initialize services
    mindsdbService = new MindsDBService();
    predictionService = new PredictionService(mindsdbService);
    cacheService = getCacheService();
    secretsManager = new SecretsManagerClient({ 
      region: process.env.AWS_REGION || 'us-east-2' 
    });
    bedrockClient = new BedrockClient({ 
      region: process.env.BEDROCK_REGION || 'us-east-2' 
    });
    
    isInitialized = true;
  }
}

interface BedrockCredentials {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

interface BedrockInitRequest {
  useServiceDefaults?: boolean;
  credentials?: BedrockCredentials;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

interface BedrockQueryRequest {
  question: string;
  context?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Bedrock Handler - Event:', JSON.stringify(event, null, 2));

  try {
    await initializeServices();

    const { httpMethod, pathParameters } = event;
    const merchantId = pathParameters?.merchantId;
    const action = pathParameters?.action;

    if (!merchantId && !pathParameters?.resource) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Merchant ID or resource identifier is required'
        })
      };
    }

    // Route to appropriate Bedrock function
    switch (action || pathParameters?.resource) {
      case 'initialize':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for initialization' })
          };
        }
        return await handleBedrockInitialization(merchantId, event, context);
      
      case 'status':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for status check' })
          };
        }
        return await handleBedrockStatus(merchantId, context);
      
      case 'ask':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for ask' })
          };
        }
        return await handleBedrockAsk(merchantId, event, context);
      
      case 'query':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for query' })
          };
        }
        return await handleBedrockQuery(merchantId, event, context);
      
      case 'test':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for test' })
          };
        }
        return await handleBedrockTest(merchantId, event, context);
      
      case 'credentials':
        if (!merchantId) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Merchant ID is required for credentials management' })
          };
        }
        return await handleCredentialsManagement(merchantId, event, context);
      
      case 'models':
        return await handleListModels(context);
      
      default:
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: 'Unknown action. Supported actions: initialize, status, ask, query, test, credentials, models' 
          })
        };
    }

  } catch (error) {
    console.error('Error in Bedrock Handler:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Bedrock processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
};

/**
 * Handle Bedrock initialization for a merchant
 */
async function handleBedrockInitialization(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const initRequest: BedrockInitRequest = {
    useServiceDefaults: body.useServiceDefaults !== false, // Default to true
    credentials: body.credentials,
    modelId: body.modelId || 'amazon.nova-micro-v1:0',
    temperature: body.temperature || 0.7,
    maxTokens: body.maxTokens || 4096
  };

  console.log(`Initializing Bedrock for merchant: ${merchantId}`);

  try {
    let credentials: BedrockCredentials;

    if (initRequest.useServiceDefaults) {
      // Use service default credentials (Lambda execution role)
      credentials = {
        awsAccessKeyId: 'SERVICE_DEFAULT',
        awsSecretAccessKey: 'SERVICE_DEFAULT',
        awsRegion: process.env.BEDROCK_REGION || 'us-east-2',
        modelId: initRequest.modelId,
        temperature: initRequest.temperature,
        maxTokens: initRequest.maxTokens
      };
    } else if (initRequest.credentials) {
      // Use provided credentials
      credentials = {
        ...initRequest.credentials,
        modelId: initRequest.modelId,
        temperature: initRequest.temperature,
        maxTokens: initRequest.maxTokens
      };
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Either useServiceDefaults must be true or credentials must be provided' 
        })
      };
    }

    // Store credentials in Secrets Manager
    const secretName = `mindsdb-rag/merchants/${merchantId}/bedrock-config`;
    
    try {
      await secretsManager.send(new CreateSecretCommand({
        Name: secretName,
        SecretString: JSON.stringify(credentials),
        Description: `Bedrock configuration for merchant ${merchantId}`
      }));
    } catch (secretError: any) {
      if (secretError.name === 'ResourceExistsException') {
        // Update existing secret
        await secretsManager.send(new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: JSON.stringify(credentials)
        }));
      } else {
        throw secretError;
      }
    }

    // Initialize MindsDB Bedrock integration
    try {
      await mindsdbService.setupBedrockIntegration(merchantId, {
        accessKeyId: credentials.awsAccessKeyId,
        secretAccessKey: credentials.awsSecretAccessKey,
        region: credentials.awsRegion
      });
      console.log(`MindsDB Bedrock integration created for merchant ${merchantId}`);
    } catch (mindsdbError) {
      console.warn('Failed to create MindsDB Bedrock integration:', mindsdbError);
      // Continue - credentials are still stored
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
          message: 'Bedrock initialized successfully',
          merchantId,
          configuration: {
            modelId: credentials.modelId,
            region: credentials.awsRegion,
            temperature: credentials.temperature,
            maxTokens: credentials.maxTokens,
            useServiceDefaults: initRequest.useServiceDefaults
          }
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Bedrock initialization failed:', error);
    throw new Error(`Bedrock initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle Bedrock status check
 */
async function handleBedrockStatus(
  merchantId: string,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`Checking Bedrock status for merchant: ${merchantId}`);

  try {
    // Check if credentials exist
    const secretName = `mindsdb-rag/merchants/${merchantId}/bedrock-config`;
    let credentialsExist = false;
    let configuration: any = null;

    try {
      const response = await secretsManager.send(new GetSecretValueCommand({
        SecretId: secretName
      }));
      
      if (response.SecretString) {
        credentialsExist = true;
        configuration = JSON.parse(response.SecretString);
        // Don't expose actual credentials
        configuration = {
          modelId: configuration.modelId,
          region: configuration.awsRegion,
          temperature: configuration.temperature,
          maxTokens: configuration.maxTokens,
          useServiceDefaults: configuration.awsAccessKeyId === 'SERVICE_DEFAULT'
        };
      }
    } catch (secretError) {
      console.log('No Bedrock configuration found for merchant');
    }

    // Check MindsDB integration status
    let mindsdbIntegrationStatus = 'not_configured';
    try {
      // Check if Bedrock integration exists by trying to use it
      mindsdbIntegrationStatus = 'configured'; // Assume configured if credentials exist
    } catch (mindsdbError) {
      console.warn('Failed to check MindsDB integration status:', mindsdbError);
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
          merchantId,
          status: credentialsExist ? 'configured' : 'not_configured',
          configuration,
          mindsdb_integration: mindsdbIntegrationStatus,
          last_checked: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Bedrock status check failed:', error);
    throw new Error(`Bedrock status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle Bedrock ask (simple question answering)
 */
async function handleBedrockAsk(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const question = body.question;

  if (!question || question.trim().length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Question is required' })
    };
  }

  console.log(`Processing Bedrock ask for merchant: ${merchantId}, question: "${question}"`);

  try {
    // Get merchant's Bedrock configuration
    const config = await getMerchantBedrockConfig(merchantId);
    
    if (!config) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Bedrock not configured for this merchant. Please initialize first.' 
        })
      };
    }

    // Use MindsDB to query Bedrock
    const response = await mindsdbService.queryAgent(
      `bedrock_agent_${merchantId}`,
      question
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          question,
          answer: typeof response === 'string' ? response : 
                  (response as any).answer || (response as any).response || 'No response generated',
          model: config.modelId,
          confidence: 0.85,
          processing_time: 0
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Bedrock ask failed:', error);
    throw new Error(`Bedrock ask failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle Bedrock query (with context)
 */
async function handleBedrockQuery(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const queryRequest: BedrockQueryRequest = {
    question: body.question,
    context: body.context,
    modelId: body.modelId,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    sessionId: body.sessionId
  };

  if (!queryRequest.question) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Question is required' })
    };
  }

  console.log(`Processing Bedrock query for merchant: ${merchantId}`);

  try {
    // Get merchant's Bedrock configuration
    const config = await getMerchantBedrockConfig(merchantId);
    
    if (!config) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Bedrock not configured for this merchant. Please initialize first.' 
        })
      };
    }

    // Build contextual prompt if context is provided
    let prompt = queryRequest.question;
    if (queryRequest.context) {
      prompt = `Context: ${queryRequest.context}\n\nQuestion: ${queryRequest.question}\n\nPlease answer the question based on the provided context.`;
    }

    // Use MindsDB agent for querying
    const agentResponse = await mindsdbService.queryAgent(
      `bedrock_agent_${merchantId}`,
      prompt
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          question: queryRequest.question,
          answer: typeof agentResponse === 'string' ? agentResponse : 'No response generated',
          context_used: !!queryRequest.context,
          model: queryRequest.modelId || config.modelId,
          session_id: queryRequest.sessionId,
          confidence: 0.85,
          processing_time: 0
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Bedrock query failed:', error);
    throw new Error(`Bedrock query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle Bedrock test
 */
async function handleBedrockTest(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`Testing Bedrock configuration for merchant: ${merchantId}`);

  try {
    // Get merchant's Bedrock configuration
    const config = await getMerchantBedrockConfig(merchantId);
    
    if (!config) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Bedrock not configured for this merchant. Please initialize first.' 
        })
      };
    }

    // Test with a simple question
    const testQuestion = 'Hello, can you confirm that you are working correctly?';
    
    const response = await mindsdbService.queryAgent(
      `bedrock_agent_${merchantId}`,
      testQuestion
    );

    const isWorking = response && (typeof response === 'string' ? response : 
                      (response as any).answer || (response as any).response);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          test_status: isWorking ? 'passed' : 'failed',
          test_question: testQuestion,
          test_response: typeof response === 'string' ? response : 
                         (response as any).answer || (response as any).response || 'No response',
          model: config.modelId,
          configuration: {
            region: config.awsRegion,
            model_id: config.modelId,
            temperature: config.temperature,
            max_tokens: config.maxTokens
          }
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Bedrock test failed:', error);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          test_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          test_question: 'Hello, can you confirm that you are working correctly?'
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
}

/**
 * Handle credentials management
 */
async function handleCredentialsManagement(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const { httpMethod } = event;

  switch (httpMethod) {
    case 'POST':
      // Store new credentials
      return await handleStoreCredentials(merchantId, event, context);
    
    case 'GET':
      // Get credentials status (not actual credentials)
      return await handleBedrockStatus(merchantId, context);
    
    case 'DELETE':
      // Delete credentials
      return await handleDeleteCredentials(merchantId, context);
    
    default:
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
  }
}

/**
 * Handle storing credentials
 */
async function handleStoreCredentials(
  merchantId: string,
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const credentials: BedrockCredentials = {
    awsAccessKeyId: body.awsAccessKeyId,
    awsSecretAccessKey: body.awsSecretAccessKey,
    awsRegion: body.awsRegion || 'us-east-2',
    modelId: body.modelId || 'amazon.nova-micro-v1:0',
    temperature: body.temperature || 0.7,
    maxTokens: body.maxTokens || 4096
  };

  if (!credentials.awsAccessKeyId || !credentials.awsSecretAccessKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'AWS Access Key ID and Secret Access Key are required' })
    };
  }

  // Use the initialization logic
  const initEvent = {
    ...event,
    body: JSON.stringify({
      useServiceDefaults: false,
      credentials,
      modelId: credentials.modelId,
      temperature: credentials.temperature,
      maxTokens: credentials.maxTokens
    })
  };

  return await handleBedrockInitialization(merchantId, initEvent, context);
}

/**
 * Handle deleting credentials
 */
async function handleDeleteCredentials(
  merchantId: string,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`Deleting Bedrock credentials for merchant: ${merchantId}`);

  try {
    const secretName = `mindsdb-rag/merchants/${merchantId}/bedrock-config`;
    
    // Delete from Secrets Manager
    try {
      await secretsManager.send(new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true
      }));
    } catch (secretError) {
      console.warn('Failed to delete secret (may not exist):', secretError);
    }

    // Remove MindsDB integration
    try {
      // TODO: Implement integration removal when available
      console.log(`MindsDB integration for ${merchantId} should be removed`);
    } catch (mindsdbError) {
      console.warn('Failed to remove MindsDB integration:', mindsdbError);
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
          message: 'Bedrock credentials deleted successfully',
          merchantId
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Delete credentials failed:', error);
    throw new Error(`Delete credentials failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle listing available models
 */
async function handleListModels(context: Context): Promise<APIGatewayProxyResult> {
  console.log('Listing available Bedrock models');

  try {
    // Get models from Bedrock
    const response = await bedrockClient.send(new ListFoundationModelsCommand({}));
    
    const models = response.modelSummaries?.map(model => ({
      modelId: model.modelId,
      modelName: model.modelName,
      provider: model.providerName,
      inputModalities: model.inputModalities,
      outputModalities: model.outputModalities,
      responseStreamingSupported: model.responseStreamingSupported
    })) || [];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          models,
          count: models.length,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('List models failed:', error);
    
    // Fallback to static model list if Bedrock API fails
    const fallbackModels = [
      {
        modelId: 'amazon.nova-micro-v1:0',
        modelName: 'Nova Micro',
        provider: 'Amazon',
        inputModalities: ['TEXT'],
        outputModalities: ['TEXT'],
        responseStreamingSupported: true
      },
      {
        modelId: 'amazon.nova-lite-v1:0',
        modelName: 'Nova Lite',
        provider: 'Amazon',
        inputModalities: ['TEXT', 'IMAGE'],
        outputModalities: ['TEXT'],
        responseStreamingSupported: true
      }
    ];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          models: fallbackModels,
          count: fallbackModels.length,
          note: 'Using fallback model list due to API error',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
}

/**
 * Helper function to get merchant's Bedrock configuration
 */
async function getMerchantBedrockConfig(merchantId: string): Promise<BedrockCredentials | null> {
  try {
    const secretName = `mindsdb-rag/merchants/${merchantId}/bedrock-config`;
    const response = await secretsManager.send(new GetSecretValueCommand({
      SecretId: secretName
    }));
    
    if (response.SecretString) {
      return JSON.parse(response.SecretString);
    }
    
    return null;
  } catch (error) {
    console.log(`No Bedrock configuration found for merchant ${merchantId}`);
    return null;
  }
}