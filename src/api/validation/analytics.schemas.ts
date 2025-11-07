import { z } from 'zod';
import { merchantIdSchema } from './merchant.schemas';

/**
 * Zod validation schemas for Analytics endpoints
 */

// Date range with validation
const dateRangeQuerySchema = z.object({
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid start date format'),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid end date format'),
});

// GET /api/merchants/:merchantId/analytics/overview
export const getAnalyticsOverviewSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    includeComparison: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

export type GetAnalyticsOverviewParams = z.infer<typeof getAnalyticsOverviewSchema>['params'];
export type GetAnalyticsOverviewQuery = z.infer<typeof getAnalyticsOverviewSchema>['query'];

// GET /api/merchants/:merchantId/analytics/queries
export const getQueryAnalyticsSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    groupBy: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 100))
      .pipe(z.number().int().min(1).max(1000)),
  }),
});

export type GetQueryAnalyticsParams = z.infer<typeof getQueryAnalyticsSchema>['params'];
export type GetQueryAnalyticsQuery = z.infer<typeof getQueryAnalyticsSchema>['query'];

// GET /api/merchants/:merchantId/analytics/top-queries
export const getTopQueriesSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
    minCount: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1)),
  }),
});

export type GetTopQueriesParams = z.infer<typeof getTopQueriesSchema>['params'];
export type GetTopQueriesQuery = z.infer<typeof getTopQueriesSchema>['query'];

// GET /api/merchants/:merchantId/analytics/performance
export const getPerformanceMetricsSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    metrics: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',') : undefined))
      .pipe(
        z
          .array(
            z.enum([
              'response_time',
              'cache_hit_rate',
              'error_rate',
              'success_rate',
              'uptime',
            ])
          )
          .optional()
      ),
    percentiles: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map(Number) : [50, 95, 99]))
      .pipe(z.array(z.number().min(0).max(100))),
  }),
});

export type GetPerformanceMetricsParams = z.infer<typeof getPerformanceMetricsSchema>['params'];
export type GetPerformanceMetricsQuery = z.infer<typeof getPerformanceMetricsSchema>['query'];

// GET /api/merchants/:merchantId/analytics/intent-distribution
export const getIntentDistributionSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    minPercentage: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : 1))
      .pipe(z.number().min(0).max(100)),
  }),
});

export type GetIntentDistributionParams = z.infer<typeof getIntentDistributionSchema>['params'];
export type GetIntentDistributionQuery = z.infer<typeof getIntentDistributionSchema>['query'];

// GET /api/merchants/:merchantId/analytics/failed-queries
export const getFailedQueriesSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
  query: dateRangeQuerySchema.extend({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .pipe(z.number().int().min(1).max(500)),
    includeReason: z
      .string()
      .default('true')
      .transform((val) => val === 'true'),
  }),
});

export type GetFailedQueriesParams = z.infer<typeof getFailedQueriesSchema>['params'];
export type GetFailedQueriesQuery = z.infer<typeof getFailedQueriesSchema>['query'];

// Export all schemas as a collection
export const analyticsSchemas = {
  getOverview: getAnalyticsOverviewSchema,
  getQueries: getQueryAnalyticsSchema,
  getTopQueries: getTopQueriesSchema,
  getPerformance: getPerformanceMetricsSchema,
  getIntentDistribution: getIntentDistributionSchema,
  getFailedQueries: getFailedQueriesSchema,
};
