'use client';

import { StatsCard } from '@/components/dashboard/StatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Clock, CheckCircle, Activity } from 'lucide-react';

interface MetricsGridProps {
  data?: {
    totalQueries: number;
    activeSessions: number;
    avgResponseTime: number;
    successRate: number;
  };
  isLoading?: boolean;
}

export function MetricsGrid({ data, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Total Queries"
        value={data.totalQueries.toLocaleString()}
        icon={<MessageSquare className="h-6 w-6" />}
      />
      <StatsCard
        title="Active Sessions"
        value={data.activeSessions.toLocaleString()}
        icon={<Activity className="h-6 w-6" />}
      />
      <StatsCard
        title="Avg Response Time"
        value={`${data.avgResponseTime}ms`}
        icon={<Clock className="h-6 w-6" />}
      />
      <StatsCard
        title="Success Rate"
        value={`${data.successRate}%`}
        icon={<CheckCircle className="h-6 w-6" />}
      />
    </div>
  );
}
