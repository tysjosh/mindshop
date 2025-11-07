# Billing Cancel Endpoint Documentation

## Overview

The billing cancel endpoint allows merchants to cancel their subscription. Merchants can choose to cancel immediately or at the end of their current billing period.

## Endpoint

```
POST /api/merchants/:merchantId/billing/cancel
```

## Authentication

Requires JWT authentication. The authenticated user must either:
- Be the owner of the merchant account (merchantId matches the JWT token)
- Have admin role

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| merchantId | string | Yes | The unique identifier of the merchant |

### Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cancelAtPeriodEnd | boolean | No | true | If true, subscription continues until end of billing period. If false, cancels immediately. |

## Request Example

### Cancel at Period End (Recommended)

```bash
curl -X POST \
  https://api.example.com/api/merchants/acme_electronics_2024/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }'
```

### Cancel Immediately

```bash
curl -X POST \
  https://api.example.com/api/merchants/acme_electronics_2024/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": false
  }'
```

## Response

### Success Response (200 OK)

#### Cancel at Period End

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1234567890",
    "status": "active",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2025-12-01T00:00:00.000Z",
    "message": "Subscription will be canceled at the end of the billing period"
  },
  "timestamp": "2025-11-04T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

#### Cancel Immediately

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1234567890",
    "status": "canceled",
    "cancelAtPeriodEnd": false,
    "currentPeriodEnd": "2025-12-01T00:00:00.000Z",
    "message": "Subscription canceled immediately"
  },
  "timestamp": "2025-11-04T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

### Error Responses

#### 401 Unauthorized

Missing or invalid JWT token.

```json
{
  "success": false,
  "error": "Missing or invalid API key",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

#### 403 Forbidden

User doesn't have permission to cancel this merchant's subscription.

```json
{
  "success": false,
  "error": "Access denied",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

#### 400 Bad Request

No active subscription found or cancellation failed.

```json
{
  "success": false,
  "error": "No active subscription found",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

## Behavior Details

### Cancel at Period End (cancelAtPeriodEnd: true)

When `cancelAtPeriodEnd` is set to `true`:

1. The subscription remains active until the end of the current billing period
2. The merchant retains full access to all features until the period ends
3. No refund is issued for the current period
4. The subscription status remains "active" but is marked for cancellation
5. The merchant can reactivate the subscription before the period ends
6. At the end of the period, the subscription automatically cancels

**Database Updates:**
- `billing_info.cancel_at_period_end` is set to `1` (true)
- `billing_info.status` remains "active"
- `merchants.status` remains "active"

**Stripe Updates:**
- Subscription's `cancel_at_period_end` is set to `true`
- Subscription status remains "active"

### Cancel Immediately (cancelAtPeriodEnd: false)

When `cancelAtPeriodEnd` is set to `false`:

1. The subscription is canceled immediately
2. The merchant loses access to paid features immediately
3. No refund is issued for the current period
4. The subscription status changes to "canceled"
5. The merchant account is suspended
6. The merchant must create a new subscription to reactivate

**Database Updates:**
- `billing_info.status` is set to "canceled"
- `billing_info.cancel_at_period_end` is set to `0` (false)
- `merchants.status` is set to "suspended"

**Stripe Updates:**
- Subscription is canceled via `stripe.subscriptions.cancel()`
- Subscription status changes to "canceled"

## Reactivation

### After Cancel at Period End

If a merchant cancels with `cancelAtPeriodEnd: true`, they can reactivate before the period ends by:

1. Calling the upgrade endpoint with their current plan
2. Or contacting support to remove the cancellation flag

### After Immediate Cancellation

If a merchant cancels immediately, they must:

1. Create a new subscription via the subscribe endpoint
2. Provide a valid payment method
3. Select a plan

## Integration Examples

### JavaScript/TypeScript

```typescript
async function cancelSubscription(
  merchantId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> {
  const response = await fetch(
    `https://api.example.com/api/merchants/${merchantId}/billing/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelAtPeriodEnd }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();
  console.log('Subscription canceled:', result.data);
}

// Cancel at period end (recommended)
await cancelSubscription('acme_electronics_2024', true);

// Cancel immediately
await cancelSubscription('acme_electronics_2024', false);
```

### Python

```python
import requests

def cancel_subscription(merchant_id: str, cancel_at_period_end: bool = True) -> dict:
    url = f"https://api.example.com/api/merchants/{merchant_id}/billing/cancel"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    data = {
        "cancelAtPeriodEnd": cancel_at_period_end
    }
    
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    
    return response.json()

# Cancel at period end (recommended)
result = cancel_subscription("acme_electronics_2024", True)
print(f"Subscription canceled: {result['data']}")

# Cancel immediately
result = cancel_subscription("acme_electronics_2024", False)
print(f"Subscription canceled: {result['data']}")
```

### cURL

```bash
# Cancel at period end
curl -X POST \
  https://api.example.com/api/merchants/acme_electronics_2024/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancelAtPeriodEnd": true}'

# Cancel immediately
curl -X POST \
  https://api.example.com/api/merchants/acme_electronics_2024/billing/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancelAtPeriodEnd": false}'
```

## Best Practices

1. **Always use cancelAtPeriodEnd: true by default**
   - Provides better user experience
   - Allows merchants to continue using the service they paid for
   - Gives merchants time to reconsider

2. **Confirm cancellation with the user**
   - Show a confirmation dialog before calling the endpoint
   - Explain the consequences of immediate vs. period-end cancellation
   - Display the date when the subscription will end

3. **Handle errors gracefully**
   - Check for 403 errors (access denied)
   - Check for 400 errors (no active subscription)
   - Provide clear error messages to users

4. **Update UI immediately**
   - Show cancellation status in the UI
   - Display the date when access will end
   - Provide option to reactivate (if canceled at period end)

5. **Send confirmation emails**
   - Notify the merchant via email when cancellation is successful
   - Include details about when access will end
   - Provide instructions for reactivation

## Testing

Use the provided test script to verify the endpoint:

```bash
# Set environment variables
export JWT_TOKEN="your_jwt_token_here"
export MERCHANT_ID="your_merchant_id"
export API_URL="http://localhost:3000"

# Run the test script
./scripts/test-billing-cancel.sh
```

The test script will verify:
- Cancel at period end works correctly
- Immediate cancellation works correctly
- Authentication is required
- Authorization is enforced

## Related Endpoints

- `POST /api/merchants/:merchantId/billing/subscribe` - Create a new subscription
- `POST /api/merchants/:merchantId/billing/upgrade` - Upgrade/downgrade subscription
- `GET /api/merchants/:merchantId/billing/current` - Get current billing information
- `GET /api/merchants/:merchantId/billing/invoices` - Get invoice history

## Webhook Events

When a subscription is canceled, the following Stripe webhook events are triggered:

1. `customer.subscription.updated` - When canceled at period end
2. `customer.subscription.deleted` - When canceled immediately

These events are handled automatically by the webhook handler at `/api/billing/webhook`.

## Support

For questions or issues with subscription cancellation:
- Email: support@example.com
- Documentation: https://docs.example.com/billing
- Status Page: https://status.example.com
