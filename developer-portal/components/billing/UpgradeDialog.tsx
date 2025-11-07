'use client';

import { useState } from 'react';
import { PlanDetails } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  currentPlan: 'starter' | 'professional' | 'enterprise';
  onUpgrade: (plan: 'starter' | 'professional' | 'enterprise') => void;
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

export function UpgradeDialog({
  open,
  onClose,
  currentPlan,
  onUpgrade,
  isLoading = false,
}: UpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional' | 'enterprise'>(
    currentPlan
  );

  const plans = ['starter', 'professional', 'enterprise'] as const;
  const currentPlanIndex = plans.indexOf(currentPlan);

  const handleUpgrade = () => {
    onUpgrade(selectedPlan);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose a plan that fits your needs. You can upgrade or downgrade at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {plans.map((planKey, index) => {
            const plan = PLAN_DETAILS[planKey];
            const isCurrentPlan = planKey === currentPlan;
            const isSelected = planKey === selectedPlan;
            const isDowngrade = index < currentPlanIndex;

            return (
              <div
                key={planKey}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600 ring-opacity-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isCurrentPlan ? 'bg-gray-50' : ''}`}
                onClick={() => !isCurrentPlan && setSelectedPlan(planKey)}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  {plan.price > 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-600">/month</span>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-gray-900">Custom Pricing</div>
                  )}
                </div>

                {isCurrentPlan && (
                  <div className="mb-4">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      Current Plan
                    </span>
                  </div>
                )}

                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isDowngrade && !isCurrentPlan && (
                  <p className="text-xs text-amber-600 mt-2">
                    Note: Downgrading may result in data loss if you exceed the new limits.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isLoading || selectedPlan === currentPlan}
          >
            {isLoading ? 'Processing...' : `Upgrade to ${PLAN_DETAILS[selectedPlan].name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
