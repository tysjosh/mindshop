import { z } from 'zod';
import { merchantIdSchema } from './merchant.schemas';

/**
 * Zod validation schemas for API Key Management endpoints
 */

// API Key environment types
export const apiKeyEnvironmentSchema = z.enum(['development', 'production'], {
  message: 'Environment must be either "development" or "production"',
});

// API Key permissions
export const apiKeyPermissionSchema = z.enum([
  'chat:read',
  'chat:write',
  'documents:read',
  'documents:write',
  'documents:delete',
  'analytics:read',
  'settings:read',
  'settings:write',
  '*', // All permissions
]);

export const apiKeyIdSchema = z
  .string()
  .min(1, 'API Key ID is required')
  .regex(/^key_[a-zA-Z0-9]+$/, 'Invalid API Key ID format');

// POST /api/merchants/:merchantId/api-keys
export const createApiKeySchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(3, 'API Key name must be at least 3 characters')
      .max(100, 'API Key name must not exceed 100 characters')
      .trim(),
    environment: apiKeyEnvironmentSchema,
    permissions: z
      .array(apiKeyPermissionSchema)
      .min(1, 'At least one permission is required')
      .optional()
      .default(['*']),
    expiresInDays: z
      .number()
      .int('Expiration must be a whole number')
      .min(1, 'Expiration must be at least 1 day')
      .max(365, 'Expiration must not exceed 365 days')
      .optional(),
  }),
});

export type CreateApiKeyParams = z.infer<typeof createApiKeySchema>['params'];
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>['body'];

// GET /api/merchants/:merchantId/api-keys
export const listApiKeysSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: z.object({
    environment: apiKeyEnvironmentSchema.optional(),
    status: z.enum(['active', 'revoked', 'expired']).optional(),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .pipe(z.number().int().min(1).max(100)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().int().min(0)),
  }),
});

export type ListApiKeysParams = z.infer<typeof listApiKeysSchema>['params'];
export type ListApiKeysQuery = z.infer<typeof listApiKeysSchema>['query'];

// DELETE /api/merchants/:merchantId/api-keys/:keyId
export const revokeApiKeySchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
    keyId: apiKeyIdSchema,
  }),
});

export type RevokeApiKeyParams = z.infer<typeof revokeApiKeySchema>['params'];

// POST /api/merchants/:merchantId/api-keys/:keyId/rotate
export const rotateApiKeySchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
    keyId: apiKeyIdSchema,
  }),
  body: z.object({
    gracePeriodDays: z
      .number()
      .int('Grace period must be a whole number')
      .min(0, 'Grace period must be at least 0 days')
      .max(30, 'Grace period must not exceed 30 days')
      .optional()
      .default(7),
  }),
});

export type RotateApiKeyParams = z.infer<typeof rotateApiKeySchema>['params'];
export type RotateApiKeyInput = z.infer<typeof rotateApiKeySchema>['body'];

// GET /api/merchants/:merchantId/api-keys/:keyId/usage
export const getApiKeyUsageSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
    keyId: apiKeyIdSchema,
  }),
  query: z.object({
    startDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid start date format'),
    endDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid end date format'),
    groupBy: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
  }),
});

export type GetApiKeyUsageParams = z.infer<typeof getApiKeyUsageSchema>['params'];
export type GetApiKeyUsageQuery = z.infer<typeof getApiKeyUsageSchema>['query'];

// Export all schemas as a collection
export const apiKeySchemas = {
  create: createApiKeySchema,
  list: listApiKeysSchema,
  revoke: revokeApiKeySchema,
  rotate: rotateApiKeySchema,
  getUsage: getApiKeyUsageSchema,
};
