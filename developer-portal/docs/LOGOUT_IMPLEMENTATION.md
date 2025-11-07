# Logout Implementation with Cognito GlobalSignOut

## Overview

This document describes the implementation of the logout functionality that integrates with AWS Cognito's GlobalSignOut API to properly invalidate user sessions across all devices.

## Implementation Details

### Components Modified

1. **Logout Page** (`app/logout/page.tsx`)
   - Enhanced to call Cognito GlobalSignOut API before clearing local session
   - Handles both dev mode (mock auth) and production mode (Cognito)
   - Provides error handling and user feedback
   - Gracefully continues with local logout even if GlobalSignOut fails

2. **Logout API Endpoint** (`app/api/auth/logout/route.ts`)
   - Server-side endpoint that calls Cognito's GlobalSignOut API
   - Uses AWS SDK v3 (`@aws-sdk/client-cognito-identity-provider`)
   - Invalidates all tokens for the user across all devices
   - Returns appropriate error responses while not blocking logout

3. **Dashboard Header** (`components/dashboard/DashboardHeader.tsx`)
   - Updated to redirect to `/logout` page instead of calling signOut directly
   - Ensures proper GlobalSignOut flow is triggered

4. **Admin Header** (`components/admin/AdminHeader.tsx`)
   - Updated to redirect to `/logout` page for consistency
   - Ensures admin users also go through GlobalSignOut

5. **NextAuth Configuration** (`app/api/auth/[...nextauth]/route.ts`)
   - Added `events.signOut` handler to log signout events
   - Maintains existing session configuration

## Flow Diagram

```
User clicks "Sign out"
        ↓
Redirect to /logout page
        ↓
Check if production mode
        ↓
    ┌───┴───┐
    │       │
   Yes      No (Dev Mode)
    │       │
    ↓       ↓
Call /api/auth/logout    Skip GlobalSignOut
    ↓                    ↓
GlobalSignOut API        │
(invalidate all tokens)  │
    ↓                    │
    └───┬────────────────┘
        ↓
Call NextAuth signOut()
(clear local session)
        ↓
Redirect to /login
```

## Requirements Satisfied

This implementation satisfies **Requirement 7.4** from the requirements document:

> WHEN a user logs out, THE Developer Portal SHALL clear all tokens from the session and THE Backend SHALL invalidate the session

### Acceptance Criteria Met:

✅ **Implement logout button** - Logout buttons exist in DashboardHeader and AdminHeader
✅ **Clear session tokens** - NextAuth signOut() clears all local session tokens
✅ **Call Cognito GlobalSignOut API** - API endpoint calls GlobalSignOut to invalidate tokens server-side
✅ **Redirect to login page** - User is redirected to `/login` after successful logout

## API Endpoint

### POST /api/auth/logout

**Request Body:**
```json
{
  "accessToken": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out from all devices"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Error message",
  "code": "COGNITO_SIGNOUT_ERROR"
}
```

## Environment Variables Required

The following environment variables must be configured for production logout:

- `NEXT_PUBLIC_DEV_MODE` - Set to "false" for production
- `NEXT_PUBLIC_COGNITO_REGION` - AWS region (e.g., "us-east-1")
- `COGNITO_CLIENT_ID` - Cognito App Client ID

## Development Mode

In development mode (`NEXT_PUBLIC_DEV_MODE=true`):
- GlobalSignOut API is skipped
- Only local session is cleared
- Faster logout for development workflow

## Error Handling

The implementation includes robust error handling:

1. **GlobalSignOut Failure**: If Cognito GlobalSignOut fails, the error is logged but logout continues with local session clearing
2. **Missing Configuration**: If Cognito configuration is missing, an error is returned but logout still proceeds
3. **Network Errors**: Network failures are caught and logged, but don't block the logout flow
4. **User Feedback**: Error states are displayed to the user with appropriate messaging

## Security Considerations

1. **Token Invalidation**: GlobalSignOut invalidates all tokens for the user, preventing reuse
2. **Session Clearing**: Local session is cleared regardless of GlobalSignOut success
3. **Redirect**: User is always redirected to login page after logout
4. **Logging**: Signout events are logged for audit purposes

## Testing

To test the logout functionality:

1. **Dev Mode Test**:
   ```bash
   # Set NEXT_PUBLIC_DEV_MODE=true in .env.local
   npm run dev
   # Login and click logout - should skip GlobalSignOut
   ```

2. **Production Mode Test**:
   ```bash
   # Set NEXT_PUBLIC_DEV_MODE=false and configure Cognito variables
   npm run dev
   # Login with real Cognito credentials and click logout
   # Verify GlobalSignOut is called in network tab
   ```

3. **Error Handling Test**:
   - Test with invalid access token
   - Test with missing Cognito configuration
   - Verify logout still completes

## Future Enhancements

Potential improvements for future iterations:

1. **Selective Logout**: Option to logout from current device only vs all devices
2. **Session Management UI**: Show active sessions and allow selective revocation
3. **Logout Confirmation**: Add confirmation dialog before logout
4. **Activity Logging**: Enhanced logging of logout events to database
5. **Metrics**: Track logout success/failure rates

## References

- [AWS Cognito GlobalSignOut API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_GlobalSignOut.html)
- [NextAuth.js Documentation](https://next-auth.js.org/getting-started/client#signout)
- [Requirements Document](.kiro/specs/cognito-authentication/requirements.md)
