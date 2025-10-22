import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../../types';

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      const response: ApiResponse = {
        success: false,
        error: `Validation failed: ${errors.join('; ')}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(400).json(response);
    }

    next();
  };
};

// Common validation schemas
export const schemas = {
  chatRequest: Joi.object({
    query: Joi.string().required().min(1).max(1000),
    sessionId: Joi.string().optional(),
    merchantId: Joi.string().required(),
    userId: Joi.string().optional(),
    context: Joi.object().optional(),
  }),

  merchantId: Joi.object({
    merchantId: Joi.string().required(),
  }),

  sessionId: Joi.object({
    sessionId: Joi.string().required(),
  }),

  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};