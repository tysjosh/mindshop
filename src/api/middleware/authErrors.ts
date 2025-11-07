/**
 * Authentication Error Codes and Utilities
 * Provides standardized error codes and response formatting for authentication failures
 */

import { ApiResponse } from '../../types';

/**
 * Standardized authentication error codes
 */
export enum AuthErrorCode {
  // Missing or malformed authentication
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_INVALID_FORMAT = 'AUTH_INVALID_FORMAT',
  
  // Token validation errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_SIGNATURE_INVALID = 'TOKEN_SIGNATURE_INVALID',
  TOKEN_MISSING_CLAIMS = 'TOKEN_MISSING_CLAIMS',
  
  // Merchant and access errors
  MERCHANT_ID_MISSING = 'MERCHANT_ID_MISSING',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Email verification
  EMAIL_UNVERIFIED = 'EMAIL_UNVERIFIED',
  
  // API key errors
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System errors
  AUTH_SYSTEM_ERROR = 'AUTH_SYSTEM_ERROR',
}

/**
 * Authentication error details
 */
export interface AuthErrorDetails {
  code: AuthErrorCode;
  message: string;
  userMessage: string; // User-friendly message
  httpStatus: number;
  logLevel: 'warn' | 'error' | 'info';
  shouldAlert: boolean; // Whether to trigger security alerts
}

/**
 * Error code to details mapping
 */
export const AUTH_ERROR_DETAILS: Record<AuthErrorCode, Omit<AuthErrorDetails, 'code'>> = {
  [AuthErrorCode.AUTH_MISSING]: {
    message: 'Missing or invalid authorization header',
    userMessage: 'Authentication is required. Please provide a valid authorization token.',
    httpStatus: 401,
    logLevel: 'info',
    shouldAlert: false,
  },
  [AuthErrorCode.AUTH_INVALID_FORMAT]: {
    message: 'Authorization header format is invalid',
    userMessage: 'Invalid authentication format. Expected: Bearer <token>',
    httpStatus: 401,
    logLevel: 'warn',
    shouldAlert: false,
  },
  [AuthErrorCode.TOKEN_EXPIRED]: {
    message: 'Token has expired',
    userMessage: 'Your session has expired. Please log in again.',
    httpStatus: 401,
    logLevel: 'info',
    shouldAlert: false,
  },
  [AuthErrorCode.TOKEN_INVALID]: {
    message: 'Token is invalid or malformed',
    userMessage: 'Invalid authentication token. Please log in again.',
    httpStatus: 401,
    logLevel: 'warn',
    shouldAlert: false,
  },
  [AuthErrorCode.TOKEN_SIGNATURE_INVALID]: {
    message: 'Token signature verification failed',
    userMessage: 'Authentication token could not be verified. Please log in again.',
    httpStatus: 401,
    logLevel: 'warn',
    shouldAlert: true,
  },
  [AuthErrorCode.TOKEN_MISSING_CLAIMS]: {
    message: 'Token is missing required claims',
    userMessage: 'Authentication token is incomplete. Please log in again.',
    httpStatus: 401,
    logLevel: 'error',
    shouldAlert: true,
  },
  [AuthErrorCode.MERCHANT_ID_MISSING]: {
    message: 'Token missing required merchant identifier',
    userMessage: 'Your account is not properly configured. Please contact support.',
    httpStatus: 401,
    logLevel: 'error',
    shouldAlert: true,
  },
  [AuthErrorCode.ACCESS_DENIED]: {
    message: 'Access denied to merchant resources',
    userMessage: 'You do not have permission to access this resource.',
    httpStatus: 403,
    logLevel: 'warn',
    shouldAlert: true,
  },
  [AuthErrorCode.INSUFFICIENT_PERMISSIONS]: {
    message: 'Insufficient permissions for this operation',
    userMessage: 'You do not have the required permissions to perform this action.',
    httpStatus: 403,
    logLevel: 'warn',
    shouldAlert: false,
  },
  [AuthErrorCode.EMAIL_UNVERIFIED]: {
    message: 'Email verification required',
    userMessage: 'Please verify your email address to access this resource.',
    httpStatus: 403,
    logLevel: 'info',
    shouldAlert: false,
  },
  [AuthErrorCode.API_KEY_INVALID]: {
    message: 'API key is invalid',
    userMessage: 'The provided API key is invalid.',
    httpStatus: 401,
    logLevel: 'warn',
    shouldAlert: true,
  },
  [AuthErrorCode.API_KEY_EXPIRED]: {
    message: 'API key has expired',
    userMessage: 'Your API key has expired. Please generate a new one.',
    httpStatus: 401,
    logLevel: 'info',
    shouldAlert: false,
  },
  [AuthErrorCode.API_KEY_REVOKED]: {
    message: 'API key has been revoked',
    userMessage: 'This API key has been revoked. Please generate a new one.',
    httpStatus: 401,
    logLevel: 'warn',
    shouldAlert: false,
  },
  [AuthErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Rate limit exceeded',
    userMessage: 'Too many authentication attempts. Please try again later.',
    httpStatus: 429,
    logLevel: 'warn',
    shouldAlert: true,
  },
  [AuthErrorCode.AUTH_SYSTEM_ERROR]: {
    message: 'Authentication system error',
    userMessage: 'An error occurred during authentication. Please try again.',
    httpStatus: 500,
    logLevel: 'error',
    shouldAlert: true,
  },
};

/**
 * Create a standardized authentication error response
 */
export function createAuthErrorResponse(
  errorCode: AuthErrorCode,
  requestId: string,
  additionalDetails?: any
): ApiResponse {
  const details = AUTH_ERROR_DETAILS[errorCode];
  
  return {
    success: false,
    error: details.userMessage,
    message: details.message,
    details: {
      code: errorCode,
      ...additionalDetails,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Get HTTP status code for an error code
 */
export function getHttpStatusForError(errorCode: AuthErrorCode): number {
  return AUTH_ERROR_DETAILS[errorCode].httpStatus;
}

/**
 * Check if an error should trigger security alerts
 */
export function shouldAlertOnError(errorCode: AuthErrorCode): boolean {
  return AUTH_ERROR_DETAILS[errorCode].shouldAlert;
}

/**
 * Get log level for an error code
 */
export function getLogLevelForError(errorCode: AuthErrorCode): 'warn' | 'error' | 'info' {
  return AUTH_ERROR_DETAILS[errorCode].logLevel;
}

/**
 * Parse Cognito JWT verification error to appropriate error code
 */
export function parseJwtVerificationError(error: any): AuthErrorCode {
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('expired')) {
    return AuthErrorCode.TOKEN_EXPIRED;
  }
  
  if (errorMessage.includes('signature')) {
    return AuthErrorCode.TOKEN_SIGNATURE_INVALID;
  }
  
  if (errorMessage.includes('claim') || errorMessage.includes('missing')) {
    return AuthErrorCode.TOKEN_MISSING_CLAIMS;
  }
  
  if (errorMessage.includes('malformed') || errorMessage.includes('invalid')) {
    return AuthErrorCode.TOKEN_INVALID;
  }
  
  return AuthErrorCode.TOKEN_INVALID;
}
