'use client';

import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductSyncHistory } from '@/types';

interface SyncStatusCardProps {
  status: 'idle' | 'syncing' | 'error';
  lastSync?: ProductSyncHistory;
  nextSync?: string;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export function SyncStatusCard({
  status,
  lastSync,
  nextSync,
  onTriggerSync,
  isSyncing,
}: SyncStatusCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'syncing':
        return (
          <Badge variant="default" className="bg-blue-500">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <CheckCircle className="mr-1 h-3 w-3" />
            Idle
          </Badge>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync Status</CardTitle>
            <CardDescription>Current synchronization status</CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
            <p className="text-sm">{formatDate(lastSync?.completedAt)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Next Sync</p>
            <p className="text-sm">{nextSync ? formatDate(nextSync) : 'Not scheduled'}</p>
          </div>
        </div>

        {lastSync && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Last Sync Details</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge
                  variant={lastSync.status === 'completed' ? 'default' : 'destructive'}
                  className="ml-1"
                >
                  {lastSync.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>{' '}
                {formatDuration(lastSync.duration)}
              </div>
              <div>
                <span className="text-muted-foreground">Processed:</span>{' '}
                {lastSync.productsProcessed}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span> {lastSync.productsCreated}
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span> {lastSync.productsUpdated}
              </div>
              <div>
                <span className="text-muted-foreground">Skipped:</span> {lastSync.productsSkipped}
              </div>
            </div>
            {lastSync.errorMessage && (
              <div className="mt-2 rounded-md bg-red-50 p-2">
                <p className="text-sm text-red-800">{lastSync.errorMessage}</p>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={onTriggerSync}
          disabled={isSyncing || status === 'syncing'}
          className="w-full"
        >
          {isSyncing || status === 'syncing' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Trigger Manual Sync
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
