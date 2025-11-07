'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductSyncConfig } from '@/types';

interface SyncConfigFormData {
  syncType: 'scheduled' | 'webhook' | 'manual';
  schedule?: string;
  sourceType: 'api' | 'ftp' | 's3' | 'csv';
  sourceUrl?: string;
  fieldMapping: Record<string, string> | string;
}

interface SyncConfigurationFormProps {
  config?: ProductSyncConfig | null;
  onSubmit: (data: SyncConfigFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function SyncConfigurationForm({
  config,
  onSubmit,
  isSubmitting,
}: SyncConfigurationFormProps) {
  const [syncType, setSyncType] = useState<'scheduled' | 'webhook' | 'manual'>(
    config?.syncType || 'manual'
  );
  const [sourceType, setSourceType] = useState<'api' | 'ftp' | 's3' | 'csv'>(
    config?.sourceType || 'api'
  );

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      syncType: config?.syncType || 'manual',
      schedule: config?.schedule || '',
      sourceType: config?.sourceType || 'api',
      sourceUrl: config?.sourceUrl || '',
      fieldMapping: config?.fieldMapping || {
        sku: 'sku',
        title: 'title',
        description: 'description',
        price: 'price',
        image: 'image_url',
      },
    },
  });

  const handleFormSubmit = async (data: SyncConfigFormData) => {
    await onSubmit({
      ...data,
      syncType,
      sourceType,
      fieldMapping: typeof data.fieldMapping === 'string' 
        ? JSON.parse(data.fieldMapping) 
        : data.fieldMapping,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
          <CardDescription>
            Configure how products are synchronized from your e-commerce platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="syncType">Sync Type</Label>
            <Select value={syncType} onValueChange={(value) => setSyncType(value as 'scheduled' | 'webhook' | 'manual')}>
              <SelectTrigger>
                <SelectValue placeholder="Select sync type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {syncType === 'manual' && 'Sync products manually when needed'}
              {syncType === 'scheduled' && 'Automatically sync on a schedule'}
              {syncType === 'webhook' && 'Sync when receiving webhook notifications'}
            </p>
          </div>

          {syncType === 'scheduled' && (
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
              <Input
                id="schedule"
                {...register('schedule', {
                  required: syncType === 'scheduled',
                })}
                placeholder="0 */6 * * * (every 6 hours)"
              />
              {errors.schedule && (
                <p className="text-sm text-red-500">Schedule is required</p>
              )}
              <p className="text-sm text-muted-foreground">
                Use cron syntax: minute hour day month weekday
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sourceType">Source Type</Label>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as 'api' | 'ftp' | 's3' | 'csv')}>
              <SelectTrigger>
                <SelectValue placeholder="Select source type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api">API Endpoint</SelectItem>
                <SelectItem value="csv">CSV Upload</SelectItem>
                <SelectItem value="ftp">FTP Server</SelectItem>
                <SelectItem value="s3">S3 Bucket</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(sourceType === 'api' || sourceType === 'ftp' || sourceType === 's3') && (
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input
                id="sourceUrl"
                {...register('sourceUrl', {
                  required: sourceType === 'api' || sourceType === 'ftp' || sourceType === 's3',
                })}
                placeholder={
                  sourceType === 'api'
                    ? 'https://api.yourstore.com/products'
                    : sourceType === 'ftp'
                    ? 'ftp://ftp.yourstore.com/products.json'
                    : 's3://your-bucket/products.json'
                }
              />
              {errors.sourceUrl && (
                <p className="text-sm text-red-500">Source URL is required</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fieldMapping">Field Mapping (JSON)</Label>
            <textarea
              id="fieldMapping"
              {...register('fieldMapping')}
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={JSON.stringify(
                {
                  sku: 'sku',
                  title: 'title',
                  description: 'description',
                  price: 'price',
                  image: 'image_url',
                },
                null,
                2
              )}
            />
            <p className="text-sm text-muted-foreground">
              Map your product fields to our schema
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : config ? 'Update Configuration' : 'Create Configuration'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
