import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getMerchantRepository } from '../../repositories/MerchantRepository';
import { getAuditLogRepository } from '../../repositories/AuditLogRepository';
import { ApiResponse } from '../../types';
import jwt from 'jsonwebtoken';

/**
 * Impersonation Middleware
 * 
 * Allows admins to impersonate merchants for debugging and support purposes.
 * All actions performed during impersonation are logged and attributed to the admin.
 * 
 * @see .kiro/specs/merchant-platform/tasks.md - Task 13.2 Admin UI (Add impersonation mode)
 */

export interface ImpersonationToken {
  adminUserId: string;
  adminEmail: string;
  merchantId: string;
  expiresAt: number;
  type: 'impersonation';
}

export interface ImpersonatedRequest extends AuthenticatedRequest {
  impersonation?: {
    isImpersonating: boolean;
    adminUserId: string;
    adminEmail: string;
    originalMerchantId: string;
  };
}

const IMPERSONATION_SECRET = process.env.IMPERSONATION_SECRET || process.env.JWT_SECRET || 'default-secret';
const IMPERSONATION_EXPIRY = 60 * 60; // 1 hour

/**
 * Generate an impersonation token
 */
export function generateImpersonationToken(data: {
  adminUserId: string;
  adminEmail: string;
  merchantId: string;
}): string {
  const payload: ImpersonationToken = {
    adminUserId: data.adminUserId,
    adminEmail: data.adminEmail,
    merchantId: data.merchantId,
    expiresAt: Date.now() + (IMPERSONATION_EXPIRY * 1000),
    type: 'impersonation',
  };

  return jwt.sign(payload, IMPERSONATION_SECRET, {
    expiresIn: IMPERSONATION_EXPIRY,
  });
}

/**
 * Verify an impersonation token
 */
export function verifyImpersonationToken(token: string): ImpersonationToken | null {
  try {
    const decoded = jwt.verify(token, IMPERSONATION_SECRET) as ImpersonationToken;
    
    // Verify token type
    if (decoded.type !== 'impersonation') {
      return null;
    }

    // Verify expiration
    if (decoded.expiresAt < Date.now()) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to handle impersonation
 * 
 * Checks for X-Impersonation-Token header and validates it.
 * If valid, modifies the request to act as the impersonated merchant
 * while tracking the admin who is impersonating.
 */
export function impersonationMiddleware() {
  const merchantRepository = getMerchantRepository();
  const auditLogRepository = getAuditLogRepository();

  return async (req: ImpersonatedRequest, res: Response, next: NextFunction) => {
    const impersonationToken = req.headers['x-impersonation-token'] as string;

    // If no impersonation token, continue normally
    if (!impersonationToken) {
      return next();
    }

    try {
      // Verify the impersonation token
      const tokenData = verifyImpersonationToken(impersonationToken);

      if (!tokenData) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired impersonation token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        return res.status(401).json(response);
      }

      // Verify the merchant exists
      const merchant = await merchantRepository.findByMerchantId(tokenData.merchantId);
      if (!merchant) {
        const response: ApiResponse = {
          success: false,
          error: 'Impersonated merchant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        return res.status(404).json(response);
      }

      // Store original user info if it exists
      const originalUserId = req.user?.userId;
      const originalMerchantId = req.user?.merchantId;

      // Override user context to act as the merchant
      req.user = {
        userId: merchant.cognitoUserId,
        merchantId: merchant.merchantId,
        email: merchant.email,
        roles: ['merchant_admin'],
      };

      // Add impersonation metadata
      req.impersonation = {
        isImpersonating: true,
        adminUserId: tokenData.adminUserId,
        adminEmail: tokenData.adminEmail,
        originalMerchantId: originalMerchantId || tokenData.merchantId,
      };

      // Log the impersonated action
      await auditLogRepository.create({
        merchantId: merchant.merchantId,
        userId: tokenData.adminUserId,
        sessionId: '',
        operation: 'impersonation.action',
        requestPayloadHash: JSON.stringify({
          method: req.method,
          path: req.path,
          impersonatedBy: tokenData.adminEmail,
        }),
        responseReference: '',
        outcome: 'success',
        reason: `Admin ${tokenData.adminEmail} performed action while impersonating merchant`,
        actor: tokenData.adminEmail,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });

      // Add impersonation header to response
      res.setHeader('X-Impersonating', merchant.merchantId);
      res.setHeader('X-Impersonated-By', tokenData.adminEmail);

      next();
    } catch (error: any) {
      console.error('Impersonation middleware error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Impersonation failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(500).json(response);
    }
  };
}

/**
 * Middleware to prevent impersonation on sensitive endpoints
 * 
 * Use this on endpoints where impersonation should not be allowed
 * (e.g., changing passwords, deleting accounts, billing operations)
 */
export function preventImpersonation() {
  return (req: ImpersonatedRequest, res: Response, next: NextFunction) => {
    if (req.impersonation?.isImpersonating) {
      const response: ApiResponse = {
        success: false,
        error: 'This action cannot be performed while impersonating',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      return res.status(403).json(response);
    }
    next();
  };
}
