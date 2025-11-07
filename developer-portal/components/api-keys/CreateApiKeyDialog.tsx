'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    environment: 'development' | 'production';
    permissions?: string[];
  }) => Promise<{ key: string; keyId: string }>;
}

// Available permissions with descriptions
const AVAILABLE_PERMISSIONS = [
  { value: 'chat:read', label: 'Chat: Read', description: 'Read chat history and conversation data' },
  { value: 'chat:write', label: 'Chat: Write', description: 'Send chat messages and create conversations' },
  { value: 'documents:read', label: 'Documents: Read', description: 'Read documents and product data' },
  { value: 'documents:write', label: 'Documents: Write', description: 'Create and update documents' },
  { value: 'documents:delete', label: 'Documents: Delete', description: 'Delete documents' },
  { value: 'sessions:read', label: 'Sessions: Read', description: 'Read session data' },
  { value: 'sessions:write', label: 'Sessions: Write', description: 'Create and manage sessions' },
  { value: 'analytics:read', label: 'Analytics: Read', description: 'View analytics and usage data' },
  { value: 'webhooks:read', label: 'Webhooks: Read', description: 'View webhook configurations' },
  { value: 'webhooks:write', label: 'Webhooks: Write', description: 'Manage webhook configurations' },
  { value: 'sync:read', label: 'Product Sync: Read', description: 'View product sync status and history' },
  { value: 'sync:write', label: 'Product Sync: Write', description: 'Trigger product syncs and manage configuration' },
];

export function CreateApiKeyDialog({
  open,
  onClose,
  onCreate,
}: CreateApiKeyDialogProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'development' | 'production'>(
    'development'
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handlePermissionToggle = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSelectAll = () => {
    if (selectedPermissions.length === AVAILABLE_PERMISSIONS.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.value));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPermissions.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one permission',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await onCreate({ 
        name: name.trim(), 
        environment,
        permissions: selectedPermissions 
      });
      setCreatedKey(result.key);
      setStep('success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create API key';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'API key copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('form');
    setName('');
    setEnvironment('development');
    setSelectedPermissions([]);
    setCreatedKey('');
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to integrate MindShop into your
                application.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production API Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  A descriptive name to help you identify this key
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={environment}
                  onValueChange={(value: 'development' | 'production') =>
                    setEnvironment(value)
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Development keys are for testing, production keys are for live
                  applications
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Permissions</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={isCreating}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    {selectedPermissions.length === AVAILABLE_PERMISSIONS.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the permissions this API key should have. You can always
                  create a new key with different permissions later.
                </p>
                <div className="max-h-64 overflow-y-auto rounded-md border p-4 space-y-3">
                  {AVAILABLE_PERMISSIONS.map((permission) => (
                    <div
                      key={permission.value}
                      className="flex items-start space-x-3"
                    >
                      <Checkbox
                        id={permission.value}
                        checked={selectedPermissions.includes(permission.value)}
                        onCheckedChange={() =>
                          handlePermissionToggle(permission.value)
                        }
                        disabled={isCreating}
                      />
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor={permission.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {permission.label}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create API Key'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Make sure to copy your API key now. You won&apos;t be able to see it
                again!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted p-4">
                <div className="flex items-center justify-between gap-2">
                  <code className="flex-1 break-all text-sm font-mono">
                    {createdKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Store this key securely. For security
                  reasons, we won&apos;t show it again. If you lose it, you&apos;ll need to
                  create a new one.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
