import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthConfig {
  userPoolId: string;
  clientId?: string;
  region: string;
}

export interface UserInfo {
  userId: string;
  merchantId: string;
  email?: string;
  roles: string[];
  groups?: string[];
}

export class AuthService {
  private accessTokenVerifier: any;
  private idTokenVerifier: any;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    
    // Create JWT verifiers
    this.accessTokenVerifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: 'access',
      clientId: config.clientId,
    });

    this.idTokenVerifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: 'id',
      clientId: config.clientId,
    });
  }

  /**
   * Verify a JWT token and extract user information
   */
  async verifyToken(token: string): Promise<UserInfo> {
    let payload: any;
    let tokenUse: 'access' | 'id';

    try {
      // Try access token first
      payload = await this.accessTokenVerifier.verify(token, { 
        clientId: this.config.clientId || null 
      });
      tokenUse = 'access';
    } catch (accessError) {
      try {
        // Try ID token
        payload = await this.idTokenVerifier.verify(token, { 
          clientId: this.config.clientId || null 
        });
        tokenUse = 'id';
      } catch (idError) {
        throw new Error('Invalid token: failed both access and ID token verification');
      }
    }

    // Extract user information
    const userInfo: UserInfo = {
      userId: payload.sub || payload['cognito:username'] || payload.username,
      merchantId: this.extractMerchantId(payload),
      email: payload.email,
      roles: this.extractRoles(payload),
      groups: payload['cognito:groups'] || [],
    };

    // Validate required fields
    if (!userInfo.userId) {
      throw new Error('Token missing required user identifier');
    }

    if (!userInfo.merchantId) {
      throw new Error('Token missing required merchant identifier');
    }

    return userInfo;
  }

  /**
   * Extract merchant ID from token payload
   */
  private extractMerchantId(payload: any): string {
    return (
      payload['custom:merchant_id'] ||
      payload.merchant_id ||
      payload['cognito:merchant_id'] ||
      payload.merchantId ||
      ''
    );
  }

  /**
   * Extract roles from token payload
   */
  private extractRoles(payload: any): string[] {
    const roles: string[] = [];

    // Extract from custom attributes
    if (payload['custom:roles']) {
      roles.push(...payload['custom:roles'].split(','));
    }

    // Extract from groups
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
   * Generate a development token for testing (mock implementation)
   */
  generateDevToken(userInfo: Partial<UserInfo>): string {
    const defaultUser: UserInfo = {
      userId: 'dev_user_123',
      merchantId: 'dev_merchant_456',
      email: 'dev@example.com',
      roles: ['user'],
      groups: [],
    };

    const user = { ...defaultUser, ...userInfo };
    
    // Simple format: userId:merchantId:roles
    return `${user.userId}:${user.merchantId}:${user.roles.join(',')}`;
  }

  /**
   * Validate merchant access for a user
   */
  validateMerchantAccess(userInfo: UserInfo, requestedMerchantId: string): boolean {
    // Admin users can access any merchant
    if (userInfo.roles.includes('admin') || userInfo.roles.includes('super_admin')) {
      return true;
    }

    // Regular users can only access their own merchant
    return userInfo.merchantId === requestedMerchantId;
  }

  /**
   * Check if user has required roles
   */
  hasRequiredRoles(userInfo: UserInfo, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => userInfo.roles.includes(role));
  }
}

/**
 * Factory function to create AuthService
 */
export function createAuthService(config: AuthConfig): AuthService {
  return new AuthService(config);
}

/**
 * Get AuthService instance with environment configuration
 */
export function getAuthService(): AuthService {
  const config: AuthConfig = {
    userPoolId: process.env.COGNITO_USER_POOL_ID || 'dev-pool',
    clientId: process.env.COGNITO_CLIENT_ID,
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
  };

  return createAuthService(config);
}