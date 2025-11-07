'use client';

import { useState } from 'react';
import { PaymentMethod } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Trash2, Plus } from 'lucide-react';
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

interface PaymentMethodFormProps {
  paymentMethods: PaymentMethod[];
  onAdd: () => void;
  onDelete: (paymentMethodId: string) => void;
  isLoading?: boolean;
}

export function PaymentMethodForm({
  paymentMethods,
  onAdd,
  onDelete,
  isLoading = false,
}: PaymentMethodFormProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const handleDeleteClick = (paymentMethodId: string) => {
    setSelectedMethodId(paymentMethodId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedMethodId) {
      onDelete(selectedMethodId);
      setDeleteDialogOpen(false);
      setSelectedMethodId(null);
    }
  };

  const getCardBrandIcon = () => {
    // In a real app, you'd use actual card brand logos
    return <CreditCard className="h-5 w-5 text-gray-600" />;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your payment methods</CardDescription>
            </div>
            <Button onClick={onAdd} disabled={isLoading} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No payment methods</p>
              <p className="text-sm text-gray-500 mt-1">
                Add a payment method to subscribe to a plan
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getCardBrandIcon()}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Card'} ending in {method.last4}
                        </p>
                        {method.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      {method.expMonth && method.expYear && (
                        <p className="text-sm text-gray-600">
                          Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(method.stripePaymentMethodId)}
                    disabled={isLoading || method.isDefault}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
