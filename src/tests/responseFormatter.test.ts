import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import {
  sendSuccess,
  sendError,
  getRequestId,
  generateRequestId,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendServerError
} from '../api/utils/responseFormatter';

describe('Response Formatter', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    
    mockRequest = {
      headers: {}
    };
    
    mockResponse = {
      status: statusSpy,
      json: jsonSpy
    };
  });

  describe('generateRequestId', () => {
    it('should generate a unique request ID', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('getRequestId', () => {
    it('should return request ID from headers if present', () => {
      mockRequest.headers = { 'x-request-id': 'test_request_123' };
      const requestId = getRequestId(mockRequest as Request);
      expect(requestId).toBe('test_request_123');
    });

    it('should generate new request ID if not in headers', () => {
      const requestId = getRequestId(mockRequest as Request);
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('sendSuccess', () => {
    it('should send success response with correct format', () => {
      const data = { message: 'Test successful' };
      const requestId = 'test_request_123';
      
      sendSuccess(mockResponse as Response, data, 200, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
        timestamp: expect.any(String),
        requestId
      });
    });

    it('should use default status code 200', () => {
      const data = { message: 'Test' };
      
      sendSuccess(mockResponse as Response, data);
      
      expect(statusSpy).toHaveBeenCalledWith(200);
    });

    it('should generate request ID if not provided', () => {
      const data = { message: 'Test' };
      
      sendSuccess(mockResponse as Response, data);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('sendError', () => {
    it('should send error response with string error', () => {
      const error = 'Test error message';
      const requestId = 'test_request_123';
      
      sendError(mockResponse as Response, error, 400, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error,
        timestamp: expect.any(String),
        requestId
      });
    });

    it('should send error response with Error object', () => {
      const error = new Error('Test error');
      const requestId = 'test_request_123';
      
      sendError(mockResponse as Response, error, 500, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        timestamp: expect.any(String),
        requestId
      });
    });

    it('should include details if provided', () => {
      const error = 'Validation failed';
      const details = { field: 'email', message: 'Invalid format' };
      const requestId = 'test_request_123';
      
      sendError(mockResponse as Response, error, 400, requestId, details);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.details).toEqual(details);
    });

    it('should use default status code 400', () => {
      sendError(mockResponse as Response, 'Error');
      expect(statusSpy).toHaveBeenCalledWith(400);
    });
  });

  describe('sendValidationError', () => {
    it('should send validation error with 422 status', () => {
      const errors = { email: 'Invalid email' };
      const requestId = 'test_request_123';
      
      sendValidationError(mockResponse as Response, errors, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(422);
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Validation failed');
      expect(callArgs.details).toEqual(errors);
    });
  });

  describe('sendUnauthorized', () => {
    it('should send unauthorized error with 401 status', () => {
      const message = 'Invalid credentials';
      const requestId = 'test_request_123';
      
      sendUnauthorized(mockResponse as Response, message, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe(message);
    });

    it('should use default message', () => {
      sendUnauthorized(mockResponse as Response);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Unauthorized');
    });
  });

  describe('sendForbidden', () => {
    it('should send forbidden error with 403 status', () => {
      const message = 'Insufficient permissions';
      const requestId = 'test_request_123';
      
      sendForbidden(mockResponse as Response, message, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(403);
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe(message);
    });

    it('should use default message', () => {
      sendForbidden(mockResponse as Response);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Access denied');
    });
  });

  describe('sendNotFound', () => {
    it('should send not found error with 404 status', () => {
      const message = 'User not found';
      const requestId = 'test_request_123';
      
      sendNotFound(mockResponse as Response, message, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(404);
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe(message);
    });

    it('should use default message', () => {
      sendNotFound(mockResponse as Response);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Resource not found');
    });
  });

  describe('sendServerError', () => {
    it('should send server error with 500 status', () => {
      const error = new Error('Database connection failed');
      const requestId = 'test_request_123';
      
      sendServerError(mockResponse as Response, error, requestId);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Database connection failed');
    });

    it('should use default message', () => {
      sendServerError(mockResponse as Response);
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs.error).toBe('Internal server error');
    });
  });

  describe('Response format consistency', () => {
    it('should always include required fields in success response', () => {
      sendSuccess(mockResponse as Response, { test: 'data' });
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs).toHaveProperty('success', true);
      expect(callArgs).toHaveProperty('data');
      expect(callArgs).toHaveProperty('timestamp');
      expect(callArgs).toHaveProperty('requestId');
    });

    it('should always include required fields in error response', () => {
      sendError(mockResponse as Response, 'Test error');
      
      const callArgs = jsonSpy.mock.calls[0][0];
      expect(callArgs).toHaveProperty('success', false);
      expect(callArgs).toHaveProperty('error');
      expect(callArgs).toHaveProperty('timestamp');
      expect(callArgs).toHaveProperty('requestId');
    });

    it('should format timestamp as ISO string', () => {
      sendSuccess(mockResponse as Response, { test: 'data' });
      
      const callArgs = jsonSpy.mock.calls[0][0];
      const timestamp = new Date(callArgs.timestamp);
      expect(timestamp.toISOString()).toBe(callArgs.timestamp);
    });
  });
});
