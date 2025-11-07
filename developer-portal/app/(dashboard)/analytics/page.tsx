'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  MetricsGrid,
  QueryChart,
  TopQueriesTable,
  DateRangePicker,
  DateRange,
} from '@/components/analytics';
import { apiClient } from '@/lib/api-client';

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const merchantId = session?.user?.merchantId;
  const token = session?.accessToken;

  // Default to last 30 days - use useState with function initializer to ensure it only runs once
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    label: 'Last 30 days',
  }));

  // Fetch analytics overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview', merchantId, dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      apiClient.getAnalytics(
        merchantId!,
        dateRange.startDate,
        dateRange.endDate,
        token
      ),
    enabled: !!merchantId && !!token,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch query time series
  const { data: queryTimeSeries, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['analytics', 'queries', merchantId, dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      apiClient.getQueryTimeSeries(
        merchantId!,
        dateRange.startDate,
        dateRange.endDate,
        'day',
        token!
      ),
    enabled: !!merchantId && !!token,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch top queries
  const { data: topQueries, isLoading: topQueriesLoading } = useQuery({
    queryKey: ['analytics', 'top-queries', merchantId],
    queryFn: () => apiClient.getTopQueries(merchantId!, 20, token!),
    enabled: !!merchantId && !!token,
  });

  const handleExportCSV = () => {
    if (!topQueries) return;

    // Create CSV content
    const headers = ['Query', 'Count', 'Avg Confidence'];
    const rows = topQueries.map((q) => [
      `"${q.query.replace(/"/g, '""')}"`,
      q.count,
      (q.avgConfidence * 100).toFixed(2) + '%',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange.label.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            View detailed usage and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!topQueries || topQueries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <MetricsGrid
        data={overview}
        isLoading={overviewLoading}
      />

      {/* Query Chart */}
      <QueryChart
        data={queryTimeSeries}
        isLoading={timeSeriesLoading}
      />

      {/* Top Queries Table */}
      <TopQueriesTable
        data={topQueries}
        isLoading={topQueriesLoading}
      />
    </div>
  );
}
