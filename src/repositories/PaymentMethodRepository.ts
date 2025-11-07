import { BaseRepository } from "./BaseRepository";
import { paymentMethods, type PaymentMethod, type NewPaymentMethod } from "../database/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class PaymentMethodRepository extends BaseRepository {
  async create(data: NewPaymentMethod): Promise<PaymentMethod> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(paymentMethods)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByStripePaymentMethodId(
    stripePaymentMethodId: string
  ): Promise<PaymentMethod | null> {
    const result = await this.db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId))
      .limit(1);

    return result[0] || null;
  }

  async findByMerchantId(merchantId: string): Promise<PaymentMethod[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.merchantId, merchantId))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));

    return result;
  }

  async findDefaultByMerchantId(merchantId: string): Promise<PaymentMethod | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.merchantId, merchantId),
          eq(paymentMethods.isDefault, 1)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async update(
    stripePaymentMethodId: string,
    data: Partial<NewPaymentMethod>
  ): Promise<PaymentMethod> {
    const [result] = await this.db
      .update(paymentMethods)
      .set(data)
      .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId))
      .returning();

    if (!result) {
      throw new Error("Payment method not found");
    }

    return result;
  }

  async setAsDefault(
    merchantId: string,
    stripePaymentMethodId: string
  ): Promise<PaymentMethod> {
    this.validateMerchantId(merchantId);

    // First, unset all other payment methods as default
    await this.db
      .update(paymentMethods)
      .set({ isDefault: 0 })
      .where(eq(paymentMethods.merchantId, merchantId));

    // Then set the specified payment method as default
    const [result] = await this.db
      .update(paymentMethods)
      .set({ isDefault: 1 })
      .where(
        and(
          eq(paymentMethods.merchantId, merchantId),
          eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId)
        )
      )
      .returning();

    if (!result) {
      throw new Error("Payment method not found");
    }

    return result;
  }

  async delete(stripePaymentMethodId: string): Promise<boolean> {
    const result = await this.db
      .delete(paymentMethods)
      .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId));

    return result.count > 0;
  }

  async deleteByMerchantId(merchantId: string): Promise<number> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .delete(paymentMethods)
      .where(eq(paymentMethods.merchantId, merchantId));

    return result.count;
  }

  async countByMerchantId(merchantId: string): Promise<number> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(paymentMethods)
      .where(eq(paymentMethods.merchantId, merchantId));

    return Number(result[0]?.count || 0);
  }

  async hasPaymentMethod(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const count = await this.countByMerchantId(merchantId);
    return count > 0;
  }
}

// Export singleton instance
let paymentMethodRepositoryInstance: PaymentMethodRepository | null = null;

export const getPaymentMethodRepository = (): PaymentMethodRepository => {
  if (!paymentMethodRepositoryInstance) {
    paymentMethodRepositoryInstance = new PaymentMethodRepository();
  }
  return paymentMethodRepositoryInstance;
};
