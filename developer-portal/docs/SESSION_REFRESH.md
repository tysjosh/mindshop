# Session Refresh and Token Management

This document describes how the developer portal handles session refresh and token expiration.

## Overview

The application uses AWS Cognito for authentication, which issues:
- **Access Token**: Short-lived token (1 hour) used for API requests
- **ID Token**: Contains user identity information (1 hour)
- **Refresh Token**: Long-lived token (30 days) used to obtain new access tokens

## Automatic Token Refresh

The NextAuth.js JWT callback automatically refreshes expired access tokens using the refresh token. This happens transparently without user intervention.

### How It Works

1. **Token Expiration Check**: Before each request, NextAuth checks if the access token has expired
2. **Automatic Refresh**: If expired, it calls the Cognito token endpoint with the refresh token
3. **Token Update**: New access and ID tokens are stored in the session
4. **Seamless Experience**: The user continues working without interruption

### Implementation

The token refresh logic is implemented in `app/api/auth/[...nextauth]/route.ts`:

```typescript
async function refreshAccessToken(token: any) {
  const response = await fetch(`${process.env.COGNITO_ISSUER}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.COGNITO_CLIENT_ID!,
      client_secret: process.env.COGNITO_CLIENT_SECRET!,
      refresh_token: token.refreshToken,
    }),
  });

  const refreshedTokens = await response.json();

  if (!response.ok) {
    throw refreshedTokens;
  }

  return {
    ...token,
    accessToken: refreshedTokens.access_token,
    idToken: refreshedTokens.id_token,
    accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
    refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
  };
}
```

## Refresh Token Expiration

When the refresh token expires (after 30 days of inactivity), the user must sign in again.

### Handling Expiration

The `useSessionRefresh` hook monitors the session for refresh errors and automatically:
1. Signs out the user
2. Redirects to the login page
3. Shows a "Your session has expired" message

### Usage

To use the session refresh handler in your components:

```tsx
import { useSessionRefresh } from '@/hooks/use-session-refresh';

function MyComponent() {
  const { session, status } = useSessionRefresh();
  
  if (status === 'loading') {
    return <div>Loading...</div>;
  }
  
  if (status === 'unauthenticated') {
    return <div>Please sign in</div>;
  }
  
  return <div>Welcome, {session?.user?.email}</div>;
}
```

### Global Handler

For application-wide session monitoring, wrap your app with the `SessionRefreshHandler`:

```tsx
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

## API Client Error Handling

The API client automatically handles 401 Unauthorized responses, which may indicate an expired token:

```typescript
if (response.status === 401) {
  const error = new Error(json.error || json.message || 'Unauthorized');
  (error as any).status = 401;
  throw error;
}
```

When a 401 error occurs:
1. The error is thrown to the calling component
2. NextAuth will attempt to refresh the token on the next request
3. If the refresh token is expired, the user is redirected to login

## Token Lifecycle

```
User Signs In
    ↓
Cognito Issues Tokens
    ↓
Access Token (1 hour)
ID Token (1 hour)
Refresh Token (30 days)
    ↓
User Makes API Request
    ↓
Access Token Expired? ──No──→ Request Succeeds
    ↓ Yes
Refresh Token Valid? ──No──→ Redirect to Login
    ↓ Yes
Request New Tokens
    ↓
Update Session
    ↓
Request Succeeds
```

## Configuration

### Environment Variables

Required environment variables for token refresh:

```env
# Cognito Configuration
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{user_pool_id}

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret
```

### Token Validity

Token validity periods are configured in the Cognito User Pool App Client:

- **Access Token**: 1 hour (3600 seconds)
- **ID Token**: 1 hour (3600 seconds)
- **Refresh Token**: 30 days (2592000 seconds)

## Security Considerations

1. **HTTP-Only Cookies**: Tokens are stored in HTTP-only cookies to prevent XSS attacks
2. **HTTPS Only**: All token exchanges must occur over HTTPS in production
3. **Token Rotation**: Refresh tokens are rotated on each use (optional)
4. **Secure Storage**: Never store tokens in localStorage or sessionStorage
5. **Token Validation**: All tokens are validated on the server side

## Troubleshooting

### Session Expires Too Quickly

If users are being logged out frequently:
- Check that the access token expiration is set correctly (1 hour)
- Verify that the refresh token is being stored properly
- Ensure the JWT callback is checking expiration correctly

### Refresh Token Not Working

If token refresh fails:
- Verify Cognito client credentials are correct
- Check that the refresh token hasn't expired (30 days)
- Ensure the Cognito issuer URL is correct
- Check CloudWatch logs for Cognito errors

### Users Not Redirected on Expiration

If users aren't redirected when the refresh token expires:
- Verify the `SessionRefreshHandler` is included in the layout
- Check that the `useSessionRefresh` hook is being called
- Ensure the error is being passed from the JWT callback to the session

## Testing

### Manual Testing

1. **Test Token Refresh**:
   - Sign in to the portal
   - Wait for the access token to expire (1 hour)
   - Make an API request
   - Verify the token is refreshed automatically

2. **Test Refresh Token Expiration**:
   - Manually expire the refresh token in Cognito
   - Make an API request
   - Verify the user is redirected to login

### Automated Testing

```typescript
// Example test for token refresh
describe('Token Refresh', () => {
  it('should refresh expired access token', async () => {
    // Mock expired token
    const expiredToken = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      accessTokenExpires: Date.now() - 1000,
    };
    
    // Call refresh function
    const refreshedToken = await refreshAccessToken(expiredToken);
    
    // Verify new token
    expect(refreshedToken.accessToken).not.toBe('expired_token');
    expect(refreshedToken.accessTokenExpires).toBeGreaterThan(Date.now());
  });
});
```

## References

- [NextAuth.js JWT Callback](https://next-auth.js.org/configuration/callbacks#jwt-callback)
- [AWS Cognito Token Endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html)
- [OAuth 2.0 Refresh Token Flow](https://oauth.net/2/grant-types/refresh-token/)
