# Billing Guide

## Overview

This comprehensive guide covers everything you need to know about billing and subscription management on the Merchant Platform. Learn how to subscribe to plans, manage payment methods, view invoices, and handle subscription changes.

---

## Table of Contents

1. [Pricing Plans](#pricing-plans)
2. [Getting Started](#getting-started)
3. [Subscription Management](#subscription-management)
4. [Payment Methods](#payment-methods)
5. [Invoices](#invoices)
6. [Usage Limits](#usage-limits)
7. [Webhooks](#webhooks)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Pricing Plans

### Starter Plan - $99/month

Perfect for small businesses and startups testing the RAG Assistant.

**Features:**
- 1,000 queries per month
- 100 documents
- 5,000 API calls per day
- 1 GB storage
- Email support
- 7-day data retention

**Best for:**
- Small e-commerce stores
- Testing and development
- Low-traffic websites

### Professional Plan - $499/month

Ideal for growing businesses with moderate traffic.

**Features:**
- 10,000 queries per month
- 1,000 documents
- 50,000 API calls per day
- 10 GB storage
- Priority support
- 30-day data retention
- Custom branding options

**Best for:**
- Medium-sized e-commerce stores
- Growing businesses
- Multiple product categories

### Enterprise Plan - Custom Pricing

For large businesses requiring unlimited resources and dedicated support.

**Features:**
- Unlimited queries
- Unlimited documents
- Unlimited API calls
- 1 TB storage
- 24/7 dedicated support
- Unlimited data retention
- SLA guarantees
- Custom integrations
- White-label options
- Dedicated account manager

**Best for:**
- Large e-commerce platforms
- Multi-brand retailers
- High-traffic websites
- Custom requirements

**Contact:** sales@example.com for enterprise pricing

---

## Getting Started

### Step 1: Create Your Account

1. Register at the [Developer Portal](https://portal.rag-assistant.com/register)
2. Verify your email address
3. Complete your company profile

During registration, a Stripe customer account is automatically created for you.

### Step 2: Choose Your Plan

1. Log in to the [Developer Portal](https://portal.rag-assistant.com)
2. Navigate to **Billing** in the sidebar
3. Review the available plans
4. Click **Subscribe** on your preferred plan

### Step 3: Add Payment Method

1. Enter your credit card information using our secure Stripe integration
2. Your card details are never stored on our servers
3. All payment processing is handled by Stripe (PCI DSS compliant)

### Step 4: Confirm Subscription

1. Review your subscription details
2. Confirm the billing cycle (monthly)
3. Click **Confirm Subscription**
4. You'll receive a confirmation email with your invoice

### Step 5: Start Using the API

Once subscribed, you can:
- Generate API keys
- Integrate the RAG Assistant
- Monitor your usage
- Access analytics

---

## Subscription Management

### Subscribing to a Plan

#### Via Developer Portal

1. Go to **Billing** → **Plans**
2. Click **Subscribe** on your chosen plan
3. Add a payment method if you haven't already
4. Confirm your subscription

#### Via API

```bash
curl -X POST https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/subscribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "professional",
    "paymentMethodId": "pm_1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1234567890",
    "status": "active",
    "currentPeriodStart": "2025-11-04T12:00:00.000Z",
    "currentPeriodEnd": "2025-12-04T12:00:00.000Z",
    "plan": "professional"
  }
}
```

### Upgrading Your Plan

Upgrade to a higher tier at any time. You'll be charged a prorated amount for the remainder of your billing period.

#### Via Developer Portal

1. Go to **Billing** → **Current Plan**
2. Click **Upgrade Plan**
3. Select your new plan
4. Confirm the upgrade

#### Via API

```bash
curl -X POST https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/upgrade \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "enterprise"
  }'
```

**Proration Example:**
- Current plan: Starter ($99/month)
- New plan: Professional ($499/month)
- Days remaining: 15 days
- Prorated charge: ~$200 (for remaining 15 days)

### Downgrading Your Plan

Downgrade to a lower tier at any time. The change takes effect at the end of your current billing period.

#### Via Developer Portal

1. Go to **Billing** → **Current Plan**
2. Click **Change Plan**
3. Select a lower-tier plan
4. Confirm the downgrade

The downgrade will be scheduled for the end of your billing period, allowing you to use your current plan's features until then.

### Canceling Your Subscription

You have two cancellation options:

#### Option 1: Cancel at Period End (Recommended)

Your subscription remains active until the end of your billing period. You retain full access to all features until then.

**Via Developer Portal:**
1. Go to **Billing** → **Current Plan**
2. Click **Cancel Subscription**
3. Select **Cancel at period end**
4. Confirm cancellation

**Via API:**
```bash
curl -X POST https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }'
```

**What happens:**
- ✅ Subscription remains active until period end
- ✅ Full access to all features
- ✅ No refund (you paid for the full period)
- ✅ Can reactivate before period ends
- ❌ No automatic renewal

#### Option 2: Cancel Immediately

Your subscription is canceled immediately, and you lose access to paid features right away.

**Via Developer Portal:**
1. Go to **Billing** → **Current Plan**
2. Click **Cancel Subscription**
3. Select **Cancel immediately**
4. Confirm cancellation

**Via API:**
```bash
curl -X POST https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": false
  }'
```

**What happens:**
- ❌ Immediate loss of access
- ❌ Account suspended
- ❌ No refund
- ❌ Must create new subscription to reactivate

### Reactivating a Canceled Subscription

If you canceled with `cancelAtPeriodEnd: true`, you can reactivate before the period ends:

1. Go to **Billing** → **Current Plan**
2. Click **Reactivate Subscription**
3. Confirm reactivation

If you canceled immediately, you must create a new subscription.

---

## Payment Methods

### Adding a Payment Method

#### Via Developer Portal

1. Go to **Billing** → **Payment Methods**
2. Click **Add Payment Method**
3. Enter your card details (processed securely by Stripe)
4. Optionally set as default payment method
5. Click **Save**

#### Via API

First, create a payment method using Stripe.js on your frontend:

```javascript
// Frontend code
const stripe = Stripe('pk_live_...');
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Create payment method
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
});

if (!error) {
  // Send payment method ID to your backend
  await addPaymentMethod(paymentMethod.id);
}
```

Then add it to your account:

```bash
curl -X POST https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/payment-methods \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethodId": "pm_1234567890",
    "setAsDefault": true
  }'
```

### Viewing Payment Methods

#### Via Developer Portal

1. Go to **Billing** → **Payment Methods**
2. View all saved payment methods
3. See which one is set as default

#### Via API

```bash
curl -X GET https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/payment-methods \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pm_1234567890",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025
      }
    }
  ]
}
```

### Removing a Payment Method

#### Via Developer Portal

1. Go to **Billing** → **Payment Methods**
2. Click the **Delete** icon next to the payment method
3. Confirm deletion

**Note:** You cannot delete your default payment method if you have an active subscription. Set another payment method as default first.

#### Via API

```bash
curl -X DELETE https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/payment-methods/pm_1234567890 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Updating Your Default Payment Method

1. Add a new payment method
2. Set it as default
3. Optionally remove the old payment method

All future invoices will be charged to your default payment method.

---

## Invoices

### Viewing Invoices

#### Via Developer Portal

1. Go to **Billing** → **Invoices**
2. View all past invoices
3. Filter by date range
4. Download PDF invoices

#### Via API

```bash
curl -X GET "https://api.example.com/api/merchants/YOUR_MERCHANT_ID/billing/invoices?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv_1234567890",
        "stripeInvoiceId": "in_1234567890",
        "amountDue": 49900,
        "amountPaid": 49900,
        "currency": "usd",
        "status": "paid",
        "invoicePdf": "https://invoice.stripe.com/...",
        "periodStart": "2025-11-01T00:00:00.000Z",
        "periodEnd": "2025-12-01T00:00:00.000Z",
        "paidAt": "2025-11-01T12:00:00.000Z"
      }
    ],
    "limit": 10,
    "offset": 0
  }
}
```

### Invoice Details

Each invoice includes:
- **Invoice ID**: Unique identifier
- **Amount**: Total amount charged
- **Status**: paid, open, void, uncollectible
- **Period**: Billing period covered
- **PDF**: Downloadable invoice PDF
- **Payment Date**: When payment was processed

### Failed Payments

If a payment fails:

1. You'll receive an email notification
2. Your account status changes to "past_due"
3. Stripe automatically retries the payment (3 attempts over 2 weeks)
4. Update your payment method to resolve the issue

**To resolve:**
1. Go to **Billing** → **Payment Methods**
2. Add a new payment method or update the existing one
3. Stripe will automatically retry the payment

If payment fails after all retries:
- Your subscription is canceled
- Your account is suspended
- You must create a new subscription to reactivate

---

## Usage Limits

### Understanding Your Limits

Each plan has specific usage limits:

| Metric | Starter | Professional | Enterprise |
|--------|---------|--------------|------------|
| Queries/month | 1,000 | 10,000 | Unlimited |
| Documents | 100 | 1,000 | Unlimited |
| API calls/day | 5,000 | 50,000 | Unlimited |
| Storage | 1 GB | 10 GB | 1 TB |

### Monitoring Usage

#### Via Developer Portal

1. Go to **Dashboard** → **Usage**
2. View real-time usage metrics
3. See percentage of limits used
4. View usage trends over time

#### Via API

```bash
curl -X GET https://api.example.com/api/merchants/YOUR_MERCHANT_ID/usage/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queries": {
      "count": 750,
      "limit": 1000,
      "percentage": 75
    },
    "documents": {
      "count": 45,
      "limit": 100,
      "percentage": 45
    },
    "apiCalls": {
      "count": 3200,
      "limit": 5000,
      "percentage": 64
    },
    "storageGb": {
      "count": 0.5,
      "limit": 1,
      "percentage": 50
    }
  }
}
```

### What Happens When You Exceed Limits

#### Soft Limits (Queries, Documents, Storage)

When you approach your limit (80%):
- You receive a warning email
- A webhook event is triggered: `usage.limit.approaching`
- Dashboard shows a warning banner

When you exceed your limit (100%):
- New requests are throttled (HTTP 429)
- You receive an email notification
- A webhook event is triggered: `usage.limit.exceeded`
- You're prompted to upgrade your plan

#### Hard Limits (API Calls per Day)

When you exceed your daily API call limit:
- Requests return HTTP 429 (Too Many Requests)
- Response includes `Retry-After` header
- Limit resets at midnight UTC
- Consider upgrading to a higher plan

### Upgrading When Limits Are Reached

1. Go to **Billing** → **Upgrade Plan**
2. Select a higher-tier plan
3. Confirm the upgrade
4. Your limits are immediately increased
5. You're charged a prorated amount

---

## Webhooks

### Billing Webhook Events

Subscribe to webhook events to automate your billing workflows:

#### Available Events

**Subscription Events:**
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription modified
- `customer.subscription.deleted` - Subscription canceled

**Invoice Events:**
- `invoice.created` - New invoice generated
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed
- `invoice.finalized` - Invoice finalized

**Payment Method Events:**
- `payment_method.attached` - Payment method added
- `payment_method.detached` - Payment method removed

**Usage Events:**
- `usage.limit.approaching` - Usage at 80% of limit
- `usage.limit.exceeded` - Usage limit exceeded

### Setting Up Webhooks

1. Go to **Developer Portal** → **Webhooks**
2. Click **Create Webhook**
3. Enter your webhook URL
4. Select events to subscribe to
5. Save your webhook

See the [Webhook Integration Guide](./webhook-integration.md) for detailed setup instructions.

### Example Webhook Handler

```javascript
app.post('/webhooks/billing', async (req, res) => {
  const event = req.body;

  switch (event.type) {
    case 'invoice.payment_succeeded':
      // Update internal records
      await updateSubscriptionStatus(event.data.merchantId, 'active');
      // Send confirmation email
      await sendPaymentConfirmation(event.data.merchantId);
      break;

    case 'invoice.payment_failed':
      // Notify merchant
      await sendPaymentFailureNotification(event.data.merchantId);
      // Suspend features if needed
      await suspendNonEssentialFeatures(event.data.merchantId);
      break;

    case 'usage.limit.exceeded':
      // Notify merchant
      await sendUsageLimitAlert(event.data.merchantId);
      // Suggest upgrade
      await suggestPlanUpgrade(event.data.merchantId);
      break;
  }

  res.status(200).json({ received: true });
});
```

---

## Best Practices

### 1. Choose the Right Plan

- Start with the Starter plan to test the integration
- Monitor your usage for the first month
- Upgrade when you consistently use >70% of your limits
- Don't wait until you hit 100% to upgrade

### 2. Set Up Billing Alerts

- Enable email notifications for billing events
- Set up webhooks to automate responses
- Monitor usage daily during your first month
- Set up internal alerts at 50%, 75%, and 90% usage

### 3. Manage Payment Methods

- Keep at least one backup payment method on file
- Update expiring cards before they expire
- Use business credit cards for better expense tracking
- Enable automatic payment retries

### 4. Plan for Growth

- Review usage trends monthly
- Upgrade proactively before hitting limits
- Consider annual billing for discounts (contact sales)
- Plan for seasonal traffic spikes

### 5. Optimize Costs

- Cache frequently requested data
- Implement client-side rate limiting
- Use webhooks instead of polling
- Archive old documents you no longer need
- Monitor and optimize query patterns

### 6. Handle Failed Payments

- Update payment methods immediately when notified
- Don't wait for automatic retries
- Keep billing contact information current
- Have a backup payment method ready

### 7. Cancellation Best Practices

- Always use "cancel at period end" unless urgent
- Export your data before canceling
- Document your integration for future reactivation
- Provide feedback to help us improve

---

## Troubleshooting

### Common Issues

#### "Billing information not found"

**Cause:** Stripe customer not created during registration

**Solution:**
1. Contact support at support@example.com
2. Provide your merchant ID
3. We'll manually create your Stripe customer

#### "Invalid payment method"

**Cause:** Payment method ID is invalid or expired

**Solution:**
1. Create a new payment method using Stripe.js
2. Ensure you're using the correct Stripe publishable key
3. Check that the payment method hasn't been deleted

#### "No Stripe price ID configured for plan"

**Cause:** Environment variables not set correctly

**Solution:**
- This is a server configuration issue
- Contact support immediately
- We'll verify the Stripe integration

#### "Payment failed"

**Causes:**
- Insufficient funds
- Card declined by bank
- Expired card
- Incorrect card details

**Solutions:**
1. Check with your bank
2. Try a different payment method
3. Update card details if expired
4. Contact support if issue persists

#### "Subscription already exists"

**Cause:** Trying to create a subscription when one already exists

**Solution:**
1. Check your current subscription status
2. Use the upgrade endpoint instead
3. Cancel existing subscription first if needed

#### "Access denied"

**Cause:** JWT token doesn't match merchant ID

**Solution:**
1. Ensure you're using the correct JWT token
2. Verify the merchant ID in the URL
3. Re-authenticate if token expired

### Getting Help

**Email Support:**
- support@example.com
- Response time: 24 hours (Starter/Professional)
- Response time: 4 hours (Enterprise)

**Documentation:**
- [API Reference](./api-reference.md)
- [Getting Started Guide](./getting-started.md)
- [Webhook Integration](./webhook-integration.md)

**Status Page:**
- https://status.example.com
- Check for ongoing incidents
- Subscribe to status updates

**Enterprise Support:**
- 24/7 phone support
- Dedicated Slack channel
- Dedicated account manager

---

## API Reference

### Quick Reference

All billing endpoints require JWT authentication.

**Base URL:** `https://api.example.com`

### Subscribe to Plan

```http
POST /api/merchants/:merchantId/billing/subscribe
```

**Body:**
```json
{
  "plan": "professional",
  "paymentMethodId": "pm_1234567890"
}
```

[Full documentation →](./billing-subscribe-endpoint.md)

### Get Current Billing Info

```http
GET /api/merchants/:merchantId/billing/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": "professional",
    "status": "active",
    "currentPeriodStart": "2025-11-01T00:00:00.000Z",
    "currentPeriodEnd": "2025-12-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

### Get Invoices

```http
GET /api/merchants/:merchantId/billing/invoices?limit=10&offset=0
```

### Add Payment Method

```http
POST /api/merchants/:merchantId/billing/payment-methods
```

**Body:**
```json
{
  "paymentMethodId": "pm_1234567890",
  "setAsDefault": true
}
```

### Delete Payment Method

```http
DELETE /api/merchants/:merchantId/billing/payment-methods/:paymentMethodId
```

### Upgrade/Downgrade Plan

```http
POST /api/merchants/:merchantId/billing/upgrade
```

**Body:**
```json
{
  "plan": "enterprise"
}
```

### Cancel Subscription

```http
POST /api/merchants/:merchantId/billing/cancel
```

**Body:**
```json
{
  "cancelAtPeriodEnd": true
}
```

[Full documentation →](./billing-cancel-endpoint.md)

---

## Additional Resources

- [Getting Started Guide](./getting-started.md) - Set up your account
- [API Reference](./api-reference.md) - Complete API documentation
- [Authentication Guide](./authentication.md) - JWT authentication
- [Webhook Integration](./webhook-integration.md) - Set up webhooks
- [Best Practices](./best-practices.md) - Optimization tips
- [Troubleshooting](./troubleshooting.md) - Common issues

---

## Feedback

We're constantly improving our billing system. If you have suggestions or encounter issues:

- Email: feedback@example.com
- Feature requests: https://feedback.example.com
- Bug reports: support@example.com

---

**Last Updated:** November 5, 2025  
**Version:** 1.0
