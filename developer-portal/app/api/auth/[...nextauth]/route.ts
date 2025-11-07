import NextAuth, { AuthOptions } from 'next-auth';
import CognitoProvider from 'next-auth/providers/cognito';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';

const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(token: JWT) {
  try {
    // In dev mode, just return the token as-is
    if (isDevMode) {
      return token;
    }

    const response = await fetch(`${process.env.COGNITO_ISSUER}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.COGNITO_CLIENT_ID!,
        client_secret: process.env.COGNITO_CLIENT_SECRET!,
        refresh_token: token.refreshToken as string,
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
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

const authOptions: AuthOptions = {
  providers: [
    // Dev mode: bypass authentication
    ...(isDevMode
      ? [
          CredentialsProvider({
            id: 'dev-bypass',
            name: 'Development Mode',
            credentials: {},
            async authorize() {
              return {
                id: process.env.DEV_MERCHANT_ID || 'dev-merchant-123',
                email: 'dev@example.com',
                name: 'Dev User',
                merchantId: process.env.DEV_MERCHANT_ID || 'dev-merchant-123',
                roles: 'merchant_user,merchant_admin',
              };
            },
          }),
        ]
      : []),
    // Production: Cognito
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Dev mode: inject mock data
      if (isDevMode && user) {
        token.accessToken = process.env.DEV_ACCESS_TOKEN || 'dev-token-12345';
        token.idToken = 'dev-id-token';
        token.refreshToken = 'dev-refresh-token';
        token.merchantId = user.merchantId || user.id;
        token.roles = user.roles || 'merchant_user,merchant_admin';
        token.emailVerified = true;
        return token;
      }

      // Initial sign in: Extract tokens from Cognito response
      if (account && profile) {
        // Store all tokens from Cognito
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        
        // Extract merchant_id and roles from custom attributes
        const customProfile = profile as Record<string, string | boolean | undefined>;
        token.merchantId = customProfile['custom:merchant_id'] as string || customProfile.merchant_id as string;
        token.roles = customProfile['custom:roles'] as string || customProfile.roles as string || 'merchant_user';
        token.emailVerified = customProfile.email_verified === 'true' || customProfile.email_verified === true;
        
        // Store token expiration times
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
        
        return token;
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to refresh it
      console.log('Access token expired, attempting refresh...');
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Attach tokens and user information to session
      session.accessToken = token.accessToken as string;
      session.user.id = token.sub as string;
      session.user.merchantId = token.merchantId as string;
      session.user.roles = token.roles as string;
      
      // Add email verification status (can be used to show verification banner)
      if (token.emailVerified !== undefined) {
        (session.user as { emailVerified?: boolean }).emailVerified = token.emailVerified;
      }

      // Pass refresh error to client so it can handle session expiration
      if (token.error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).error = token.error;
      }
      
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      // Log signout event
      console.log('User signed out:', {
        userId: token?.sub,
        merchantId: token?.merchantId,
        timestamp: new Date().toISOString(),
      });
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
