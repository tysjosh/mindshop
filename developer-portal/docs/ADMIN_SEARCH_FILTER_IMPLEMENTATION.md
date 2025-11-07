# Admin Panel Search & Filter Implementation

## Overview
Implemented comprehensive search and filter functionality for the admin panel, enabling administrators to efficiently find and manage merchants and error logs.

## Changes Made

### 1. Backend - MerchantRepository (`src/repositories/MerchantRepository.ts`)

**Added search functionality:**
- Updated `findAll()` method to accept optional `search` parameter
- Implemented case-insensitive search across:
  - Merchant ID
  - Email address
  - Company name
- Updated `count()` method to support search filtering for accurate pagination

**Technical Details:**
- Uses Drizzle ORM's `ilike` operator for case-insensitive pattern matching
- Combines multiple search conditions with `or()` operator
- Integrates with existing status filtering using `and()` operator

### 2. Backend - AuditLogRepository (`src/repositories/AuditLogRepository.ts`)

**Added flexible querying:**
- New `findAll()` method supporting:
  - Pagination (limit/offset)
  - Optional merchant ID filter
  - Optional date range filter (startDate/endDate)
- New `countAll()` method for accurate pagination counts with filters

**Technical Details:**
- Dynamically builds query conditions based on provided parameters
- Supports querying across all merchants or filtering by specific merchant
- Properly handles date range filtering with `gte` and `lte` operators

### 3. Backend - AdminController (`src/api/controllers/AdminController.ts`)

**Enhanced getMerchants endpoint:**
- Now accepts `search` query parameter
- Passes search parameter to repository layer
- Returns accurate pagination metadata

**Enhanced getErrors endpoint:**
- Improved date parsing and validation
- Uses new `findAll()` and `countAll()` repository methods
- Properly filters for error logs (outcome !== 'success')
- Returns accurate pagination metadata

### 4. Frontend - Merchant List Page (`developer-portal/app/(admin)/admin/merchants/page.tsx`)

**Improved search behavior:**
- Changed from client-side filtering to server-side search
- Search query now triggers API call with `search` parameter
- Added `searchQuery` to useEffect dependencies for automatic search
- Removed client-side `filteredMerchants` logic
- Enhanced empty state messaging when filters are active

## Features

### Merchant Search & Filter
- **Search:** Real-time search across merchant ID, email, and company name
- **Status Filter:** Filter by merchant status (all, active, pending, suspended, deleted)
- **Page Size:** Adjustable results per page (10, 20, 50, 100)
- **Pagination:** Full pagination support with accurate counts

### Error Logs Search & Filter
- **Merchant ID Filter:** Filter logs by specific merchant
- **Date Range:** Filter by start and end date/time
- **Page Size:** Adjustable results per page (25, 50, 100, 200)
- **Pagination:** Full pagination support
- **Auto-refresh:** Manual refresh button with loading state

## API Endpoints

### GET /api/admin/merchants
**Query Parameters:**
- `limit` (number, 1-100): Results per page
- `offset` (number, ≥0): Pagination offset
- `status` (string, optional): Filter by status
- `search` (string, optional): Search query

**Response:**
```json
{
  "success": true,
  "data": {
    "merchants": [...],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 150,
      "hasMore": true
    }
  }
}
```

### GET /api/admin/errors
**Query Parameters:**
- `limit` (number, 1-1000): Results per page
- `offset` (number, ≥0): Pagination offset
- `merchantId` (string, optional): Filter by merchant
- `startDate` (ISO string, optional): Start of date range
- `endDate` (ISO string, optional): End of date range

**Response:**
```json
{
  "success": true,
  "data": {
    "errors": [...],
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 45,
      "hasMore": false
    }
  }
}
```

## Testing

To test the implementation:

1. **Merchant Search:**
   - Navigate to `/admin/merchants`
   - Enter search terms in the search box
   - Verify results update automatically
   - Test with merchant ID, email, and company name

2. **Merchant Filters:**
   - Use status dropdown to filter by status
   - Adjust page size
   - Navigate through pages
   - Verify counts are accurate

3. **Error Log Filters:**
   - Navigate to `/admin/errors`
   - Filter by merchant ID
   - Set date range filters
   - Click "Apply Filters"
   - Verify results match criteria

## Performance Considerations

- Database queries use indexed columns (merchantId, email, status)
- Search uses `ilike` which may be slower on large datasets
- Consider adding full-text search indexes for production
- Pagination prevents loading excessive data
- Frontend debouncing could be added for search input

## Future Enhancements

1. **Advanced Search:**
   - Add more search fields (website, industry)
   - Support for multiple search terms
   - Search operators (AND, OR, NOT)

2. **Saved Filters:**
   - Allow admins to save common filter combinations
   - Quick filter presets

3. **Export:**
   - Export filtered results to CSV
   - Scheduled reports

4. **Performance:**
   - Add full-text search indexes
   - Implement search result caching
   - Add debouncing to search input

## Related Files

- `src/repositories/MerchantRepository.ts`
- `src/repositories/AuditLogRepository.ts`
- `src/api/controllers/AdminController.ts`
- `developer-portal/app/(admin)/admin/merchants/page.tsx`
- `developer-portal/app/(admin)/admin/errors/page.tsx`

## Task Reference

- Task: 13.2 Admin UI - Add search/filter
- Spec: `.kiro/specs/merchant-platform/tasks.md`
- Status: ✅ Completed
