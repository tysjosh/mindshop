'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  DollarSign, 
  AlertCircle,
  BarChart3,
  Clock,
  Zap
} from 'lucide-react';

export default function MetricsPage() {
  const { data: session } = useSession();

  // Mock data for now - replace with actual API calls
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // return apiClient.getAdminMetrics(session?.accessToken!);
      return {
        platform: {
          totalMerchants: 156,
          activeMerchants: 142,
          totalApiCalls: 1250000,
          avgResponseTime: 145,
        },
        usage: {
          last24h: 45000,
          last7d: 280000,
          last30d: 1250000,
        },
        revenue: {
          mrr: 45600,
          arr: 547200,
          growth: 12.5,
        },
        performance: {
          uptime: 99.98,
          errorRate: 0.02,
          avgLatency: 145,
        },
      };
    },
    enabled: !!session,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Metrics</h1>
          <p className="text-gray-600 mt-1">Loading metrics...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Metrics</h1>
        <p className="text-gray-600 mt-1">Real-time analytics and performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.platform.totalMerchants}</div>
            <p className="text-xs text-gray-600 mt-1">
              {metrics?.platform.activeMerchants} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls (30d)</CardTitle>
            <Activity className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.platform.totalApiCalls.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {metrics?.usage.last24h.toLocaleString()} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(metrics?.revenue.mrr || 0).toLocaleString()}
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +{metrics?.revenue.growth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.platform.avgResponseTime}ms</div>
            <p className="text-xs text-gray-600 mt-1">
              {metrics?.performance.uptime}% uptime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance
            </CardTitle>
            <CardDescription>System performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="font-semibold">{metrics?.performance.uptime}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="font-semibold">{metrics?.performance.errorRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Latency</span>
              <span className="font-semibold">{metrics?.performance.avgLatency}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Trends
            </CardTitle>
            <CardDescription>API usage over time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 24 hours</span>
              <span className="font-semibold">
                {metrics?.usage.last24h.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="font-semibold">
                {metrics?.usage.last7d.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="font-semibold">
                {metrics?.usage.last30d.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Metrics are updated in real-time. Historical data is available for the last 90 days.
          For detailed analytics, use the merchant-specific analytics pages.
        </AlertDescription>
      </Alert>
    </div>
  );
}
