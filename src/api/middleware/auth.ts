import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ApiResponse, Permission, hasAllPermissions } from '../../types';
import { getApiKeyService } from '../../services/ApiKeyService';
import {
  AuthErrorCode,
  createAuthErrorResponse,
  getHttpStatusForError,
  parseJwtVerificationError,
} from './authErrors';
import { getAuthSecurityLogger } from './authSecurityLogger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    merchantId: string;
    roles: string[];
    email?: string;
    groups?: string[];
  };
  cognitoToken?: any;
  apiKey?: {
    keyId: string;
    merchantId: string;
    permissions: string[];
  };
  authMethod?: 'jwt' | 'apikey';
}

interface AuthConfig {
  userPoolId: string;
  clientId?: string;
  region: string;
  enableMockAuth?: boolean; // For development/testing
}

/**
 * Create authentication middleware with Cognito JWT verification
 */
export function createAuthMiddleware(config: AuthConfig) {
  // If mock auth is enabled (for development), use simplified version
  if (config.enableMockAuth) {
    console.log('🔓 Using mock authentication for development');
    return mockAuthMiddleware;
  }

  // Validate required config for Cognito
  if (!config.userPoolId || config.userPoolId === 'dev-pool') {
    console.warn('⚠️  No valid Cognito User Pool ID provided, falling back to mock auth');
    return mockAuthMiddleware;
  }

  console.log('🔒 Using Cognito JWT authentication');

  // Create JWT verifiers for both access and ID tokens
  const accessTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  });

  const idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'id',
    clientId: config.clientId,
  });

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Note: With route-level auth, path-based skipping is not needed
    // Public routes (health checks, bedrock-agent) simply don't apply this middleware
    
    const securityLogger = getAuthSecurityLogger();
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
    
    // Check rate limiting first
    const clientIp = getClientIp(req);
    if (securityLogger.isRateLimitExceeded(clientIp)) {
      await securityLogger.logRateLimitExceeded(req);
      const response = createAuthErrorResponse(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        requestId
      );
      return res.status(getHttpStatusForError(AuthErrorCode.RATE_LIMIT_EXCEEDED)).json(response);
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await securityLogger.logAuthFailure(req, AuthErrorCode.AUTH_MISSING);
      const response = createAuthErrorResponse(AuthErrorCode.AUTH_MISSING, requestId);
      return res.status(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).json(response);
    }

    const token = authHeader.substring(7);

    try {
      // Try to verify as access token first, then ID token
      let payload: any;
      let tokenUse: 'access' | 'id';

      try {
        payload = await accessTokenVerifier.verify(token, { clientId: config.clientId || null });
        tokenUse = 'access';
      } catch (accessError) {
        try {
          payload = await idTokenVerifier.verify(token, { clientId: config.clientId || null });
          tokenUse = 'id';
        } catch (idError) {
          throw idError; // Use the ID token error for better error messages
        }
      }

      // Extract user information from token payload
      const user = {
        userId: payload.sub || payload['cognito:username'] || payload.username,
        merchantId: extractMerchantId(payload),
        email: payload.email,
        roles: extractRoles(payload),
        groups: payload['cognito:groups'] || [],
      };

      // Validate required fields
      if (!user.userId) {
        const errorCode = AuthErrorCode.TOKEN_MISSING_CLAIMS;
        await securityLogger.logAuthFailure(req, errorCode, {
          missingClaim: 'userId',
          tokenUse,
        });
        const response = createAuthErrorResponse(errorCode, requestId, {
          missingClaim: 'userId',
        });
        return res.status(getHttpStatusForError(errorCode)).json(response);
      }

      if (!user.merchantId) {
        const errorCode = AuthErrorCode.MERCHANT_ID_MISSING;
        await securityLogger.logAuthFailure(req, errorCode, {
          userId: user.userId,
          tokenUse,
        });
        const response = createAuthErrorResponse(errorCode, requestId);
        return res.status(getHttpStatusForError(errorCode)).json(response);
      }

      // Attach user info to request
      req.user = user;
      req.cognitoToken = payload;
      req.authMethod = 'jwt';

      // Log successful authentication
      await securityLogger.logAuthSuccess(req, user.userId, user.merchantId, 'jwt');

      next();

    } catch (error: any) {
      // Parse the error to get appropriate error code
      const errorCode = parseJwtVerificationError(error);
      
      // Log the authentication failure with context
      await securityLogger.logAuthFailure(req, errorCode, {
        errorMessage: error.message,
        errorName: error.name,
      });

      const response = createAuthErrorResponse(errorCode, requestId, {
        technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });

      return res.status(getHttpStatusForError(errorCode)).json(response);
    }
  };
}

/**
 * Legacy authenticateJWT function for backward compatibility
 * Now uses Cognito verification
 * If called without config, uses environment variables
 */
export function authenticateJWT(config?: AuthConfig) {
  // If no config provided, create from environment variables
  if (!config) {
    const enableMockAuth = process.env.NODE_ENV === 'development' && 
                          process.env.ENABLE_COGNITO_AUTH !== 'true';
    
    config = {
      userPoolId: process.env.COGNITO_USER_POOL_ID || 'dev-pool',
      clientId: process.env.COGNITO_CLIENT_ID,
      region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
      enableMockAuth: enableMockAuth,
    };
  }
  
  return createAuthMiddleware(config);
}

/**
 * Mock authentication middleware for development/testing
 */
const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Note: With route-level auth, path-based skipping is not needed
  // Public routes (health checks, bedrock-agent) simply don't apply this middleware
  
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response = createAuthErrorResponse(AuthErrorCode.AUTH_MISSING, requestId);
    return res.status(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).json(response);
  }

  const token = authHeader.substring(7);
  
  try {
    // Mock user extraction for development
    const decoded = mockDecodeJWT(token);
    req.user = decoded;
    req.authMethod = 'jwt';
    next();
  } catch (error: any) {
    const response = createAuthErrorResponse(AuthErrorCode.TOKEN_INVALID, requestId);
    return res.status(getHttpStatusForError(AuthErrorCode.TOKEN_INVALID)).json(response);
  }
};

/**
 * Middleware to require merchant access (tenant isolation)
 */
export const requireMerchantAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
  const securityLogger = getAuthSecurityLogger();
  
  if (!req.user) {
    const response = createAuthErrorResponse(AuthErrorCode.AUTH_MISSING, requestId);
    return res.status(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).json(response);
  }

  // Extract merchant ID from request (body, params, or query)
  const requestMerchantId = 
    req.body?.merchantId || 
    req.body?.merchant_id ||
    req.params?.merchantId ||
    req.query?.merchantId;

  if (!requestMerchantId) {
    const response: ApiResponse = {
      success: false,
      error: 'Merchant ID is required',
      timestamp: new Date().toISOString(),
      requestId,
    };
    return res.status(400).json(response);
  }

  // Allow admin users to access any merchant
  if (req.user.roles?.includes('admin') || req.user.roles?.includes('super_admin')) {
    return next();
  }

  // Check if user's merchant ID matches the requested merchant ID
  if (req.user.merchantId !== requestMerchantId) {
    await securityLogger.logAccessDenied(
      req,
      req.user.userId,
      req.user.merchantId,
      `Attempted to access merchant ${requestMerchantId}`
    );
    
    const response = createAuthErrorResponse(
      AuthErrorCode.ACCESS_DENIED,
      requestId,
      {
        requestedMerchant: requestMerchantId,
        userMerchant: req.user.merchantId,
      }
    );
    return res.status(getHttpStatusForError(AuthErrorCode.ACCESS_DENIED)).json(response);
  }

  next();
};

/**
 * Middleware to require specific roles
 */
export function requireRoles(requiredRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
    const securityLogger = getAuthSecurityLogger();
    
    if (!req.user) {
      const response = createAuthErrorResponse(AuthErrorCode.AUTH_MISSING, requestId);
      return res.status(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).json(response);
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      await securityLogger.logAccessDenied(
        req,
        req.user.userId,
        req.user.merchantId,
        `Missing required roles: ${requiredRoles.join(', ')}`
      );
      
      const response = createAuthErrorResponse(
        AuthErrorCode.INSUFFICIENT_PERMISSIONS,
        requestId,
        {
          requiredRoles,
          userRoles,
        }
      );
      return res.status(getHttpStatusForError(AuthErrorCode.INSUFFICIENT_PERMISSIONS)).json(response);
    }

    next();
  };
}

/**
 * Middleware to require specific permissions with dual auth support
 * Works with both JWT and API key authentication:
 * - JWT users: Granted full permissions (portal users have full access)
 * - API key users: Permissions checked against API key's granted permissions
 * 
 * Note: Use this with dualAuth() middleware. For API-key-only routes, use
 * requirePermissions from apiKeyAuth.ts instead.
 */
export function requirePermissionsWithDualAuth(requiredPermissions: Permission[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
    const securityLogger = getAuthSecurityLogger();
    
    if (!req.user) {
      const response = createAuthErrorResponse(AuthErrorCode.AUTH_MISSING, requestId);
      return res.status(getHttpStatusForError(AuthErrorCode.AUTH_MISSING)).json(response);
    }

    // JWT-authenticated users (portal users) have full permissions
    if (req.authMethod === 'jwt') {
      return next();
    }

    // API key users must have the required permissions
    if (req.authMethod === 'apikey' && req.apiKey) {
      const hasPermissions = hasAllPermissions(req.apiKey.permissions, requiredPermissions);

      if (!hasPermissions) {
        await securityLogger.logAccessDenied(
          req,
          req.user.userId,
          req.user.merchantId,
          `API key missing required permissions: ${requiredPermissions.join(', ')}`
        );
        
        const response = createAuthErrorResponse(
          AuthErrorCode.INSUFFICIENT_PERMISSIONS,
          requestId,
          {
            requiredPermissions,
            grantedPermissions: req.apiKey.permissions,
          }
        );
        return res.status(getHttpStatusForError(AuthErrorCode.INSUFFICIENT_PERMISSIONS)).json(response);
      }

      return next();
    }

    // Unknown auth method or missing API key info
    const response = createAuthErrorResponse(AuthErrorCode.AUTH_INVALID_FORMAT, requestId);
    return res.status(getHttpStatusForError(AuthErrorCode.AUTH_INVALID_FORMAT)).json(response);
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Extract merchant ID from Cognito token payload
 */
function extractMerchantId(payload: any): string {
  // Try multiple possible locations for merchant ID
  return (
    payload['custom:merchant_id'] ||
    payload.merchant_id ||
    payload['cognito:merchant_id'] ||
    payload.merchantId ||
    ''
  );
}

/**
 * Extract user roles from Cognito token payload
 */
function extractRoles(payload: any): string[] {
  const roles: string[] = [];

  // Extract from custom attributes
  if (payload['custom:roles']) {
    roles.push(...payload['custom:roles'].split(','));
  }

  // Extract from groups (Cognito groups can represent roles)
  if (payload['cognito:groups']) {
    roles.push(...payload['cognito:groups']);
  }

  // Extract from scope (for access tokens)
  if (payload.scope) {
    const scopes = payload.scope.split(' ');
    roles.push(...scopes.filter((scope: string) => scope.startsWith('role:')));
  }

  // Default role if none found
  if (roles.length === 0) {
    roles.push('user');
  }

  return [...new Set(roles)]; // Remove duplicates
}

/**
 * Mock JWT decoder for development/testing
 */
function mockDecodeJWT(token: string): { userId: string; merchantId: string; roles: string[]; email?: string } {
  // Simple token parsing for development - extract info from token if it's a simple format
  try {
    // If token contains merchant info (e.g., "user123:merchant456"), parse it
    if (token.includes(':')) {
      const [userId, merchantId] = token.split(':');
      return {
        userId: userId || 'dev_user_123',
        merchantId: merchantId || 'acme_electronics_2024',
        roles: ['user', 'admin'],
        email: 'dev@example.com',
      };
    }
  } catch (error) {
    // Fall through to default
  }

  // Default mock user for development - use acme_electronics_2024 to match seed data
  return {
    userId: 'dev_user_123',
    merchantId: 'acme_electronics_2024',
    roles: ['user', 'admin'],
    email: 'dev@example.com',
  };
}

/**
 * Dual authentication middleware that supports both JWT tokens and API keys
 * Tries JWT authentication first, then falls back to API key authentication
 * This allows the same endpoints to be accessed by portal users (JWT) and programmatic clients (API keys)
 */
export function dualAuth(config?: AuthConfig) {
  // Create JWT auth middleware
  const jwtAuth = authenticateJWT(config);
  const apiKeyService = getApiKeyService();

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing or invalid authorization header',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7);

    // Detect authentication method based on token format
    // API keys typically start with 'sk_' or similar prefix
    // JWTs are three base64-encoded parts separated by dots
    const isJWT = token.split('.').length === 3;

    if (isJWT) {
      // Try JWT authentication
      return jwtAuth(req, res, (error?: any) => {
        if (error) {
          // JWT auth failed, try API key as fallback
          return tryApiKeyAuth(req, res, next, token, apiKeyService);
        }
        // JWT auth succeeded
        req.authMethod = 'jwt';
        next();
      });
    } else {
      // Try API key authentication
      return tryApiKeyAuth(req, res, next, token, apiKeyService);
    }
  };
}

/**
 * Helper function to attempt API key authentication
 */
async function tryApiKeyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  apiKey: string,
  apiKeyService: ReturnType<typeof getApiKeyService>
) {
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
  const securityLogger = getAuthSecurityLogger();
  
  try {
    // Validate the API key
    const validation = await apiKeyService.validateKey(apiKey);

    if (!validation.valid) {
      const errorCode = AuthErrorCode.API_KEY_INVALID;
      await securityLogger.logAuthFailure(req, errorCode, {
        reason: 'Invalid or expired API key',
      });
      
      const response = createAuthErrorResponse(errorCode, requestId);
      return res.status(getHttpStatusForError(errorCode)).json(response);
    }

    // Attach API key info to request
    req.apiKey = {
      keyId: validation.keyId!,
      merchantId: validation.merchantId!,
      permissions: validation.permissions || []
    };

    // Also populate req.user for consistency with JWT auth
    req.user = {
      userId: validation.keyId!,
      merchantId: validation.merchantId!,
      roles: ['api_user'], // API keys have a special role
      email: undefined,
      groups: []
    };

    req.authMethod = 'apikey';
    
    // Log successful API key authentication
    await securityLogger.logAuthSuccess(req, validation.keyId!, validation.merchantId!, 'apikey');
    
    next();
  } catch (error: any) {
    console.error('API key validation error:', error);
    await securityLogger.logAuthFailure(req, AuthErrorCode.AUTH_SYSTEM_ERROR, {
      errorMessage: error.message,
    });
    
    const response = createAuthErrorResponse(AuthErrorCode.AUTH_SYSTEM_ERROR, requestId);
    return res.status(getHttpStatusForError(AuthErrorCode.AUTH_SYSTEM_ERROR)).json(response);
  }
}