import { BaseRepository } from "./BaseRepository";
import { usageLimits, type UsageLimit, type NewUsageLimit } from "../database/schema";
import { eq, sql } from "drizzle-orm";

export class UsageLimitsRepository extends BaseRepository {
  async create(data: NewUsageLimit): Promise<UsageLimit> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(usageLimits)
      .values(data)
      .returning();

    return result;
  }

  async findByMerchantId(merchantId: string): Promise<UsageLimit | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(usageLimits)
      .where(eq(usageLimits.merchantId, merchantId))
      .limit(1);

    return result[0] || null;
  }

  async update(merchantId: string, data: Partial<NewUsageLimit>): Promise<UsageLimit> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(usageLimits)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(usageLimits.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Usage limits not found");
    }

    return result;
  }

  async upsert(merchantId: string, data: Omit<NewUsageLimit, "merchantId">): Promise<UsageLimit> {
    this.validateMerchantId(merchantId);

    const existing = await this.findByMerchantId(merchantId);

    if (existing) {
      return this.update(merchantId, data);
    } else {
      return this.create({
        merchantId,
        ...data,
      });
    }
  }

  async setDefaultLimitsForPlan(
    merchantId: string,
    plan: "starter" | "professional" | "enterprise"
  ): Promise<UsageLimit> {
    this.validateMerchantId(merchantId);

    const limits = this.getDefaultLimitsForPlan(plan);

    return this.upsert(merchantId, limits);
  }

  async delete(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .delete(usageLimits)
      .where(eq(usageLimits.merchantId, merchantId));

    return result.count > 0;
  }

  private getDefaultLimitsForPlan(plan: "starter" | "professional" | "enterprise"): Omit<NewUsageLimit, "merchantId"> {
    const limitsMap = {
      starter: {
        plan: "starter" as const,
        queriesPerMonth: 1000,
        documentsMax: 100,
        apiCallsPerDay: 5000,
        storageGbMax: 1,
      },
      professional: {
        plan: "professional" as const,
        queriesPerMonth: 10000,
        documentsMax: 1000,
        apiCallsPerDay: 50000,
        storageGbMax: 10,
      },
      enterprise: {
        plan: "enterprise" as const,
        queriesPerMonth: 999999999,
        documentsMax: 999999999,
        apiCallsPerDay: 999999999,
        storageGbMax: 1000,
      },
    };

    return limitsMap[plan];
  }
}

// Export singleton instance
let usageLimitsRepositoryInstance: UsageLimitsRepository | null = null;

export const getUsageLimitsRepository = (): UsageLimitsRepository => {
  if (!usageLimitsRepositoryInstance) {
    usageLimitsRepositoryInstance = new UsageLimitsRepository();
  }
  return usageLimitsRepositoryInstance;
};
