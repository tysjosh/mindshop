import Joi from 'joi';
import { getBedrockAgentToolRegistry, ToolDefinition } from './BedrockAgentToolRegistry';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ToolTestResult {
  toolName: string;
  success: boolean;
  executionTime: number;
  error?: string;
  response?: any;
}

/**
 * Validator for Bedrock Agent tool integrations
 * Ensures tools meet AWS Bedrock Agent requirements and work correctly
 */
export class BedrockAgentValidator {
  private toolRegistry = getBedrockAgentToolRegistry();

  /**
   * Validate all registered tools against Bedrock Agent requirements
   */
  async validateAllTools(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tools = this.toolRegistry.getTools();

    if (tools.length === 0) {
      errors.push('No tools registered');
      return { valid: false, errors, warnings };
    }

    for (const tool of tools) {
      const toolValidation = this.validateTool(tool);
      errors.push(...toolValidation.errors);
      warnings.push(...toolValidation.warnings);
    }

    // Validate OpenAPI specification
    const openApiValidation = this.validateOpenAPISpec();
    errors.push(...openApiValidation.errors);
    warnings.push(...openApiValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single tool
   */
  validateTool(tool: ToolDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate tool name
    if (!tool.name || typeof tool.name !== 'string') {
      errors.push(`Tool name is required and must be a string`);
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tool.name)) {
      errors.push(`Tool name '${tool.name}' must start with a letter and contain only letters, numbers, and underscores`);
    }

    // Validate description
    if (!tool.description || typeof tool.description !== 'string') {
      errors.push(`Tool '${tool.name}' must have a description`);
    } else if (tool.description.length > 500) {
      warnings.push(`Tool '${tool.name}' description is very long (${tool.description.length} chars). Consider shortening for better UX.`);
    }

    // Validate input schema
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      errors.push(`Tool '${tool.name}' must have an input schema`);
    } else {
      const schemaValidation = this.validateJSONSchema(tool.inputSchema, `${tool.name} input schema`);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }

    // Validate output schema
    if (!tool.outputSchema || typeof tool.outputSchema !== 'object') {
      errors.push(`Tool '${tool.name}' must have an output schema`);
    } else {
      const schemaValidation = this.validateJSONSchema(tool.outputSchema, `${tool.name} output schema`);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }

    // Validate handler
    if (!tool.handler || typeof tool.handler !== 'function') {
      errors.push(`Tool '${tool.name}' must have a handler function`);
    }

    // Validate rate limiting
    if (tool.rateLimitPerMinute && (typeof tool.rateLimitPerMinute !== 'number' || tool.rateLimitPerMinute <= 0)) {
      errors.push(`Tool '${tool.name}' rate limit must be a positive number`);
    }

    // Validate cost estimate
    if (tool.costEstimate && (typeof tool.costEstimate !== 'number' || tool.costEstimate < 0)) {
      errors.push(`Tool '${tool.name}' cost estimate must be a non-negative number`);
    }

    // Check for required merchant_id parameter
    if (tool.inputSchema.properties && !tool.inputSchema.properties.merchant_id) {
      warnings.push(`Tool '${tool.name}' should include merchant_id parameter for tenant isolation`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate JSON Schema structure
   */
  private validateJSONSchema(schema: any, context: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!schema.type) {
      errors.push(`${context}: Schema must have a 'type' property`);
    }

    if (schema.type === 'object') {
      if (!schema.properties) {
        warnings.push(`${context}: Object schema should have 'properties' defined`);
      }

      // Check for overly complex schemas
      if (schema.properties && Object.keys(schema.properties).length > 20) {
        warnings.push(`${context}: Schema has many properties (${Object.keys(schema.properties).length}). Consider simplifying.`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate OpenAPI specification
   */
  private validateOpenAPISpec(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const spec = this.toolRegistry.generateOpenAPISpec();

      if (!spec.openapi) {
        errors.push('OpenAPI specification must have version');
      }

      if (!spec.info || !spec.info.title || !spec.info.version) {
        errors.push('OpenAPI specification must have info with title and version');
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('OpenAPI specification must have paths');
      }

      // Validate each path
      for (const [path, pathSpec] of Object.entries(spec.paths as any)) {
        const pathSpecTyped = pathSpec as any;
        if (!pathSpecTyped.post) {
          warnings.push(`Path '${path}' should have POST method for tool execution`);
        }

        const postSpec = pathSpecTyped.post;
        if (postSpec && !postSpec.operationId) {
          errors.push(`Path '${path}' POST method must have operationId`);
        }

        if (postSpec && !postSpec.requestBody) {
          warnings.push(`Path '${path}' POST method should have requestBody`);
        }

        if (postSpec && !postSpec.responses) {
          errors.push(`Path '${path}' POST method must have responses`);
        }
      }

    } catch (error) {
      errors.push(`Failed to generate OpenAPI spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Test all tools with sample data
   */
  async testAllTools(): Promise<ToolTestResult[]> {
    const tools = this.toolRegistry.getTools();
    const results: ToolTestResult[] = [];

    for (const tool of tools) {
      if (tool.name === 'tool_health_check') {
        // Skip health check tool in testing
        continue;
      }

      const testResult = await this.testTool(tool);
      results.push(testResult);
    }

    return results;
  }

  /**
   * Test a single tool with sample data
   */
  async testTool(tool: ToolDefinition): Promise<ToolTestResult> {
    const startTime = Date.now();

    try {
      // Generate sample input based on schema
      const sampleInput = this.generateSampleInput(tool.inputSchema);
      
      // Create test execution context
      const context = {
        merchantId: 'test-merchant-validation',
        userId: 'test-user',
        sessionId: 'test-session',
        requestId: `test-${Date.now()}`,
        timestamp: new Date(),
      };

      // Execute tool
      const result = await this.toolRegistry.executeTool(tool.name, sampleInput, context);

      return {
        toolName: tool.name,
        success: result.success,
        executionTime: Date.now() - startTime,
        response: result.success ? result.data : undefined,
        error: result.success ? undefined : result.error,
      };

    } catch (error) {
      return {
        toolName: tool.name,
        success: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate sample input based on JSON schema
   */
  private generateSampleInput(schema: any): any {
    if (!schema || !schema.properties) {
      return {};
    }

    const input: any = {};

    for (const [key, propSchema] of Object.entries(schema.properties as any)) {
      input[key] = this.generateSampleValue(propSchema, key);
    }

    return input;
  }

  /**
   * Generate sample value for a schema property
   */
  private generateSampleValue(propSchema: any, key: string): any {
    switch (propSchema.type) {
      case 'string':
        if (key === 'merchant_id') return 'test-merchant-validation';
        if (key === 'user_id') return 'test-user';
        if (key === 'session_id') return 'test-session';
        if (key === 'sku') return 'TEST-SKU-001';
        if (key === 'query') return 'test product search query';
        if (key.includes('email')) return 'test@example.com';
        if (key.includes('phone')) return '+1234567890';
        return propSchema.default || 'test-value';

      case 'number':
      case 'integer':
        return propSchema.default || (propSchema.minimum || 1);

      case 'boolean':
        return propSchema.default !== undefined ? propSchema.default : true;

      case 'array':
        if (key === 'items') {
          return [{
            sku: 'TEST-SKU-001',
            quantity: 1,
            price: 10.99,
            name: 'Test Product'
          }];
        }
        return propSchema.default || [];

      case 'object':
        if (key === 'user_context') {
          return {
            user_id: 'test-user',
            preferences: { category: 'electronics' },
            purchase_history: ['PREV-SKU-001']
          };
        }
        if (key === 'shipping_address') {
          return {
            address_line_1: '123 Test Street',
            city: 'Test City',
            postal_code: '12345',
            country: 'US'
          };
        }
        if (key === 'user_consent') {
          return {
            terms_accepted: true,
            privacy_accepted: true,
            consent_timestamp: new Date().toISOString()
          };
        }
        return propSchema.default || {};

      default:
        return propSchema.default || null;
    }
  }

  /**
   * Generate Bedrock Agent configuration
   */
  generateBedrockAgentConfig(): any {
    const tools = this.toolRegistry.getTools();
    const openApiSpec = this.toolRegistry.generateOpenAPISpec();

    return {
      agentName: 'mindsdb-rag-agent',
      description: 'Intelligent e-commerce assistant with MindsDB RAG capabilities',
      foundationModel: 'amazon.nova-micro-v1:0',
      instruction: `You are an intelligent e-commerce assistant that helps customers discover products and complete purchases.

Your capabilities include:
1. Semantic search through product catalogs using MindsDB
2. Personalized product recommendations with explainable predictions  
3. Secure checkout processing
4. Health monitoring and tool status checks

Key behaviors:
- Always maintain tenant isolation by including merchant_id in all operations
- Provide explanations for recommendations including feature importance
- Ground all factual claims in retrieved documents
- Limit product recommendations to 3 items maximum
- Explicitly state information limitations when documents don't contain sufficient data
- Ensure secure handling of payment information during checkout

Available tools: ${tools.map(t => t.name).join(', ')}`,
      
      actionGroups: [
        {
          actionGroupName: 'MindsDBTools',
          description: 'Tools for interacting with MindsDB predictors and semantic retrieval',
          actionGroupExecutor: {
            lambda: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:mindsdb-rag-tools'
          },
          apiSchema: {
            payload: JSON.stringify(openApiSpec)
          }
        }
      ],

      idleSessionTtlInSeconds: 1800,
      
      promptOverrideConfiguration: {
        promptConfigurations: [
          {
            promptType: 'PRE_PROCESSING',
            promptCreationMode: 'OVERRIDDEN',
            promptState: 'ENABLED',
            basePromptTemplate: `You are processing a user query for an e-commerce assistant.

Extract the following information:
- User intent (search, recommend, purchase, question)
- Product-related keywords or SKUs
- User context (preferences, constraints)
- Required actions (retrieval, prediction, checkout)

Merchant ID: {{merchant_id}}
User Query: {{query}}

Respond with a structured plan for tool invocations.`,
            inferenceConfiguration: {
              temperature: 0.1,
              topP: 0.9,
              maxLength: 2048,
              stopSequences: ['</plan>']
            }
          }
        ]
      }
    };
  }

  /**
   * Validate Bedrock Agent integration
   */
  async validateBedrockIntegration(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Test tool registry
    const toolValidation = await this.validateAllTools();
    errors.push(...toolValidation.errors);
    warnings.push(...toolValidation.warnings);

    // Test tool execution
    try {
      const testResults = await this.testAllTools();
      const failedTests = testResults.filter(r => !r.success);
      
      if (failedTests.length > 0) {
        errors.push(`${failedTests.length} tools failed testing: ${failedTests.map(t => t.toolName).join(', ')}`);
      }

      // Check execution times
      const slowTests = testResults.filter(r => r.executionTime > 5000);
      if (slowTests.length > 0) {
        warnings.push(`${slowTests.length} tools are slow (>5s): ${slowTests.map(t => `${t.toolName}(${t.executionTime}ms)`).join(', ')}`);
      }

    } catch (error) {
      errors.push(`Tool testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Singleton instance
let validatorInstance: BedrockAgentValidator | null = null;

export function getBedrockAgentValidator(): BedrockAgentValidator {
  if (!validatorInstance) {
    validatorInstance = new BedrockAgentValidator();
  }
  return validatorInstance;
}

export { BedrockAgentValidator as BedrockAgentValidatorClass };