'use client';

import { useSessionRefresh } from '@/hooks/use-session-refresh';

/**
 * Component that handles session refresh and expiration
 * 
 * This component should be placed in the root layout to monitor
 * the session across the entire application. It will automatically
 * sign out users and redirect to login when their refresh token expires.
 */
export function SessionRefreshHandler({ children }: { children: React.ReactNode }) {
  // This hook monitors the session and handles refresh token expiration
  useSessionRefresh();
  
  return <>{children}</>;
}
