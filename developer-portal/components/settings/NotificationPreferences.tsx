'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface NotificationSettings {
  emailNotifications: {
    usageLimitWarning: boolean;
    apiKeyExpiring: boolean;
    weeklyReport: boolean;
    systemUpdates: boolean;
  };
}

interface NotificationPreferencesProps {
  onUpdate: (preferences: NotificationSettings) => Promise<void>;
  isUpdating?: boolean;
  initialPreferences?: NotificationSettings;
}

export function NotificationPreferences({ onUpdate, isUpdating, initialPreferences }: NotificationPreferencesProps) {
  const defaultPreferences: NotificationSettings = {
    emailNotifications: {
      usageLimitWarning: true,
      apiKeyExpiring: true,
      weeklyReport: false,
      systemUpdates: true,
    },
  };

  const [preferences, setPreferences] = useState<NotificationSettings>(() => {
    if (!initialPreferences || !initialPreferences.emailNotifications) {
      return defaultPreferences;
    }
    return initialPreferences;
  });

  const [isDirty, setIsDirty] = useState(false);

  const handleToggle = (key: keyof NotificationSettings['emailNotifications']) => {
    setPreferences((prev) => ({
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: !prev.emailNotifications[key],
      },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    await onUpdate(preferences);
    setIsDirty(false);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Notification Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Manage how you receive notifications
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="usageLimitWarning" className="text-base cursor-pointer">
                Usage Limit Warnings
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you reach 80% of your usage limits
              </p>
            </div>
            <input
              id="usageLimitWarning"
              type="checkbox"
              checked={preferences.emailNotifications.usageLimitWarning}
              onChange={() => handleToggle('usageLimitWarning')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="apiKeyExpiring" className="text-base cursor-pointer">
                API Key Expiration
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified 7 days before your API keys expire
              </p>
            </div>
            <input
              id="apiKeyExpiring"
              type="checkbox"
              checked={preferences.emailNotifications.apiKeyExpiring}
              onChange={() => handleToggle('apiKeyExpiring')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="weeklyReport" className="text-base cursor-pointer">
                Weekly Reports
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive weekly usage and analytics reports
              </p>
            </div>
            <input
              id="weeklyReport"
              type="checkbox"
              checked={preferences.emailNotifications.weeklyReport}
              onChange={() => handleToggle('weeklyReport')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label htmlFor="systemUpdates" className="text-base cursor-pointer">
                System Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about platform updates and maintenance
              </p>
            </div>
            <input
              id="systemUpdates"
              type="checkbox"
              checked={preferences.emailNotifications.systemUpdates}
              onChange={() => handleToggle('systemUpdates')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isUpdating}
          >
            {isUpdating ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
