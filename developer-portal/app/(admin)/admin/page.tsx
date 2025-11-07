'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function AdminOverviewPage() {
  // Mock data - will be replaced with real API calls
  const stats = [
    {
      title: 'Total Merchants',
      value: '156',
      change: '+12%',
      trend: 'up',
      icon: Users,
    },
    {
      title: 'Active Sessions',
      value: '2,847',
      change: '+8%',
      trend: 'up',
      icon: Activity,
    },
    {
      title: 'System Uptime',
      value: '99.9%',
      change: '+0.1%',
      trend: 'up',
      icon: TrendingUp,
    },
    {
      title: 'Error Rate',
      value: '0.3%',
      change: '-0.2%',
      trend: 'down',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-500 mt-2">
          Monitor and manage the MindShop platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={`text-xs ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest system events and merchant activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium">New merchant registered</p>
                <p className="text-xs text-gray-500">acme_electronics_2024</p>
              </div>
              <span className="text-xs text-gray-500">2 minutes ago</span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium">API key created</p>
                <p className="text-xs text-gray-500">techstore_2024</p>
              </div>
              <span className="text-xs text-gray-500">15 minutes ago</span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium">Subscription upgraded</p>
                <p className="text-xs text-gray-500">fashion_boutique_2024</p>
              </div>
              <span className="text-xs text-gray-500">1 hour ago</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">System maintenance completed</p>
                <p className="text-xs text-gray-500">Database optimization</p>
              </div>
              <span className="text-xs text-gray-500">3 hours ago</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/merchants">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Manage Merchants</CardTitle>
              <CardDescription>
                View, search, and manage merchant accounts
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/health">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
              <CardDescription>
                Monitor system performance and health metrics
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
