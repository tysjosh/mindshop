/**
 * Unit tests for BillingService
 * Tests Stripe integration, subscription management, and webhook handling
 *
 * Requirements: 10.1 Stripe Integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Stripe from "stripe";

// Mock Stripe
vi.mock("stripe", () => {
  const mockStripe = {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    paymentMethods: {
      attach: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
  };
});

// Mock repositories
const billingInfoStore = new Map<string, any>();
const invoiceStore = new Map<string, any>();
const paymentMethodStore = new Map<string, any>();
const usageLimitsStore = new Map<string, any>();
const merchantStore = new Map<string, any>();

vi.mock("../repositories/BillingInfoRepository", () => ({
  getBillingInfoRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockImplementation((merchantId: string) => {
      return Promise.resolve(billingInfoStore.get(merchantId) || null);
    }),
    create: vi.fn().mockImplementation((data: any) => {
      const billingInfo = {
        id: "billing_" + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      billingInfoStore.set(data.merchantId, billingInfo);
      return Promise.resolve(billingInfo);
    }),
    update: vi.fn().mockImplementation((merchantId: string, data: any) => {
      const existing = billingInfoStore.get(merchantId);
      if (!existing) {
        throw new Error("Billing info not found");
      }
      const updated = { ...existing, ...data, updatedAt: new Date() };
      billingInfoStore.set(merchantId, updated);
      return Promise.resolve(updated);
    }),
  })),
}));

vi.mock("../repositories/InvoiceRepository", () => ({
  getInvoiceRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data: any) => {
      const invoice = {
        id: "invoice_" + Date.now(),
        ...data,
        createdAt: new Date(),
      };
      invoiceStore.set(data.stripeInvoiceId, invoice);
      return Promise.resolve(invoice);
    }),
  })),
}));

vi.mock("../repositories/PaymentMethodRepository", () => ({
  getPaymentMethodRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data: any) => {
      const paymentMethod = {
        id: "pm_" + Date.now(),
        ...data,
        createdAt: new Date(),
      };
      paymentMethodStore.set(data.stripePaymentMethodId, paymentMethod);
      return Promise.resolve(paymentMethod);
    }),
    delete: vi.fn().mockImplementation((stripePaymentMethodId: string) => {
      const deleted = paymentMethodStore.delete(stripePaymentMethodId);
      return Promise.resolve(deleted);
    }),
  })),
}));

vi.mock("../repositories/UsageLimitsRepository", () => ({
  getUsageLimitsRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockImplementation((merchantId: string) => {
      return Promise.resolve(usageLimitsStore.get(merchantId) || null);
    }),
    create: vi.fn().mockImplementation((data: any) => {
      const limits = {
        id: "limits_" + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usageLimitsStore.set(data.merchantId, limits);
      return Promise.resolve(limits);
    }),
    update: vi.fn().mockImplementation((merchantId: string, data: any) => {
      const existing = usageLimitsStore.get(merchantId);
      if (!existing) {
        throw new Error("Usage limits not found");
      }
      const updated = { ...existing, ...data, updatedAt: new Date() };
      usageLimitsStore.set(merchantId, updated);
      return Promise.resolve(updated);
    }),
  })),
}));

vi.mock("../repositories/MerchantRepository", () => ({
  getMerchantRepository: vi.fn(() => ({
    findByMerchantId: vi.fn().mockImplementation((merchantId: string) => {
      return Promise.resolve(
        merchantStore.get(merchantId) || {
          merchantId,
          email: "test@example.com",
          companyName: "Test Company",
          status: "active",
          plan: "starter",
        }
      );
    }),
    update: vi.fn().mockImplementation((merchantId: string, data: any) => {
      const existing = merchantStore.get(merchantId) || {
        merchantId,
        email: "test@example.com",
        companyName: "Test Company",
        status: "active",
        plan: "starter",
      };
      const updated = { ...existing, ...data };
      merchantStore.set(merchantId, updated);
      return Promise.resolve(updated);
    }),
  })),
}));

// Set environment variables
process.env.STRIPE_SECRET_KEY = "sk_test_123456789";
process.env.STRIPE_PRICE_STARTER = "price_starter_123";
process.env.STRIPE_PRICE_PROFESSIONAL = "price_professional_123";
process.env.STRIPE_PRICE_ENTERPRISE = "price_enterprise_123";

import { BillingService } from "../services/BillingService";

describe("BillingService", () => {
  let billingService: BillingService;
  let mockStripe: any;

  beforeEach(() => {
    // Clear stores
    billingInfoStore.clear();
    invoiceStore.clear();
    paymentMethodStore.clear();
    usageLimitsStore.clear();
    merchantStore.clear();

    // Create service instance
    billingService = new BillingService();

    // Get mock Stripe instance
    mockStripe = (Stripe as any).mock.results[0].value;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createCustomer", () => {
    it("should create a Stripe customer and billing info", async () => {
      const customerData = {
        merchantId: "merchant_123",
        email: "test@example.com",
        companyName: "Test Company",
      };

      const mockCustomer = {
        id: "cus_123",
        email: customerData.email,
        name: customerData.companyName,
        metadata: { merchantId: customerData.merchantId },
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await billingService.createCustomer(customerData);

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: customerData.email,
        name: customerData.companyName,
        metadata: { merchantId: customerData.merchantId },
      });

      // Verify billing info was created
      const billingInfo = billingInfoStore.get(customerData.merchantId);
      expect(billingInfo).toBeDefined();
      expect(billingInfo.stripeCustomerId).toBe(mockCustomer.id);
      expect(billingInfo.plan).toBe("starter");
      expect(billingInfo.status).toBe("trialing");
    });

    it("should throw error if customer already exists", async () => {
      const customerData = {
        merchantId: "merchant_123",
        email: "test@example.com",
        companyName: "Test Company",
      };

      // Pre-populate billing info
      billingInfoStore.set(customerData.merchantId, {
        merchantId: customerData.merchantId,
        stripeCustomerId: "cus_existing",
      });

      await expect(billingService.createCustomer(customerData)).rejects.toThrow(
        "Customer already exists for this merchant"
      );
    });
  });

  describe("subscribe", () => {
    it("should create a subscription and update billing info", async () => {
      const subscribeData = {
        merchantId: "merchant_123",
        plan: "professional" as const,
        paymentMethodId: "pm_123",
      };

      // Setup existing billing info
      billingInfoStore.set(subscribeData.merchantId, {
        merchantId: subscribeData.merchantId,
        stripeCustomerId: "cus_123",
        plan: "starter",
        status: "trialing",
      });

      const mockSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
        items: {
          data: [{ price: { id: "price_professional_123" } }],
        },
      };

      mockStripe.paymentMethods.attach.mockResolvedValue({});
      mockStripe.customers.update.mockResolvedValue({});
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.subscribe(subscribeData);

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith("pm_123", {
        customer: "cus_123",
      });
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        items: [{ price: "price_professional_123" }],
        metadata: { merchantId: subscribeData.merchantId },
        expand: ["latest_invoice.payment_intent"],
      });

      // Verify billing info was updated
      const billingInfo = billingInfoStore.get(subscribeData.merchantId);
      expect(billingInfo.stripeSubscriptionId).toBe(mockSubscription.id);
      expect(billingInfo.plan).toBe("professional");
      expect(billingInfo.status).toBe("active");

      // Verify usage limits were created
      const usageLimits = usageLimitsStore.get(subscribeData.merchantId);
      expect(usageLimits).toBeDefined();
      expect(usageLimits.queriesPerMonth).toBe(10000);
      expect(usageLimits.documentsMax).toBe(1000);
    });

    it("should throw error if billing info not found", async () => {
      const subscribeData = {
        merchantId: "merchant_123",
        plan: "professional" as const,
        paymentMethodId: "pm_123",
      };

      await expect(billingService.subscribe(subscribeData)).rejects.toThrow(
        "Billing information not found"
      );
    });
  });

  describe("updateSubscription", () => {
    it("should update subscription plan", async () => {
      const updateData = {
        merchantId: "merchant_123",
        plan: "enterprise" as const,
      };

      // Setup existing billing info with subscription
      billingInfoStore.set(updateData.merchantId, {
        merchantId: updateData.merchantId,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        plan: "professional",
        status: "active",
      });

      const mockSubscription = {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: {
          data: [{ id: "si_123", price: { id: "price_professional_123" } }],
        },
      };

      const mockUpdatedSubscription = {
        ...mockSubscription,
        items: {
          data: [{ id: "si_123", price: { id: "price_enterprise_123" } }],
        },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const result = await billingService.updateSubscription(updateData);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        items: [
          {
            id: "si_123",
            price: "price_enterprise_123",
          },
        ],
        proration_behavior: "create_prorations",
        metadata: {
          merchantId: updateData.merchantId,
          previousPlan: "professional",
          newPlan: "enterprise",
        },
      });

      // Verify billing info was updated
      const billingInfo = billingInfoStore.get(updateData.merchantId);
      expect(billingInfo.plan).toBe("enterprise");

      // Verify usage limits were updated
      const usageLimits = usageLimitsStore.get(updateData.merchantId);
      expect(usageLimits.queriesPerMonth).toBe(999999999);
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription at period end", async () => {
      const cancelData = {
        merchantId: "merchant_123",
        cancelAtPeriodEnd: true,
      };

      // Setup existing billing info with subscription
      billingInfoStore.set(cancelData.merchantId, {
        merchantId: cancelData.merchantId,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        plan: "professional",
        status: "active",
      });

      const mockSubscription = {
        id: "sub_123",
        cancel_at_period_end: true,
      };

      mockStripe.subscriptions.update.mockResolvedValue(mockSubscription);

      const result = await billingService.cancelSubscription(cancelData);

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });

      // Verify billing info was updated
      const billingInfo = billingInfoStore.get(cancelData.merchantId);
      expect(billingInfo.cancelAtPeriodEnd).toBe(1);
    });

    it("should cancel subscription immediately", async () => {
      const cancelData = {
        merchantId: "merchant_123",
        cancelAtPeriodEnd: false,
      };

      // Setup existing billing info with subscription
      billingInfoStore.set(cancelData.merchantId, {
        merchantId: cancelData.merchantId,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        plan: "professional",
        status: "active",
      });

      const mockSubscription = {
        id: "sub_123",
        status: "canceled",
      };

      mockStripe.subscriptions.cancel.mockResolvedValue(mockSubscription);

      const result = await billingService.cancelSubscription(cancelData);

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith("sub_123");

      // Verify billing info was updated
      const billingInfo = billingInfoStore.get(cancelData.merchantId);
      expect(billingInfo.status).toBe("canceled");

      // Verify merchant was suspended
      const merchant = merchantStore.get(cancelData.merchantId);
      expect(merchant.status).toBe("suspended");
    });
  });

  describe("handleWebhook", () => {
    it("should handle invoice.payment_succeeded event", async () => {
      const merchantId = "merchant_123";
      const invoice = {
        id: "in_123",
        amount_due: 9900,
        amount_paid: 9900,
        currency: "usd",
        status: "paid",
        invoice_pdf: "https://example.com/invoice.pdf",
        period_start: Math.floor(Date.now() / 1000),
        period_end: Math.floor(Date.now() / 1000) + 2592000,
        metadata: { merchantId },
      };

      const event = {
        type: "invoice.payment_succeeded",
        data: { object: invoice },
      } as Stripe.Event;

      // Setup billing info
      billingInfoStore.set(merchantId, {
        merchantId,
        stripeCustomerId: "cus_123",
        status: "past_due",
      });

      await billingService.handleWebhook(event);

      // Verify invoice was created
      const storedInvoice = invoiceStore.get(invoice.id);
      expect(storedInvoice).toBeDefined();
      expect(storedInvoice.amountPaid).toBe(9900);

      // Verify billing status was updated
      const billingInfo = billingInfoStore.get(merchantId);
      expect(billingInfo.status).toBe("active");
    });

    it("should handle invoice.payment_failed event", async () => {
      const merchantId = "merchant_123";
      const invoice = {
        id: "in_123",
        amount_due: 9900,
        amount_paid: 0,
        currency: "usd",
        status: "open",
        period_start: Math.floor(Date.now() / 1000),
        period_end: Math.floor(Date.now() / 1000) + 2592000,
        metadata: { merchantId },
      };

      const event = {
        type: "invoice.payment_failed",
        data: { object: invoice },
      } as Stripe.Event;

      // Setup billing info
      billingInfoStore.set(merchantId, {
        merchantId,
        stripeCustomerId: "cus_123",
        status: "active",
      });

      await billingService.handleWebhook(event);

      // Verify invoice was created
      const storedInvoice = invoiceStore.get(invoice.id);
      expect(storedInvoice).toBeDefined();

      // Verify billing status was updated
      const billingInfo = billingInfoStore.get(merchantId);
      expect(billingInfo.status).toBe("past_due");
    });

    it("should handle customer.subscription.deleted event", async () => {
      const merchantId = "merchant_123";
      const subscription = {
        id: "sub_123",
        status: "canceled",
        metadata: { merchantId },
      };

      const event = {
        type: "customer.subscription.deleted",
        data: { object: subscription },
      } as Stripe.Event;

      // Setup billing info
      billingInfoStore.set(merchantId, {
        merchantId,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        status: "active",
      });

      await billingService.handleWebhook(event);

      // Verify billing status was updated
      const billingInfo = billingInfoStore.get(merchantId);
      expect(billingInfo.status).toBe("canceled");

      // Verify merchant was suspended
      const merchant = merchantStore.get(merchantId);
      expect(merchant.status).toBe("suspended");
    });
  });
});
