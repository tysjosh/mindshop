/**
 * Central export for all Zod validation schemas
 * This provides a single import point for all validation schemas across the application
 */

// Export all merchant schemas
export * from './merchant.schemas';

// Export all API key schemas
export * from './apiKey.schemas';

// Export all usage schemas
export * from './usage.schemas';

// Export all analytics schemas
export * from './analytics.schemas';

// Export validation middleware
export * from '../middleware/zodValidation';

// Re-export commonly used schemas for convenience
import { merchantSchemas } from './merchant.schemas';
import { apiKeySchemas } from './apiKey.schemas';
import { usageSchemas } from './usage.schemas';
import { analyticsSchemas } from './analytics.schemas';

export const schemas = {
  merchant: merchantSchemas,
  apiKey: apiKeySchemas,
  usage: usageSchemas,
  analytics: analyticsSchemas,
};
