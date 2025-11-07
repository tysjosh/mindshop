import { Request, Response } from 'express';
import { getBillingService } from '../../services/BillingService';
import { getBillingInfoRepository } from '../../repositories/BillingInfoRepository';
import { getInvoiceRepository } from '../../repositories/InvoiceRepository';
import { getPaymentMethodRepository } from '../../repositories/PaymentMethodRepository';
import { ApiResponse } from '../../types';
import { AuthenticatedRequest } from '../middleware/auth';
import Stripe from 'stripe';

// Stripe API version constant
const STRIPE_API_VERSION = '2025-10-29.clover' as const;

/**
 * BillingController
 * 
 * Handles all billing-related operations for the merchant platform including:
 * - Subscription management (subscribe, upgrade, cancel)
 * - Invoice retrieval
 * - Payment method management
 * - Stripe webhook processing
 * 
 * All endpoints require JWT authentication except the webhook endpoint which
 * uses Stripe signature verification.
 */
export class BillingController {
  private billingService = getBillingService();
  private billingInfoRepository = getBillingInfoRepository();
  private invoiceRepository = getInvoiceRepository();
  private paymentMethodRepository = getPaymentMethodRepository();

  /**
   * Subscribe merchant to a plan
   * POST /api/merchants/:merchantId/billing/subscribe
   */
  async subscribe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { plan, paymentMethodId } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!plan || !paymentMethodId) {
        const response: ApiResponse = {
          success: false,
          error: 'Plan and payment method ID are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate plan
      const validPlans = ['starter', 'professional', 'enterprise'];
      if (!validPlans.includes(plan)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid plan. Must be one of: starter, professional, enterprise',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const subscription = await this.billingService.subscribe({
        merchantId,
        plan,
        paymentMethodId,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000) : undefined,
          currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined,
          plan,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Subscribe error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Subscription failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get merchant invoices
   * GET /api/merchants/:merchantId/billing/invoices
   */
  async getInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { limit = '10', offset = '0' } = req.query;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const invoices = await this.invoiceRepository.findByMerchantId(
        merchantId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      const response: ApiResponse = {
        success: true,
        data: {
          invoices,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get invoices error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get invoices',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get current billing information
   * GET /api/merchants/:merchantId/billing/current
   */
  async getCurrentBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const billingInfo = await this.billingInfoRepository.findByMerchantId(merchantId);

      if (!billingInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Billing information not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          plan: billingInfo.plan,
          status: billingInfo.status,
          currentPeriodStart: billingInfo.currentPeriodStart,
          currentPeriodEnd: billingInfo.currentPeriodEnd,
          cancelAtPeriodEnd: billingInfo.cancelAtPeriodEnd === 1,
          stripeCustomerId: billingInfo.stripeCustomerId,
          stripeSubscriptionId: billingInfo.stripeSubscriptionId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get current billing error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to get billing information',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Get payment methods
   * GET /api/merchants/:merchantId/billing/payment-methods
   */
  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const billingInfo = await this.billingInfoRepository.findByMerchantId(merchantId);
      if (!billingInfo) {
        const response: ApiResponse = {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(200).json(response);
        return;
      }

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_key')) {
        const response: ApiResponse = {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(200).json(response);
        return;
      }

      // Initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: STRIPE_API_VERSION,
      });

      // Get payment methods from Stripe
      const paymentMethods = await stripe.paymentMethods.list({
        customer: billingInfo.stripeCustomerId,
        type: 'card',
      });

      const formattedPaymentMethods = paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : undefined,
      }));

      const response: ApiResponse = {
        success: true,
        data: formattedPaymentMethods,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Get payment methods error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to retrieve payment methods',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Add payment method
   * POST /api/merchants/:merchantId/billing/payment-methods
   */
  async addPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { paymentMethodId, setAsDefault = false } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!paymentMethodId) {
        const response: ApiResponse = {
          success: false,
          error: 'Payment method ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const billingInfo = await this.billingInfoRepository.findByMerchantId(merchantId);
      if (!billingInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Billing information not found. Please create a customer first.',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(404).json(response);
        return;
      }

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_key')) {
        const response: ApiResponse = {
          success: false,
          error: 'Stripe is not configured. Please configure Stripe to add payment methods.',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(503).json(response);
        return;
      }

      // Initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: STRIPE_API_VERSION,
      });

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: billingInfo.stripeCustomerId,
      });

      // Set as default if requested
      if (setAsDefault) {
        await stripe.customers.update(billingInfo.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Get payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      const response: ApiResponse = {
        success: true,
        data: {
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            expMonth: paymentMethod.card.exp_month,
            expYear: paymentMethod.card.exp_year,
          } : undefined,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Add payment method error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to add payment method',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Delete payment method
   * DELETE /api/merchants/:merchantId/billing/payment-methods/:paymentMethodId
   */
  async deletePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId, paymentMethodId } = req.params;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_key')) {
        const response: ApiResponse = {
          success: false,
          error: 'Stripe is not configured',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(503).json(response);
        return;
      }

      // Initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: STRIPE_API_VERSION,
      });

      // Detach payment method
      await stripe.paymentMethods.detach(paymentMethodId);

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Payment method deleted successfully',
          paymentMethodId,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Delete payment method error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to delete payment method',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Upgrade/downgrade subscription
   * POST /api/merchants/:merchantId/billing/upgrade
   */
  async upgradeSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { plan } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      // Validate required fields
      if (!plan) {
        const response: ApiResponse = {
          success: false,
          error: 'Plan is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Validate plan
      const validPlans = ['starter', 'professional', 'enterprise'];
      if (!validPlans.includes(plan)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid plan. Must be one of: starter, professional, enterprise',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      const subscription = await this.billingService.updateSubscription({
        merchantId,
        plan,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000) : undefined,
          currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined,
          plan,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Upgrade subscription error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to upgrade subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Cancel subscription
   * POST /api/merchants/:merchantId/billing/cancel
   */
  async cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { cancelAtPeriodEnd = true } = req.body;

      // Validate merchant access
      if (req.user?.merchantId !== merchantId && !req.user?.roles?.includes('admin')) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(403).json(response);
        return;
      }

      const subscription = await this.billingService.cancelSubscription({
        merchantId,
        cancelAtPeriodEnd,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined,
          message: cancelAtPeriodEnd
            ? 'Subscription will be canceled at the end of the billing period'
            : 'Subscription canceled immediately',
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Failed to cancel subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(400).json(response);
    }
  }

  /**
   * Handle Stripe webhook
   * POST /api/billing/webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing stripe-signature header',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_key')) {
        const response: ApiResponse = {
          success: false,
          error: 'Stripe is not configured',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(503).json(response);
        return;
      }

      // Initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: STRIPE_API_VERSION,
      });

      // Verify webhook signature
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        const response: ApiResponse = {
          success: false,
          error: 'Webhook signature verification failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };
        res.status(400).json(response);
        return;
      }

      // Handle the event
      await this.billingService.handleWebhook(event);

      const response: ApiResponse = {
        success: true,
        data: {
          received: true,
          eventType: event.type,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Webhook handler error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Webhook processing failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };
      res.status(500).json(response);
    }
  }
}
