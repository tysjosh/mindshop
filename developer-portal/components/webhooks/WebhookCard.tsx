'use client';

import { useState } from 'react';
import { Webhook } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Globe, AlertCircle, CheckCircle, XCircle, Play, History, Trash2 } from 'lucide-react';

interface WebhookCardProps {
  webhook: Webhook;
  onDelete: (webhookId: string) => void;
  onTest: (webhookId: string) => void;
  onViewDeliveries: (webhookId: string) => void;
  onToggleStatus: (webhookId: string, status: 'active' | 'disabled') => void;
  isDeleting?: boolean;
  isTesting?: boolean;
}

export function WebhookCard({
  webhook,
  onDelete,
  onTest,
  onViewDeliveries,
  onToggleStatus,
  isDeleting,
  isTesting,
}: WebhookCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusBadge = () => {
    switch (webhook.status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case 'disabled':
        return (
          <Badge variant="secondary">
            <XCircle className="mr-1 h-3 w-3" />
            Disabled
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-mono text-sm break-all">
                  {webhook.url}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                ID: {webhook.webhookId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onTest(webhook.webhookId)} disabled={isTesting}>
                    <Play className="mr-2 h-4 w-4" />
                    Test Webhook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewDeliveries(webhook.webhookId)}>
                    <History className="mr-2 h-4 w-4" />
                    View Deliveries
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      onToggleStatus(
                        webhook.webhookId,
                        webhook.status === 'active' ? 'disabled' : 'active'
                      )
                    }
                  >
                    {webhook.status === 'active' ? 'Disable' : 'Enable'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Events</p>
              <div className="flex flex-wrap gap-2">
                {webhook.events.map((event) => (
                  <Badge key={event} variant="outline">
                    {event}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Last Success</p>
                <p className="font-medium">{formatDate(webhook.lastSuccessAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Failure</p>
                <p className="font-medium">{formatDate(webhook.lastFailureAt)}</p>
              </div>
            </div>

            {webhook.failureCount > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="inline mr-1 h-4 w-4" />
                  {webhook.failureCount} consecutive failure{webhook.failureCount > 1 ? 's' : ''}
                  {webhook.failureCount >= 10 && ' - Webhook has been disabled'}
                </p>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Created {formatDate(webhook.createdAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
              You will stop receiving events at this endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(webhook.webhookId);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
