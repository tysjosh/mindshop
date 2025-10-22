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
export declare class AuthService {
    private accessTokenVerifier;
    private idTokenVerifier;
    private config;
    constructor(config: AuthConfig);
    /**
     * Verify a JWT token and extract user information
     */
    verifyToken(token: string): Promise<UserInfo>;
    /**
     * Extract merchant ID from token payload
     */
    private extractMerchantId;
    /**
     * Extract roles from token payload
     */
    private extractRoles;
    /**
     * Generate a development token for testing (mock implementation)
     */
    generateDevToken(userInfo: Partial<UserInfo>): string;
    /**
     * Validate merchant access for a user
     */
    validateMerchantAccess(userInfo: UserInfo, requestedMerchantId: string): boolean;
    /**
     * Check if user has required roles
     */
    hasRequiredRoles(userInfo: UserInfo, requiredRoles: string[]): boolean;
}
/**
 * Factory function to create AuthService
 */
export declare function createAuthService(config: AuthConfig): AuthService;
/**
 * Get AuthService instance with environment configuration
 */
export declare function getAuthService(): AuthService;
//# sourceMappingURL=AuthService.d.ts.map