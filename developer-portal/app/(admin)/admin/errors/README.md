# Error Logs Page

## Overview

The Error Logs page provides administrators with a comprehensive view of system errors and audit logs across all merchants. This page is part of the Admin Panel and helps monitor system health, identify issues, and track security-related events.

## Features

### 1. Real-time Error Monitoring
- Displays all error logs from the audit log system
- Auto-refresh capability to get the latest errors
- Last refresh timestamp for tracking data freshness

### 2. Statistics Dashboard
- **Total Errors**: Count of all error logs in the current view
- **Critical Errors**: Security and authentication-related errors requiring immediate attention
- **Warnings**: Non-critical errors and issues

### 3. Advanced Filtering
- **Merchant ID Filter**: Search for errors from a specific merchant
- **Date Range Filter**: Filter errors by start and end date/time
- **Page Size**: Adjustable results per page (25, 50, 100, 200)

### 4. Detailed Error Information
Each error log entry displays:
- **Severity Icon**: Visual indicator of error criticality
- **Timestamp**: When the error occurred (with full date and time)
- **Merchant ID**: Which merchant experienced the error
- **Operation**: The operation that failed (e.g., `auth.login`, `api.chat`)
- **Actor**: Who or what triggered the operation
- **Reason**: Detailed error message or reason for failure
- **IP Address**: Source IP address of the request
- **Status Badge**: Visual status indicator (Error/Info)

### 5. Pagination
- Navigate through large sets of error logs
- Shows current page position and total pages
- Displays range of results being viewed

## Usage

### Accessing the Page
Navigate to `/admin/errors` from the Admin Panel sidebar.

### Filtering Errors

1. **By Merchant**:
   - Enter a merchant ID in the "Merchant ID" filter field
   - Click "Apply Filters"

2. **By Date Range**:
   - Select a start date/time
   - Select an end date/time
   - Click "Apply Filters"

3. **Clear Filters**:
   - Click "Clear Filters" to reset all filters

### Refreshing Data
Click the "Refresh" button in the top-right corner to fetch the latest error logs.

### Adjusting Page Size
Use the "Page Size" dropdown to change how many errors are displayed per page.

## Error Severity Levels

### Critical Errors (Red)
- Authentication failures
- Security-related issues
- Operations containing "auth" or "security" in the operation name
- Require immediate attention

### Warnings (Yellow)
- General operation failures
- Non-critical system issues
- Should be monitored but not urgent

### Info (Blue)
- Informational audit logs
- Successful operations logged for audit purposes

## API Integration

The page integrates with the following API endpoint:

```
GET /api/admin/errors
```

**Query Parameters**:
- `limit`: Number of results per page (default: 50)
- `offset`: Pagination offset
- `merchantId`: Filter by specific merchant (optional)
- `startDate`: Filter by start date (optional)
- `endDate`: Filter by end date (optional)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": "uuid",
        "timestamp": "2025-01-01T12:00:00Z",
        "merchantId": "merchant_123",
        "operation": "auth.login",
        "outcome": "failure",
        "reason": "Invalid credentials",
        "actor": "user@example.com",
        "ipAddress": "192.168.1.1"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 150
    }
  }
}
```

## Security Considerations

- Only accessible to users with `admin` or `super_admin` roles
- All access is logged in the audit trail
- Sensitive information (like full request payloads) is not displayed
- IP addresses are shown for security tracking

## Future Enhancements

Potential improvements for future versions:
- Export error logs to CSV/JSON
- Real-time error notifications
- Error grouping and aggregation
- Detailed error drill-down with full request/response data
- Error trend analysis and charts
- Automatic error categorization
- Integration with alerting systems (PagerDuty, Slack)

## Related Components

- **AdminController**: Backend controller handling error log retrieval
- **AuditLogRepository**: Database repository for audit logs
- **Admin Layout**: Parent layout providing navigation and authentication
- **Admin Sidebar**: Navigation component with "Error Logs" link

## Technical Details

**File Location**: `developer-portal/app/(admin)/admin/errors/page.tsx`

**Dependencies**:
- Next.js 14 (App Router)
- NextAuth.js for authentication
- shadcn/ui components
- Lucide React icons
- TailwindCSS for styling

**State Management**:
- React hooks (useState, useEffect)
- Session management via NextAuth

**Performance Considerations**:
- Pagination to handle large datasets
- Configurable page sizes
- Efficient filtering on the backend
- Minimal re-renders with proper state management
