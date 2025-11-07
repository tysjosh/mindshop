import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

/**
 * POST /api/auth/logout
 * 
 * Handles logout by calling Cognito's GlobalSignOut API to invalidate all tokens
 * for the user across all devices.
 */
export async function POST(request: NextRequest) {
  try {
    // In dev mode, skip Cognito GlobalSignOut
    if (isDevMode) {
      return NextResponse.json({
        success: true,
        message: 'Logged out (dev mode)',
      });
    }

    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access token is required',
        },
        { status: 400 }
      );
    }

    // Validate required Cognito configuration
    if (!process.env.COGNITO_CLIENT_ID || !process.env.NEXT_PUBLIC_COGNITO_REGION) {
      console.error('Missing Cognito configuration for logout');
      return NextResponse.json(
        {
          success: false,
          error: 'Cognito configuration is missing',
        },
        { status: 500 }
      );
    }

    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_COGNITO_REGION,
    });

    // Call GlobalSignOut to invalidate all tokens for this user
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    await cognitoClient.send(command);

    console.log('Successfully called Cognito GlobalSignOut');

    return NextResponse.json({
      success: true,
      message: 'Successfully logged out from all devices',
    });
  } catch (error) {
    console.error('Cognito GlobalSignOut error:', error);

    // Return error but don't block logout
    // The client will still clear local session
    const err = error as { message?: string; name?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to sign out from Cognito',
        code: err.name || 'COGNITO_SIGNOUT_ERROR',
      },
      { status: 500 }
    );
  }
}
