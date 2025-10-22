"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.createAuthService = createAuthService;
exports.getAuthService = getAuthService;
const aws_jwt_verify_1 = require("aws-jwt-verify");
class AuthService {
    constructor(config) {
        this.config = config;
        // Create JWT verifiers
        this.accessTokenVerifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
            userPoolId: config.userPoolId,
            tokenUse: 'access',
            clientId: config.clientId,
        });
        this.idTokenVerifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
            userPoolId: config.userPoolId,
            tokenUse: 'id',
            clientId: config.clientId,
        });
    }
    /**
     * Verify a JWT token and extract user information
     */
    async verifyToken(token) {
        let payload;
        let tokenUse;
        try {
            // Try access token first
            payload = await this.accessTokenVerifier.verify(token, {
                clientId: this.config.clientId || null
            });
            tokenUse = 'access';
        }
        catch (accessError) {
            try {
                // Try ID token
                payload = await this.idTokenVerifier.verify(token, {
                    clientId: this.config.clientId || null
                });
                tokenUse = 'id';
            }
            catch (idError) {
                throw new Error('Invalid token: failed both access and ID token verification');
            }
        }
        // Extract user information
        const userInfo = {
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
    extractMerchantId(payload) {
        return (payload['custom:merchant_id'] ||
            payload.merchant_id ||
            payload['cognito:merchant_id'] ||
            payload.merchantId ||
            '');
    }
    /**
     * Extract roles from token payload
     */
    extractRoles(payload) {
        const roles = [];
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
            roles.push(...scopes.filter((scope) => scope.startsWith('role:')));
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
    generateDevToken(userInfo) {
        const defaultUser = {
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
    validateMerchantAccess(userInfo, requestedMerchantId) {
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
    hasRequiredRoles(userInfo, requiredRoles) {
        return requiredRoles.some(role => userInfo.roles.includes(role));
    }
}
exports.AuthService = AuthService;
/**
 * Factory function to create AuthService
 */
function createAuthService(config) {
    return new AuthService(config);
}
/**
 * Get AuthService instance with environment configuration
 */
function getAuthService() {
    const config = {
        userPoolId: process.env.COGNITO_USER_POOL_ID || 'dev-pool',
        clientId: process.env.COGNITO_CLIENT_ID,
        region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    };
    return createAuthService(config);
}
//# sourceMappingURL=AuthService.js.map