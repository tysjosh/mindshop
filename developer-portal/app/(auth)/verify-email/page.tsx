'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  CognitoIdentityProviderClient, 
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand 
} from '@aws-sdk/client-cognito-identity-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, CheckCircle2, Mail } from 'lucide-react';

const verifyEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  confirmationCode: z
    .string()
    .min(6, 'Confirmation code must be at least 6 characters')
    .max(10, 'Confirmation code must not exceed 10 characters'),
});

type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: emailFromUrl,
    },
  });

  const onSubmit = async (data: VerifyEmailFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create Cognito client
      const client = new CognitoIdentityProviderClient({
        region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
      });

      // Call Cognito ConfirmSignUp API
      const command = new ConfirmSignUpCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        Username: data.email,
        ConfirmationCode: data.confirmationCode,
      });

      await client.send(command);

      setSuccess(true);

      // Redirect to login page after 2 seconds
      setTimeout(() => {
        router.push('/login?verified=true');
      }, 2000);
    } catch (err) {
      console.error('Verification error:', err);
      
      // Handle Cognito-specific errors
      let errorMessage = 'An error occurred during email verification';
      
      const error = err as { name?: string; message?: string };
      if (error.name === 'CodeMismatchException') {
        errorMessage = 'Invalid verification code. Please check and try again.';
      } else if (error.name === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.name === 'NotAuthorizedException') {
        errorMessage = 'User is already confirmed or verification failed.';
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your email address.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const email = getValues('email');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      // Create Cognito client
      const client = new CognitoIdentityProviderClient({
        region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
      });

      // Call Cognito ResendConfirmationCode API
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        Username: email,
      });

      await client.send(command);

      setResendSuccess(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Resend error:', err);
      
      // Handle Cognito-specific errors
      let errorMessage = 'An error occurred while resending the code';
      
      const error = err as { name?: string; message?: string };
      if (error.name === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your email address.';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = 'User is already confirmed.';
      } else if (error.name === 'LimitExceededException') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Email Verified!
            </CardTitle>
            <CardDescription className="text-center">
              Your account has been successfully verified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                You can now sign in to your account and start integrating MindShop.
              </p>
            </div>
            <p className="text-sm text-center text-gray-600">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Verify your email
          </CardTitle>
          <CardDescription className="text-center">
            Enter the verification code sent to your email address
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {resendSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 border border-green-200">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Verification code has been resent to your email</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...register('email')}
                disabled={isLoading || !!emailFromUrl}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmationCode">Verification code</Label>
              <Input
                id="confirmationCode"
                type="text"
                placeholder="Enter 6-digit code"
                {...register('confirmationCode')}
                disabled={isLoading}
                maxLength={10}
              />
              {errors.confirmationCode && (
                <p className="text-sm text-red-600">
                  {errors.confirmationCode.message}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Check your email for the verification code
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="link"
                onClick={handleResendCode}
                disabled={isResending || isLoading}
                className="px-0 text-sm"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Resending...
                  </>
                ) : (
                  "Didn't receive the code?"
                )}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify email'
              )}
            </Button>

            <div className="text-sm text-center text-gray-600">
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Back to login
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailForm />
    </Suspense>
  );
}
