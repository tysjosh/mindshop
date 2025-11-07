'use client';

import { useState } from 'react';
import { AlertCircle, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CognitoIdentityProviderClient, 
  ResendConfirmationCodeCommand 
} from '@aws-sdk/client-cognito-identity-provider';

interface EmailVerificationBannerProps {
  email: string;
}

/**
 * EmailVerificationBanner Component
 * 
 * Displays a banner prompting users to verify their email address.
 * Provides a button to resend the verification code.
 * 
 * @see .kiro/specs/cognito-authentication/tasks.md - Task 13: Add email verification banner
 * @see .kiro/specs/cognito-authentication/requirements.md - Requirement 6.4
 */
export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResendCode = async () => {
    setIsResending(true);
    setError(null);
    setSuccess(false);

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

      setSuccess(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Resend verification code error:', err);
      
      // Handle Cognito-specific errors
      let errorMessage = 'Failed to resend verification code';
      
      const error = err as { name?: string; message?: string };
      if (error.name === 'UserNotFoundException') {
        errorMessage = 'User not found. Please contact support.';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = 'Your email is already verified.';
      } else if (error.name === 'LimitExceededException') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Hide error message after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Alert className="border-yellow-500 bg-yellow-50 mb-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <AlertDescription className="text-yellow-900 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div>
                <span className="font-semibold">Email verification required</span>
                <span className="mx-2 hidden sm:inline">•</span>
                <span className="block sm:inline">
                  Please check your inbox at <strong>{email}</strong> and verify your email address.
                </span>
              </div>
              {success && (
                <div className="flex items-center gap-1 text-green-700 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verification code sent!</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-1 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResendCode}
          disabled={isResending}
          className="border-yellow-600 text-yellow-600 hover:bg-yellow-100 ml-4 flex-shrink-0"
        >
          {isResending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Resend Code
            </>
          )}
        </Button>
      </div>
    </Alert>
  );
}
