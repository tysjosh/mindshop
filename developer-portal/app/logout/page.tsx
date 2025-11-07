'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Loader2, AlertCircle } from 'lucide-react';

export default function LogoutPage() {
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  useEffect(() => {
    const performLogout = async () => {
      try {
        // In production mode with Cognito, call GlobalSignOut API
        if (!isDevMode && session?.accessToken) {
          try {
            // Call our logout API endpoint which will handle Cognito GlobalSignOut
            const response = await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accessToken: session.accessToken,
              }),
            });

            if (!response.ok) {
              console.error('Cognito GlobalSignOut failed:', await response.text());
              // Continue with local sign out even if GlobalSignOut fails
            }
          } catch (cognitoError) {
            console.error('Error calling Cognito GlobalSignOut:', cognitoError);
            // Continue with local sign out even if GlobalSignOut fails
          }
        }

        // Clear session tokens and redirect to login page
        await signOut({ callbackUrl: '/login' });
      } catch (err) {
        console.error('Logout error:', err);
        setError('An error occurred during logout. Please try again.');
      }
    };

    performLogout();
  }, [session, isDevMode]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Logout Error
          </h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          Signing out...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we log you out
        </p>
      </div>
    </div>
  );
}
