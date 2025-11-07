'use client';

import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductSyncHistory } from '@/types';

interface SyncHistoryTableProps {
  history: ProductSyncHistory[];
}

export function SyncHistoryTable({ history }: SyncHistoryTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>View past synchronization attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No sync history yet</p>
            <p className="text-sm">Trigger a sync to see history here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
        <CardDescription>View past synchronization attempts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((sync) => (
                <TableRow key={sync.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(sync.status)}
                      {getStatusBadge(sync.status)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sync.syncType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(sync.startedAt)}</TableCell>
                  <TableCell className="text-sm">{formatDuration(sync.duration)}</TableCell>
                  <TableCell className="text-sm">{sync.productsProcessed}</TableCell>
                  <TableCell className="text-sm text-green-600">
                    {sync.productsCreated}
                  </TableCell>
                  <TableCell className="text-sm text-blue-600">
                    {sync.productsUpdated}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {sync.productsSkipped}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
