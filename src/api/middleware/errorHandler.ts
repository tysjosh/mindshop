import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../types';
import { logger } from './logging';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  
  // Log the error
  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    merchantId: req.body?.merchantId || req.query?.merchantId || req.params?.merchantId,
  });

  // Determine status code
  let statusCode = 500;
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
  }

  // Prepare error response
  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred while processing your request'
      : error.message,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    (response as any).stack = error.stack;
  }

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  
  const response: ApiResponse = {
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(404).json(response);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};