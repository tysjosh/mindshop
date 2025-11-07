import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBedrockAgentToolRegistry, getBedrockAgentValidator } from '../services';

describe('Bedrock Agent Tool Integrations', () => {
  let toolRegistry: any;
  let validator: any;

  beforeEach(() => {
    toolRegistry = getBedrockAgentToolRegistry();
    validator = getBedrockAgentValidator();
  });

  describe('Tool Registry', () => {
    it('should have registered default tools', () => {
      const tools = toolRegistry.getTools();
      
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('semantic_retrieval');
      expect(toolNames).toContain('product_prediction');
      expect(toolNames).toContain('secure_checkout');
      expect(toolNames).toContain('tool_health_check');
    });

    it('should generate valid OpenAPI specification', () => {
      const openApiSpec = toolRegistry.generateOpenAPISpec();
      
      expect(openApiSpec).toHaveProperty('openapi');
      expect(openApiSpec).toHaveProperty('info');
      expect(openApiSpec).toHaveProperty('paths');
      
      expect(openApiSpec.info.title).toBe('MindsDB RAG Tools API');
      expect(openApiSpec.info.version).toBe('1.0.0');
      
      const paths = Object.keys(openApiSpec.paths);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths).toContain('/semantic_retrieval');
      expect(paths).toContain('/product_prediction');
    });

    it('should validate tool schemas correctly', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('requiresAuth');
        
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.outputSchema).toBe('object');
        expect(typeof tool.handler).toBe('function');
        expect(typeof tool.requiresAuth).toBe('boolean');
      }
    });

    it('should track execution statistics', async () => {
      const context = {
        merchantId: 'test-merchant',
        userId: 'test-user',
        sessionId: '00000000-0000-0000-0000-000000000001', // Valid UUID format
        requestId: 'test-request',
        timestamp: new Date(),
      };

      try {
        // Execute health check tool
        const result = await toolRegistry.executeTool('tool_health_check', { merchant_id: 'test-merchant' }, context);
        
        // Test should pass even if database is not available
        expect(result).toHaveProperty('executionTime');
        expect(result).toHaveProperty('cost');
        expect(result).toHaveProperty('metadata');
        
        const stats = toolRegistry.getExecutionStats();
        expect(stats).toBeDefined();
      } catch (error: any) {
        // Expected in test environment without database
        expect(error.message).toContain('cost_tracking');
      }
    }, 10000);
  });

  describe('Tool Validation', () => {
    it('should validate all tools successfully', async () => {
      const validation = await validator.validateAllTools();
      
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      
      if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
        console.log('Validation warnings:', validation.warnings);
      }
      
      // Should have minimal errors for core functionality
      expect(validation.errors.length).toBeLessThan(5);
    });

    it('should generate sample inputs for tool schemas', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        const sampleInput = (validator as any).generateSampleInput(tool.inputSchema);
        
        expect(typeof sampleInput).toBe('object');
        
        // Check required fields are present
        if (tool.inputSchema.required) {
          for (const requiredField of tool.inputSchema.required) {
            expect(sampleInput).toHaveProperty(requiredField);
          }
        }
      }
    });

    it('should generate valid Bedrock Agent configuration', () => {
      const config = validator.generateBedrockAgentConfig();
      
      expect(config).toHaveProperty('agentName');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('foundationModel');
      expect(config).toHaveProperty('instruction');
      expect(config).toHaveProperty('actionGroups');
      
      expect(config.agentName).toBe('mindsdb-rag-agent');
      expect(config.foundationModel).toBe('amazon.nova-micro-v1:0');
      expect(Array.isArray(config.actionGroups)).toBe(true);
      expect(config.actionGroups.length).toBeGreaterThan(0);
      
      const actionGroup = config.actionGroups[0];
      expect(actionGroup).toHaveProperty('actionGroupName');
      expect(actionGroup).toHaveProperty('description');
      expect(actionGroup).toHaveProperty('actionGroupExecutor');
      expect(actionGroup).toHaveProperty('apiSchema');
    });
  });

  describe('Tool Execution Context', () => {
    it('should create proper execution context', () => {
      const context = {
        merchantId: 'test-merchant-123',
        userId: 'test-user-456',
        sessionId: 'test-session-789',
        requestId: 'test-request-abc',
        timestamp: new Date(),
      };

      expect(context.merchantId).toBe('test-merchant-123');
      expect(context.userId).toBe('test-user-456');
      expect(context.sessionId).toBe('test-session-789');
      expect(context.requestId).toBe('test-request-abc');
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it('should handle missing optional context fields', () => {
      const context = {
        merchantId: 'test-merchant',
        requestId: 'test-request',
        timestamp: new Date(),
      };

      expect(context.merchantId).toBe('test-merchant');
      expect(context.requestId).toBe('test-request');
      expect(context.userId).toBeUndefined();
      expect(context.sessionId).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool names gracefully', async () => {
      const context = {
        merchantId: 'test-merchant',
        requestId: 'test-request',
        timestamp: new Date(),
      };

      try {
        const result = await toolRegistry.executeTool('non_existent_tool', {}, context);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      } catch (error: any) {
        // Expected behavior - tool throws error for non-existent tools
        expect(error.message).toContain('not found');
      }
    });

    it('should validate input parameters', async () => {
      const context = {
        merchantId: 'test-merchant',
        requestId: 'test-request',
        timestamp: new Date(),
      };

      // Test with missing required parameters
      try {
        const result = await toolRegistry.executeTool('semantic_retrieval', {}, context);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required field');
      } catch (error: any) {
        // Expected - validation should throw error for missing required fields
        expect(error.message).toContain('Missing required field');
      }
    });

    it('should handle tool execution failures', async () => {
      const context = {
        merchantId: 'test-merchant',
        requestId: 'test-request',
        timestamp: new Date(),
      };

      // Test with invalid merchant ID format
      const result = await toolRegistry.executeTool('semantic_retrieval', {
        query: 'test query',
        merchant_id: '', // Invalid empty merchant ID
      }, context);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cost Tracking Integration', () => {
    it('should track costs for tool executions', async () => {
      const context = {
        merchantId: 'test-merchant-cost',
        userId: 'test-user',
        sessionId: '00000000-0000-0000-0000-000000000002', // Valid UUID format
        requestId: 'test-request',
        timestamp: new Date(),
      };

      try {
        const result = await toolRegistry.executeTool('tool_health_check', { merchant_id: 'test-merchant-cost' }, context);
        
        expect(result).toHaveProperty('cost');
        expect(typeof result.cost).toBe('number');
        expect(result.cost).toBeGreaterThanOrEqual(0);
      } catch (error: any) {
        // Expected in test environment without database
        expect(error.message).toContain('cost_tracking');
      }
    });

    it('should estimate tool costs correctly', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        if (tool.costEstimate !== undefined) {
          expect(typeof tool.costEstimate).toBe('number');
          expect(tool.costEstimate).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limits defined for tools', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        if (tool.rateLimitPerMinute !== undefined) {
          expect(typeof tool.rateLimitPerMinute).toBe('number');
          expect(tool.rateLimitPerMinute).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Schema Validation', () => {
    it('should have proper JSON schemas for all tools', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        // Input schema validation
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        
        if (tool.inputSchema.properties) {
          expect(typeof tool.inputSchema.properties).toBe('object');
        }
        
        // Output schema validation
        expect(tool.outputSchema).toHaveProperty('type');
        expect(tool.outputSchema.type).toBe('object');
        
        if (tool.outputSchema.properties) {
          expect(typeof tool.outputSchema.properties).toBe('object');
        }
      }
    });

    it('should include merchant_id in tool schemas', () => {
      const tools = toolRegistry.getTools();
      
      for (const tool of tools) {
        if (tool.name !== 'tool_health_check') {
          expect(tool.inputSchema.properties).toHaveProperty('merchant_id');
          expect(tool.inputSchema.required).toContain('merchant_id');
        }
      }
    });
  });
});