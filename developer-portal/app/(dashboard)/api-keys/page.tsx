'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiKeyList, CreateApiKeyDialog, ApiKeyUsageDialog } from '@/components/api-keys';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export default function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [selectedKeyName, setSelectedKeyName] = useState<string>('');
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  // Fetch API keys
  const {
    data: apiKeys,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['api-keys', merchantId],
    queryFn: () => apiClient.getApiKeys(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      environment: 'development' | 'production';
      permissions?: string[];
    }) => apiClient.createApiKey(merchantId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', merchantId] });
      toast({
        title: 'Success',
        description: 'API key created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        variant: 'destructive',
      });
    },
  });

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiClient.deleteApiKey(merchantId, keyId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', merchantId] });
      toast({
        title: 'Success',
        description: 'API key deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete API key',
        variant: 'destructive',
      });
    },
  });

  // Rotate API key mutation
  const rotateMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiClient.rotateApiKey(merchantId, keyId, 7, token),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', merchantId] });
      toast({
        title: 'Success',
        description: 'API key rotated successfully. The old key will expire in 7 days.',
      });
      // Show the new key
      const keyName = apiKeys?.find(k => k.keyId === result.keyId)?.name || 'Rotated Key';
      setSelectedKeyName(keyName);
      // Could show the new key in a dialog here if needed
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rotate API key',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = async (data: {
    name: string;
    environment: 'development' | 'production';
    permissions?: string[];
  }) => {
    const result = await createMutation.mutateAsync(data);
    return result;
  };

  const handleDelete = (keyId: string) => {
    deleteMutation.mutate(keyId);
  };

  const handleRotate = (keyId: string) => {
    rotateMutation.mutate(keyId);
  };

  const handleViewUsage = (keyId: string) => {
    const key = apiKeys?.find(k => k.keyId === keyId);
    if (key) {
      setSelectedKeyId(keyId);
      setSelectedKeyName(key.name);
      setShowUsageDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your API keys for integration
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-yellow-800">
              Keep your API keys secure
            </p>
            <p className="text-sm text-yellow-700">
              API keys are shown only once when created. Store them securely and
              never share them publicly. If a key is compromised, delete it
              immediately and create a new one.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load API keys. Please try again.
          </p>
        </div>
      ) : (
        <ApiKeyList
          apiKeys={apiKeys || []}
          onDelete={handleDelete}
          onRotate={handleRotate}
          onViewUsage={handleViewUsage}
          deletingKeyId={
            deleteMutation.isPending ? deleteMutation.variables : undefined
          }
          rotatingKeyId={
            rotateMutation.isPending ? rotateMutation.variables : undefined
          }
        />
      )}

      <CreateApiKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreate}
      />

      <ApiKeyUsageDialog
        open={showUsageDialog}
        onClose={() => setShowUsageDialog(false)}
        keyId={selectedKeyId}
        keyName={selectedKeyName}
      />
    </div>
  );
}
