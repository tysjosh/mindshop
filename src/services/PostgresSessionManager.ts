import { v4 as uuidv4 } from "uuid";
import { UserSessionRepository } from "../repositories/UserSessionRepository";
import { UserSession } from "../models/UserSession";
import { UserContext, Message } from "../types";

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

/**
 * PostgresSessionManager - Postgres-based session management
 * Matches SessionManager interface for local development
 */
export class PostgresSessionManager {
  private repository: UserSessionRepository;

  constructor() {
    this.repository = new UserSessionRepository();
  }

  async createSession(request: CreateSessionRequest): Promise<UserSession> {
    console.log('[PostgresSessionManager] createSession called', { merchantId: request.merchantId, userId: request.userId });
    const sessionId = uuidv4();
    const now = new Date();

    const session = new UserSession({
      sessionId,
      userId: request.userId,
      merchantId: request.merchantId,
      conversationHistory: [],
      context: request.context || {
        preferences: {},
        purchaseHistory: [],
        currentCart: [],
        demographics: {},
      },
      createdAt: now,
      lastActivity: now,
    });

    console.log('[PostgresSessionManager] Calling repository.create');
    const result = await this.repository.create(session);
    console.log('[PostgresSessionManager] Session created successfully', { sessionId: result.sessionId });
    return result;
  }

  async getSession(
    sessionId: string,
    merchantId: string
  ): Promise<UserSession | null> {
    return await this.repository.findById(sessionId, merchantId);
  }

  async updateSession(request: UpdateSessionRequest): Promise<void> {
    const existingSession = await this.repository.findById(
      request.sessionId,
      request.merchantId
    );

    if (!existingSession) {
      throw new Error("Session not found");
    }

    if (request.message) {
      existingSession.conversationHistory.push(request.message);
    }

    if (request.context) {
      existingSession.context = {
        ...existingSession.context,
        ...request.context,
      };
    }

    existingSession.lastActivity = new Date();

    const ttlHours = 24;
    await this.repository.extendSession(
      request.sessionId,
      request.merchantId,
      ttlHours
    );

    await this.repository.update(existingSession);
  }

  async deleteSession(sessionId: string, merchantId: string): Promise<void> {
    const deleted = await this.repository.delete(sessionId, merchantId);

    if (!deleted) {
      throw new Error("Session not found or could not be deleted");
    }
  }

  async getUserSessions(
    userId: string,
    limit: number = 10
  ): Promise<UserSession[]> {
    const { db } = this.repository as any;
    const { userSessions } = await import("../database/schema");
    const { eq, desc } = await import("drizzle-orm");

    const result = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastActivity))
      .limit(limit);

    return result.map(
      (row: any) =>
        new UserSession({
          sessionId: row.sessionId,
          userId: row.userId,
          merchantId: row.merchantId,
          conversationHistory: row.conversationHistory || [],
          context: row.context || {
            preferences: {},
            purchaseHistory: [],
            currentCart: [],
            demographics: {},
          },
          createdAt: row.createdAt,
          lastActivity: row.lastActivity,
        })
    );
  }

  async cleanupExpiredSessions(merchantId: string): Promise<number> {
    const { db } = this.repository as any;
    const { userSessions } = await import("../database/schema");
    const { eq, and, lt } = await import("drizzle-orm");

    const expiredSessions = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.merchantId, merchantId),
          lt(userSessions.expiresAt, new Date())
        )
      );

    if (expiredSessions.length === 0) {
      return 0;
    }

    const deletePromises = expiredSessions.map((session: any) =>
      this.deleteSession(session.sessionId, merchantId)
    );

    await Promise.all(deletePromises);
    return expiredSessions.length;
  }

  async getSessionStats(merchantId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    avgSessionDuration: number;
  }> {
    const { db } = this.repository as any;
    const { userSessions } = await import("../database/schema");
    const { eq } = await import("drizzle-orm");

    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.merchantId, merchantId));

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        avgSessionDuration: 0,
      };
    }

    const now = Date.now();
    const activeSessions = sessions.filter((session: any) => {
      const expiresAt = new Date(session.expiresAt).getTime();
      return expiresAt > now;
    });

    const totalDuration = sessions.reduce((sum: number, session: any) => {
      const created = new Date(session.createdAt).getTime();
      const lastActivity = new Date(session.lastActivity).getTime();
      return sum + (lastActivity - created);
    }, 0);

    const avgSessionDuration =
      sessions.length > 0 ? totalDuration / sessions.length : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      avgSessionDuration: Math.round(avgSessionDuration / 1000 / 60),
    };
  }
}
