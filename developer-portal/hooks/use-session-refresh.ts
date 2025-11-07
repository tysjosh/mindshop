'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Custom hook to handle session refresh and expiration
 * 
 * This hook monitors the session for refresh token errors and automatically
 * signs out the user and redirects to login when the refresh token expires.
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { session, status } = useSessionRefresh();
 *   // ... rest of component
 * }
 * ```
 */
export function useSessionRefresh() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasHandledError = useRef(false);

  useEffect(() => {
    // Check if session has a refresh error
    if (session && (session as any).error === 'RefreshAccessTokenError' && !hasHandledError.current) {
      hasHandledError.current = true;
      
      console.log('Refresh token expired, signing out...');
      
      // Sign out and redirect to login with session expired message
      signOut({ 
        callbackUrl: '/login?error=SessionExpired',
        redirect: true 
      });
    }
  }, [session, router]);

  return { session, status };
}
