'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ErrorLog {
  id: string;
  timestamp: string;
  merchantId: string;
  userId?: string;
  sessionId?: string;
  operation: string;
  requestPayloadHash: string;
  responseReference: string;
  outcome: 'success' | 'failure';
  reason?: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
}

export default function ErrorLogsPage() {
  const { data: session } = useSession();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  // Filters
  const [merchantIdFilter, setMerchantIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (session?.accessToken) {
      fetchErrors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentPage, pageSize]);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (currentPage - 1) * pageSize;
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });

      if (merchantIdFilter) {
        params.append('merchantId', merchantIdFilter);
      }

      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }

      if (endDate) {
        params.append('endDate', new Date(endDate).toISOString());
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/errors?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch error logs');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setErrors(data.data.errors || []);
        setTotalCount(data.data.pagination?.total || 0);
      } else if (data.errors) {
        setErrors(data.errors || []);
        setTotalCount(data.pagination?.total || 0);
      } else {
        setErrors([]);
        setTotalCount(0);
      }
      
      setLastRefresh(new Date());
    } catch (err: unknown) {
      console.error('Error fetching error logs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load error logs';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchErrors();
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchErrors();
  };

  const handleClearFilters = () => {
    setMerchantIdFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    fetchErrors();
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getSeverityIcon = (operation: string, outcome: string) => {
    if (outcome === 'failure') {
      if (operation.includes('auth') || operation.includes('security')) {
        return <XCircle className="h-5 w-5 text-red-600" />;
      }
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
    return <Info className="h-5 w-5 text-blue-600" />;
  };

  const getSeverityBadge = (outcome: string) => {
    if (outcome === 'failure') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Info</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-gray-500 mt-2">
            Monitor system errors and audit logs
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {errors.filter(e => e.operation.includes('auth') || e.operation.includes('security')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {errors.filter(e => !e.operation.includes('auth') && !e.operation.includes('security')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Non-critical issues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter error logs by merchant, date range, or operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Merchant ID Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Merchant ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Filter by merchant..."
                  value={merchantIdFilter}
                  onChange={(e) => setMerchantIdFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Page Size */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Page Size
              </label>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="200">200 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-4">
            <Button onClick={handleApplyFilters} disabled={loading}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button onClick={handleClearFilters} variant="outline" disabled={loading}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `${totalCount} total error logs`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                <p className="text-muted-foreground">Loading error logs...</p>
              </div>
            </div>
          ) : errors.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No error logs found</p>
              <p className="text-sm text-gray-400 mt-2">
                Try adjusting your filters or check back later
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Severity</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Merchant ID</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((log) => (
                      <TableRow key={log.id} className="hover:bg-gray-50">
                        <TableCell>
                          {getSeverityIcon(log.operation, log.outcome)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {truncateText(log.merchantId, 20)}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {log.operation}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {truncateText(log.actor, 25)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs">
                          {log.reason ? truncateText(log.reason, 50) : '-'}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {log.ipAddress || '-'}
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(log.outcome)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to{' '}
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount} error logs
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
