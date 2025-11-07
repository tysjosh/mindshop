'use client';

import { useState } from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImpersonationBannerProps {
  merchantId: string;
  companyName: string;
  impersonatedBy: string;
  onExit: () => void;
}

/**
 * ImpersonationBanner Component
 * 
 * Displays a prominent banner when an admin is impersonating a merchant.
 * Shows who is being impersonated and provides an exit button.
 * 
 * @see .kiro/specs/merchant-platform/tasks.md - Task 13.2 Admin UI (Add impersonation mode)
 */
export function ImpersonationBanner({
  merchantId,
  companyName,
  impersonatedBy,
  onExit,
}: ImpersonationBannerProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = async () => {
    setIsExiting(true);
    try {
      await onExit();
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <Alert className="border-orange-500 bg-orange-50 mb-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-orange-900">
            <span className="font-semibold">Impersonation Mode Active</span>
            <span className="mx-2">•</span>
            <span>
              You are viewing as <strong>{companyName}</strong> ({merchantId})
            </span>
            <span className="mx-2">•</span>
            <span className="text-sm text-orange-700">
              Impersonated by: {impersonatedBy}
            </span>
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          disabled={isExiting}
          className="border-orange-600 text-orange-600 hover:bg-orange-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </Button>
      </div>
    </Alert>
  );
}
