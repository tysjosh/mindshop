# Billing Subscribe Endpoint Documentation

## Overview

The billing subscribe endpoint allows merchants to subscribe to a pricing plan using Stripe as the payment processor.

## Endpoint Details

**URL:** `POST /api/merchants/:merchantId/billing/subscribe`

**Authentication:** Required (JWT Bearer Token)

**Rate Limit:** 10 requests/minute per merchant

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| merchantId | string | Yes | The unique identifier for the merchant |

### Request Body

```json
{
  "plan": "professional",
  "paymentMethodId": "pm_1234567890"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| plan | string | Yes | The subscription plan: `starter`, `professional`, or `enterprise` |
| paymentMethodId | string | Yes | Stripe payment method ID (obtained from Stripe.js) |

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1234567890",
    "status": "active",
    "currentPeriodStart": "2025-11-04T12:00:00.000Z",
    "currentPeriodEnd": "2025-12-04T12:00:00.000Z",
    "plan": "professional"
  },
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "success": false,
  "error": "Plan and payment method ID are required",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

#### 400 Bad Request - Invalid Plan

```json
{
  "success": false,
  "error": "Invalid plan. Must be one of: starter, professional, enterprise",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

#### 400 Bad Request - Billing Info Not Found

```json
{
  "success": false,
  "error": "Billing information not found. Please create a customer first.",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

#### 401 Unauthorized

```json
{
  "success": false,
  "error": "Authentication required",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

#### 403 Forbidden

```json
{
  "success": false,
  "error": "Access denied",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

## Pricing Plans

### Starter Plan
- **Price:** $99/month
- **Queries:** 1,000/month
- **Documents:** 100
- **API Calls:** 5,000/day
- **Storage:** 1 GB

### Professional Plan
- **Price:** $499/month
- **Queries:** 10,000/month
- **Documents:** 1,000
- **API Calls:** 50,000/day
- **Storage:** 10 GB

### Enterprise Plan
- **Price:** Custom
- **Queries:** Unlimited
- **Documents:** Unlimited
- **API Calls:** Unlimited
- **Storage:** 1 TB

## Implementation Flow

1. **Merchant creates account** via `/api/merchants/register`
2. **Merchant verifies email** via `/api/merchants/verify-email`
3. **Merchant logs in** via `/api/merchants/login` to get JWT token
4. **Billing customer is created** automatically during registration
5. **Merchant collects payment method** using Stripe.js on frontend
6. **Merchant subscribes** by calling this endpoint with payment method ID
7. **Subscription is created** in Stripe
8. **Usage limits are updated** based on the selected plan
9. **Merchant can start using** the RAG Assistant API

## Code Examples

### JavaScript (Frontend with Stripe.js)

```javascript
// 1. Initialize Stripe
const stripe = Stripe('pk_live_...');
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// 2. Create payment method
async function subscribe(plan) {
  try {
    // Create payment method
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      console.error('Payment method creation failed:', error);
      return;
    }

    // Subscribe to plan
    const response = await fetch(
      `https://api.example.com/api/merchants/${merchantId}/billing/subscribe`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan,
          paymentMethodId: paymentMethod.id,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('Subscription created:', result.data);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      console.error('Subscription failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// 3. Call subscribe function
subscribe('professional');
```

### cURL

```bash
# First, create a payment method using Stripe API or Stripe.js
# Then use the payment method ID to subscribe

curl -X POST https://api.example.com/api/merchants/merchant_123/billing/subscribe \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "professional",
    "paymentMethodId": "pm_1234567890"
  }'
```

### Python

```python
import requests

def subscribe_to_plan(merchant_id, jwt_token, plan, payment_method_id):
    url = f"https://api.example.com/api/merchants/{merchant_id}/billing/subscribe"
    
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "plan": plan,
        "paymentMethodId": payment_method_id
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"Subscription created: {result['data']['subscriptionId']}")
        return result['data']
    else:
        error = response.json()
        print(f"Error: {error['error']}")
        return None

# Usage
subscribe_to_plan(
    merchant_id="merchant_123",
    jwt_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    plan="professional",
    payment_method_id="pm_1234567890"
)
```

## Security Considerations

1. **JWT Authentication:** All requests must include a valid JWT token
2. **Merchant Validation:** The endpoint verifies that the authenticated user has access to the specified merchant account
3. **Payment Method Security:** Payment method IDs are created client-side using Stripe.js and never expose card details
4. **HTTPS Only:** All API calls must use HTTPS in production
5. **Rate Limiting:** Endpoint is rate-limited to prevent abuse

## Related Endpoints

- `POST /api/merchants/register` - Register a new merchant account
- `POST /api/merchants/login` - Login to get JWT token
- `GET /api/merchants/:merchantId/billing/current` - Get current billing information
- `GET /api/merchants/:merchantId/billing/invoices` - Get invoice history
- `POST /api/merchants/:merchantId/billing/upgrade` - Upgrade/downgrade subscription
- `POST /api/merchants/:merchantId/billing/cancel` - Cancel subscription
- `POST /api/merchants/:merchantId/billing/payment-methods` - Add payment method
- `DELETE /api/merchants/:merchantId/billing/payment-methods/:paymentMethodId` - Remove payment method

## Webhook Events

After subscription is created, the following Stripe webhook events will be triggered:

- `customer.subscription.created` - Subscription created
- `invoice.created` - First invoice created
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed (if card declined)

## Testing

### Test Mode

Use Stripe test mode for development:

1. Use test API keys: `pk_test_...` and `sk_test_...`
2. Use test payment methods:
   - Success: `pm_card_visa` or card number `4242 4242 4242 4242`
   - Decline: `pm_card_chargeDeclined` or card number `4000 0000 0000 0002`

### Unit Tests

Run the billing service tests:

```bash
npm test -- src/tests/billingService.test.ts --run
```

### Integration Tests

Test the endpoint manually:

```bash
# Start the server
npm run dev

# Run the test script
./test-subscribe-endpoint.sh
```

## Troubleshooting

### Error: "Billing information not found"

**Solution:** The merchant must have a Stripe customer created first. This happens automatically during registration, but if missing, contact support.

### Error: "Invalid payment method"

**Solution:** Ensure the payment method ID is valid and created using Stripe.js with the correct publishable key.

### Error: "No Stripe price ID configured for plan"

**Solution:** Ensure environment variables are set:
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_ENTERPRISE`

### Error: "Access denied"

**Solution:** Ensure the JWT token is valid and the authenticated user has access to the specified merchant account.

## Support

For additional help:
- Email: support@example.com
- Documentation: https://docs.example.com
- Status Page: https://status.example.com
