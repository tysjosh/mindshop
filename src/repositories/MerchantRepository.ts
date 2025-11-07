import { BaseRepository } from "./BaseRepository";
import { merchants, type Merchant, type NewMerchant } from "../database/schema";
import { eq, and, desc, sql, or, ilike } from "drizzle-orm";

export class MerchantRepository extends BaseRepository {
  async create(data: NewMerchant): Promise<Merchant> {
    this.validateMerchantId(data.merchantId);

    try {
      const [result] = await this.db
        .insert(merchants)
        .values(data)
        .returning();

      return result;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') { // PostgreSQL unique violation error code
        if (error.constraint === 'merchants_cognito_user_id_unique') {
          throw new Error('A merchant with this Cognito user ID already exists');
        }
        if (error.constraint === 'merchants_email_unique') {
          throw new Error('A merchant with this email already exists');
        }
        if (error.constraint === 'merchants_merchant_id_unique') {
          throw new Error('A merchant with this merchant ID already exists');
        }
        throw new Error('Merchant creation failed due to duplicate data');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Merchant | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByMerchantId(merchantId: string): Promise<Merchant | null> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.merchantId, merchantId))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string): Promise<Merchant | null> {
    const result = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.email, email))
      .limit(1);

    return result[0] || null;
  }

  async findByCognitoUserId(cognitoUserId: string): Promise<Merchant | null> {
    const result = await this.db
      .select()
      .from(merchants)
      .where(eq(merchants.cognitoUserId, cognitoUserId))
      .limit(1);

    return result[0] || null;
  }

  async findAll(
    limit: number = 50,
    offset: number = 0,
    status?: string,
    search?: string
  ): Promise<Merchant[]> {
    const conditions = [];

    if (status) {
      conditions.push(eq(merchants.status, status as any));
    }

    if (search) {
      // Search across merchantId, email, and companyName
      conditions.push(
        or(
          ilike(merchants.merchantId, `%${search}%`),
          ilike(merchants.email, `%${search}%`),
          ilike(merchants.companyName, `%${search}%`)
        )
      );
    }

    let query = this.db
      .select()
      .from(merchants)
      .orderBy(desc(merchants.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    return query;
  }

  async update(merchantId: string, data: Partial<NewMerchant>): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async updateStatus(
    merchantId: string,
    status: "pending_verification" | "active" | "suspended" | "deleted"
  ): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async updatePlan(
    merchantId: string,
    plan: "starter" | "professional" | "enterprise"
  ): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        plan,
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async markAsVerified(merchantId: string): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        status: "active",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async updateEmailVerified(merchantId: string, emailVerified: boolean): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        emailVerified: emailVerified as any,
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async updateCognitoUserId(merchantId: string, cognitoUserId: string): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    try {
      const [result] = await this.db
        .update(merchants)
        .set({
          cognitoUserId,
          updatedAt: new Date(),
        })
        .where(eq(merchants.merchantId, merchantId))
        .returning();

      if (!result) {
        throw new Error("Merchant not found");
      }

      return result;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505' && error.constraint === 'merchants_cognito_user_id_unique') {
        throw new Error('A merchant with this Cognito user ID already exists');
      }
      throw error;
    }
  }

  async softDelete(merchantId: string): Promise<Merchant> {
    this.validateMerchantId(merchantId);

    const [result] = await this.db
      .update(merchants)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(merchants.merchantId, merchantId))
      .returning();

    if (!result) {
      throw new Error("Merchant not found");
    }

    return result;
  }

  async delete(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .delete(merchants)
      .where(eq(merchants.merchantId, merchantId));

    return result.count > 0;
  }

  async count(status?: string, search?: string): Promise<number> {
    const conditions = [];

    if (status) {
      conditions.push(eq(merchants.status, status as any));
    }

    if (search) {
      // Search across merchantId, email, and companyName
      conditions.push(
        or(
          ilike(merchants.merchantId, `%${search}%`),
          ilike(merchants.email, `%${search}%`),
          ilike(merchants.companyName, `%${search}%`)
        )
      );
    }

    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(merchants);

    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async exists(merchantId: string): Promise<boolean> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(merchants)
      .where(eq(merchants.merchantId, merchantId));

    return Number(result[0]?.count || 0) > 0;
  }
}

// Export singleton instance
let merchantRepositoryInstance: MerchantRepository | null = null;

export const getMerchantRepository = (): MerchantRepository => {
  if (!merchantRepositoryInstance) {
    merchantRepositoryInstance = new MerchantRepository();
  }
  return merchantRepositoryInstance;
};
