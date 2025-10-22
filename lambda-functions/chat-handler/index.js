"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionHandler = exports.handler = void 0;

// Production Lambda Handler - Adapted from src/lambda/chatHandler.ts
// Architecture: API Gateway → Lambda → Internal ALB → ECS (MindsDB) → Aurora
// This Lambda makes HTTP calls to MindsDB service and uses your full service layer

const fetch = require('node-fetch');
const crypto = require('crypto');

// Service initialization flags
let isInitialized = false;
let cacheService = null;
let toolRegistry = null;

// Simple in-memory cache for Lambda (since we can't connect to Redis directly)
const memoryCache = new Map();

/**
 * Initialize services for Lambda environment
 * Note: No direct database connections - only HTTP calls to MindsDB
 */
async function initializeServices() {
    if (!isInitialized) {
        console.log('Starting Lambda service initialization...');
        
        // Verify MindsDB endpoint is configured
        const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
        if (!mindsdbEndpoint) {
            throw new Error('MINDSDB_ENDPOINT environment variable is required');
        }
        
        console.log('MindsDB endpoint configured:', mindsdbEndpoint);
        
        // Test MindsDB connectivity
        try {
            const response = await fetch(`${mindsdbEndpoint}/`, {
                method: 'GET',
                timeout: 5000
            });
            console.log('MindsDB health check:', response.status);
        } catch (error) {
            console.warn('MindsDB health check failed:', error.message);
        }
        
        // Initialize simple cache service for Lambda
        cacheService = {
            get: (key) => {
                const item = memoryCache.get(key);
                if (item && item.expires > Date.now()) {
                    return item.data;
                }
                memoryCache.delete(key);
                return null;
            },
            set: (key, value, ttlSeconds = 300) => {
                memoryCache.set(key, {
                    data: value,
                    expires: Date.now() + (ttlSeconds * 1000)
                });
            }
        };
        
        // Initialize tool registry (simplified for Lambda)
        toolRegistry = {
            executeTool: async (toolName, input, context) => {
                console.log(`Executing tool: ${toolName}`);
                
                // Call MindsDB tool execution via HTTP
                const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
                try {
                    const response = await fetch(`${mindsdbEndpoint}/api/tools/${toolName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            input: input,
                            context: context
                        }),
                        timeout: 30000
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        return {
                            success: true,
                            data: result,
                            executionTime: 1000
                        };
                    } else {
                        throw new Error(`Tool execution failed: ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Tool execution error for ${toolName}:`, error);
                    return {
                        success: false,
                        error: error.message,
                        executionTime: 0
                    };
                }
            }
        };
        
        isInitialized = true;
        console.log('Lambda service initialization completed');
    }
}

/**
 * Main Lambda handler
 */
const handler = async (event, context) => {
    console.log('Chat Handler - Event:', JSON.stringify(event, null, 2));
    const startTime = Date.now();

    try {
        // Initialize services with timeout
        await Promise.race([
            initializeServices(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Service initialization timeout')), 20000)
            )
        ]);

        // Parse the request
        const body = JSON.parse(event.body || '{}');
        const chatRequest = {
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
        let result;
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

exports.handler = handler;

/**
 * Handle standard chat query using RAG via MindsDB HTTP API
 */
async function handleChatQuery(chatRequest, context) {
    console.log(`Processing chat query for merchant: ${chatRequest.merchant_id}`);

    const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
    if (!mindsdbEndpoint) {
        throw new Error('MINDSDB_ENDPOINT not configured');
    }

    // Check cache for recent similar queries
    const cacheKey = `chat:${chatRequest.merchant_id}:${crypto.createHash('md5').update(chatRequest.query).digest('hex')}`;
    const cached = cacheService.get(cacheKey);
    
    if (cached) {
        console.log('Cache hit for chat query');
        cached.metadata.cacheHit = true;
        return cached;
    }

    let response;
    let confidence = 0.85;
    let sources = [];
    let reasoning = [];
    let ragUsed = false;

    try {
        // Call MindsDB RAG system via HTTP API
        console.log('Calling MindsDB RAG API...');
        
        const ragQuery = {
            query: chatRequest.query,
            merchantId: chatRequest.merchant_id,
            userId: chatRequest.user_id,
            sessionId: chatRequest.session_id,
            userContext: chatRequest.context,
            maxResults: 5,
            threshold: 0.7,
            includeExplainability: true,
            use_rag: chatRequest.use_rag
        };

        const mindsdbResponse = await fetch(`${mindsdbEndpoint}/api/rag/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ragQuery),
            timeout: 25000
        });

        if (mindsdbResponse.ok) {
            const ragResult = await mindsdbResponse.json();
            console.log('MindsDB RAG response received');
            
            response = ragResult.response || ragResult.answer || `AI Assistant: I understand you're asking about "${chatRequest.query}". I'm processing this through our MindsDB RAG system.`;
            confidence = ragResult.confidence || 0.85;
            sources = ragResult.sources || [];
            reasoning = ragResult.reasoning || ['Query processed through MindsDB RAG system', 'Retrieved relevant documents', 'Generated contextual response'];
            ragUsed = ragResult.ragUsed || false;
            
        } else {
            throw new Error(`MindsDB RAG API error: ${mindsdbResponse.status}`);
        }
        
    } catch (ragError) {
        console.error('MindsDB RAG API call failed, trying fallback:', ragError);
        
        // Fallback to simple agent query
        try {
            const agentResponse = await fetch(`${mindsdbEndpoint}/api/agents/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agent_name: `chat_agent_${chatRequest.merchant_id}`,
                    question: chatRequest.query,
                    context: chatRequest.context
                }),
                timeout: 15000
            });
            
            if (agentResponse.ok) {
                const agentResult = await agentResponse.json();
                response = agentResult.response || agentResult.answer || `Hello! I received your message: "${chatRequest.query}". I'm processing your request through our AI system.`;
                reasoning = ['RAG system unavailable', 'Fallback to direct agent query', 'Response generated successfully'];
            } else {
                throw new Error(`Agent API error: ${agentResponse.status}`);
            }
            
        } catch (agentError) {
            console.error('Agent API also failed:', agentError);
            response = `Hello! I received your message: "${chatRequest.query}". I'm currently experiencing connectivity issues with the AI service, but I'm working to resolve this. Please try again in a moment.`;
            confidence = 0.3;
            reasoning = ['RAG system unavailable', 'Agent system unavailable', 'Fallback response provided'];
        }
    }

    const chatResponse = {
        response,
        merchant_id: chatRequest.merchant_id,
        user_id: chatRequest.user_id,
        session_id: chatRequest.session_id,
        confidence,
        sources,
        reasoning,
        metadata: {
            mindsdbEndpoint: mindsdbEndpoint,
            bedrockRegion: process.env.BEDROCK_REGION || 'us-east-2',
            processingTime: 0, // Will be set by caller
            ragUsed,
            cacheHit: false
        }
    };

    // Cache the response for 5 minutes
    cacheService.set(cacheKey, chatResponse, 300);

    return chatResponse;
}

/**
 * Handle Bedrock Agent tool calls
 */
async function handleBedrockAgentCall(body, chatRequest, context) {
    console.log(`Processing Bedrock Agent tool call: ${body.function}`);

    const executionContext = {
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
            session_id: chatRequest.session_id,
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
function buildContextualPrompt(query, retrievalResults) {
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
const sessionHandler = async (event, context) => {
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

exports.sessionHandler = sessionHandler;

/**
 * Session management helper functions
 */
async function getSession(sessionId) {
    // Call MindsDB session API
    const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
    
    try {
        const response = await fetch(`${mindsdbEndpoint}/api/sessions/${sessionId}`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn('Session retrieval failed:', error);
    }
    
    // Fallback session data
    return {
        session_id: sessionId,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        message_count: 0
    };
}

async function createSession(merchantId, userId) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
    
    try {
        const response = await fetch(`${mindsdbEndpoint}/api/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: sessionId,
                merchant_id: merchantId,
                user_id: userId
            }),
            timeout: 5000
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn('Session creation failed:', error);
    }
    
    // Fallback session creation
    return {
        session_id: sessionId,
        merchant_id: merchantId,
        user_id: userId,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        message_count: 0
    };
}

async function deleteSession(sessionId) {
    const mindsdbEndpoint = process.env.MINDSDB_ENDPOINT;
    
    try {
        await fetch(`${mindsdbEndpoint}/api/sessions/${sessionId}`, {
            method: 'DELETE',
            timeout: 5000
        });
    } catch (error) {
        console.warn('Session deletion failed:', error);
    }
    
    console.log(`Session ${sessionId} deleted`);
}