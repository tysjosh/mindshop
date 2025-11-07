'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface QueryChartProps {
  data?: Array<{
    timestamp: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  isLoading?: boolean;
}

export function QueryChart({ data, isLoading = false }: QueryChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-80 w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Query Volume Over Time</h3>
        <div className="flex h-80 items-center justify-center text-gray-500">
          No data available for the selected period
        </div>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    queries: item.count,
    responseTime: Math.round(item.avgResponseTime),
    successRate: Math.round(item.successRate),
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Query Volume Over Time</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            label={{ value: 'Queries', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            label={{ value: 'Response Time (ms)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="queries"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Queries"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="responseTime"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            name="Avg Response Time (ms)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="successRate"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
            name="Success Rate (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
