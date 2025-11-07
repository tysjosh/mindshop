import { BaseRepository } from "./BaseRepository";
import { apiKeys, type ApiKey, type NewApiKey } from "../database/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";

export class ApiKeyRepository extends BaseRepository {
  async create(data: NewApiKey): Promise<ApiKey> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(apiKeys)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<ApiKey | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByKeyId(keyId: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyId, keyId))
      .limit(1);

    return result[0] || null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    return result[0] || null;
  }

  async findByPrefix(prefix: string): Promise<ApiKey[]> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, prefix));

    return result;
  }

  async findByMerchantId(
    merchantId: string,
    includeRevoked: boolean = false
  ): Promise<ApiKey[]> {
    this.validateMerchantId(merchantId);

    let query = this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.merchantId, merchantId))
      .orderBy(desc(apiKeys.createdAt));

    if (!includeRevoked) {
      query = (query as any).where(
        and(
          eq(apiKeys.merchantId, merchantId),
          eq(apiKeys.status, "active")
        )
      );
    }

    return query;
  }

  async findActiveByMerchantId(merchantId: string): Promise<ApiKey[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.merchantId, merchantId),
          eq(apiKeys.status, "active")
        )
      )
      .orderBy(desc(apiKeys.createdAt));

    return result;
  }

  async update(keyId: string, data: Partial<NewApiKey>): Promise<ApiKey> {
    const [result] = await this.db
      .update(apiKeys)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.keyId, keyId))
      .returning();

    if (!result) {
      throw new Error("API key not found");
    }

    return result;
  }

  async updateLastUsed(keyId: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(apiKeys.keyId, keyId));
  }

  async revoke(keyId: string): Promise<ApiKey> {
    const [result] = await this.db
      .update(apiKeys)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.keyId, keyId))
      .returning();

    if (!result) {
      throw new Error("API key not found");
    }

    return result;
  }

  async markAsExpired(keyId: string): Promise<ApiKey> {
    const [result] = await this.db
      .update(apiKeys)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.keyId, keyId))
      .returning();

    if (!result) {
      throw new Error("API key not found");
    }

    return result;
  }

  async delete(keyId: string): Promise<boolean> {
    const result = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.keyId, keyId));

    return result.count > 0;
  }

  async findExpiredKeys(): Promise<ApiKey[]> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.status, "active"),
          sql`${apiKeys.expiresAt} < NOW()`
        )
      );

    return result;
  }

  async countByMerchantId(merchantId: string, status?: string): Promise<number> {
    this.validateMerchantId(merchantId);

    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(apiKeys)
      .where(eq(apiKeys.merchantId, merchantId));

    if (status) {
      query = (query as any).where(
        and(
          eq(apiKeys.merchantId, merchantId),
          eq(apiKeys.status, status as any)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }
}

// Export singleton instance
let apiKeyRepositoryInstance: ApiKeyRepository | null = null;

export const getApiKeyRepository = (): ApiKeyRepository => {
  if (!apiKeyRepositoryInstance) {
    apiKeyRepositoryInstance = new ApiKeyRepository();
  }
  return apiKeyRepositoryInstance;
};
