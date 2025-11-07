import { BaseRepository } from "./BaseRepository";
import { webhooks, type Webhook, type NewWebhook } from "../database/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class WebhookRepository extends BaseRepository {
  async create(data: NewWebhook): Promise<Webhook> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(webhooks)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<Webhook | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByWebhookId(webhookId: string): Promise<Webhook | null> {
    const result = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.webhookId, webhookId))
      .limit(1);

    return result[0] || null;
  }

  async findByMerchantId(merchantId: string): Promise<Webhook[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.merchantId, merchantId))
      .orderBy(desc(webhooks.createdAt));

    return result;
  }

  async findActiveByMerchantId(merchantId: string): Promise<Webhook[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.merchantId, merchantId),
          eq(webhooks.status, "active")
        )
      )
      .orderBy(desc(webhooks.createdAt));

    return result;
  }

  async findByMerchantAndEvent(
    merchantId: string,
    eventType: string
  ): Promise<Webhook[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.merchantId, merchantId),
          eq(webhooks.status, "active"),
          sql`${webhooks.events} @> ${JSON.stringify([eventType])}::jsonb`
        )
      );

    return result;
  }

  async update(webhookId: string, data: Partial<NewWebhook>): Promise<Webhook> {
    const [result] = await this.db
      .update(webhooks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.webhookId, webhookId))
      .returning();

    if (!result) {
      throw new Error("Webhook not found");
    }

    return result;
  }

  async updateStatus(
    webhookId: string,
    status: "active" | "disabled" | "failed"
  ): Promise<Webhook> {
    const [result] = await this.db
      .update(webhooks)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.webhookId, webhookId))
      .returning();

    if (!result) {
      throw new Error("Webhook not found");
    }

    return result;
  }

  async incrementFailureCount(webhookId: string): Promise<Webhook> {
    const webhook = await this.findByWebhookId(webhookId);
    if (!webhook) {
      throw new Error("Webhook not found");
    }

    const [result] = await this.db
      .update(webhooks)
      .set({
        failureCount: webhook.failureCount + 1,
        lastFailureAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.webhookId, webhookId))
      .returning();

    return result;
  }

  async resetFailureCount(webhookId: string): Promise<Webhook> {
    const [result] = await this.db
      .update(webhooks)
      .set({
        failureCount: 0,
        lastSuccessAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.webhookId, webhookId))
      .returning();

    if (!result) {
      throw new Error("Webhook not found");
    }

    return result;
  }

  async delete(webhookId: string): Promise<boolean> {
    const result = await this.db
      .delete(webhooks)
      .where(eq(webhooks.webhookId, webhookId));

    return result.count > 0;
  }

  async findFailedWebhooks(threshold: number = 10): Promise<Webhook[]> {
    const result = await this.db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.status, "active"),
          sql`${webhooks.failureCount} >= ${threshold}`
        )
      );

    return result;
  }

  async countByMerchantId(merchantId: string, status?: string): Promise<number> {
    this.validateMerchantId(merchantId);

    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(webhooks)
      .where(eq(webhooks.merchantId, merchantId));

    if (status) {
      query = (query as any).where(
        and(
          eq(webhooks.merchantId, merchantId),
          eq(webhooks.status, status as any)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }
}

// Export singleton instance
let webhookRepositoryInstance: WebhookRepository | null = null;

export const getWebhookRepository = (): WebhookRepository => {
  if (!webhookRepositoryInstance) {
    webhookRepositoryInstance = new WebhookRepository();
  }
  return webhookRepositoryInstance;
};
