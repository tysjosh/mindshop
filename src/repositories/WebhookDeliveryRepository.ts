import { BaseRepository } from "./BaseRepository";
import { webhookDeliveries, type WebhookDelivery, type NewWebhookDelivery } from "../database/schema";
import { eq, and, desc, sql, lte, isNull, isNotNull } from "drizzle-orm";

export class WebhookDeliveryRepository extends BaseRepository {
  async create(data: NewWebhookDelivery): Promise<WebhookDelivery> {
    const [result] = await this.db
      .insert(webhookDeliveries)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<WebhookDelivery | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByWebhookId(
    webhookId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    const result = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
    const result = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, "pending"),
          sql`(${webhookDeliveries.nextRetryAt} IS NULL OR ${webhookDeliveries.nextRetryAt} <= NOW())`
        )
      )
      .orderBy(webhookDeliveries.createdAt)
      .limit(limit);

    return result;
  }

  async findFailedDeliveries(
    webhookId?: string,
    limit: number = 100
  ): Promise<WebhookDelivery[]> {
    let query = this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, "failed"))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);

    if (webhookId) {
      query = (query as any).where(
        and(
          eq(webhookDeliveries.webhookId, webhookId),
          eq(webhookDeliveries.status, "failed")
        )
      );
    }

    return query;
  }

  async update(id: string, data: Partial<NewWebhookDelivery>): Promise<WebhookDelivery> {
    this.validateUUID(id);

    const [result] = await this.db
      .update(webhookDeliveries)
      .set(data)
      .where(eq(webhookDeliveries.id, id))
      .returning();

    if (!result) {
      throw new Error("Webhook delivery not found");
    }

    return result;
  }

  async markAsSuccess(
    id: string,
    statusCode: number,
    responseBody?: string
  ): Promise<WebhookDelivery> {
    this.validateUUID(id);

    const [result] = await this.db
      .update(webhookDeliveries)
      .set({
        status: "success",
        statusCode,
        responseBody,
        deliveredAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, id))
      .returning();

    if (!result) {
      throw new Error("Webhook delivery not found");
    }

    return result;
  }

  async markAsFailed(
    id: string,
    statusCode: number | null,
    responseBody: string,
    nextRetryAt?: Date
  ): Promise<WebhookDelivery> {
    this.validateUUID(id);

    const delivery = await this.findById(id);
    if (!delivery) {
      throw new Error("Webhook delivery not found");
    }

    const [result] = await this.db
      .update(webhookDeliveries)
      .set({
        status: nextRetryAt ? "pending" : "failed",
        statusCode,
        responseBody,
        attemptCount: delivery.attemptCount + 1,
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, id))
      .returning();

    return result;
  }

  async incrementAttemptCount(id: string): Promise<WebhookDelivery> {
    this.validateUUID(id);

    const delivery = await this.findById(id);
    if (!delivery) {
      throw new Error("Webhook delivery not found");
    }

    const [result] = await this.db
      .update(webhookDeliveries)
      .set({
        attemptCount: delivery.attemptCount + 1,
      })
      .where(eq(webhookDeliveries.id, id))
      .returning();

    return result;
  }

  async delete(id: string): Promise<boolean> {
    this.validateUUID(id);

    const result = await this.db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id));

    return result.count > 0;
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db
      .delete(webhookDeliveries)
      .where(lte(webhookDeliveries.createdAt, cutoffDate));

    return result.count;
  }

  async getDeliveryStats(webhookId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    avgAttemptCount: number;
  }> {
    const result = await this.db
      .select({
        totalDeliveries: sql<number>`count(*)`,
        successfulDeliveries: sql<number>`count(*) FILTER (WHERE ${webhookDeliveries.status} = 'success')`,
        failedDeliveries: sql<number>`count(*) FILTER (WHERE ${webhookDeliveries.status} = 'failed')`,
        pendingDeliveries: sql<number>`count(*) FILTER (WHERE ${webhookDeliveries.status} = 'pending')`,
        avgAttemptCount: sql<number>`avg(${webhookDeliveries.attemptCount})`,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId));

    return {
      totalDeliveries: Number(result[0]?.totalDeliveries || 0),
      successfulDeliveries: Number(result[0]?.successfulDeliveries || 0),
      failedDeliveries: Number(result[0]?.failedDeliveries || 0),
      pendingDeliveries: Number(result[0]?.pendingDeliveries || 0),
      avgAttemptCount: Number(result[0]?.avgAttemptCount || 0),
    };
  }

  async countByWebhookId(webhookId: string, status?: string): Promise<number> {
    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId));

    if (status) {
      query = (query as any).where(
        and(
          eq(webhookDeliveries.webhookId, webhookId),
          eq(webhookDeliveries.status, status as any)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }
}

// Export singleton instance
let webhookDeliveryRepositoryInstance: WebhookDeliveryRepository | null = null;

export const getWebhookDeliveryRepository = (): WebhookDeliveryRepository => {
  if (!webhookDeliveryRepositoryInstance) {
    webhookDeliveryRepositoryInstance = new WebhookDeliveryRepository();
  }
  return webhookDeliveryRepositoryInstance;
};
