'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Merchant } from '@/types';

interface CompanyInfoSectionProps {
  merchant: Merchant;
}

export function CompanyInfoSection({ merchant }: CompanyInfoSectionProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    switch (merchant.status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending_verification':
        return <Badge variant="warning">Pending Verification</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{merchant.status}</Badge>;
    }
  };

  const getPlanBadge = () => {
    switch (merchant.plan) {
      case 'enterprise':
        return <Badge variant="default">Enterprise</Badge>;
      case 'professional':
        return <Badge variant="default">Professional</Badge>;
      case 'starter':
        return <Badge variant="secondary">Starter</Badge>;
      default:
        return <Badge variant="outline">{merchant.plan}</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Company Information</h3>
          <p className="text-sm text-muted-foreground">
            View your account details and subscription
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium">Merchant ID</p>
              <p className="text-sm text-muted-foreground">
                Your unique merchant identifier
              </p>
            </div>
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {merchant.merchantId}
            </code>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium">Account Status</p>
              <p className="text-sm text-muted-foreground">
                Current status of your account
              </p>
            </div>
            {getStatusBadge()}
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium">Current Plan</p>
              <p className="text-sm text-muted-foreground">
                Your subscription plan
              </p>
            </div>
            {getPlanBadge()}
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium">Member Since</p>
              <p className="text-sm text-muted-foreground">
                Account creation date
              </p>
            </div>
            <p className="text-sm">{formatDate(merchant.createdAt)}</p>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Last Updated</p>
              <p className="text-sm text-muted-foreground">
                Profile last modified
              </p>
            </div>
            <p className="text-sm">{formatDate(merchant.updatedAt)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
