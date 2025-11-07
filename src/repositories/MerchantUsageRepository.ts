import { BaseRepository } from "./BaseRepository";
import { merchantUsage, type MerchantUsage, type NewMerchantUsage } from "../database/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export class MerchantUsageRepository extends BaseRepository {
  async create(data: NewMerchantUsage): Promise<MerchantUsage> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(merchantUsage)
      .values(data)
      .returning();

    return result;
  }

  async findByMerchantId(
    merchantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<MerchantUsage[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(merchantUsage)
      .where(eq(merchantUsage.merchantId, merchantId))
      .orderBy(desc(merchantUsage.date))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findByMerchantAndDate(
    merchantId: string,
    date: Date
  ): Promise<MerchantUsage[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(merchantUsage)
      .where(
        and(
          eq(merchantUsage.merchantId, merchantId),
          eq(merchantUsage.date, date)
        )
      );

    return result;
  }

  async findByMerchantDateAndMetric(
    merchantId: string,
    date: Date,
    metricType: string
  ): Promise<MerchantUsage | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(merchantUsage)
      .where(
        and(
          eq(merchantUsage.merchantId, merchantId),
          eq(merchantUsage.date, date),
          eq(merchantUsage.metricType, metricType)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async upsert(
    merchantId: string,
    date: Date,
    metricType: string,
    metricValue: number,
    metadata?: any
  ): Promise<MerchantUsage> {
    this.validateMerchantId(merchantId);

    const existing = await this.findByMerchantDateAndMetric(merchantId, date, metricType);

    if (existing) {
      const [result] = await this.db
        .update(merchantUsage)
        .set({
          metricValue,
          metadata: metadata || existing.metadata,
          updatedAt: new Date(),
        })
        .where(eq(merchantUsage.id, existing.id))
        .returning();

      return result;
    } else {
      return this.create({
        merchantId,
        date,
        metricType,
        metricValue,
        metadata: metadata || {},
      });
    }
  }

  async incrementMetric(
    merchantId: string,
    date: Date,
    metricType: string,
    incrementBy: number = 1
  ): Promise<MerchantUsage> {
    this.validateMerchantId(merchantId);

    const existing = await this.findByMerchantDateAndMetric(merchantId, date, metricType);

    if (existing) {
      const [result] = await this.db
        .update(merchantUsage)
        .set({
          metricValue: existing.metricValue + incrementBy,
          updatedAt: new Date(),
        })
        .where(eq(merchantUsage.id, existing.id))
        .returning();

      return result;
    } else {
      return this.create({
        merchantId,
        date,
        metricType,
        metricValue: incrementBy,
        metadata: {},
      });
    }
  }

  async sumByPeriod(
    merchantId: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${merchantUsage.metricValue}), 0)`,
      })
      .from(merchantUsage)
      .where(
        and(
          eq(merchantUsage.merchantId, merchantId),
          eq(merchantUsage.metricType, metricType),
          gte(merchantUsage.date, startDate),
          lte(merchantUsage.date, endDate)
        )
      );

    return Number(result[0]?.total || 0);
  }

  async getUsageByMetricType(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select({
        metricType: merchantUsage.metricType,
        total: sql<number>`SUM(${merchantUsage.metricValue})`,
      })
      .from(merchantUsage)
      .where(
        and(
          eq(merchantUsage.merchantId, merchantId),
          gte(merchantUsage.date, startDate),
          lte(merchantUsage.date, endDate)
        )
      )
      .groupBy(merchantUsage.metricType);

    const usageMap: Record<string, number> = {};
    result.forEach((row) => {
      usageMap[row.metricType] = Number(row.total);
    });

    return usageMap;
  }

  async getUsageTimeSeries(
    merchantId: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select({
        date: merchantUsage.date,
        value: merchantUsage.metricValue,
      })
      .from(merchantUsage)
      .where(
        and(
          eq(merchantUsage.merchantId, merchantId),
          eq(merchantUsage.metricType, metricType),
          gte(merchantUsage.date, startDate),
          lte(merchantUsage.date, endDate)
        )
      )
      .orderBy(merchantUsage.date);

    return result.map((row) => ({
      date: row.date as Date,
      value: Number(row.value),
    }));
  }

  async getCurrentMonthUsage(
    merchantId: string,
    metricType: string
  ): Promise<number> {
    this.validateMerchantId(merchantId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    return this.sumByPeriod(merchantId, metricType, startOfMonth, endOfMonth);
  }

  async getTodayUsage(
    merchantId: string,
    metricType: string
  ): Promise<number> {
    this.validateMerchantId(merchantId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.findByMerchantDateAndMetric(merchantId, today, metricType);

    return existing ? existing.metricValue : 0;
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db
      .delete(merchantUsage)
      .where(lte(merchantUsage.date, cutoffDate));

    return result.count;
  }
}

// Export singleton instance
let merchantUsageRepositoryInstance: MerchantUsageRepository | null = null;

export const getMerchantUsageRepository = (): MerchantUsageRepository => {
  if (!merchantUsageRepositoryInstance) {
    merchantUsageRepositoryInstance = new MerchantUsageRepository();
  }
  return merchantUsageRepositoryInstance;
};
