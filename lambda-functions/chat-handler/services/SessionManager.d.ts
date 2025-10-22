import { UserSession, UserContext, Message } from '../types';
export interface SessionManagerConfig {
    tableName: string;
    region: string;
    ttlHours?: number;
}
export interface CreateSessionRequest {
    merchantId: string;
    userId: string;
    context?: UserContext;
}
export interface UpdateSessionRequest {
    sessionId: string;
    merchantId: string;
    message?: Message;
    context?: Partial<UserContext>;
}
export declare class SessionManager {
    private dynamoClient;
    private tableName;
    private ttlHours;
    constructor(config: SessionManagerConfig);
    /**
     * Create a new session for a user
     */
    createSession(request: CreateSessionRequest): Promise<UserSession>;
    /**
     * Retrieve a session by session ID and merchant ID
     */
    getSession(sessionId: string, merchantId: string): Promise<UserSession | null>;
    /**
     * Update session with new message or context
     */
    updateSession(request: UpdateSessionRequest): Promise<void>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string, merchantId: string): Promise<void>;
    /**
     * Get all sessions for a user
     */
    getUserSessions(userId: string, limit?: number): Promise<UserSession[]>;
    /**
     * Clean up expired sessions (for maintenance)
     */
    cleanupExpiredSessions(merchantId: string): Promise<number>;
    /**
     * Get session statistics for a merchant
     */
    getSessionStats(merchantId: string): Promise<{
        totalSessions: number;
        activeSessions: number;
        avgSessionDuration: number;
    }>;
}
export declare function createSessionManager(): SessionManager;
//# sourceMappingURL=SessionManager.d.ts.map