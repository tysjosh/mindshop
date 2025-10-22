import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ApiResponse } from '../../types';

export interface CognitoAuthConfig {
  userPoolId: string;
  clientId?: string;
  region: string;
}

export interface CognitoUser {
  userId: string;
  merchantId: string;
  email?: string;
  roles: string[];
  groups?: string[];
  tokenUse: 'access' | 'id';
}

export interface CognitoAuthenticatedRequest extends Request {
  user?: CognitoUser;
  cognitoToken?: any;
}

/**
 * Cognito JWT Authentication Middleware
 * Verifies AWS Cognito JWT tokens and extracts user information
 */
export function cognitoAuthMiddleware(config: CognitoAuthConfig) {
  // Create JWT verifier for access tokens
  const accessTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  });

  // Create JWT verifier for ID tokens
  const idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'id',
    clientId: config.clientId,
  });

  return async (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip auth for health checks and public endpoints
    if (req.path === '/health' || req.path === '/api' || req.path === '/api/docs') {
      return next();
    }

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
      const user: CognitoUser = {
        userId: payload.sub || payload['cognito:username'] || payload.username,
        merchantId: extractMerchantId(payload),
        email: payload.email,
        roles: extractRoles(payload),
        groups: payload['cognito:groups'] || [],
        tokenUse,
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
 * Middleware to require specific roles
 */
export function requireRoles(requiredRoles: string[]) {
  return (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => {
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
 * Middleware to require admin access
 */
export function requireAdmin(req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRoles(['admin', 'super_admin'])(req, res, next);
}

/**
 * Middleware to ensure merchant access (user can only access their own merchant data)
 */
export function requireMerchantAccess(req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) {
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
  if (req.user.roles.includes('admin') || req.user.roles.includes('super_admin')) {
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
}

/**
 * Optional authentication middleware (doesn't fail if no token provided)
 */
export function optionalCognitoAuth(config: CognitoAuthConfig) {
  const authMiddleware = cognitoAuthMiddleware(config);

  return (req: CognitoAuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    // If auth header present, validate it
    return authMiddleware(req, res, next);
  };
}