'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface TopQueriesTableProps {
  data?: Array<{
    query: string;
    count: number;
    avgConfidence: number;
  }>;
  isLoading?: boolean;
}

export function TopQueriesTable({ data, isLoading = false }: TopQueriesTableProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Queries</h3>
        <div className="flex h-40 items-center justify-center text-gray-500">
          No queries yet
        </div>
      </Card>
    );
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High</Badge>;
    } else if (confidence >= 0.6) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Top Queries</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Query</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Count</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Avg Confidence</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm">
                  <div className="max-w-md truncate" title={item.query}>
                    {item.query}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-right font-medium">
                  {item.count.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-gray-600">
                      {(item.avgConfidence * 100).toFixed(0)}%
                    </span>
                    {getConfidenceBadge(item.avgConfidence)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
