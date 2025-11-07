# System Health Dashboard

## Overview
The System Health Dashboard provides real-time monitoring of the MindShop platform's health and performance metrics.

## Features Implemented

### 1. Overall System Status
- Real-time system health indicator (Healthy/Degraded/Unhealthy)
- System version display
- Uptime tracking
- Environment information
- Last refresh timestamp

### 2. Service Health Monitoring
Monitors critical services with status and response times:
- **PostgreSQL Database** - Primary data store
- **Redis Cache** - Caching and session storage
- **MindsDB** - ML and RAG service

Each service displays:
- Current status (Healthy/Degraded/Unhealthy)
- Response time in milliseconds
- Visual status indicators

### 3. Merchant Statistics
- Total merchants count
- Active merchants
- Pending verification count
- Suspended merchants count
- Visual breakdown with color-coded cards

### 4. System Resources
**Memory Usage:**
- Heap used vs total with progress bar
- RSS (Resident Set Size)
- External memory
- Formatted in MB/GB

**System Information:**
- Node.js version
- Platform (OS)
- Architecture
- Process uptime

### 5. Interactive Controls
- **Time Period Selector**: View metrics for 1h, 24h, 7d, or 30d
- **Refresh Button**: Manually refresh all data
- **Auto-refresh**: Data updates when period changes

## API Endpoints Used

### GET /api/admin/system/health
Returns overall system health status including:
- System status
- Service health (database, redis, mindsdb)
- Version information
- Uptime

### GET /api/admin/system/metrics?period={period}
Returns system metrics including:
- Merchant statistics (total, active, suspended, pending)
- System resource usage (memory, CPU)
- Runtime environment details

## UI Components

### Layout
- Responsive grid layout
- Mobile-friendly design
- Consistent with admin panel styling

### Visual Elements
- Status badges (green/yellow/red)
- Icon indicators for each metric
- Progress bars for memory usage
- Color-coded cards for merchant stats

### Navigation
- Accessible from admin sidebar
- Quick action card on admin overview page
- Direct URL: `/admin/health`

## Technical Details

### State Management
- React hooks (useState, useEffect)
- NextAuth session management
- Automatic data fetching on mount and period change

### Error Handling
- Try-catch blocks for API calls
- User-friendly error messages
- Loading states during data fetch

### Data Formatting
- Uptime: Days, hours, minutes
- Memory: MB/GB conversion
- Response time: ms/seconds
- Dates: Localized formatting

## Future Enhancements
- Real-time updates via WebSocket
- Historical trend charts
- Alert threshold configuration
- Export metrics to CSV
- Custom metric dashboards
- Service dependency visualization

## Related Files
- Page: `developer-portal/app/(admin)/admin/health/page.tsx`
- Sidebar: `developer-portal/components/admin/AdminSidebar.tsx`
- Controller: `src/api/controllers/AdminController.ts`
- Routes: `src/api/routes/admin.ts`

## Testing
To test the health dashboard:
1. Navigate to `/admin/health` as an admin user
2. Verify all metrics load correctly
3. Test period selector (1h, 24h, 7d, 30d)
4. Test refresh button
5. Verify responsive design on mobile
6. Check error handling with invalid tokens

## Requirements Met
✅ Create system health dashboard (Task 13.2)
✅ Display overall system status
✅ Monitor service health (database, redis, mindsdb)
✅ Show merchant statistics
✅ Display system resource usage
✅ Provide interactive controls
✅ Responsive design
✅ Error handling
✅ Integration with existing admin API endpoints
