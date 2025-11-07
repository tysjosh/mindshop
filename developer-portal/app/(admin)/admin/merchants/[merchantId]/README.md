# Merchant Detail Page

## Overview
The merchant detail page provides administrators with comprehensive information about a specific merchant account, including profile details, account status, and recent activity logs.

## Features

### 1. Merchant Information Display
- **Basic Information Card**
  - Email address
  - Company name
  - Website (with external link)
  - Industry
  
- **Account Status Card**
  - Current status with badge (Active, Pending, Suspended, Deleted)
  - Current plan with badge (Starter, Professional, Enterprise)
  - Account creation date
  - Last updated date

### 2. Status Management
- **Update Status Dialog**
  - Change merchant status (Active, Suspended, Deleted, Pending Verification)
  - Add optional reason for status change
  - All status changes are logged in audit trail
  - Visual icons for each status type
  - Disabled for already deleted merchants

### 3. Impersonation Feature
- **Impersonate Merchant**
  - Allows admin to act as the merchant for debugging/support
  - Generates impersonation token
  - All actions are logged and attributed to the admin
  - Only available for active merchants
  - Warning message about audit trail

### 4. Recent Activity Log
- **Audit Trail Table**
  - Last 20 audit log entries
  - Displays: Timestamp, Operation, Actor, Outcome, IP Address
  - Color-coded outcome badges (Success/Failed)
  - Formatted timestamps with date and time
  - Empty state when no activity exists

### 5. Navigation
- **Back Button**
  - Returns to merchant list page
  - Maintains context and filters

## API Integration

### Fetch Merchant Details
```
GET /api/admin/merchants/:merchantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "merchantId": "acme_electronics_2024",
      "email": "admin@acme.com",
      "companyName": "Acme Electronics",
      "website": "https://acme.com",
      "industry": "Electronics",
      "status": "active",
      "plan": "professional",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T00:00:00Z"
    },
    "recentActivity": [
      {
        "id": "uuid",
        "operation": "merchant.login",
        "outcome": "success",
        "actor": "admin@acme.com",
        "ipAddress": "192.168.1.1",
        "createdAt": "2025-01-15T12:00:00Z"
      }
    ]
  }
}
```

### Update Merchant Status
```
PUT /api/admin/merchants/:merchantId/status
```

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Payment failure"
}
```

### Impersonate Merchant
```
POST /api/admin/merchants/:merchantId/impersonate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "acme_electronics_2024",
    "email": "admin@acme.com",
    "companyName": "Acme Electronics",
    "impersonationToken": "impersonate_acme_electronics_2024_1234567890",
    "message": "Impersonation session created...",
    "warning": "All actions will be logged..."
  }
}
```

## Authentication
- Requires admin role (checked in layout)
- Uses NextAuth session for authentication
- Passes access token in Authorization header

## UI Components Used
- **shadcn/ui Components:**
  - Card, CardContent, CardDescription, CardHeader, CardTitle
  - Button
  - Badge
  - Table, TableBody, TableCell, TableHead, TableHeader, TableRow
  - Select, SelectContent, SelectItem, SelectTrigger, SelectValue
  - AlertDialog (for status update and impersonation confirmations)
  - Textarea (for status reason)
  - Label

- **Lucide Icons:**
  - ArrowLeft, CheckCircle, Ban, Trash2, UserCog
  - Calendar, Mail, Building, Globe, CreditCard
  - Activity, AlertCircle

## Status Badges

### Status Types
- **Active**: Green badge - Merchant is active and operational
- **Pending**: Gray badge - Awaiting email verification
- **Suspended**: Red badge - Account temporarily suspended
- **Deleted**: Outlined badge - Account marked as deleted

### Plan Types
- **Starter**: Blue badge - Basic plan
- **Professional**: Purple badge - Mid-tier plan
- **Enterprise**: Orange badge - Premium plan

## Usage

Navigate to `/admin/merchants/:merchantId` to view merchant details.

Example: `/admin/merchants/acme_electronics_2024`

## Security Considerations

1. **Admin-Only Access**: All operations require admin role
2. **Audit Logging**: All status changes and impersonations are logged
3. **Impersonation Warnings**: Clear warnings about audit trail
4. **Status Validation**: Only valid status transitions are allowed
5. **Deleted Merchant Protection**: Cannot update status of deleted merchants

## Error Handling

- **Loading State**: Shows spinner while fetching data
- **Error State**: Displays error message with back button
- **Not Found**: Shows appropriate message if merchant doesn't exist
- **API Errors**: Displays user-friendly error messages via alerts

## Future Enhancements

- View and manage merchant's API keys
- View usage statistics and analytics
- View billing information and invoices
- View and manage webhooks
- View product sync configuration
- Export merchant data
- Send notification to merchant
- View support tickets
- Bulk operations on audit logs
- Filter and search audit logs
- View merchant's settings
- Direct link to merchant's dashboard (impersonation)

