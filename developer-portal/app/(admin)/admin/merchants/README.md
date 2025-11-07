# Merchant List Page

## Overview
The merchant list page provides administrators with a comprehensive view of all merchant accounts in the system.

## Features

### 1. Merchant List Display
- Displays all merchants in a paginated table
- Shows key information: Merchant ID, Company Name, Email, Plan, Status, Created Date
- Responsive design that works on mobile and desktop

### 2. Search & Filtering
- **Search**: Search by merchant ID, email, or company name (client-side filtering)
- **Status Filter**: Filter by merchant status (active, pending_verification, suspended, deleted)
- **Page Size**: Adjustable page size (10, 20, 50, 100 merchants per page)

### 3. Pagination
- Server-side pagination for efficient data loading
- Shows current page, total pages, and total merchant count
- Previous/Next navigation buttons
- Displays range of merchants being shown

### 4. Status Badges
- **Active**: Green badge for active merchants
- **Pending**: Gray badge for merchants pending email verification
- **Suspended**: Red badge for suspended accounts
- **Deleted**: Outlined badge for deleted accounts

### 5. Plan Badges
- **Starter**: Blue badge
- **Professional**: Purple badge
- **Enterprise**: Orange badge

### 6. Actions
- **View**: Link to detailed merchant page (to be implemented)

## API Integration

The page fetches data from the admin API endpoint:
```
GET /api/admin/merchants?limit={limit}&offset={offset}&status={status}
```

### Query Parameters
- `limit`: Number of merchants per page (default: 20)
- `offset`: Starting position for pagination
- `status`: Filter by merchant status (optional)

### Response Format
```json
{
  "success": true,
  "data": {
    "merchants": [...],
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

## Authentication
- Requires admin role (checked in layout)
- Uses NextAuth session for authentication
- Passes access token in Authorization header

## Usage

Navigate to `/admin/merchants` to view the merchant list.

## Future Enhancements
- Bulk actions (suspend multiple merchants, etc.)
- Export to CSV
- Advanced filters (by plan, date range, etc.)
- Sorting by column
- Merchant detail modal/page
- Impersonation feature
