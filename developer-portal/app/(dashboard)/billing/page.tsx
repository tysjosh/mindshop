'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  SubscriptionCard,
  InvoiceList,
  PaymentMethodForm,
  UpgradeDialog,
  AddPaymentMethodDialog,
} from '@/components/billing';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function BillingPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const merchantId = session?.user?.merchantId;
  const token = session?.accessToken;

  // Fetch billing info
  const { data: billingInfo, isLoading: billingLoading } = useQuery({
    queryKey: ['billing', merchantId],
    queryFn: () => apiClient.getBillingInfo(merchantId!, token!),
    enabled: !!merchantId && !!token,
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', merchantId],
    queryFn: () => apiClient.getInvoices(merchantId!, token!),
    enabled: !!merchantId && !!token,
  });

  // Fetch payment methods
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['payment-methods', merchantId],
    queryFn: () => apiClient.getPaymentMethods(merchantId!, token!),
    enabled: !!merchantId && !!token,
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: (plan: 'starter' | 'professional' | 'enterprise') =>
      apiClient.upgradePlan(merchantId!, { plan }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', merchantId] });
      setUpgradeDialogOpen(false);
      setSuccessMessage('Plan upgraded successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to upgrade plan');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: () => apiClient.cancelSubscription(merchantId!, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', merchantId] });
      setCancelDialogOpen(false);
      setSuccessMessage('Subscription will be canceled at the end of the billing period');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to cancel subscription');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Add payment method mutation
  const addPaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      apiClient.addPaymentMethod(merchantId!, { paymentMethodId, setAsDefault: true }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', merchantId] });
      setAddPaymentDialogOpen(false);
      setSuccessMessage('Payment method added successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to add payment method');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      apiClient.deletePaymentMethod(merchantId!, paymentMethodId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', merchantId] });
      setSuccessMessage('Payment method deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to delete payment method');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleUpgrade = (plan: 'starter' | 'professional' | 'enterprise') => {
    upgradeMutation.mutate(plan);
  };

  const handleCancel = () => {
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    cancelMutation.mutate();
  };

  const handleAddPaymentMethod = (paymentMethodId: string) => {
    addPaymentMethodMutation.mutate(paymentMethodId);
  };

  const handleDeletePaymentMethod = (paymentMethodId: string) => {
    deletePaymentMethodMutation.mutate(paymentMethodId);
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Please sign in to view billing information</p>
      </div>
    );
  }

  if (billingLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing</h1>
        <div className="space-y-4">
          <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
          <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
          <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (!billingInfo) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No billing information found. Please contact support to set up your account.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-gray-600 mt-1">Manage your subscription and billing information</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Subscription Card */}
      <SubscriptionCard
        billingInfo={billingInfo}
        onUpgrade={() => setUpgradeDialogOpen(true)}
        onCancel={handleCancel}
        isLoading={upgradeMutation.isPending || cancelMutation.isPending}
      />

      {/* Payment Methods */}
      <PaymentMethodForm
        paymentMethods={paymentMethods}
        onAdd={() => setAddPaymentDialogOpen(true)}
        onDelete={handleDeletePaymentMethod}
        isLoading={paymentMethodsLoading || deletePaymentMethodMutation.isPending}
      />

      {/* Invoices */}
      <InvoiceList invoices={invoices} isLoading={invoicesLoading} />

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        currentPlan={billingInfo.plan}
        onUpgrade={handleUpgrade}
        isLoading={upgradeMutation.isPending}
      />

      {/* Add Payment Method Dialog */}
      <AddPaymentMethodDialog
        open={addPaymentDialogOpen}
        onClose={() => setAddPaymentDialogOpen(false)}
        onAdd={handleAddPaymentMethod}
        isLoading={addPaymentMethodMutation.isPending}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You will continue to have access
              until the end of your current billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
