# Token Refresh Quick Start Guide

## What Was Implemented

Automatic token refresh and session expiration handling for AWS Cognito authentication.

## How It Works

1. **Access tokens expire after 1 hour** - NextAuth automatically refreshes them using the refresh token
2. **Refresh tokens expire after 30 days** - Users are signed out and redirected to login
3. **Everything happens automatically** - No user intervention required

## For Developers

### Using the Session Refresh Hook

Replace `useSession` from next-auth with `useSessionRefresh`:

```tsx
// Before
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  // ...
}

// After
import { useSessionRefresh } from '@/hooks/use-session-refresh';

function MyComponent() {
  const { session, status } = useSessionRefresh();
  // ...
}
```

### Adding Global Session Monitoring (Recommended)

Add the `SessionRefreshHandler` to your root layout:

```tsx
// app/layout.tsx
import { SessionRefreshHandler } from '@/components/auth/session-refresh-handler';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          <SessionRefreshHandler>
            {children}
          </SessionRefreshHandler>
        </Providers>
      </body>
    </html>
  );
}
```

### Handling API Errors

The API client automatically handles 401 errors. In your components:

```tsx
try {
  const data = await apiClient.getMerchantProfile(merchantId, token);
} catch (error) {
  if ((error as any).status === 401) {
    // Token expired - NextAuth will refresh on next request
    // Or user will be redirected to login if refresh token expired
  }
}
```

## Environment Variables

Ensure these are set in your `.env.local`:

```env
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{user_pool_id}
```

## Testing

### Test Automatic Refresh
1. Sign in to the portal
2. Wait 1 hour (or modify token expiration in Cognito for testing)
3. Make an API request
4. Token should refresh automatically

### Test Session Expiration
1. Sign in to the portal
2. Manually expire the refresh token in Cognito console
3. Make an API request
4. Should redirect to login with "Your session has expired" message

## What Happens When...

### Access Token Expires (After 1 Hour)
- ✅ Automatically refreshed using refresh token
- ✅ User continues working without interruption
- ✅ No visible change to the user

### Refresh Token Expires (After 30 Days)
- ✅ User is signed out automatically
- ✅ Redirected to login page
- ✅ Message shown: "Your session has expired. Please sign in again."

### User Makes API Request with Expired Token
- ✅ NextAuth checks token expiration
- ✅ Refreshes if needed before request
- ✅ Request proceeds with fresh token

## Troubleshooting

### Users Being Logged Out Frequently
- Check Cognito token expiration settings
- Verify refresh token is being stored correctly
- Check browser console for errors

### Token Refresh Not Working
- Verify Cognito client credentials
- Check COGNITO_ISSUER URL is correct
- Ensure OAuth2 token endpoint is accessible

### Session Expired Message Not Showing
- Verify SessionRefreshHandler is in layout
- Check login page error handling
- Ensure error parameter is being passed

## More Information

See `SESSION_REFRESH.md` for detailed documentation.
