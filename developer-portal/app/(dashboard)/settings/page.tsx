'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ProfileSection,
  CompanyInfoSection,
  NotificationPreferences,
  DangerZone,
} from '@/components/settings';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Merchant } from '@/types';
import { NotificationSettings } from '@/components/settings/NotificationPreferences';

export default function SettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const merchantId = session?.user?.merchantId || '';
  const token = session?.accessToken || '';

  // Fetch merchant profile
  const {
    data: merchant,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['merchant-profile', merchantId],
    queryFn: () => apiClient.getMerchantProfile(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Fetch merchant settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
  } = useQuery({
    queryKey: ['merchant-settings', merchantId],
    queryFn: () => apiClient.getMerchantSettings(merchantId, token),
    enabled: !!merchantId && !!token,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<Merchant>) =>
      apiClient.updateMerchantProfile(merchantId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-profile', merchantId] });
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  // Update notification preferences mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (preferences: NotificationSettings) => {
      // Update merchant settings with notification preferences
      const currentSettings = await apiClient.getMerchantSettings(merchantId, token);
      const existingSettings = (currentSettings as { settings?: Record<string, unknown> })?.settings || {};
      const updatedSettings = {
        ...existingSettings,
        notifications: preferences,
      };
      return apiClient.updateMerchantSettings(merchantId, updatedSettings, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-settings', merchantId] });
      toast({
        title: 'Success',
        description: 'Notification preferences updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update notification preferences',
        variant: 'destructive',
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiClient.deleteMerchantAccount(merchantId, token);
    },
    onSuccess: () => {
      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted',
      });
      window.location.href = '/login';
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to delete account',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateProfile = async (data: Partial<Merchant>) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const handleUpdateNotifications = async (preferences: NotificationSettings) => {
    await updateNotificationsMutation.mutateAsync(preferences);
  };

  const handleDeleteAccount = async () => {
    await deleteAccountMutation.mutateAsync();
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load settings. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        <ProfileSection
          merchant={merchant}
          onUpdate={handleUpdateProfile}
          isUpdating={updateProfileMutation.isPending}
        />

        <Separator />

        <CompanyInfoSection merchant={merchant} />

        <Separator />

        <NotificationPreferences
          onUpdate={handleUpdateNotifications}
          isUpdating={updateNotificationsMutation.isPending}
          initialPreferences={(settings as { settings?: { notifications?: NotificationSettings } })?.settings?.notifications}
        />

        <Separator />

        <DangerZone
          onDeleteAccount={handleDeleteAccount}
          isDeleting={deleteAccountMutation.isPending}
        />
      </div>
    </div>
  );
}
