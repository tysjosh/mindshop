import { ToolDefinition } from './BedrockAgentToolRegistry';
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
export declare class BedrockAgentValidator {
    private toolRegistry;
    /**
     * Validate all registered tools against Bedrock Agent requirements
     */
    validateAllTools(): Promise<ValidationResult>;
    /**
     * Validate a single tool
     */
    validateTool(tool: ToolDefinition): ValidationResult;
    /**
     * Validate JSON Schema structure
     */
    private validateJSONSchema;
    /**
     * Validate OpenAPI specification
     */
    private validateOpenAPISpec;
    /**
     * Test all tools with sample data
     */
    testAllTools(): Promise<ToolTestResult[]>;
    /**
     * Test a single tool with sample data
     */
    testTool(tool: ToolDefinition): Promise<ToolTestResult>;
    /**
     * Generate sample input based on JSON schema
     */
    private generateSampleInput;
    /**
     * Generate sample value for a schema property
     */
    private generateSampleValue;
    /**
     * Generate Bedrock Agent configuration
     */
    generateBedrockAgentConfig(): any;
    /**
     * Validate Bedrock Agent integration
     */
    validateBedrockIntegration(): Promise<ValidationResult>;
}
export declare function getBedrockAgentValidator(): BedrockAgentValidator;
export { BedrockAgentValidator as BedrockAgentValidatorClass };
//# sourceMappingURL=BedrockAgentValidator.d.ts.map