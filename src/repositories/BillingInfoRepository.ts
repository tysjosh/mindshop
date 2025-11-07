import { BaseRepository } from "./BaseRepository";
import { billingInfo, type BillingInfo, type NewBillingInfo } from "../database/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class BillingInfoRepository extends BaseRepository {
  async create(data: NewBillingInfo): Promise<BillingInfo> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(billingInfo)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<BillingInfo | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByMerchantId(merchantId: string): Promise<BillingInfo | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.merchantId, merchantId))
      .limit(1);

    return result[0] || null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<BillingInfo | null> {
    const result = await this.db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return result[0] || null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<BillingInfo | null> {
    const result = await this.db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    return result[0] || null;
  }

  async update(merchantId: string, data: Partial<NewBillingInfo>): Promise<BillingInfo> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(billingInfo)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(billingInfo.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Billing info not found");
    }

    return result;
  }

  async updateByStripeCustomerId(
    stripeCustomerId: string,
    data: Partial<NewBillingInfo>
  ): Promise<BillingInfo> {
    const [result] = await this.db
      .update(billingInfo)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(billingInfo.stripeCustomerId, stripeCustomerId))
      .returning();

    if (!result) {
      throw new Error("Billing info not found");
    }

    return result;
  }

  async updateStatus(
    merchantId: string,
    status: "active" | "past_due" | "canceled" | "trialing"
  ): Promise<BillingInfo> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(billingInfo)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(billingInfo.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Billing info not found");
    }

    return result;
  }

  async updatePlan(
    merchantId: string,
    plan: "starter" | "professional" | "enterprise"
  ): Promise<BillingInfo> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(billingInfo)
      .set({
        plan,
        updatedAt: new Date(),
      })
      .where(eq(billingInfo.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Billing info not found");
    }

    return result;
  }

  async setCancelAtPeriodEnd(
    merchantId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<BillingInfo> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(billingInfo)
      .set({
        cancelAtPeriodEnd: cancelAtPeriodEnd ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(billingInfo.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Billing info not found");
    }

    return result;
  }

  async delete(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .delete(billingInfo)
      .where(eq(billingInfo.merchantId, merchantId));

    return result.count > 0;
  }

  async findByStatus(status: string): Promise<BillingInfo[]> {
    const result = await this.db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.status, status as any))
      .orderBy(desc(billingInfo.updatedAt));

    return result;
  }

  async findExpiringSubscriptions(daysUntilExpiry: number = 7): Promise<BillingInfo[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);

    const result = await this.db
      .select()
      .from(billingInfo)
      .where(
        and(
          eq(billingInfo.status, "active"),
          sql`${billingInfo.currentPeriodEnd} <= ${expiryDate}`,
          sql`${billingInfo.currentPeriodEnd} > NOW()`
        )
      );

    return result;
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(billingInfo)
      .where(eq(billingInfo.status, status as any));

    return Number(result[0]?.count || 0);
  }

  async countByPlan(plan: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(billingInfo)
      .where(eq(billingInfo.plan, plan as any));

    return Number(result[0]?.count || 0);
  }
}

// Export singleton instance
let billingInfoRepositoryInstance: BillingInfoRepository | null = null;

export const getBillingInfoRepository = (): BillingInfoRepository => {
  if (!billingInfoRepositoryInstance) {
    billingInfoRepositoryInstance = new BillingInfoRepository();
  }
  return billingInfoRepositoryInstance;
};
