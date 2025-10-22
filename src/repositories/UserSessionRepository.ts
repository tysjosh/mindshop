import { BaseRepository } from './BaseRepository';
import { UserSession } from '../models';
import { userSessions, type NewUserSession } from '../database/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

export class UserSessionRepository extends BaseRepository {
  public async create(session: UserSession): Promise<UserSession> {
    this.validateMerchantId(session.merchantId);
    
    const newSession: NewUserSession = {
      sessionId: session.sessionId,
      userId: session.userId,
      merchantId: session.merchantId,
      conversationHistory: session.conversationHistory,
      context: session.context,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    };

    const [result] = await this.db.insert(userSessions).values(newSession).returning();
    return this.mapRowToUserSession(result);
  }

  public async findById(sessionId: string, merchantId: string): Promise<UserSession | null> {
    this.validateMerchantId(merchantId);
    this.validateUUID(sessionId);
    
    const result = await this.db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.sessionId, sessionId), 
        eq(userSessions.merchantId, merchantId)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    return this.mapRowToUserSession(result[0]);
  }

  public async findByUser(userId: string, merchantId: string): Promise<UserSession[]> {
    this.validateMerchantId(merchantId);
    
    const result = await this.db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.merchantId, merchantId)
      ))
      .orderBy(desc(userSessions.lastActivity));
    
    return result.map(this.mapRowToUserSession);
  }

  public async update(session: UserSession): Promise<UserSession> {
    this.validateMerchantId(session.merchantId);
    this.validateUUID(session.sessionId);
    
    const [result] = await this.db
      .update(userSessions)
      .set({
        conversationHistory: session.conversationHistory,
        context: session.context,
        lastActivity: new Date(),
      })
      .where(and(
        eq(userSessions.sessionId, session.sessionId),
        eq(userSessions.merchantId, session.merchantId)
      ))
      .returning();
    
    if (!result) {
      throw new Error('Session not found or access denied');
    }
    
    return this.mapRowToUserSession(result);
  }

  public async delete(sessionId: string, merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);
    this.validateUUID(sessionId);
    
    const result = await this.db
      .delete(userSessions)
      .where(and(
        eq(userSessions.sessionId, sessionId),
        eq(userSessions.merchantId, merchantId)
      ));
    
    return result.length > 0;
  }

  public async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db
      .delete(userSessions)
      .where(lt(userSessions.expiresAt, new Date()));
    
    return result.length;
  }

  public async extendSession(sessionId: string, merchantId: string, hours: number = 24): Promise<void> {
    this.validateMerchantId(merchantId);
    this.validateUUID(sessionId);
    
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    await this.db
      .update(userSessions)
      .set({
        expiresAt,
        lastActivity: new Date(),
      })
      .where(and(
        eq(userSessions.sessionId, sessionId),
        eq(userSessions.merchantId, merchantId)
      ));
  }

  private mapRowToUserSession(row: any): UserSession {
    return new UserSession({
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
    });
  }
}