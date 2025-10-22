import { PreTokenGenerationTriggerEvent, PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface UserAttributes {
  [key: string]: string;
}

/**
 * Pre-token generation Lambda trigger for Cognito User Pool
 * Adds merchant_id and user_role claims to JWT tokens for tenant isolation
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  console.log('Pre-token generation event:', JSON.stringify(event, null, 2));

  try {
    const { userPoolId, userName } = event;
    const { clientId } = event.callerContext;

    // Get user attributes from Cognito
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });

    const userResponse = await cognitoClient.send(getUserCommand);
    
    if (!userResponse.UserAttributes) {
      throw new Error('User attributes not found');
    }

    // Convert user attributes to a more usable format
    const userAttributes: UserAttributes = {};
    userResponse.UserAttributes.forEach((attr: any) => {
      if (attr.Name && attr.Value) {
        userAttributes[attr.Name] = attr.Value;
      }
    });

    // Extract merchant_id and user_role from custom attributes
    const merchantId = userAttributes['custom:merchant_id'];
    const userRole = userAttributes['custom:user_role'] || 'customer';
    const email = userAttributes['email'];
    const givenName = userAttributes['given_name'];
    const familyName = userAttributes['family_name'];

    // Validate required attributes
    if (!merchantId && userRole !== 'platform_admin') {
      throw new Error('merchant_id is required for non-platform admin users');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    // Add custom claims to the token
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          merchant_id: merchantId || '',
          user_role: userRole,
          email: email,
          given_name: givenName || '',
          family_name: familyName || '',
          client_id: clientId,
        },
        claimsToSuppress: [], // Don't suppress any standard claims
        groupOverrideDetails: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: undefined,
        },
      },
    };

    // Add role-specific claims
    switch (userRole) {
      case 'platform_admin':
        event.response.claimsOverrideDetails!.claimsToAddOrOverride!.permissions = JSON.stringify([
          'read:all_merchants',
          'write:all_merchants',
          'admin:platform',
        ]);
        break;
      
      case 'merchant_admin':
        event.response.claimsOverrideDetails!.claimsToAddOrOverride!.permissions = JSON.stringify([
          'read:merchant_data',
          'write:merchant_data',
          'admin:merchant',
        ]);
        break;
      
      case 'customer':
      default:
        event.response.claimsOverrideDetails!.claimsToAddOrOverride!.permissions = JSON.stringify([
          'read:own_data',
          'write:own_data',
        ]);
        break;
    }

    // Add security metadata
    event.response.claimsOverrideDetails!.claimsToAddOrOverride!.iat = Math.floor(Date.now() / 1000).toString();
    event.response.claimsOverrideDetails!.claimsToAddOrOverride!.tenant_isolation = 'enabled';
    event.response.claimsOverrideDetails!.claimsToAddOrOverride!.security_level = userRole === 'platform_admin' ? 'high' : 'standard';

    console.log('Successfully added custom claims to token:', {
      merchantId,
      userRole,
      email,
      permissions: event.response.claimsOverrideDetails!.claimsToAddOrOverride!.permissions,
    });

    return event;

  } catch (error) {
    console.error('Error in pre-token generation:', error);
    
    // Log security event for monitoring
    console.log('SECURITY_EVENT', {
      event_type: 'token_generation_failure',
      user_pool_id: event.userPoolId,
      username: event.userName,
      client_id: event.callerContext.clientId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // Don't throw error to avoid breaking authentication flow
    // Instead, return minimal claims
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          user_role: 'customer',
          permissions: JSON.stringify(['read:own_data']),
          security_level: 'restricted',
          error_occurred: 'true',
        },
        claimsToSuppress: [],
        groupOverrideDetails: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: undefined,
        },
      },
    };

    return event;
  }
};

/**
 * Validates merchant_id format and existence
 */
function validateMerchantId(merchantId: string): boolean {
  if (!merchantId) return false;
  
  // Merchant ID should be alphanumeric with hyphens, 3-50 characters
  const merchantIdRegex = /^[a-zA-Z0-9-]{3,50}$/;
  return merchantIdRegex.test(merchantId);
}

/**
 * Validates user role
 */
function validateUserRole(userRole: string): boolean {
  const validRoles = ['platform_admin', 'merchant_admin', 'customer'];
  return validRoles.includes(userRole);
}

/**
 * Sanitizes user input to prevent injection attacks
 */
function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>\"'&]/g, '')
    .trim()
    .substring(0, 255); // Limit length
}