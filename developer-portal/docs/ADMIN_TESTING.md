# Admin Panel Testing Guide

This guide explains how to test the admin panel functionality in the MindShop Developer Portal.

## Prerequisites

- Developer portal running on `http://localhost:3001`
- Backend API running on `http://localhost:3000`
- PostgreSQL database with seed data loaded

## Option 1: Use Development Mode (Quickest)

The easiest way to test admin features is to use the development authentication bypass:

1. **Enable Dev Mode** - Make sure `NODE_ENV=development` in your `.env.local` file

2. **Access Admin Panel** - Navigate to:
   ```
   http://localhost:3001/admin
   ```

3. **Dev Mode Behavior** - In development mode, the auth middleware automatically assigns admin role:
   ```typescript
   roles: ['user', 'admin']
   ```

4. **Test Admin Features**:
   - View admin dashboard at `/admin`
   - Access merchant management at `/admin/merchants`
   - View system health at `/admin/health`
   - Check error logs at `/admin/errors`

## Option 2: Create Admin User in Cognito

For testing with real authentication:

### Step 1: Create Admin User via AWS Console

1. Go to AWS Cognito Console
2. Select your User Pool
3. Click "Create user"
4. Fill in:
   - Username: `admin@mindshop.com`
   - Email: `admin@mindshop.com`
   - Temporary password: `TempPass123!`
   - Mark email as verified

### Step 2: Add Admin Role Attribute

1. Find the created user in Cognito
2. Go to "Attributes" tab
3. Add custom attribute:
   - Attribute name: `custom:roles`
   - Value: `admin` or `super_admin`

### Step 3: Sign In

1. Navigate to `http://localhost:3001/login`
2. Sign in with:
   - Email: `admin@mindshop.com`
   - Password: `TempPass123!`
3. Change password when prompted
4. You should now have admin access

## Option 3: Use Impersonation Feature

If you're already logged in as a regular merchant, you can use the impersonation feature:

1. **Login as Admin** (using Option 1 or 2)

2. **Impersonate a Merchant**:
   ```bash
   # From admin panel, use the impersonation API
   curl -X POST http://localhost:3000/api/admin/impersonate \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"merchantId": "acme_electronics_2024"}'
   ```

3. **Stop Impersonation**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/stop-impersonation \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## Admin Panel Features

### Available Pages

1. **Admin Dashboard** (`/admin`)
   - Overview of platform metrics
   - Quick stats on merchants, API usage, errors

2. **Merchant Management** (`/admin/merchants`)
   - List all merchants
   - View merchant details
   - Impersonate merchants
   - Manage merchant status

3. **System Health** (`/admin/health`)
   - Database connection status
   - API health checks
   - Service status monitoring

4. **Error Logs** (`/admin/errors`)
   - View application errors
   - Filter by severity, date, merchant
   - Error details and stack traces

### Admin API Endpoints

All admin endpoints require `admin` or `super_admin` role:

```
GET    /api/admin/merchants              # List all merchants
GET    /api/admin/merchants/:id          # Get merchant details
PUT    /api/admin/merchants/:id          # Update merchant
POST   /api/admin/impersonate            # Impersonate merchant
POST   /api/admin/stop-impersonation     # Stop impersonation
GET    /api/admin/health                 # System health check
GET    /api/admin/errors                 # Get error logs
GET    /api/admin/metrics                # Platform metrics
```

## Testing Checklist

- [ ] Access admin dashboard without errors
- [ ] View list of all merchants
- [ ] Click on a merchant to view details
- [ ] Impersonate a merchant and verify access
- [ ] Stop impersonation and return to admin view
- [ ] Check system health page shows all services
- [ ] View error logs with filtering
- [ ] Verify non-admin users cannot access `/admin` routes
- [ ] Test admin API endpoints with Postman/curl

## Troubleshooting

### "Access Denied" Error

**Problem**: Getting redirected or seeing access denied message

**Solutions**:
1. Check that `NODE_ENV=development` in `.env.local`
2. Verify user has `admin` or `super_admin` in `custom:roles` attribute
3. Clear browser cookies and sign in again
4. Check browser console for authentication errors

### Admin Routes Not Loading

**Problem**: Admin pages show 404 or don't load

**Solutions**:
1. Verify Next.js dev server is running: `cd developer-portal && npm run dev`
2. Check that admin layout exists: `app/(admin)/layout.tsx`
3. Clear Next.js cache: `rm -rf .next && npm run dev`

### API Endpoints Return 403

**Problem**: Admin API calls return "Access denied"

**Solutions**:
1. Check JWT token includes `roles` claim with `admin`
2. Verify `requireRoles` middleware is working
3. Check backend logs for authentication errors
4. Test with development mode first

## Development Tips

### Quick Admin Access

Add this to your `.env.local` for instant admin access:

```bash
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Testing Different Roles

You can test different role combinations by modifying the dev auth in `src/api/middleware/auth.ts`:

```typescript
// Test as super_admin
roles: ['user', 'super_admin']

// Test as regular admin
roles: ['user', 'admin']

// Test as merchant only (should be denied)
roles: ['user', 'merchant_admin']
```

### Viewing Admin Logs

Backend logs will show admin actions:

```bash
# In the backend directory
npm run dev

# Watch for admin-related logs
[Admin] User admin@mindshop.com accessed merchant list
[Admin] Impersonation started: admin -> acme_electronics_2024
```

## Next Steps

After verifying admin access works:

1. Implement remaining admin pages (merchants, health, errors)
2. Add admin-specific components (merchant table, health dashboard)
3. Create admin API endpoints in backend
4. Add audit logging for admin actions
5. Implement role-based permissions (admin vs super_admin)

## Security Notes

⚠️ **Important**: 
- Development mode bypasses authentication - NEVER use in production
- Always verify admin role on backend, not just frontend
- Admin actions should be logged for audit trail
- Use `super_admin` role for destructive operations
- Implement rate limiting on admin endpoints
