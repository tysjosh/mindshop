'use client';

import { BillingInfo, PlanDetails } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface SubscriptionCardProps {
  billingInfo: BillingInfo;
  onUpgrade: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PLAN_DETAILS: Record<string, PlanDetails> = {
  starter: {
    name: 'Starter',
    price: 99,
    currency: 'USD',
    interval: 'month',
    features: [
      '1,000 queries/month',
      '100 documents',
      '7-day data retention',
      'Email support',
    ],
    limits: {
      queriesPerMonth: 1000,
      documentsMax: 100,
      apiCallsPerDay: 5000,
      storageGbMax: 1,
    },
  },
  professional: {
    name: 'Professional',
    price: 499,
    currency: 'USD',
    interval: 'month',
    features: [
      '10,000 queries/month',
      '1,000 documents',
      '30-day data retention',
      'Priority support',
      'Custom branding',
    ],
    limits: {
      queriesPerMonth: 10000,
      documentsMax: 1000,
      apiCallsPerDay: 50000,
      storageGbMax: 10,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 0,
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited queries',
      'Unlimited documents',
      'Unlimited retention',
      '24/7 support',
      'SLA guarantees',
      'Dedicated account manager',
    ],
    limits: {
      queriesPerMonth: 999999999,
      documentsMax: 999999999,
      apiCallsPerDay: 999999999,
      storageGbMax: 1000,
    },
  },
};

export function SubscriptionCard({
  billingInfo,
  onUpgrade,
  onCancel,
  isLoading = false,
}: SubscriptionCardProps) {
  const planDetails = PLAN_DETAILS[billingInfo.plan];
  const statusIcon = {
    active: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    trialing: <Clock className="h-4 w-4 text-blue-600" />,
    past_due: <AlertCircle className="h-4 w-4 text-red-600" />,
    canceled: <AlertCircle className="h-4 w-4 text-gray-600" />,
  }[billingInfo.status];

  const statusColor = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-red-100 text-red-800',
    canceled: 'bg-gray-100 text-gray-800',
  }[billingInfo.status];

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </div>
          <Badge className={statusColor}>
            <span className="flex items-center gap-1">
              {statusIcon}
              {billingInfo.status.replace('_', ' ')}
            </span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div>
          <div className="flex items-baseline gap-2 mb-4">
            <h3 className="text-3xl font-bold">{planDetails.name}</h3>
            {planDetails.price > 0 && (
              <span className="text-2xl font-semibold text-gray-900">
                ${planDetails.price}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </span>
            )}
            {planDetails.price === 0 && (
              <span className="text-lg font-semibold text-gray-900">Custom Pricing</span>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-2">
            {planDetails.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Billing Period */}
        {billingInfo.currentPeriodStart && billingInfo.currentPeriodEnd && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Current period start</p>
                <p className="font-medium">{formatDate(billingInfo.currentPeriodStart)}</p>
              </div>
              <div>
                <p className="text-gray-600">Current period end</p>
                <p className="font-medium">{formatDate(billingInfo.currentPeriodEnd)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Notice */}
        {billingInfo.cancelAtPeriodEnd && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Subscription will be canceled</strong> at the end of the current billing
              period on {formatDate(billingInfo.currentPeriodEnd)}.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {billingInfo.status === 'active' && !billingInfo.cancelAtPeriodEnd && (
            <>
              {billingInfo.plan !== 'enterprise' && (
                <Button onClick={onUpgrade} disabled={isLoading} className="flex-1">
                  Upgrade Plan
                </Button>
              )}
              <Button
                onClick={onCancel}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                Cancel Subscription
              </Button>
            </>
          )}
          {billingInfo.status === 'past_due' && (
            <Button onClick={onUpgrade} disabled={isLoading} className="flex-1">
              Update Payment Method
            </Button>
          )}
          {billingInfo.status === 'canceled' && (
            <Button onClick={onUpgrade} disabled={isLoading} className="flex-1">
              Reactivate Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
