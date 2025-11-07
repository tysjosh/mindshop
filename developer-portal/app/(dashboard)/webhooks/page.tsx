'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Webhook as WebhookIcon, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  WebhookList,
  CreateWebhookDialog,
  DeliveryHistoryDialog,
} from '@/components/webhooks';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export default function WebhooksPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [selectedWebhookUrl, setSelectedWebhookUrl] = useState<string>('');
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  // Fetch webhooks
  const {
    data: webhooks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['webhooks', merchantId],
    queryFn: () => apiClient.getWebhooks(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      apiClient.createWebhook(merchantId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', merchantId] });
      toast({
        title: 'Success',
        description: 'Webhook created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create webhook',
        variant: 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.deleteWebhook(merchantId, webhookId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', merchantId] });
      toast({
        title: 'Success',
        description: 'Webhook deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete webhook',
        variant: 'destructive',
      });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.testWebhook(merchantId, webhookId, token),
    onSuccess: (result) => {
      toast({
        title: result.success ? 'Success' : 'Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to test webhook',
        variant: 'destructive',
      });
    },
  });

  // Toggle webhook status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({
      webhookId,
      status,
    }: {
      webhookId: string;
      status: 'active' | 'disabled';
    }) => apiClient.updateWebhook(merchantId, webhookId, { status }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', merchantId] });
      toast({
        title: 'Success',
        description: 'Webhook status updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update webhook status',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = async (data: { url: string; events: string[] }) => {
    const result = await createMutation.mutateAsync(data);
    return result;
  };

  const handleDelete = (webhookId: string) => {
    deleteMutation.mutate(webhookId);
  };

  const handleTest = (webhookId: string) => {
    testMutation.mutate(webhookId);
  };

  const handleViewDeliveries = (webhookId: string) => {
    const webhook = webhooks?.find((w) => w.webhookId === webhookId);
    if (webhook) {
      setSelectedWebhookId(webhookId);
      setSelectedWebhookUrl(webhook.url);
      setShowDeliveryDialog(true);
    }
  };

  const handleToggleStatus = (webhookId: string, status: 'active' | 'disabled') => {
    toggleStatusMutation.mutate({ webhookId, status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Webhooks</h2>
          <p className="text-muted-foreground">
            Receive real-time notifications about events in your integration
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Webhooks allow your application to receive real-time notifications when events
          occur in MindShop. Configure an HTTPS endpoint to receive event payloads.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <WebhookIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-800">
              How webhooks work
            </p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Configure an HTTPS endpoint to receive event notifications</li>
              <li>Subscribe to specific events you want to monitor</li>
              <li>Verify webhook signatures using your signing secret</li>
              <li>Webhooks are retried up to 3 times with exponential backoff</li>
              <li>
                Webhooks are automatically disabled after 10 consecutive failures
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load webhooks. Please try again.
          </AlertDescription>
        </Alert>
      ) : (
        <WebhookList
          webhooks={webhooks || []}
          onDelete={handleDelete}
          onTest={handleTest}
          onViewDeliveries={handleViewDeliveries}
          onToggleStatus={handleToggleStatus}
          deletingWebhookId={
            deleteMutation.isPending && typeof deleteMutation.variables === 'string' 
              ? deleteMutation.variables 
              : undefined
          }
          testingWebhookId={
            testMutation.isPending && typeof testMutation.variables === 'string'
              ? testMutation.variables 
              : undefined
          }
        />
      )}

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
    </div>
  );
}
