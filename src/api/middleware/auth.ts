import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ApiResponse } from '../../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    merchantId: string;
    roles: string[];
    email?: string;
    groups?: string[];
  };
  cognitoToken?: any;
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
          throw new Error('Invalid token: failed both access and ID token verification');
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
        throw new Error('Token missing required user identifier');
      }

      if (!user.merchantId) {
        throw new Error('Token missing required merchant identifier');
      }

      // Attach user info to request
      req.user = user;
      req.cognitoToken = payload;

      next();

    } catch (error: any) {
      console.error('Cognito JWT verification failed:', error.message);

      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      return res.status(401).json(response);
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
  
  try {
    // Mock user extraction for development
    const decoded = mockDecodeJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    return res.status(401).json(response);
  }
};

/**
 * Middleware to require merchant access (tenant isolation)
 */
export const requireMerchantAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    return res.status(401).json(response);
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
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    return res.status(400).json(response);
  }

  // Allow admin users to access any merchant
  if (req.user.roles?.includes('admin') || req.user.roles?.includes('super_admin')) {
    return next();
  }

  // Check if user's merchant ID matches the requested merchant ID
  if (req.user.merchantId !== requestMerchantId) {
    const response: ApiResponse = {
      success: false,
      error: 'Access denied to merchant resources',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };
    return res.status(403).json(response);
  }

  next();
};

/**
 * Middleware to require specific roles
 */
export function requireRoles(requiredRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(401).json(response);
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      const response: ApiResponse = {
        success: false,
        error: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(403).json(response);
    }

    next();
  };
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
        merchantId: merchantId || 'dev_merchant_456',
        roles: ['user'],
        email: 'dev@example.com',
      };
    }
  } catch (error) {
    // Fall through to default
  }

  // Default mock user for development
  return {
    userId: 'dev_user_123',
    merchantId: 'dev_merchant_456',
    roles: ['user'],
    email: 'dev@example.com',
  };
}