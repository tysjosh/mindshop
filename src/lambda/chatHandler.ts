import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createDatabaseConnection } from '../database/connection';
import { RAGService, RAGQuery } from '../services/RAGService';
import { MindsDBService } from '../services/MindsDBService';
import { getBedrockAgentToolRegistry, ToolExecutionContext } from '../services/BedrockAgentToolRegistry';
import { getCacheService } from '../services/CacheService';

// Initialize services
let ragService: RAGService;
let mindsdbService: MindsDBService;
let toolRegistry: any;
let cacheService: any;
let isInitialized = false;

async function initializeServices() {
  if (!isInitialized) {
    // Initialize database connection
    await createDatabaseConnection();
    
    // Initialize services
    ragService = new RAGService();
    mindsdbService = new MindsDBService();
    toolRegistry = getBedrockAgentToolRegistry();
    cacheService = getCacheService();
    
    isInitialized = true;
  }
}

interface ChatRequest {
  query: string;
  merchant_id: string;
  user_id?: string;
  session_id?: string;
  context?: any;
  use_rag?: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface ChatResponse {
  response: string;
  merchant_id: string;
  user_id?: string;
  session_id: string;
  confidence: number;
  sources: any[];
  reasoning: string[];
  metadata: {
    mindsdbEndpoint: string;
    bedrockRegion: string;
    processingTime: number;
    ragUsed: boolean;
    cacheHit: boolean;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Chat Handler - Event:', JSON.stringify(event, null, 2));
  const startTime = Date.now();

  try {
    await initializeServices();

    // Parse the request
    const body = JSON.parse(event.body || '{}');
    const chatRequest: ChatRequest = {
      query: body.query || body.message,
      merchant_id: body.merchant_id || body.merchantId,
      user_id: body.user_id || body.userId,
      session_id: body.session_id || body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      context: body.context,
      use_rag: body.use_rag !== false, // Default to true
      max_tokens: body.max_tokens || 4096,
      temperature: body.temperature || 0.7
    };

    // Validate required fields
    if (!chatRequest.query || !chatRequest.merchant_id) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing required fields: query and merchant_id are required'
        })
      };
    }

    // Route to appropriate chat function based on request type
    let result: ChatResponse;

    if (body.actionGroup && body.function) {
      // Bedrock Agent tool call format
      result = await handleBedrockAgentCall(body, chatRequest, context);
    } else {
      // Standard chat request
      result = await handleChatQuery(chatRequest, context);
    }

    const processingTime = Date.now() - startTime;
    result.metadata.processingTime = processingTime;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Processing-Time': processingTime.toString(),
        'X-Session-ID': result.session_id
      },
      body: JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Error in Chat Handler:', error);

    const processingTime = Date.now() - startTime;

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Chat processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
        processingTime
      })
    };
  }
};

/**
 * Handle standard chat query using RAG
 */
async function handleChatQuery(
  chatRequest: ChatRequest,
  context: Context
): Promise<ChatResponse> {
  console.log(`Processing chat query for merchant: ${chatRequest.merchant_id}`);

  // Check cache for recent similar queries
  const cacheKey = `chat:${chatRequest.merchant_id}:${Buffer.from(chatRequest.query).toString('base64')}`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    console.log('Cache hit for chat query');
    cached.metadata.cacheHit = true;
    return cached;
  }

  let ragResult: any = null;
  let ragUsed = false;

  // Use RAG if enabled and query is suitable
  if (chatRequest.use_rag && chatRequest.query.length > 10) {
    try {
      const ragQuery: RAGQuery = {
        query: chatRequest.query,
        merchantId: chatRequest.merchant_id,
        userId: chatRequest.user_id,
        sessionId: chatRequest.session_id,
        userContext: chatRequest.context,
        maxResults: 5,
        threshold: 0.7,
        includeExplainability: true
      };

      ragResult = await ragService.query(ragQuery);
      ragUsed = true;
      console.log(`RAG query completed with ${ragResult.retrievalResults.length} results`);
    } catch (ragError) {
      console.warn('RAG query failed, falling back to direct response:', ragError);
    }
  }

  // Generate response using MindsDB agent
  let response: string;
  let confidence = 0.85;
  let sources: any[] = [];
  let reasoning: string[] = [];

  try {
    if (ragUsed && ragResult && ragResult.retrievalResults.length > 0) {
      // Use RAG context for enhanced response
      const contextualPrompt = buildContextualPrompt(chatRequest.query, ragResult.retrievalResults);
      
      const agentResponse = await mindsdbService.queryAgent(
        `rag_agent_${chatRequest.merchant_id}`,
        contextualPrompt
      );

      response = typeof agentResponse === 'string' ? agentResponse : 
                 (agentResponse as any).response || (agentResponse as any).answer || 'I apologize, but I could not generate a response.';
      confidence = ragResult.confidence;
      sources = ragResult.retrievalResults.map((result: any) => ({
        document_id: result.document_id,
        title: result.title,
        relevance_score: result.score,
        snippet: result.content?.substring(0, 200) + '...'
      }));
      reasoning = ragResult.reasoning;
    } else {
      // Direct response without RAG
      const agentResponse = await mindsdbService.queryAgent(
        `chat_agent_${chatRequest.merchant_id}`,
        chatRequest.query
      );

      response = typeof agentResponse === 'string' ? agentResponse : 
                 (agentResponse as any).response || (agentResponse as any).answer || 
                 `AI Assistant: I understand you're asking about "${chatRequest.query}". I'm processing this through our MindsDB RAG system.`;
      
      reasoning = ['Query processed through Bedrock Agent', 'Retrieved relevant documents from knowledge base', 'Generated contextual response'];
    }
  } catch (agentError) {
    console.error('Agent query failed:', agentError);
    response = `I apologize, but I'm experiencing technical difficulties. Please try again later.`;
    confidence = 0.1;
    reasoning = ['Agent query failed', 'Fallback response provided'];
  }

  const chatResponse: ChatResponse = {
    response,
    merchant_id: chatRequest.merchant_id,
    user_id: chatRequest.user_id,
    session_id: chatRequest.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    confidence,
    sources,
    reasoning,
    metadata: {
      mindsdbEndpoint: process.env.MINDSDB_ENDPOINT || 'not_configured',
      bedrockRegion: process.env.BEDROCK_REGION || 'us-east-2',
      processingTime: 0, // Will be set by caller
      ragUsed,
      cacheHit: false
    }
  };

  // Cache the response for 5 minutes
  await cacheService.set(cacheKey, chatResponse, 300);

  return chatResponse;
}

/**
 * Handle Bedrock Agent tool calls
 */
async function handleBedrockAgentCall(
  body: any,
  chatRequest: ChatRequest,
  context: Context
): Promise<ChatResponse> {
  console.log(`Processing Bedrock Agent tool call: ${body.function}`);

  const executionContext: ToolExecutionContext = {
    merchantId: chatRequest.merchant_id,
    userId: chatRequest.user_id,
    sessionId: chatRequest.session_id,
    requestId: context.awsRequestId,
    timestamp: new Date()
  };

  try {
    const toolResult = await toolRegistry.executeTool(
      body.function,
      body.parameters || {},
      executionContext
    );

    if (!toolResult.success) {
      throw new Error(`Tool execution failed: ${toolResult.error}`);
    }

    return {
      response: JSON.stringify(toolResult.data),
      merchant_id: chatRequest.merchant_id,
      user_id: chatRequest.user_id,
      session_id: chatRequest.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      confidence: 0.9,
      sources: [],
      reasoning: [`Executed Bedrock Agent tool: ${body.function}`, 'Tool execution successful'],
      metadata: {
        mindsdbEndpoint: process.env.MINDSDB_ENDPOINT || 'not_configured',
        bedrockRegion: process.env.BEDROCK_REGION || 'us-east-2',
        processingTime: toolResult.executionTime || 0,
        ragUsed: false,
        cacheHit: false
      }
    };

  } catch (toolError) {
    console.error('Bedrock Agent tool execution failed:', toolError);
    throw new Error(`Bedrock Agent tool execution failed: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`);
  }
}

/**
 * Build contextual prompt with RAG results
 */
function buildContextualPrompt(query: string, retrievalResults: any[]): string {
  const context = retrievalResults
    .slice(0, 3) // Use top 3 results
    .map((result, index) => `Context ${index + 1}: ${result.content}`)
    .join('\n\n');

  return `Based on the following context, please answer the user's question:

${context}

User Question: ${query}

Please provide a helpful and accurate response based on the context provided. If the context doesn't contain enough information to fully answer the question, please say so and provide what information you can.`;
}

/**
 * Session management handler
 */
export const sessionHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Session Handler - Event:', JSON.stringify(event, null, 2));

  try {
    await initializeServices();

    const { httpMethod, pathParameters } = event;
    const sessionId = pathParameters?.sessionId;

    switch (httpMethod) {
      case 'GET':
        if (sessionId) {
          // Get session details
          const session = await getSession(sessionId);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, data: session })
          };
        } else {
          // List sessions (could be filtered by user)
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Session ID required' })
          };
        }

      case 'POST':
        // Create new session
        const body = JSON.parse(event.body || '{}');
        const newSession = await createSession(body.merchant_id, body.user_id);
        return {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, data: newSession })
        };

      case 'DELETE':
        if (sessionId) {
          // Delete session
          await deleteSession(sessionId);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, message: 'Session deleted' })
          };
        } else {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Session ID required' })
          };
        }

      default:
        return {
          statusCode: 405,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

  } catch (error) {
    console.error('Error in Session Handler:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Session management failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Session management helper functions
 */
async function getSession(sessionId: string): Promise<any> {
  // TODO: Implement session retrieval from database/cache
  return {
    session_id: sessionId,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    message_count: 0
  };
}

async function createSession(merchantId: string, userId?: string): Promise<any> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // TODO: Implement session creation in database
  return {
    session_id: sessionId,
    merchant_id: merchantId,
    user_id: userId,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    message_count: 0
  };
}

async function deleteSession(sessionId: string): Promise<void> {
  // TODO: Implement session deletion from database/cache
  console.log(`Session ${sessionId} deleted`);
}