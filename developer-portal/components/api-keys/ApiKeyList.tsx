'use client';

import { ApiKey } from '@/types';
import { ApiKeyCard } from './ApiKeyCard';

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onDelete: (keyId: string) => void;
  onRotate?: (keyId: string) => void;
  onViewUsage?: (keyId: string) => void;
  deletingKeyId?: string;
  rotatingKeyId?: string;
}

export function ApiKeyList({ apiKeys, onDelete, onRotate, onViewUsage, deletingKeyId, rotatingKeyId }: ApiKeyListProps) {
  if (apiKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <div className="mx-auto max-w-md space-y-2">
          <h3 className="text-lg font-semibold">No API keys yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first API key to start integrating MindShop into
            your application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {apiKeys.map((apiKey) => (
        <ApiKeyCard
          key={apiKey.keyId}
          apiKey={apiKey}
          onDelete={onDelete}
          onRotate={onRotate}
          onViewUsage={onViewUsage}
          isDeleting={deletingKeyId === apiKey.keyId}
          isRotating={rotatingKeyId === apiKey.keyId}
        />
      ))}
    </div>
  );
}
