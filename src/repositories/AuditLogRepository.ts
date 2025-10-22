import { BaseRepository } from "./BaseRepository";
import { auditLogs, type NewAuditLog } from "../database/schema";
import { AuditLog } from "../types";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export class AuditLogRepository extends BaseRepository {
  public async create(
    auditLog: Omit<AuditLog, "id" | "timestamp">
  ): Promise<void> {
    this.validateMerchantId(auditLog.merchantId);

    const newAuditLog: NewAuditLog = {
      merchantId: auditLog.merchantId,
      userId: auditLog.userId,
      sessionId: auditLog.sessionId,
      operation: auditLog.operation,
      requestPayloadHash: auditLog.requestPayloadHash,
      responseReference: auditLog.responseReference,
      outcome: auditLog.outcome,
      reason: auditLog.reason,
      actor: auditLog.actor,
      ipAddress: auditLog.ipAddress?.toString(),
      userAgent: auditLog.userAgent,
    };

    await this.db.insert(auditLogs).values(newAuditLog);
  }

  public async findByMerchant(
    merchantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.merchantId, merchantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return result.map(this.mapRowToAuditLog);
  }

  public async findByOperation(
    merchantId: string,
    operation: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.merchantId, merchantId),
          eq(auditLogs.operation, operation)
        )
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return result.map(this.mapRowToAuditLog);
  }

  public async findByDateRange(
    merchantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<AuditLog[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.merchantId, merchantId),
          gte(auditLogs.timestamp, startDate),
          lte(auditLogs.timestamp, endDate)
        )
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return result.map(this.mapRowToAuditLog);
  }

  public async findByUser(
    merchantId: string,
    userId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.merchantId, merchantId), eq(auditLogs.userId, userId))
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return result.map(this.mapRowToAuditLog);
  }

  public async findOlderThan(cutoffDate: Date): Promise<AuditLog[]> {
    const result = await this.db
      .select()
      .from(auditLogs)
      .where(lte(auditLogs.timestamp, cutoffDate))
      .orderBy(desc(auditLogs.timestamp));

    return result.map(this.mapRowToAuditLog);
  }

  public async delete(id: string): Promise<void> {
    await this.db.delete(auditLogs).where(eq(auditLogs.id, id));
  }

  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      merchantId: row.merchantId,
      userId: row.userId,
      sessionId: row.sessionId,
      operation: row.operation,
      requestPayloadHash: row.requestPayloadHash,
      responseReference: row.responseReference,
      outcome: row.outcome,
      reason: row.reason,
      actor: row.actor,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    };
  }
}
// Export singleton instance
let auditLogRepositoryInstance: AuditLogRepository | null = null;

export const getAuditLogRepository = (): AuditLogRepository => {
  if (!auditLogRepositoryInstance) {
    auditLogRepositoryInstance = new AuditLogRepository();
  }
  return auditLogRepositoryInstance;
};