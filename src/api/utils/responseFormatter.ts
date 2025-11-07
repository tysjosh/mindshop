import { Response } from 'express';
import { ApiResponse } from '../../types';

/**
 * Utility functions for standardizing API responses
 */

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get request ID from request headers or generate a new one
 */
export function getRequestId(req: any): string {
  return (req.headers['x-request-id'] as string) || generateRequestId();
}

/**
 * Send a successful response with standardized format
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  requestId?: string
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
  res.status(statusCode).json(response);
}

/**
 * Send an error response with standardized format
 */
export function sendError(
  res: Response,
  error: string | Error,
  statusCode: number = 400,
  requestId?: string,
  details?: any
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    ...(details && { details }),
  };
  
  res.status(statusCode).json(response);
}

/**
 * Send a validation error response
 */
export function sendValidationError(
  res: Response,
  errors: any,
  requestId?: string
): void {
  sendError(res, 'Validation failed', 422, requestId, errors);
}

/**
 * Send an unauthorized error response
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized',
  requestId?: string
): void {
  sendError(res, message, 401, requestId);
}

/**
 * Send a forbidden error response
 */
export function sendForbidden(
  res: Response,
  message: string = 'Access denied',
  requestId?: string
): void {
  sendError(res, message, 403, requestId);
}

/**
 * Send a not found error response
 */
export function sendNotFound(
  res: Response,
  message: string = 'Resource not found',
  requestId?: string
): void {
  sendError(res, message, 404, requestId);
}

/**
 * Send a server error response
 */
export function sendServerError(
  res: Response,
  error: string | Error = 'Internal server error',
  requestId?: string
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  sendError(res, errorMessage, 500, requestId);
}
