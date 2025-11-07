'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { WebhookDelivery } from '@/types';

interface DeliveryHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  webhookId: string;
  webhookUrl: string;
}

export function DeliveryHistoryDialog({
  open,
  onClose,
  webhookId,
  webhookUrl,
}: DeliveryHistoryDialogProps) {
  const { data: session } = useSession();
  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => apiClient.getWebhookDeliveries(merchantId, webhookId, token),
    enabled: open && !!merchantId && !!webhookId && !!token,
  });

  const getStatusBadge = (delivery: WebhookDelivery) => {
    switch (delivery.status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Delivery History</DialogTitle>
          <DialogDescription className="break-all">
            Recent webhook deliveries for {webhookUrl}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[500px] overflow-y-auto pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deliveries yet</h3>
              <p className="text-sm text-muted-foreground">
                Webhook deliveries will appear here once events are triggered.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{delivery.eventType}</Badge>
                        {getStatusBadge(delivery)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(delivery.createdAt)}
                      </p>
                    </div>
                    {delivery.statusCode && (
                      <Badge variant="outline">
                        HTTP {delivery.statusCode}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Attempts</p>
                      <p className="font-medium">{delivery.attemptCount}</p>
                    </div>
                    {delivery.deliveredAt && (
                      <div>
                        <p className="text-muted-foreground">Delivered At</p>
                        <p className="font-medium text-xs">
                          {formatDate(delivery.deliveredAt)}
                        </p>
                      </div>
                    )}
                    {delivery.nextRetryAt && (
                      <div>
                        <p className="text-muted-foreground">Next Retry</p>
                        <p className="font-medium text-xs">
                          {formatDate(delivery.nextRetryAt)}
                        </p>
                      </div>
                    )}
                  </div>

                  {delivery.responseBody && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Response
                      </p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {delivery.responseBody}
                      </pre>
                    </div>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View Payload
                    </summary>
                    <pre className="mt-2 bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(delivery.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
