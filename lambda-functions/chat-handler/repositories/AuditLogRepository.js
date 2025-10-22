"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogRepository = exports.AuditLogRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
const schema_1 = require("../database/schema");
const drizzle_orm_1 = require("drizzle-orm");
class AuditLogRepository extends BaseRepository_1.BaseRepository {
    async create(auditLog) {
        this.validateMerchantId(auditLog.merchantId);
        const newAuditLog = {
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
        await this.db.insert(schema_1.auditLogs).values(newAuditLog);
    }
    async findByMerchant(merchantId, limit = 100, offset = 0) {
        this.validateMerchantId(merchantId);
        const result = await this.db
            .select()
            .from(schema_1.auditLogs)
            .where((0, drizzle_orm_1.eq)(schema_1.auditLogs.merchantId, merchantId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.timestamp))
            .limit(limit)
            .offset(offset);
        return result.map(this.mapRowToAuditLog);
    }
    async findByOperation(merchantId, operation, limit = 100) {
        this.validateMerchantId(merchantId);
        const result = await this.db
            .select()
            .from(schema_1.auditLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.auditLogs.merchantId, merchantId), (0, drizzle_orm_1.eq)(schema_1.auditLogs.operation, operation)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.timestamp))
            .limit(limit);
        return result.map(this.mapRowToAuditLog);
    }
    async findByDateRange(merchantId, startDate, endDate, limit = 1000) {
        this.validateMerchantId(merchantId);
        const result = await this.db
            .select()
            .from(schema_1.auditLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.auditLogs.merchantId, merchantId), (0, drizzle_orm_1.gte)(schema_1.auditLogs.timestamp, startDate), (0, drizzle_orm_1.lte)(schema_1.auditLogs.timestamp, endDate)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.timestamp))
            .limit(limit);
        return result.map(this.mapRowToAuditLog);
    }
    async findByUser(merchantId, userId, limit = 100) {
        this.validateMerchantId(merchantId);
        const result = await this.db
            .select()
            .from(schema_1.auditLogs)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.auditLogs.merchantId, merchantId), (0, drizzle_orm_1.eq)(schema_1.auditLogs.userId, userId)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.timestamp))
            .limit(limit);
        return result.map(this.mapRowToAuditLog);
    }
    async findOlderThan(cutoffDate) {
        const result = await this.db
            .select()
            .from(schema_1.auditLogs)
            .where((0, drizzle_orm_1.lte)(schema_1.auditLogs.timestamp, cutoffDate))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.timestamp));
        return result.map(this.mapRowToAuditLog);
    }
    async delete(id) {
        await this.db.delete(schema_1.auditLogs).where((0, drizzle_orm_1.eq)(schema_1.auditLogs.id, id));
    }
    mapRowToAuditLog(row) {
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
exports.AuditLogRepository = AuditLogRepository;
// Export singleton instance
let auditLogRepositoryInstance = null;
const getAuditLogRepository = () => {
    if (!auditLogRepositoryInstance) {
        auditLogRepositoryInstance = new AuditLogRepository();
    }
    return auditLogRepositoryInstance;
};
exports.getAuditLogRepository = getAuditLogRepository;
