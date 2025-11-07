'use client';

import { Webhook } from '@/types';
import { WebhookCard } from './WebhookCard';

interface WebhookListProps {
  webhooks: Webhook[];
  onDelete: (webhookId: string) => void;
  onTest: (webhookId: string) => void;
  onViewDeliveries: (webhookId: string) => void;
  onToggleStatus: (webhookId: string, status: 'active' | 'disabled') => void;
  deletingWebhookId?: string;
  testingWebhookId?: string;
}

export function WebhookList({
  webhooks,
  onDelete,
  onTest,
  onViewDeliveries,
  onToggleStatus,
  deletingWebhookId,
  testingWebhookId,
}: WebhookListProps) {
  if (webhooks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <div className="mx-auto max-w-md space-y-2">
          <h3 className="text-lg font-semibold">No webhooks configured</h3>
          <p className="text-sm text-muted-foreground">
            Create your first webhook to receive real-time notifications about events
            in your MindShop integration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {webhooks.map((webhook) => (
        <WebhookCard
          key={webhook.webhookId}
          webhook={webhook}
          onDelete={onDelete}
          onTest={onTest}
          onViewDeliveries={onViewDeliveries}
          onToggleStatus={onToggleStatus}
          isDeleting={deletingWebhookId === webhook.webhookId}
          isTesting={testingWebhookId === webhook.webhookId}
        />
      ))}
    </div>
  );
}
