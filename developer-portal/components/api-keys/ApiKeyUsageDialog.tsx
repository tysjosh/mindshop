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
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { BarChart3, TrendingUp, AlertCircle, Clock } from 'lucide-react';

interface ApiKeyUsageDialogProps {
  open: boolean;
  onClose: () => void;
  keyId: string;
  keyName: string;
}

export function ApiKeyUsageDialog({
  open,
  onClose,
  keyId,
  keyName,
}: ApiKeyUsageDialogProps) {
  const { data: session } = useSession();
  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  const { data: usage, isLoading, error } = useQuery({
    queryKey: ['api-key-usage', keyId],
    queryFn: () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return apiClient.getApiKeyUsage(merchantId, keyId, startDate, endDate, token);
    },
    enabled: open && !!merchantId && !!token && !!keyId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>API Key Usage</DialogTitle>
          <DialogDescription>
            Usage statistics for &quot;{keyName}&quot; (Last 30 days)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">
              Failed to load usage statistics. Please try again.
            </p>
          </div>
        ) : usage ? (
          <div className="space-y-6 py-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm">Total Requests</span>
                </div>
                <p className="text-2xl font-bold">{usage.totalRequests.toLocaleString()}</p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Success Rate</span>
                </div>
                <p className="text-2xl font-bold">
                  {usage.totalRequests > 0
                    ? ((usage.successfulRequests / usage.totalRequests) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Avg Response Time</span>
                </div>
                <p className="text-2xl font-bold">{usage.avgResponseTime.toFixed(0)}ms</p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Failed Requests</span>
                </div>
                <p className="text-2xl font-bold">{usage.failedRequests.toLocaleString()}</p>
              </div>
            </div>

            {/* Usage by Endpoint */}
            {usage.usageByEndpoint && usage.usageByEndpoint.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Usage by Endpoint</h4>
                <div className="space-y-2">
                  {usage.usageByEndpoint.map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-mono">{endpoint.endpoint}</p>
                        <p className="text-xs text-muted-foreground">
                          Avg: {endpoint.avgResponseTime.toFixed(0)}ms
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{endpoint.count.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">requests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
