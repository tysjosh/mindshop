'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

function LoginForm() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const error = searchParams.get('error');

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      if (isDevMode) {
        await signIn('dev-bypass', { callbackUrl });
      } else {
        await signIn('cognito', { callbackUrl });
      }
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'SessionExpired':
        return 'Your session has expired. Please sign in again.';
      case 'OAuthSignin':
      case 'OAuthCallback':
        return 'Error connecting to authentication provider. Please try again.';
      case 'OAuthCreateAccount':
        return 'Could not create account. Please contact support.';
      case 'EmailCreateAccount':
        return 'Could not create account with that email.';
      case 'Callback':
        return 'Authentication callback failed. Please try again.';
      case 'OAuthAccountNotLinked':
        return 'Account already exists with different credentials.';
      case 'SessionRequired':
        return 'Please sign in to access this page.';
      case 'Default':
      default:
        return error ? 'An error occurred during sign in. Please try again.' : null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-center">
            Access the developer portal to manage your MindShop integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button
            onClick={handleSignIn}
            className="w-full"
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : isDevMode ? (
              'Sign in (Dev Mode)'
            ) : (
              'Sign in with AWS Cognito'
            )}
          </Button>

          {isDevMode && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
              <strong>Development Mode:</strong> Authentication is bypassed. Click the button above to continue.
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">
                Secure authentication
              </span>
            </div>
          </div>

          <div className="text-xs text-center text-gray-500">
            Your credentials are securely managed by AWS Cognito
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-gray-600">
            <Link
              href="/forgot-password"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Forgot your password?
            </Link>
          </div>
          <div className="text-sm text-center text-gray-600">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
