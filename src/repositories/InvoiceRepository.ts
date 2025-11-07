import { BaseRepository } from "./BaseRepository";
import { invoices, type Invoice, type NewInvoice } from "../database/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export class InvoiceRepository extends BaseRepository {
  async create(data: NewInvoice): Promise<Invoice> {
    this.validateMerchantId(data.merchantId);

    const [result] = await this.db
      .insert(invoices)
      .values(data)
      .returning();

    return result;
  }

  async findById(id: string): Promise<Invoice | null> {
    this.validateUUID(id);

    const result = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<Invoice | null> {
    const result = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .limit(1);

    return result[0] || null;
  }

  async findByMerchantId(
    merchantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Invoice[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.merchantId, merchantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findByMerchantIdAndStatus(
    merchantId: string,
    status: string
  ): Promise<Invoice[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.merchantId, merchantId),
          eq(invoices.status, status as any)
        )
      )
      .orderBy(desc(invoices.createdAt));

    return result;
  }

  async findByDateRange(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Invoice[]> {
    this.validateMerchantId(merchantId);

    const result = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.merchantId, merchantId),
          gte(invoices.createdAt, startDate),
          lte(invoices.createdAt, endDate)
        )
      )
      .orderBy(desc(invoices.createdAt));

    return result;
  }

  async update(stripeInvoiceId: string, data: Partial<NewInvoice>): Promise<Invoice> {
    const [result] = await this.db
      .update(invoices)
      .set(data)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .returning();

    if (!result) {
      throw new Error("Invoice not found");
    }

    return result;
  }

  async updateStatus(
    stripeInvoiceId: string,
    status: "draft" | "open" | "paid" | "void" | "uncollectible"
  ): Promise<Invoice> {
    const [result] = await this.db
      .update(invoices)
      .set({
        status,
      })
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .returning();

    if (!result) {
      throw new Error("Invoice not found");
    }

    return result;
  }

  async markAsPaid(stripeInvoiceId: string): Promise<Invoice> {
    const [result] = await this.db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: new Date(),
      })
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .returning();

    if (!result) {
      throw new Error("Invoice not found");
    }

    return result;
  }

  async delete(stripeInvoiceId: string): Promise<boolean> {
    const result = await this.db
      .delete(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId));

    return result.count > 0;
  }

  async getTotalRevenue(merchantId?: string): Promise<number> {
    let query = this.db
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    if (merchantId) {
      this.validateMerchantId(merchantId);
      query = (query as any).where(
        and(
          eq(invoices.merchantId, merchantId),
          eq(invoices.status, "paid")
        )
      );
    }

    const result = await query;
    return Number(result[0]?.total || 0);
  }

  async getRevenueByPeriod(
    startDate: Date,
    endDate: Date,
    merchantId?: string
  ): Promise<number> {
    let query = this.db
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startDate),
          lte(invoices.paidAt, endDate)
        )
      );

    if (merchantId) {
      this.validateMerchantId(merchantId);
      query = (query as any).where(
        and(
          eq(invoices.merchantId, merchantId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startDate),
          lte(invoices.paidAt, endDate)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.total || 0);
  }

  async countByMerchantId(merchantId: string, status?: string): Promise<number> {
    this.validateMerchantId(merchantId);

    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.merchantId, merchantId));

    if (status) {
      query = (query as any).where(
        and(
          eq(invoices.merchantId, merchantId),
          eq(invoices.status, status as any)
        )
      );
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.status, status as any));

    return Number(result[0]?.count || 0);
  }

  async findUnpaidInvoices(merchantId?: string): Promise<Invoice[]> {
    let query = this.db
      .select()
      .from(invoices)
      .where(eq(invoices.status, "open"))
      .orderBy(desc(invoices.createdAt));

    if (merchantId) {
      this.validateMerchantId(merchantId);
      query = (query as any).where(
        and(
          eq(invoices.merchantId, merchantId),
          eq(invoices.status, "open")
        )
      );
    }

    return query;
  }
}

// Export singleton instance
let invoiceRepositoryInstance: InvoiceRepository | null = null;

export const getInvoiceRepository = (): InvoiceRepository => {
  if (!invoiceRepositoryInstance) {
    invoiceRepositoryInstance = new InvoiceRepository();
  }
  return invoiceRepositoryInstance;
};
