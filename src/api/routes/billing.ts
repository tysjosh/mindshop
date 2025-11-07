import { Router } from 'express';
import { BillingController } from '../controllers/BillingController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const billingController = new BillingController();

// Webhook endpoint (no authentication - verified by Stripe signature)
router.post(
  '/webhook',
  billingController.handleWebhook.bind(billingController)
);

// Protected routes (require JWT authentication)
router.post(
  '/:merchantId/billing/subscribe',
  authenticateJWT(),
  billingController.subscribe.bind(billingController)
);

router.get(
  '/:merchantId/billing/invoices',
  authenticateJWT(),
  billingController.getInvoices.bind(billingController)
);

router.get(
  '/:merchantId/billing/current',
  authenticateJWT(),
  billingController.getCurrentBilling.bind(billingController)
);

router.get(
  '/:merchantId/billing/payment-methods',
  authenticateJWT(),
  billingController.getPaymentMethods.bind(billingController)
);

router.post(
  '/:merchantId/billing/payment-methods',
  authenticateJWT(),
  billingController.addPaymentMethod.bind(billingController)
);

router.delete(
  '/:merchantId/billing/payment-methods/:paymentMethodId',
  authenticateJWT(),
  billingController.deletePaymentMethod.bind(billingController)
);

router.post(
  '/:merchantId/billing/upgrade',
  authenticateJWT(),
  billingController.upgradeSubscription.bind(billingController)
);

router.post(
  '/:merchantId/billing/cancel',
  authenticateJWT(),
  billingController.cancelSubscription.bind(billingController)
);

export default router;
