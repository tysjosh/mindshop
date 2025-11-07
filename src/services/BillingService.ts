import Stripe from 'stripe';
import { getBillingInfoRepository } from '../repositories/BillingInfoRepository';
import { getInvoiceRepository } from '../repositories/InvoiceRepository';
import { getPaymentMethodRepository } from '../repositories/PaymentMethodRepository';
import { getUsageLimitsRepository } from '../repositories/UsageLimitsRepository';
import { getMerchantRepository } from '../repositories/MerchantRepository';

export interface CreateCustomerData {
  merchantId: string;
  email: string;
  companyName: string;
}

export interface SubscribeData {
  merchantId: string;
  plan: 'starter' | 'professional' | 'enterprise';
  paymentMethodId: string;
}

export interface UpdateSubscriptionData {
  merchantId: string;
  plan: 'starter' | 'professional' | 'enterprise';
}

export interface CancelSubscriptionData {
  merchantId: string;
  cancelAtPeriodEnd?: boolean;
}

export class BillingService {
  private stripe: Stripe;
  private billingInfoRepository = getBillingInfoRepository();
  private invoiceRepository = getInvoiceRepository();
  private paymentMethodRepository = getPaymentMethodRepository();
  private usageLimitsRepository = getUsageLimitsRepository();
  private merchantRepository = getMerchantRepository();

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  /**
   * Create a Stripe customer for a merchant
   */
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    // Check if customer already exists
    const existingBillingInfo = await this.billingInfoRepository.findByMerchantId(data.merchantId);
    if (existingBillingInfo) {
      throw new Error('Customer already exists for this merchant');
    }

    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email: data.email,
      name: data.companyName,
      metadata: {
        merchantId: data.merchantId,
      },
    });

    // Store in database
    await this.billingInfoRepository.create({
      merchantId: data.merchantId,
      stripeCustomerId: customer.id,
      plan: 'starter',
      status: 'trialing',
      cancelAtPeriodEnd: 0, // false
    });

    return customer;
  }

  /**
   * Subscribe a merchant to a plan
   */
  async subscribe(data: SubscribeData): Promise<Stripe.Subscription> {
    const billingInfo = await this.billingInfoRepository.findByMerchantId(data.merchantId);
    if (!billingInfo) {
      throw new Error('Billing information not found. Please create a customer first.');
    }

    // Get price ID for plan
    const priceId = this.getPriceId(data.plan);

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: billingInfo.stripeCustomerId,
    });

    // Set as default payment method
    await this.stripe.customers.update(billingInfo.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: billingInfo.stripeCustomerId,
      items: [{ price: priceId }],
      metadata: {
        merchantId: data.merchantId,
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Update database
    await this.billingInfoRepository.update(data.merchantId, {
      stripeSubscriptionId: subscription.id,
      plan: data.plan,
      status: subscription.status as 'active' | 'past_due' | 'canceled' | 'trialing',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    });

    // Update merchant plan
    await this.merchantRepository.update(data.merchantId, {
      plan: data.plan,
    });

    // Update usage limits based on plan
    await this.updateUsageLimits(data.merchantId, data.plan);

    return subscription;
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(data: UpdateSubscriptionData): Promise<Stripe.Subscription> {
    const billingInfo = await this.billingInfoRepository.findByMerchantId(data.merchantId);
    if (!billingInfo || !billingInfo.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Get current subscription
    const subscription = await this.stripe.subscriptions.retrieve(billingInfo.stripeSubscriptionId);

    // Get new price ID
    const newPriceId = this.getPriceId(data.plan);

    // Update subscription
    const updatedSubscription = await this.stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        merchantId: data.merchantId,
        previousPlan: billingInfo.plan,
        newPlan: data.plan,
      },
    });

    // Update database
    await this.billingInfoRepository.update(data.merchantId, {
      plan: data.plan,
      status: updatedSubscription.status as 'active' | 'past_due' | 'canceled' | 'trialing',
      currentPeriodStart: new Date((updatedSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((updatedSubscription as any).current_period_end * 1000),
    });

    // Update merchant plan
    await this.merchantRepository.update(data.merchantId, {
      plan: data.plan,
    });

    // Update usage limits
    await this.updateUsageLimits(data.merchantId, data.plan);

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(data: CancelSubscriptionData): Promise<Stripe.Subscription> {
    const billingInfo = await this.billingInfoRepository.findByMerchantId(data.merchantId);
    if (!billingInfo || !billingInfo.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    let canceledSubscription: Stripe.Subscription;

    if (data.cancelAtPeriodEnd) {
      // Cancel at end of billing period
      canceledSubscription = await this.stripe.subscriptions.update(billingInfo.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update database
      await this.billingInfoRepository.update(data.merchantId, {
        cancelAtPeriodEnd: 1, // true
      });
    } else {
      // Cancel immediately
      canceledSubscription = await this.stripe.subscriptions.cancel(billingInfo.stripeSubscriptionId);

      // Update database
      await this.billingInfoRepository.update(data.merchantId, {
        status: 'canceled',
        cancelAtPeriodEnd: 0, // false
      });

      // Update merchant status
      await this.merchantRepository.update(data.merchantId, {
        status: 'suspended',
      });
    }

    return canceledSubscription;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const merchantId = invoice.metadata?.merchantId;
    if (!merchantId) {
      console.warn('Invoice payment succeeded but no merchantId in metadata');
      return;
    }

    // Store invoice in database
    await this.invoiceRepository.create({
      merchantId,
      stripeInvoiceId: invoice.id,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
      invoicePdf: invoice.invoice_pdf || undefined,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      paidAt: new Date(),
    });

    // Update billing status to active
    await this.billingInfoRepository.update(merchantId, {
      status: 'active',
    });

    // Update merchant status to active if it was suspended
    const merchant = await this.merchantRepository.findByMerchantId(merchantId);
    if (merchant && merchant.status === 'suspended') {
      await this.merchantRepository.update(merchantId, {
        status: 'active',
      });
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const merchantId = invoice.metadata?.merchantId;
    if (!merchantId) {
      console.warn('Invoice payment failed but no merchantId in metadata');
      return;
    }

    // Store invoice in database
    await this.invoiceRepository.create({
      merchantId,
      stripeInvoiceId: invoice.id,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
      invoicePdf: invoice.invoice_pdf || undefined,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
    });

    // Update billing status to past_due
    await this.billingInfoRepository.update(merchantId, {
      status: 'past_due',
    });

    // TODO: Send notification to merchant about payment failure
    console.log(`Payment failed for merchant ${merchantId}. Notification should be sent.`);
  }

  /**
   * Handle subscription update
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const merchantId = subscription.metadata?.merchantId;
    if (!merchantId) {
      console.warn('Subscription updated but no merchantId in metadata');
      return;
    }

    // Update billing info
    await this.billingInfoRepository.update(merchantId, {
      status: subscription.status as 'active' | 'past_due' | 'canceled' | 'trialing',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ? 1 : 0,
    });
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const merchantId = subscription.metadata?.merchantId;
    if (!merchantId) {
      console.warn('Subscription deleted but no merchantId in metadata');
      return;
    }

    // Update billing info
    await this.billingInfoRepository.update(merchantId, {
      status: 'canceled',
      cancelAtPeriodEnd: 0,
    });

    // Suspend merchant account
    await this.merchantRepository.update(merchantId, {
      status: 'suspended',
    });
  }

  /**
   * Handle payment method attached
   */
  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (!paymentMethod.customer) {
      return;
    }

    // Get merchant from customer
    const customer = await this.stripe.customers.retrieve(paymentMethod.customer as string);
    if (customer.deleted) {
      return;
    }

    const merchantId = customer.metadata?.merchantId;
    if (!merchantId) {
      return;
    }

    // Store payment method in database
    await this.paymentMethodRepository.create({
      merchantId,
      stripePaymentMethodId: paymentMethod.id,
      type: paymentMethod.type as 'card' | 'bank_account',
      last4: paymentMethod.card?.last4 || paymentMethod.us_bank_account?.last4,
      brand: paymentMethod.card?.brand,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
      isDefault: 0, // Will be updated if set as default
    });
  }

  /**
   * Handle payment method detached
   */
  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    // Delete payment method from database
    await this.paymentMethodRepository.delete(paymentMethod.id);
  }

  /**
   * Get Stripe price ID for a plan
   */
  private getPriceId(plan: string): string {
    const priceIds: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER || '',
      professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      throw new Error(`No Stripe price ID configured for plan: ${plan}`);
    }

    return priceId;
  }

  /**
   * Update usage limits based on plan
   */
  private async updateUsageLimits(merchantId: string, plan: string): Promise<void> {
    const limits: Record<string, {
      queriesPerMonth: number;
      documentsMax: number;
      apiCallsPerDay: number;
      storageGbMax: number;
    }> = {
      starter: {
        queriesPerMonth: 1000,
        documentsMax: 100,
        apiCallsPerDay: 5000,
        storageGbMax: 1,
      },
      professional: {
        queriesPerMonth: 10000,
        documentsMax: 1000,
        apiCallsPerDay: 50000,
        storageGbMax: 10,
      },
      enterprise: {
        queriesPerMonth: 999999999,
        documentsMax: 999999999,
        apiCallsPerDay: 999999999,
        storageGbMax: 1000,
      },
    };

    const planLimits = limits[plan];
    if (!planLimits) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    // Check if usage limits already exist
    const existingLimits = await this.usageLimitsRepository.findByMerchantId(merchantId);

    if (existingLimits) {
      // Update existing limits
      await this.usageLimitsRepository.update(merchantId, {
        plan: plan as 'starter' | 'professional' | 'enterprise',
        ...planLimits,
      });
    } else {
      // Create new limits
      await this.usageLimitsRepository.create({
        merchantId,
        plan: plan as 'starter' | 'professional' | 'enterprise',
        ...planLimits,
      });
    }
  }
}

// Export singleton instance
let billingServiceInstance: BillingService | null = null;

export const getBillingService = (): BillingService => {
  if (!billingServiceInstance) {
    billingServiceInstance = new BillingService();
  }
  return billingServiceInstance;
};
