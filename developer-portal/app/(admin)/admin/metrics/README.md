# Admin Metrics Page

Platform-wide metrics and analytics dashboard for administrators.

## Features

- **Key Metrics Cards**
  - Total merchants (active/inactive)
  - API call volume (24h, 7d, 30d)
  - Monthly recurring revenue (MRR)
  - Average response time

- **Performance Indicators**
  - System uptime percentage
  - Error rate
  - Average latency

- **Usage Trends**
  - API usage over different time periods
  - Growth metrics
  - Trend visualization

## Data Sources

Currently using mock data. To integrate with real backend:

1. Create admin metrics endpoint in backend:
   ```typescript
   GET /api/admin/metrics
   ```

2. Update the API client:
   ```typescript
   async getAdminMetrics(token: string): Promise<AdminMetrics> {
     return this.request<AdminMetrics>('/admin/metrics', {
       headers: { Authorization: `Bearer ${token}` },
     });
   }
   ```

3. Replace mock data in the component with actual API call

## Metrics Structure

```typescript
interface AdminMetrics {
  platform: {
    totalMerchants: number;
    activeMerchants: number;
    totalApiCalls: number;
    avgResponseTime: number;
  };
  usage: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    growth: number;
  };
  performance: {
    uptime: number;
    errorRate: number;
    avgLatency: number;
  };
}
```

## Future Enhancements

- [ ] Add time range selector (24h, 7d, 30d, custom)
- [ ] Add charts and graphs for trend visualization
- [ ] Export metrics to CSV/PDF
- [ ] Real-time metric updates via WebSocket
- [ ] Comparison with previous periods
- [ ] Drill-down into specific metrics
- [ ] Custom metric dashboards
