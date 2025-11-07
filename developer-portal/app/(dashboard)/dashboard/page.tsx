'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  StatsCard,
  UsageChart,
  RecentActivity,
  QuickActions,
} from '@/components/dashboard';
import {
  MessageSquare,
  Users,
  Zap,
  CheckCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data: session } = useSession();
  const merchantId = session?.user?.merchantId;
  const accessToken = session?.accessToken;

  // Fetch analytics overview
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['analytics', 'overview', merchantId],
    queryFn: () => apiClient.getAnalytics(merchantId!, undefined, undefined, accessToken),
    enabled: !!merchantId && !!accessToken,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch usage data
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage', 'current', merchantId],
    queryFn: () => apiClient.getCurrentUsage(merchantId!, accessToken!),
    enabled: !!merchantId && !!accessToken,
    refetchInterval: 60000,
  });

  // Fetch query time series for chart (last 7 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const { data: queryTimeSeries, isLoading: chartLoading } = useQuery({
    queryKey: ['analytics', 'queries', merchantId, startDate, endDate],
    queryFn: () =>
      apiClient.getQueryTimeSeries(
        merchantId!,
        startDate.toISOString(),
        endDate.toISOString(),
        'day',
        accessToken!
      ),
    enabled: !!merchantId && !!accessToken,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Mock recent activity (in production, this would come from an API)
  const recentActivities = [
    {
      id: '1',
      type: 'query' as const,
      message: 'New chat query processed successfully',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: '2',
      type: 'api_key' as const,
      message: 'API key "Production Key" was used',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      id: '3',
      type: 'success' as const,
      message: 'Document sync completed',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: '4',
      type: 'query' as const,
      message: 'Product recommendation generated',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    },
    {
      id: '5',
      type: 'success' as const,
      message: 'Webhook delivered successfully',
      timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    },
  ];

  // Calculate trends (mock for now)
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { change: '+100%', trend: 'up' as const };
    const percentChange = ((current - previous) / previous) * 100;
    return {
      change: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
      trend: percentChange > 0 ? 'up' as const : percentChange < 0 ? 'down' as const : 'neutral' as const,
    };
  };

  // Mock previous values for trend calculation
  const previousQueries = analytics?.totalQueries ? Math.floor(analytics.totalQueries * 0.88) : 0;
  const previousSessions = analytics?.activeSessions ? Math.floor(analytics.activeSessions * 0.95) : 0;
  const previousResponseTime = analytics?.avgResponseTime ? Math.floor(analytics.avgResponseTime * 1.08) : 0;
  const previousSuccessRate = analytics?.successRate ? analytics.successRate - 0.5 : 0;

  const queriesToday = analytics?.totalQueries || 0;
  const activeSessions = analytics?.activeSessions || 0;
  const avgResponseTime = analytics?.avgResponseTime || 0;
  const successRate = analytics?.successRate || 0;

  const queriesTrend = calculateTrend(queriesToday, previousQueries);
  const sessionsTrend = calculateTrend(activeSessions, previousSessions);
  const responseTrend = calculateTrend(previousResponseTime, avgResponseTime); // Inverted for response time
  const successTrend = calculateTrend(successRate, previousSuccessRate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your MindShop.
        </p>
      </div>

      {/* Error State */}
      {analyticsError && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">
            Unable to load analytics data. Please try refreshing the page.
          </p>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Queries Today"
          value={queriesToday.toLocaleString()}
          change={queriesTrend.change}
          trend={queriesTrend.trend}
          isLoading={analyticsLoading}
          icon={<MessageSquare className="h-6 w-6" />}
        />
        <StatsCard
          title="Active Sessions"
          value={activeSessions.toLocaleString()}
          change={sessionsTrend.change}
          trend={sessionsTrend.trend}
          isLoading={analyticsLoading}
          icon={<Users className="h-6 w-6" />}
        />
        <StatsCard
          title="Avg Response Time"
          value={`${avgResponseTime}ms`}
          change={responseTrend.change}
          trend={responseTrend.trend}
          isLoading={analyticsLoading}
          icon={<Zap className="h-6 w-6" />}
        />
        <StatsCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          change={successTrend.change}
          trend={successTrend.trend}
          isLoading={analyticsLoading}
          icon={<CheckCircle className="h-6 w-6" />}
        />
      </div>

      {/* Usage Chart */}
      <UsageChart data={queryTimeSeries} isLoading={chartLoading} />

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <RecentActivity activities={recentActivities} />

        {/* Usage Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Usage Summary</h3>
          {usageLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-2 w-full mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : usage ? (
            <div className="space-y-4">
              {/* Queries */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Queries</span>
                  <span className="font-medium">
                    {usage.queries.count.toLocaleString()} / {usage.queries.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(usage.queries.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {usage.queries.percentage.toFixed(1)}% of monthly limit
                </p>
              </div>

              {/* Documents */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Documents</span>
                  <span className="font-medium">
                    {usage.documents.count.toLocaleString()} / {usage.documents.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${Math.min(usage.documents.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {usage.documents.percentage.toFixed(1)}% of limit
                </p>
              </div>

              {/* API Calls */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">API Calls (24h)</span>
                  <span className="font-medium">
                    {usage.apiCalls.count.toLocaleString()} / {usage.apiCalls.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${Math.min(usage.apiCalls.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {usage.apiCalls.percentage.toFixed(1)}% of daily limit
                </p>
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Storage</span>
                  <span className="font-medium">
                    {usage.storageGb.count.toFixed(2)} GB / {usage.storageGb.limit} GB
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-600 transition-all"
                    style={{ width: `${Math.min(usage.storageGb.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {usage.storageGb.percentage.toFixed(1)}% of limit
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-gray-500">
              No usage data available
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
