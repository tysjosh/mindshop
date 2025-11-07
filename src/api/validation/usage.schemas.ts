import { z } from 'zod';
import { merchantIdSchema } from './merchant.schemas';

/**
 * Zod validation schemas for Usage Tracking and Analytics endpoints
 */

// Metric types
export const metricTypeSchema = z.enum(['queries', 'documents', 'api_calls', 'storage_gb'], {
  message: 'Invalid metric type',
});

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid start date format')
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid end date format')
    .transform((val) => (val ? new Date(val) : undefined)),
});

// GET /api/merchants/:merchantId/usage/current
export const getCurrentUsageSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      { message: 'Start date must be before or equal to end date' }
    )
    .optional(),
});

export type GetCurrentUsageParams = z.infer<typeof getCurrentUsageSchema>['params'];
export type GetCurrentUsageQuery = z.infer<typeof getCurrentUsageSchema>['query'];

// GET /api/merchants/:merchantId/usage/history
export const getUsageHistorySchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      metricType: metricTypeSchema.optional(),
      groupBy: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 100))
        .pipe(z.number().int().min(1).max(1000)),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      { message: 'Start date must be before or equal to end date' }
    ),
});

export type GetUsageHistoryParams = z.infer<typeof getUsageHistorySchema>['params'];
export type GetUsageHistoryQuery = z.infer<typeof getUsageHistorySchema>['query'];

// GET /api/merchants/:merchantId/usage/forecast
export const getUsageForecastSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: z.object({
    metricType: metricTypeSchema,
    days: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 30))
      .pipe(z.number().int().min(1).max(90)),
  }),
});

export type GetUsageForecastParams = z.infer<typeof getUsageForecastSchema>['params'];
export type GetUsageForecastQuery = z.infer<typeof getUsageForecastSchema>['query'];

// POST /api/merchants/:merchantId/usage/limits (admin only)
export const setUsageLimitsSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  body: z.object({
    queriesPerMonth: z
      .number()
      .int('Queries per month must be a whole number')
      .min(0, 'Queries per month must be non-negative')
      .optional(),
    documentsMax: z
      .number()
      .int('Documents max must be a whole number')
      .min(0, 'Documents max must be non-negative')
      .optional(),
    apiCallsPerDay: z
      .number()
      .int('API calls per day must be a whole number')
      .min(0, 'API calls per day must be non-negative')
      .optional(),
    storageGbMax: z
      .number()
      .int('Storage GB max must be a whole number')
      .min(0, 'Storage GB max must be non-negative')
      .optional(),
  }),
});

export type SetUsageLimitsParams = z.infer<typeof setUsageLimitsSchema>['params'];
export type SetUsageLimitsInput = z.infer<typeof setUsageLimitsSchema>['body'];

// Export all schemas as a collection
export const usageSchemas = {
  getCurrent: getCurrentUsageSchema,
  getHistory: getUsageHistorySchema,
  getForecast: getUsageForecastSchema,
  setLimits: setUsageLimitsSchema,
};
