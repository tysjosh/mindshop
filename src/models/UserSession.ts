import { UserSession as IUserSession, Message, UserContext } from '../types';

export class UserSession implements IUserSession {
  public sessionId: string;
  public userId: string;
  public merchantId: string;
  public conversationHistory: Message[];
  public context: UserContext;
  public createdAt: Date;
  public lastActivity: Date;

  constructor(data: Partial<IUserSession> & { sessionId: string; userId: string; merchantId: string }) {
    this.sessionId = data.sessionId;
    this.userId = data.userId;
    this.merchantId = data.merchantId;
    this.conversationHistory = data.conversationHistory || [];
    this.context = data.context || {
      preferences: {},
      purchaseHistory: [],
      currentCart: [],
      demographics: {},
    };
    this.createdAt = data.createdAt || new Date();
    this.lastActivity = data.lastActivity || new Date();
  }

  public addMessage(message: Message): void {
    this.conversationHistory.push(message);
    this.lastActivity = new Date();
  }

  public updateContext(context: Partial<UserContext>): void {
    this.context = { ...this.context, ...context };
    this.lastActivity = new Date();
  }

  public getRecentMessages(count: number = 10): Message[] {
    return this.conversationHistory.slice(-count);
  }

  public isExpired(ttlMinutes: number = 60): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - this.lastActivity.getTime()) / (1000 * 60);
    return diffMinutes > ttlMinutes;
  }

  public toJSON(): IUserSession {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      merchantId: this.merchantId,
      conversationHistory: this.conversationHistory,
      context: this.context,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
    };
  }
}