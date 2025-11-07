'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, Trash2, MoreVertical, RotateCw, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useToast } from '@/hooks/use-toast';
import { ApiKey } from '@/types';

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: (keyId: string) => void;
  onRotate?: (keyId: string) => void;
  onViewUsage?: (keyId: string) => void;
  isDeleting?: boolean;
  isRotating?: boolean;
}

export function ApiKeyCard({ apiKey, onDelete, onRotate, onViewUsage, isDeleting, isRotating }: ApiKeyCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const keyToCopy = `${apiKey.keyPrefix}••••••••••••••••`;
    await navigator.clipboard.writeText(keyToCopy);
    toast({
      title: 'Copied to clipboard',
      description: 'API key prefix copied to clipboard',
    });
  };

  const handleDelete = () => {
    onDelete(apiKey.keyId);
    setShowDeleteDialog(false);
  };

  const handleRotate = () => {
    if (onRotate) {
      onRotate(apiKey.keyId);
    }
    setShowRotateDialog(false);
  };

  const handleViewUsage = () => {
    if (onViewUsage) {
      onViewUsage(apiKey.keyId);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    if (apiKey.status === 'active') {
      return <Badge variant="success">Active</Badge>;
    } else if (apiKey.status === 'revoked') {
      return <Badge variant="destructive">Revoked</Badge>;
    } else if (apiKey.status === 'expired') {
      return <Badge variant="warning">Expired</Badge>;
    }
    return <Badge variant="outline">{apiKey.status}</Badge>;
  };

  const getEnvironmentBadge = () => {
    if (apiKey.environment === 'production') {
      return <Badge variant="default">Production</Badge>;
    }
    return <Badge variant="secondary">Development</Badge>;
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{apiKey.name}</h3>
              {getStatusBadge()}
              {getEnvironmentBadge()}
            </div>

            <div className="flex items-center gap-2 font-mono text-sm">
              <code className="rounded bg-muted px-2 py-1">
                {showKey ? apiKey.keyPrefix : `${apiKey.keyPrefix}••••••••••••••••`}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="h-8 w-8 p-0"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-6 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Created:</span>{' '}
                {formatDate(apiKey.createdAt)}
              </div>
              <div>
                <span className="font-medium">Last used:</span>{' '}
                {formatDate(apiKey.lastUsedAt)}
              </div>
              {apiKey.expiresAt && (
                <div>
                  <span className="font-medium">Expires:</span>{' '}
                  {formatDate(apiKey.expiresAt)}
                </div>
              )}
            </div>

            {apiKey.permissions && apiKey.permissions.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  Permissions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {apiKey.permissions.map((permission) => (
                    <Badge
                      key={permission}
                      variant="outline"
                      className="text-xs font-normal"
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onViewUsage && (
                <DropdownMenuItem onClick={handleViewUsage}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Usage
                </DropdownMenuItem>
              )}
              {onRotate && apiKey.status === 'active' && (
                <DropdownMenuItem
                  onClick={() => setShowRotateDialog(true)}
                  disabled={isRotating}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Rotate Key
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key &quot;{apiKey.name}&quot;? This
              action cannot be undone and any applications using this key will
              stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new API key and deprecate the old one. The old key
              will continue to work for 7 days to give you time to update your
              applications. After 7 days, the old key will be automatically revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotate}>
              Rotate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
