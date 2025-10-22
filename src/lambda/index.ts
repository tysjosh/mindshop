/**
 * Lambda Handlers Index
 * Exports all Lambda function handlers for AWS deployment
 */

// Health Check Handler (Public)
export { handler as healthHandler } from './healthHandler';

// Chat Handler (Bedrock Agent Integration)
export { handler as chatHandler, sessionHandler } from './chatHandler';

// Documents Handler (RAG Document Management)
export { handler as documentsHandler } from './documentsHandler';

// Bedrock Integration Handler (AI Model Management)
export { handler as bedrockHandler } from './bedrockHandler';

// Semantic Retrieval Handler (ML-powered Search)
export { handler as semanticRetrievalHandler } from './semanticRetrievalHandler';

// Existing Handlers
export { handler as checkoutHandler, healthHandler as checkoutHealthHandler } from './checkoutHandler';
export { handler as bedrockToolsHandler, getToolsHandler, healthHandler as bedrockToolsHealthHandler } from './bedrockToolsHandler';
export { handler as documentIngestionHandler, healthHandler as documentIngestionHealthHandler } from './documentIngestionHandler';

// Step Function Handlers
export {
  validateInputHandler,
  documentParserHandler,
  piiSanitizationHandler,
  embeddingGenerationHandler,
  documentStorageHandler,
  vectorIndexUpdateHandler,
  errorHandler as stepFunctionErrorHandler,
  batchReportHandler,
  healthCheckHandler as stepFunctionHealthHandler
} from './stepFunctionHandlers';

// Utility Handlers
export { handler as preTokenGenerationHandler } from './preTokenGenerationHandler';
export { handler as credentialRotationHandler } from './credentialRotationHandler';