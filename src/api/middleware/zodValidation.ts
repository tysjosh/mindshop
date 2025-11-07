import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ApiResponse } from '../../types';

/**
 * Zod validation middleware for Express
 * Validates request body, query, and params against Zod schemas
 */
export const validateZod = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Validate query
      if (schema.query) {
        const validatedQuery = await schema.query.parseAsync(req.query);
        req.query = validatedQuery as any;
      }

      // Validate params
      if (schema.params) {
        const validatedParams = await schema.params.parseAsync(req.params);
        req.params = validatedParams as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        const response: ApiResponse = {
          success: false,
          error: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
          requestId: (req.headers['x-request-id'] as string) || 'unknown',
        };

        return res.status(400).json(response);
      }

      // Handle unexpected errors
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        timestamp: new Date().toISOString(),
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
      };

      return res.status(500).json(response);
    }
  };
};

/**
 * Helper function to create a validation middleware from a full schema
 * that includes body, query, and params
 */
export const validateZodSchema = (
  schema: z.ZodObject<{
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
  }>
) => {
  return validateZod(schema.shape);
};

/**
 * Validate only request body
 */
export const validateBody = (schema: ZodSchema) => {
  return validateZod({ body: schema });
};

/**
 * Validate only query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
  return validateZod({ query: schema });
};

/**
 * Validate only route parameters
 */
export const validateParams = (schema: ZodSchema) => {
  return validateZod({ params: schema });
};
