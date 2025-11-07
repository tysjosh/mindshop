'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, AlertCircle } from 'lucide-react';

const webhookSchema = z.object({
  url: z.string().url('Must be a valid HTTPS URL').startsWith('https://', 'URL must use HTTPS'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
});

type WebhookFormData = z.infer<typeof webhookSchema>;

interface CreateWebhookDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: WebhookFormData) => Promise<{ webhookId: string; secret: string }>;
}

const AVAILABLE_EVENTS = [
  { id: 'chat.query.completed', label: 'Chat Query Completed', description: 'When a chat query is successfully processed' },
  { id: 'chat.query.failed', label: 'Chat Query Failed', description: 'When a chat query fails' },
  { id: 'document.created', label: 'Document Created', description: 'When a new document is added' },
  { id: 'document.updated', label: 'Document Updated', description: 'When a document is modified' },
  { id: 'document.deleted', label: 'Document Deleted', description: 'When a document is removed' },
  { id: 'usage.limit.approaching', label: 'Usage Limit Approaching', description: 'When usage reaches 80% of limit' },
  { id: 'usage.limit.exceeded', label: 'Usage Limit Exceeded', description: 'When usage limit is exceeded' },
  { id: 'api_key.expiring', label: 'API Key Expiring', description: 'When an API key will expire in 7 days' },
];

export function CreateWebhookDialog({ open, onClose, onCreate }: CreateWebhookDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<{ webhookId: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
  });

  const handleClose = () => {
    reset();
    setSelectedEvents([]);
    setCreatedWebhook(null);
    setCopiedSecret(false);
    setError('');
    onClose();
  };

  const onSubmit = async (data: WebhookFormData) => {
    setIsCreating(true);
    setError('');

    try {
      const result = await onCreate({
        url: data.url,
        events: selectedEvents,
      });
      setCreatedWebhook(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopySecret = async () => {
    if (createdWebhook) {
      await navigator.clipboard.writeText(createdWebhook.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  if (createdWebhook) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Webhook Created Successfully</DialogTitle>
            <DialogDescription>
              Save your webhook secret securely. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use this secret to verify webhook signatures and ensure requests are from MindShop.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Webhook ID</Label>
              <div className="flex gap-2">
                <Input value={createdWebhook.webhookId} readOnly className="font-mono text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={createdWebhook.secret}
                  readOnly
                  className="font-mono text-sm"
                  type="password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                >
                  {copiedSecret ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Configure a webhook endpoint to receive real-time event notifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url">Endpoint URL</Label>
            <Input
              id="url"
              placeholder="https://your-domain.com/webhooks/mindshop"
              {...register('url')}
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be a publicly accessible HTTPS URL
            </p>
          </div>

          <div className="space-y-3">
            <Label>Events to Subscribe</Label>
            <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-lg p-4">
              {AVAILABLE_EVENTS.map((event) => (
                <div key={event.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={event.id}
                    checked={selectedEvents.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor={event.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {event.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-destructive">Select at least one event</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || selectedEvents.length === 0}>
              {isCreating ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
