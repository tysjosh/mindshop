import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { getBedrockAgentToolRegistry, ToolExecutionContext } from '../services/BedrockAgentToolRegistry';
import { createDatabaseConnection } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

// Initialize services
let toolRegistry: any;
let isInitialized = false;

async function initializeServices() {
  if (!isInitialized) {
    // Initialize database connection
    await createDatabaseConnection();
    
    // Get tool registry
    toolRegistry = getBedrockAgentToolRegistry();
    
    isInitialized = true;
  }
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Bedrock Tools Handler - Event:', JSON.stringify(event, null, 2));

  try {
    await initializeServices();

    // Parse the request - handle both direct tool calls and Bedrock Agent format
    const body = JSON.parse(event.body || '{}');
    
    // Extract tool information
    let toolName: string;
    let toolInput: any;
    let executionContext: ToolExecutionContext;

    if (body.apiPath) {
      // Legacy format support
      toolName = body.apiPath.replace('/', '').replace('-', '_');
      toolInput = body.requestBody;
    } else if (body.actionGroup && body.function) {
      // Bedrock Agent format
      toolName = body.function;
      toolInput = body.parameters || {};
    } else if (body.tool_name) {
      // Direct tool call format
      toolName = body.tool_name;
      toolInput = body.input || {};
    } else {
      throw new Error('Invalid request format. Expected apiPath, actionGroup/function, or tool_name.');
    }

    // Create execution context
    executionContext = {
      merchantId: toolInput.merchant_id || 'unknown',
      userId: toolInput.user_id,
      sessionId: toolInput.session_id || body.sessionId,
      requestId: event.requestContext?.requestId || uuidv4(),
      timestamp: new Date(),
    };

    console.log(`Executing tool: ${toolName} for merchant: ${executionContext.merchantId}`);

    // Execute tool using registry
    const result = await toolRegistry.executeTool(toolName, toolInput, executionContext);

    if (!result.success) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Tool execution failed',
          message: result.error,
          tool_name: toolName,
          execution_time: result.executionTime,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Execution-Time': result.executionTime.toString(),
        'X-Tool-Cost': result.cost.toString(),
      },
      body: JSON.stringify({
        success: true,
        data: result.data,
        metadata: {
          tool_name: toolName,
          execution_time: result.executionTime,
          cost: result.cost,
          timestamp: executionContext.timestamp.toISOString(),
        },
      }),
    };

  } catch (error) {
    console.error('Error in Bedrock Tools Handler:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Get available tools endpoint
 */
export const getToolsHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    await initializeServices();

    const tools = toolRegistry.getTools();
    const openApiSpec = toolRegistry.generateOpenAPISpec();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        tools: tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          requires_auth: tool.requiresAuth,
          rate_limit_per_minute: tool.rateLimitPerMinute,
          cost_estimate: tool.costEstimate,
        })),
        openapi_spec: openApiSpec,
        timestamp: new Date().toISOString(),
      }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to get tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Health check endpoint
 */
export const healthHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    await initializeServices();

    // Execute health check tool
    const executionContext: ToolExecutionContext = {
      merchantId: 'system',
      requestId: event.requestContext?.requestId || uuidv4(),
      timestamp: new Date(),
    };

    const result = await toolRegistry.executeTool('tool_health_check', { merchant_id: 'system' }, executionContext);

    return {
      statusCode: result.success ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: result.success ? 'healthy' : 'unhealthy',
        data: result.data,
        execution_time: result.executionTime,
        timestamp: new Date().toISOString(),
      }),
    };

  } catch (error) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};