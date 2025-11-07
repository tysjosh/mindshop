import { BaseRepository } from "./BaseRepository";
import { apiKeyUsage, type ApiKeyUsage, type NewApiKeyUsage } from "../database/schema";
import { eq, and, desc, sql, gte, lte, between } from "drizzle-orm";

export class ApiKeyUsageRepository extends BaseRepository {
  async create(data: NewApiKeyUsage): Promise<ApiKeyUsage> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(apiKeyUsage)
      .values(data)
      .returning();

    return result;
  }

  async findByKeyId(
    keyId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ApiKeyUsage[]> {
    const result = await this.db
      .select()
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.keyId, keyId))
      .orderBy(desc(apiKeyUsage.timestamp))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findByMerchantId(
    merchantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ApiKeyUsage[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.merchantId, merchantId))
      .orderBy(desc(apiKeyUsage.timestamp))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findByDateRange(
    keyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApiKeyUsage[]> {
    const result = await this.db
      .select()
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        )
      )
      .orderBy(desc(apiKeyUsage.timestamp));

    return result;
  }

  async getUsageStats(
    keyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
  }> {
    const result = await this.db
      .select({
        totalRequests: sql<number>`count(*)`,
        successfulRequests: sql<number>`count(*) FILTER (WHERE ${apiKeyUsage.statusCode} >= 200 AND ${apiKeyUsage.statusCode} < 300)`,
        failedRequests: sql<number>`count(*) FILTER (WHERE ${apiKeyUsage.statusCode} >= 400)`,
        avgResponseTime: sql<number>`avg(${apiKeyUsage.responseTimeMs})`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        )
      );

    return {
      totalRequests: Number(result[0]?.totalRequests || 0),
      successfulRequests: Number(result[0]?.successfulRequests || 0),
      failedRequests: Number(result[0]?.failedRequests || 0),
      avgResponseTime: Number(result[0]?.avgResponseTime || 0),
    };
  }

  async getUsageByEndpoint(
    keyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ endpoint: string; count: number }>> {
    const result = await this.db
      .select({
        endpoint: apiKeyUsage.endpoint,
        count: sql<number>`count(*)`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        )
      )
      .groupBy(apiKeyUsage.endpoint)
      .orderBy(desc(sql`count(*)`));

    return result.map((row) => ({
      endpoint: row.endpoint,
      count: Number(row.count),
    }));
  }

  async getUsageTimeSeries(
    keyId: string,
    startDate: Date,
    endDate: Date,
    interval: "hour" | "day" = "day"
  ): Promise<Array<{ timestamp: Date; count: number }>> {
    const result = await this.db
      .select({
        timestamp: sql<Date>`DATE_TRUNC('${sql.raw(interval)}', ${apiKeyUsage.timestamp})`,
        count: sql<number>`count(*)`,
      })
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        )
      )
      .groupBy(sql`DATE_TRUNC('${sql.raw(interval)}', ${apiKeyUsage.timestamp})`)
      .orderBy(sql`DATE_TRUNC('${sql.raw(interval)}', ${apiKeyUsage.timestamp})`);

    return result.map((row) => ({
      timestamp: row.timestamp,
      count: Number(row.count),
    }));
  }

  async countByKeyId(keyId: string, startDate?: Date, endDate?: Date): Promise<number> {
    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.keyId, keyId));

    if (startDate && endDate) {
      query = (query as any).where(
        and(
          eq(apiKeyUsage.keyId, keyId),
          gte(apiKeyUsage.timestamp, startDate),
          lte(apiKeyUsage.timestamp, endDate)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db
      .delete(apiKeyUsage)
      .where(lte(apiKeyUsage.timestamp, cutoffDate));

    return result.count;
  }
}

// Export singleton instance
let apiKeyUsageRepositoryInstance: ApiKeyUsageRepository | null = null;

export const getApiKeyUsageRepository = (): ApiKeyUsageRepository => {
  if (!apiKeyUsageRepositoryInstance) {
    apiKeyUsageRepositoryInstance = new ApiKeyUsageRepository();
  }
  return apiKeyUsageRepositoryInstance;
};
