'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Database,
  Server,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface SystemHealth {
  status: string;
  timestamp: string;
  services: {
    database: { status: string; responseTime: number };
    redis: { status: string; responseTime: number };
    mindsdb: { status: string; responseTime: number };
  };
  version: string;
  uptime: number;
}

interface SystemMetrics {
  period: string;
  timestamp: string;
  merchants: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
  };
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    nodeVersion: string;
    platform: string;
    arch: string;
  };
}

export default function SystemHealthPage() {
  const { data: session } = useSession();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('24h');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (session?.accessToken) {
      fetchHealthData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch health status
      const healthResponse = await fetch(`${API_BASE_URL}/admin/system/health`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!healthResponse.ok) {
        throw new Error('Failed to fetch system health');
      }

      const healthData = await healthResponse.json();
      setHealth(healthData.success ? healthData.data : healthData);

      // Fetch metrics
      const metricsResponse = await fetch(
        `${API_BASE_URL}/admin/system/metrics?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!metricsResponse.ok) {
        throw new Error('Failed to fetch system metrics');
      }

      const metricsData = await metricsResponse.json();
      setMetrics(metricsData.success ? metricsData.data : metricsData);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      console.error('Error fetching health data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load system health data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchHealthData();
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'healthy' || statusLower === 'ok') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
    } else if (statusLower === 'degraded' || statusLower === 'warning') {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Degraded</Badge>;
    } else {
      return <Badge variant="destructive">Unhealthy</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading && !health && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-2">
            Monitor system performance and health metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Overall Status */}
      {health && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(health.status)}
                <div>
                  <CardTitle>Overall System Status</CardTitle>
                  <CardDescription>
                    Last updated: {new Date(lastRefresh).toLocaleTimeString()}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(health.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Server className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Version</p>
                  <p className="text-lg font-semibold">{health.version}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-500">Uptime</p>
                  <p className="text-lg font-semibold">{formatUptime(health.uptime)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Activity className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-lg font-semibold capitalize">{health.status}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Zap className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-500">Environment</p>
                  <p className="text-lg font-semibold">
                    {process.env.NODE_ENV || 'production'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Health */}
      {health?.services && (
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
            <CardDescription>
              Status and response times for critical services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Database */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Database className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-medium">PostgreSQL Database</p>
                    <p className="text-sm text-gray-500">
                      Primary data store
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Response Time</p>
                    <p className="font-semibold">
                      {formatResponseTime(health.services.database.responseTime)}
                    </p>
                  </div>
                  {getStatusBadge(health.services.database.status)}
                </div>
              </div>

              {/* Redis */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Zap className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-medium">Redis Cache</p>
                    <p className="text-sm text-gray-500">
                      Caching and session storage
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Response Time</p>
                    <p className="font-semibold">
                      {formatResponseTime(health.services.redis.responseTime)}
                    </p>
                  </div>
                  {getStatusBadge(health.services.redis.status)}
                </div>
              </div>

              {/* MindsDB */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="h-6 w-6 text-purple-600" />
                  <div>
                    <p className="font-medium">MindsDB</p>
                    <p className="text-sm text-gray-500">
                      ML and RAG service
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Response Time</p>
                    <p className="font-semibold">
                      {formatResponseTime(health.services.mindsdb.responseTime)}
                    </p>
                  </div>
                  {getStatusBadge(health.services.mindsdb.status)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Merchant Statistics */}
      {metrics?.merchants && (
        <Card>
          <CardHeader>
            <CardTitle>Merchant Statistics</CardTitle>
            <CardDescription>
              Overview of merchant accounts and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-5 w-5 text-gray-500" />
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{metrics.merchants.total}</p>
                <p className="text-sm text-gray-500">Total Merchants</p>
              </div>
              <div className="p-4 border rounded-lg bg-green-50">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-700">{metrics.merchants.active}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
              <div className="p-4 border rounded-lg bg-yellow-50">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold text-yellow-700">{metrics.merchants.pending}</p>
                <p className="text-sm text-gray-600">Pending Verification</p>
              </div>
              <div className="p-4 border rounded-lg bg-red-50">
                <div className="flex items-center justify-between mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-700">{metrics.merchants.suspended}</p>
                <p className="text-sm text-gray-600">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Resources */}
      {metrics?.system && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Memory Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5" />
                <span>Memory Usage</span>
              </CardTitle>
              <CardDescription>
                Node.js process memory consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Heap Used</span>
                    <span className="text-sm font-semibold">
                      {formatBytes(metrics.system.memory.heapUsed)} / {formatBytes(metrics.system.memory.heapTotal)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">RSS (Resident Set Size)</span>
                    <span className="text-sm font-semibold">
                      {formatBytes(metrics.system.memory.rss)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">External</span>
                    <span className="text-sm font-semibold">
                      {formatBytes(metrics.system.memory.external)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cpu className="h-5 w-5" />
                <span>System Information</span>
              </CardTitle>
              <CardDescription>
                Runtime environment details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Node.js Version</span>
                  <span className="text-sm font-semibold">{metrics.system.nodeVersion}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Platform</span>
                  <span className="text-sm font-semibold capitalize">{metrics.system.platform}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Architecture</span>
                  <span className="text-sm font-semibold">{metrics.system.arch}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span className="text-sm font-semibold">{formatUptime(metrics.system.uptime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
