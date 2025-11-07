'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface DangerZoneProps {
  onDeleteAccount: () => Promise<void>;
  isDeleting?: boolean;
}

export function DangerZone({ onDeleteAccount, isDeleting }: DangerZoneProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText === 'DELETE') {
      await onDeleteAccount();
      setShowDeleteDialog(false);
    }
  };

  const isConfirmValid = confirmText === 'DELETE';

  return (
    <>
      <Card className="border-destructive p-6">
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">
                Irreversible and destructive actions
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">Delete Account</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permanently delete your account and all associated data. This action
                    cannot be undone.
                  </p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>All API keys will be immediately revoked</li>
                  <li>All usage data and analytics will be deleted</li>
                  <li>All integrations will stop working</li>
                  <li>This action cannot be reversed</li>
                </ul>
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete your account and all associated data.
                This action cannot be undone.
              </p>
              <p className="font-semibold">
                Type <span className="font-mono bg-muted px-1">DELETE</span> to confirm:
              </p>
              <div className="space-y-2">
                <Label htmlFor="confirmDelete" className="sr-only">
                  Confirm deletion
                </Label>
                <Input
                  id="confirmDelete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!isConfirmValid || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
