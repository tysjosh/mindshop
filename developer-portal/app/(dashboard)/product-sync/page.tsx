'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertCircle, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SyncConfigurationForm,
  SyncStatusCard,
  FileUploadCard,
  SyncHistoryTable,
} from '@/components/product-sync';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export default function ProductSyncPage() {
  const [activeTab, setActiveTab] = useState('configuration');
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  // Fetch sync configuration
  const {
    data: config,
    isLoading: isLoadingConfig,
    error: configError,
  } = useQuery({
    queryKey: ['product-sync-config', merchantId],
    queryFn: () => apiClient.getProductSyncConfig(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Fetch sync status
  const {
    data: syncStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['product-sync-status', merchantId],
    queryFn: () => apiClient.getProductSyncStatus(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Poll status when syncing
  useEffect(() => {
    if (syncStatus?.status === 'syncing') {
      const interval = setInterval(() => {
        refetchStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [syncStatus?.status, refetchStatus]);

  // Fetch sync history
  const {
    data: history,
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: ['product-sync-history', merchantId],
    queryFn: () => apiClient.getProductSyncHistory(merchantId, 20, token),
    enabled: !!merchantId && !!token,
  });

  // Create/Update configuration mutation
  const configMutation = useMutation({
    mutationFn: (data: {
      syncType: 'scheduled' | 'webhook' | 'manual';
      schedule?: string;
      sourceType: 'api' | 'ftp' | 's3' | 'csv';
      sourceUrl?: string;
      fieldMapping: Record<string, string>;
    }) => {
      if (config) {
        return apiClient.updateProductSyncConfig(merchantId, data, token);
      } else {
        return apiClient.createProductSyncConfig(merchantId, data, token);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sync-config', merchantId] });
      toast({
        title: 'Success',
        description: 'Sync configuration saved successfully',
      });
      setActiveTab('status');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive',
      });
    },
  });

  // Trigger sync mutation
  const triggerSyncMutation = useMutation({
    mutationFn: () => apiClient.triggerProductSync(merchantId, token),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-sync-status', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['product-sync-history', merchantId] });
      toast({
        title: 'Success',
        description: result.message || 'Sync triggered successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to trigger sync',
        variant: 'destructive',
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadProductFile(merchantId, file, token),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-sync-history', merchantId] });
      toast({
        title: 'Success',
        description: `File uploaded successfully. ${result.productsProcessed} products processed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  const handleConfigSubmit = async (data: {
    syncType: 'scheduled' | 'webhook' | 'manual';
    schedule?: string;
    sourceType: 'api' | 'ftp' | 's3' | 'csv';
    sourceUrl?: string;
    fieldMapping: Record<string, string> | string;
  }) => {
    // Convert fieldMapping to Record if it's a string
    const processedData = {
      ...data,
      fieldMapping: typeof data.fieldMapping === 'string' 
        ? JSON.parse(data.fieldMapping) 
        : data.fieldMapping
    };
    await configMutation.mutateAsync(processedData);
  };

  const handleTriggerSync = () => {
    triggerSyncMutation.mutate();
  };

  const handleFileUpload = async (file: File) => {
    await uploadFileMutation.mutateAsync(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Sync</h2>
          <p className="text-muted-foreground">
            Synchronize your product catalog with the RAG assistant
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Keep your product data up-to-date by configuring automatic synchronization or
          manually uploading product files. The RAG assistant uses this data to provide
          accurate product recommendations.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Package className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-800">
              How product sync works
            </p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Configure sync settings to automatically pull products from your platform</li>
              <li>Upload CSV or JSON files for manual product updates</li>
              <li>Products are processed and indexed for semantic search</li>
              <li>The RAG assistant uses this data to answer customer queries</li>
              <li>Sync history shows all past synchronization attempts</li>
            </ul>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          {isLoadingConfig ? (
            <Skeleton className="h-96 w-full" />
          ) : configError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load configuration. Please try again.
              </AlertDescription>
            </Alert>
          ) : (
            <SyncConfigurationForm
              config={config}
              onSubmit={handleConfigSubmit}
              isSubmitting={configMutation.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          {isLoadingStatus ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <SyncStatusCard
              status={syncStatus?.status || 'idle'}
              lastSync={syncStatus?.lastSync}
              nextSync={syncStatus?.nextSync}
              onTriggerSync={handleTriggerSync}
              isSyncing={triggerSyncMutation.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <FileUploadCard
            onUpload={handleFileUpload}
            isUploading={uploadFileMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {isLoadingHistory ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <SyncHistoryTable history={history || []} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
