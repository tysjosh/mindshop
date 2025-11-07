# Webhooks Components

This directory contains the components for the Webhooks page in the developer portal.

## Components

### WebhookCard
Displays a single webhook with its configuration, status, and actions.

**Features:**
- Shows webhook URL, events, and status
- Displays last success/failure timestamps
- Shows failure count with warnings
- Actions: Test, View Deliveries, Enable/Disable, Delete
- Confirmation dialog for deletion

### WebhookList
Displays a list of webhooks or an empty state.

**Props:**
- `webhooks`: Array of webhook objects
- `onDelete`: Callback for deleting a webhook
- `onTest`: Callback for testing a webhook
- `onViewDeliveries`: Callback for viewing delivery history
- `onToggleStatus`: Callback for enabling/disabling a webhook
- `deletingWebhookId`: ID of webhook being deleted (for loading state)
- `testingWebhookId`: ID of webhook being tested (for loading state)

### CreateWebhookDialog
Modal dialog for creating a new webhook.

**Features:**
- URL input with HTTPS validation
- Event selection with checkboxes
- Shows available events with descriptions
- Displays webhook secret after creation (one-time view)
- Copy to clipboard functionality for secret

**Available Events:**
- `chat.query.completed` - When a chat query is successfully processed
- `chat.query.failed` - When a chat query fails
- `document.created` - When a new document is added
- `document.updated` - When a document is modified
- `document.deleted` - When a document is removed
- `usage.limit.approaching` - When usage reaches 80% of limit
- `usage.limit.exceeded` - When usage limit is exceeded
- `api_key.expiring` - When an API key will expire in 7 days

### DeliveryHistoryDialog
Modal dialog showing webhook delivery history.

**Features:**
- Lists all delivery attempts for a webhook
- Shows status (success, failed, pending)
- Displays HTTP status codes and response bodies
- Shows retry information
- Expandable payload view
- Scrollable list for many deliveries

## Usage

```tsx
import {
  WebhookList,
  CreateWebhookDialog,
  DeliveryHistoryDialog,
} from '@/components/webhooks';

// In your page component
<WebhookList
  webhooks={webhooks}
  onDelete={handleDelete}
  onTest={handleTest}
  onViewDeliveries={handleViewDeliveries}
  onToggleStatus={handleToggleStatus}
/>

<CreateWebhookDialog
  open={showCreateDialog}
  onClose={() => setShowCreateDialog(false)}
  onCreate={handleCreate}
/>

<DeliveryHistoryDialog
  open={showDeliveryDialog}
  onClose={() => setShowDeliveryDialog(false)}
  webhookId={selectedWebhookId}
  webhookUrl={selectedWebhookUrl}
/>
```

## API Integration

The components integrate with the following API endpoints:

- `GET /api/merchants/:merchantId/webhooks` - List webhooks
- `POST /api/merchants/:merchantId/webhooks` - Create webhook
- `PUT /api/merchants/:merchantId/webhooks/:id` - Update webhook
- `DELETE /api/merchants/:merchantId/webhooks/:id` - Delete webhook
- `POST /api/merchants/:merchantId/webhooks/:id/test` - Test webhook
- `GET /api/merchants/:merchantId/webhooks/:id/deliveries` - Get delivery history

## Webhook Security

Webhooks include several security features:

1. **HTTPS Only**: All webhook URLs must use HTTPS
2. **HMAC Signatures**: Each webhook delivery includes an HMAC signature in the `X-Webhook-Signature` header
3. **Signing Secret**: Merchants receive a signing secret to verify webhook authenticity
4. **Retry Logic**: Failed deliveries are retried up to 3 times with exponential backoff
5. **Auto-Disable**: Webhooks are automatically disabled after 10 consecutive failures

## Webhook Payload Format

```json
{
  "event": "chat.query.completed",
  "timestamp": "2025-11-04T12:00:00Z",
  "merchantId": "acme_electronics_2024",
  "data": {
    // Event-specific data
  }
}
```

## Verifying Webhook Signatures

Merchants should verify webhook signatures using the signing secret:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  return signature === expectedSignature;
}
```

## Status Badges

- **Active** (Green): Webhook is enabled and functioning
- **Disabled** (Gray): Webhook has been manually disabled
- **Failed** (Red): Webhook has failed and been auto-disabled

## Implementation Notes

- Uses React Query for data fetching and mutations
- Implements optimistic updates for better UX
- Shows loading states during operations
- Displays toast notifications for success/error feedback
- Responsive design works on mobile and desktop
