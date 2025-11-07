'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  CheckCircle,
  Ban,
  Trash2,
  UserCog,
  Calendar,
  Mail,
  Building,
  Globe,
  CreditCard,
  Activity,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Merchant } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface AuditLog {
  id: string;
  operation: string;
  outcome: string;
  reason?: string;
  actor: string;
  ipAddress?: string;
  createdAt: string;
}

interface MerchantDetails {
  merchant: Merchant;
  recentActivity: AuditLog[];
}

export default function MerchantDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const merchantId = params?.merchantId as string;

  const [merchantDetails, setMerchantDetails] = useState<MerchantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Status update dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Impersonation dialog
  const [showImpersonateDialog, setShowImpersonateDialog] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (session?.accessToken && merchantId) {
      fetchMerchantDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, merchantId]);

  const fetchMerchantDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/admin/merchants/${merchantId}`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch merchant details');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setMerchantDetails(data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: unknown) {
      console.error('Error fetching merchant details:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load merchant details';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || !merchantDetails) return;

    try {
      setUpdatingStatus(true);

      const response = await fetch(
        `${API_BASE_URL}/admin/merchants/${merchantId}/status`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: newStatus,
            reason: statusReason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update merchant status');
      }

      // Refresh merchant details
      await fetchMerchantDetails();
      
      setShowStatusDialog(false);
      setNewStatus('');
      setStatusReason('');
    } catch (err: unknown) {
      console.error('Error updating status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      alert(errorMessage);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleImpersonate = async () => {
    if (!merchantDetails) return;

    try {
      setImpersonating(true);

      const response = await fetch(
        `${API_BASE_URL}/admin/merchants/${merchantId}/impersonate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to impersonate merchant');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Store impersonation state in localStorage
        const impersonationState = {
          isImpersonating: true,
          merchantId: data.data.merchantId,
          companyName: data.data.companyName,
          impersonatedBy: session?.user?.email || 'Admin',
          token: data.data.impersonationToken,
        };
        localStorage.setItem('impersonation_state', JSON.stringify(impersonationState));

        // Redirect to merchant dashboard
        router.push('/dashboard');
        setShowImpersonateDialog(false);
      }
    } catch (err: unknown) {
      console.error('Error impersonating merchant:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to impersonate merchant';
      alert(errorMessage);
    } finally {
      setImpersonating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      active: { variant: 'default', label: 'Active' },
      pending_verification: { variant: 'secondary', label: 'Pending' },
      suspended: { variant: 'destructive', label: 'Suspended' },
      deleted: { variant: 'outline', label: 'Deleted' },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const planConfig: Record<string, { color: string, label: string }> = {
      starter: { color: 'bg-blue-100 text-blue-800', label: 'Starter' },
      professional: { color: 'bg-purple-100 text-purple-800', label: 'Professional' },
      enterprise: { color: 'bg-orange-100 text-orange-800', label: 'Enterprise' },
    };

    const config = planConfig[plan] || { color: 'bg-gray-100 text-gray-800', label: plan };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOutcomeBadge = (outcome: string) => {
    if (outcome === 'success') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading merchant details...</p>
        </div>
      </div>
    );
  }

  if (error || !merchantDetails) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin/merchants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Merchants
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              <p className="text-sm">{error || 'Merchant not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { merchant, recentActivity } = merchantDetails;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/merchants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Merchants
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{merchant.companyName}</h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{merchant.merchantId}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(merchant.status)}
          {getPlanBadge(merchant.plan)}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          onClick={() => setShowStatusDialog(true)}
          disabled={merchant.status === 'deleted'}
        >
          <Activity className="h-4 w-4 mr-2" />
          Update Status
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowImpersonateDialog(true)}
          disabled={merchant.status !== 'active'}
        >
          <UserCog className="h-4 w-4 mr-2" />
          Impersonate
        </Button>
      </div>

      {/* Merchant Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Merchant account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{merchant.email}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Building className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Company Name</p>
                <p className="text-sm text-gray-900">{merchant.companyName}</p>
              </div>
            </div>
            {merchant.website && (
              <div className="flex items-start space-x-3">
                <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Website</p>
                  <a
                    href={merchant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {merchant.website}
                  </a>
                </div>
              </div>
            )}
            {merchant.industry && (
              <div className="flex items-start space-x-3">
                <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Industry</p>
                  <p className="text-sm text-gray-900">{merchant.industry}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Current account state and plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Activity className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(merchant.status)}</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CreditCard className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Plan</p>
                <div className="mt-1">{getPlanBadge(merchant.plan)}</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="text-sm text-gray-900">{formatDate(merchant.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Last Updated</p>
                <p className="text-sm text-gray-900">{formatDate(merchant.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Last 20 audit log entries for this merchant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent activity</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.operation}
                      </TableCell>
                      <TableCell className="text-sm">{log.actor}</TableCell>
                      <TableCell>{getOutcomeBadge(log.outcome)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {log.ipAddress || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Merchant Status</AlertDialogTitle>
            <AlertDialogDescription>
              Change the status of {merchant.companyName}. This action will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="suspended">
                    <div className="flex items-center">
                      <Ban className="h-4 w-4 mr-2 text-red-600" />
                      Suspended
                    </div>
                  </SelectItem>
                  <SelectItem value="deleted">
                    <div className="flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-gray-600" />
                      Deleted
                    </div>
                  </SelectItem>
                  <SelectItem value="pending_verification">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
                      Pending Verification
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for status change..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusUpdate}
              disabled={!newStatus || updatingStatus}
            >
              {updatingStatus ? 'Updating...' : 'Update Status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impersonate Dialog */}
      <AlertDialog open={showImpersonateDialog} onOpenChange={setShowImpersonateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate Merchant</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to impersonate {merchant.companyName}. All actions will be logged and attributed to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Use impersonation only for debugging and support purposes. All actions will be audited.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={impersonating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImpersonate}
              disabled={impersonating}
            >
              {impersonating ? 'Starting...' : 'Start Impersonation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
