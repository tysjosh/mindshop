# Design Document: AWS Cognito Authentication Implementation

## Overview

This document describes the technical design for implementing AWS Cognito as the production authentication system for the MindShop platform. The design integrates Cognito with the existing backend API and developer portal while maintaining support for API key authentication for programmatic access.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer Portal                          │
│                      (Next.js + NextAuth.js)                     │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                 │
                 │ OAuth 2.0                       │ JWT Token
                 │ Authorization Code Flow         │ (API Requests)
                 │                                 │
┌────────────────▼────────────────┐   ┌───────────▼────────────────┐
│     AWS Cognito User Pool       │   │      Backend API           │
│  ┌──────────────────────────┐   │   │   (Node.js/Express)        │
│  │  User Directory          │   │   │  ┌──────────────────────┐  │
│  │  - Email/Password        │   │   │  │  Auth Middleware     │  │
│  │  - Custom Attributes     │   │   │  │  - JWT Verification  │  │
│  │  - Roles & Groups        │   │   │  │  - API Key Auth      │  │
│  └──────────────────────────┘   │   │  └──────────────────────┘  │
│                                  │   │                            │
│  ┌──────────────────────────┐   │   │  ┌──────────────────────┐  │
│  │  Lambda Triggers         │   │   │  │  Protected Routes    │  │
│  │  - Post-Confirmation     │───┼───┼─▶│  - Merchant Data     │  │
│  │  - Pre-Token-Generation  │   │   │  │  - API Keys          │  │
│  └──────────────────────────┘   │   │  │  - Analytics         │  │
│                                  │   │  └──────────────────────┘  │
└──────────────────────────────────┘   └────────────┬───────────────┘
                                                     │
                                        ┌────────────▼───────────────┐
                                        │   PostgreSQL Database      │
                                        │  ┌──────────────────────┐  │
                                        │  │  merchants           │  │
                                        │  │  - merchant_id (PK)  │  │
                                        │  │  - company_name      │  │
                                        │  │  - cognito_user_id   │  │
                                        │  └──────────────────────┘  │
                                        └────────────────────────────┘
```

### Authentication Flow

```
User Registration Flow:
1. User → Developer Portal: Submit registration form
2. Developer Portal → Cognito: SignUp API call
3. Cognito → User: Send verification email
4. User → Cognito: Submit verification code
5. Cognito → Lambda: Trigger Post-Confirmation
6. Lambda → Database: Create merchant record
7. Lambda → Cognito: Add custom:merchant_id attribute
8. Developer Portal → User: Show success, redirect to login

User Login Flow:
1. User → Developer Portal: Click "Sign In"
2. Developer Portal → Cognito Hosted UI: Redirect with OAuth params
3. User → Cognito: Enter credentials
4. Cognito → Developer Portal: Redirect with authorization code
5. Developer Portal → Cognito: Exchange code for tokens
6. Developer Portal: Store tokens in session
7. User → Developer Portal: Access protected pages

API Request Flow:
1. Developer Portal → Backend API: Request with JWT in Authorization header
2. Backend → Cognito: Verify JWT signature (cached public keys)
3. Backend: Extract merchant_id from token claims
4. Backend: Validate merchant access
5. Backend → Database: Query merchant data
6. Backend → Developer Portal: Return response
```

## Components and Interfaces

### 1. AWS Cognito User Pool

**Configuration:**
```typescript
interface CognitoUserPoolConfig {
  poolName: string; // "mindshop-users-production"
  autoVerifiedAttributes: ['email'];
  usernameAttributes: ['email'];
  passwordPolicy: {
    minimumLength: 8;
    requireLowercase: true;
    requireUppercase: true;
    requireNumbers: true;
    requireSymbols: true;
  };
  customAttributes: [
    {
      name: 'merchant_id';
      type: 'String';
      mutable: true;
    },
    {
      name: 'roles';
      type: 'String';
      mutable: true;
    }
  ];
  mfaConfiguration: 'OPTIONAL';
  emailConfiguration: {
    emailSendingAccount: 'COGNITO_DEFAULT';
    replyToEmailAddress: 'noreply@mindshop.com';
  };
}
```

**App Client Configuration:**
```typescript
interface CognitoAppClientConfig {
  clientName: string; // "mindshop-developer-portal"
  generateSecret: true;
  authFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
  oAuthFlows: ['code', 'implicit'];
  oAuthScopes: ['openid', 'email', 'profile'];
  callbackURLs: [
    'http://localhost:3001/api/auth/callback/cognito',
    'https://portal.mindshop.com/api/auth/callback/cognito'
  ];
  logoutURLs: [
    'http://localhost:3001',
    'https://portal.mindshop.com'
  ];
  tokenValidityUnits: {
    accessToken: 'hours';
    idToken: 'hours';
    refreshToken: 'days';
  };
  accessTokenValidity: 1; // 1 hour
  idTokenValidity: 1; // 1 hour
  refreshTokenValidity: 30; // 30 days
}
```

### 2. Lambda Triggers

#### Post-Confirmation Trigger

**Purpose:** Create merchant record and assign merchant_id when user confirms email

**Implementation:**
```typescript
// lambda-functions/cognito-post-confirmation/index.ts

import { PostConfirmationTriggerEvent } from 'aws-lambda';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

export const handler = async (event: PostConfirmationTriggerEvent) => {
  const { userPoolId, userName, request } = event;
  const { userAttributes } = request;
  
  try {
    // Generate unique merchant ID
    const merchantId = `merchant_${uuidv4().replace(/-/g, '')}`;
    
    // Extract company name from user attributes (if provided during signup)
    const companyName = userAttributes['custom:company_name'] || 
                       userAttributes.email.split('@')[0];
    
    // Create merchant record in database
    const query = `
      INSERT INTO merchants (
        merchant_id, 
        company_name, 
        email, 
        cognito_user_id,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING merchant_id
    `;
    
    await pool.query(query, [
      merchantId,
      companyName,
      userAttributes.email,
      userName,
      'active'
    ]);
    
    // Update Cognito user with merchant_id
    const AWS = require('aws-sdk');
    const cognito = new AWS.CognitoIdentityServiceProvider();
    
    await cognito.adminUpdateUserAttributes({
      UserPoolId: userPoolId,
      Username: userName,
      UserAttributes: [
        {
          Name: 'custom:merchant_id',
          Value: merchantId
        },
        {
          Name: 'custom:roles',
          Value: 'merchant_user,merchant_admin'
        }
      ]
    }).promise();
    
    console.log(`Created merchant ${merchantId} for user ${userName}`);
    
    return event;
  } catch (error) {
    console.error('Post-confirmation error:', error);
    throw error;
  }
};
```

#### Pre-Token-Generation Trigger

**Purpose:** Add custom claims to JWT tokens

**Implementation:**
```typescript
// lambda-functions/cognito-pre-token-generation/index.ts

import { PreTokenGenerationTriggerEvent } from 'aws-lambda';

export const handler = async (event: PreTokenGenerationTriggerEvent) => {
  const { request, response } = event;
  
  // Add custom claims to ID token
  response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      merchant_id: request.userAttributes['custom:merchant_id'],
      roles: request.userAttributes['custom:roles'],
      email_verified: request.userAttributes.email_verified
    }
  };
  
  return event;
};
```

### 3. Backend Auth Middleware

**Enhanced Implementation:**
```typescript
// src/api/middleware/auth.ts

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    merchantId: string;
    email: string;
    roles: string[];
    emailVerified: boolean;
  };
}

export function createAuthMiddleware(config: {
  userPoolId: string;
  clientId: string;
  region: string;
  enableMockAuth?: boolean;
}) {
  // Create JWT verifier for Cognito tokens
  const verifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  });
  
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Verify JWT token
      const payload = await verifier.verify(token);
      
      // Extract user information
      req.user = {
        userId: payload.sub,
        merchantId: payload['custom:merchant_id'] || payload.merchant_id,
        email: payload.email,
        roles: (payload['custom:roles'] || '').split(',').filter(Boolean),
        emailVerified: payload.email_verified === 'true'
      };
      
      // Validate required fields
      if (!req.user.merchantId) {
        throw new Error('Token missing merchant_id claim');
      }
      
      next();
    } catch (error: any) {
      console.error('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  };
}

// Middleware to validate merchant access
export function requireMerchantAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const requestedMerchantId = req.params.merchantId || req.body.merchantId;
  
  if (!requestedMerchantId) {
    return res.status(400).json({
      success: false,
      error: 'Merchant ID is required'
    });
  }
  
  // Allow admin users to access any merchant
  if (req.user?.roles.includes('admin')) {
    return next();
  }
  
  // Validate user's merchant matches requested merchant
  if (req.user?.merchantId !== requestedMerchantId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to merchant resources'
    });
  }
  
  next();
}
```

### 4. Developer Portal Integration

**NextAuth Configuration:**
```typescript
// developer-portal/app/api/auth/[...nextauth]/route.ts

import NextAuth from 'next-auth';
import CognitoProvider from 'next-auth/providers/cognito';

const handler = NextAuth({
  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
      authorization: {
        params: {
          scope: 'openid email profile'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.merchantId = (profile as any)['custom:merchant_id'];
        token.roles = (profile as any)['custom:roles'];
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.merchantId = token.merchantId as string;
      session.user.roles = token.roles as string;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  }
});

export { handler as GET, handler as POST };
```

**Registration Page:**
```typescript
// developer-portal/app/(auth)/register/page.tsx

'use client';

import { useState } from 'react';
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: ''
  });
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [verificationCode, setVerificationCode] = useState('');
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_COGNITO_REGION
    });
    
    try {
      await client.send(new SignUpCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
        Username: formData.email,
        Password: formData.password,
        UserAttributes: [
          { Name: 'email', Value: formData.email },
          { Name: 'custom:company_name', Value: formData.companyName }
        ]
      }));
      
      setStep('verify');
    } catch (error) {
      console.error('Registration error:', error);
    }
  };
  
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_COGNITO_REGION
    });
    
    try {
      await client.send(new ConfirmSignUpCommand({
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
        Username: formData.email,
        ConfirmationCode: verificationCode
      }));
      
      // Redirect to login
      window.location.href = '/login?verified=true';
    } catch (error) {
      console.error('Verification error:', error);
    }
  };
  
  // Render registration or verification form based on step
  return step === 'register' ? (
    <form onSubmit={handleRegister}>
      {/* Registration form fields */}
    </form>
  ) : (
    <form onSubmit={handleVerify}>
      {/* Verification form fields */}
    </form>
  );
}
```

## Data Models

### Cognito User Attributes

```typescript
interface CognitoUserAttributes {
  sub: string; // Cognito user ID (UUID)
  email: string;
  email_verified: boolean;
  'custom:merchant_id': string; // Links to merchants table
  'custom:roles': string; // Comma-separated roles
  'custom:company_name'?: string; // Optional company name
}
```

### JWT Token Claims

```typescript
interface JWTClaims {
  sub: string; // User ID
  email: string;
  email_verified: boolean;
  merchant_id: string; // From custom attribute
  roles: string; // From custom attribute
  iss: string; // Cognito issuer URL
  aud: string; // Client ID
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  token_use: 'access' | 'id';
}
```

### Database Schema Updates

```sql
-- Add cognito_user_id to merchants table
ALTER TABLE merchants 
ADD COLUMN cognito_user_id VARCHAR(255) UNIQUE,
ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_merchants_cognito_user_id ON merchants(cognito_user_id);
```

## Error Handling

### Error Response Format

```typescript
interface AuthErrorResponse {
  success: false;
  error: string; // User-friendly error message
  code?: string; // Error code for programmatic handling
  timestamp: string;
  requestId: string;
}
```

### Common Error Scenarios

| Scenario | HTTP Status | Error Message | Code |
|----------|-------------|---------------|------|
| Missing token | 401 | "Missing or invalid authorization header" | AUTH_MISSING |
| Expired token | 401 | "Invalid or expired token" | TOKEN_EXPIRED |
| Invalid signature | 401 | "Invalid or expired token" | TOKEN_INVALID |
| Missing merchant_id | 401 | "Token missing merchant_id claim" | MERCHANT_ID_MISSING |
| Wrong merchant | 403 | "Access denied to merchant resources" | ACCESS_DENIED |
| Unverified email | 403 | "Email verification required" | EMAIL_UNVERIFIED |

## Testing Strategy

### Unit Tests

1. **Auth Middleware Tests**
   - Valid JWT token verification
   - Expired token rejection
   - Invalid signature rejection
   - Missing claims handling
   - Mock auth mode

2. **Lambda Trigger Tests**
   - Merchant creation
   - Attribute assignment
   - Error handling
   - Database rollback

### Integration Tests

1. **End-to-End Registration Flow**
   - User signup
   - Email verification
   - Merchant creation
   - First login

2. **Authentication Flow**
   - Login with valid credentials
   - Token refresh
   - Logout
   - Session expiration

3. **API Access Tests**
   - Protected endpoint access with JWT
   - Protected endpoint access with API key
   - Cross-merchant access denial
   - Admin override

### Performance Tests

1. **Token Verification Performance**
   - Target: < 10ms per verification
   - Use cached public keys
   - Measure under load

2. **Lambda Trigger Performance**
   - Target: < 500ms for post-confirmation
   - Database connection pooling
   - Async operations

## Security Considerations

### Token Security

1. **Storage**: Store tokens in HTTP-only cookies (not localStorage)
2. **Transmission**: Always use HTTPS
3. **Expiration**: Short-lived access tokens (1 hour)
4. **Refresh**: Secure refresh token rotation

### Password Security

1. **Policy**: Enforce strong password requirements
2. **Hashing**: Cognito handles bcrypt hashing
3. **Reset**: Secure password reset flow with time-limited codes

### Rate Limiting

1. **Login Attempts**: 5 attempts per IP per 5 minutes
2. **Token Refresh**: 10 requests per user per minute
3. **Registration**: 3 attempts per IP per hour

## Deployment Strategy

### Phase 1: Infrastructure Setup (Week 1)
- Create Cognito User Pool
- Deploy Lambda triggers
- Configure environment variables
- Test in staging environment

### Phase 2: Backend Integration (Week 2)
- Update auth middleware
- Add merchant creation logic
- Deploy to staging
- Run integration tests

### Phase 3: Frontend Integration (Week 3)
- Implement registration flow
- Implement login flow
- Add password reset
- Deploy to staging

### Phase 4: Testing & Migration (Week 4)
- End-to-end testing
- Performance testing
- Security audit
- Production deployment

### Phase 5: Monitoring & Optimization (Ongoing)
- Monitor authentication metrics
- Optimize token verification
- Gather user feedback
- Iterate on UX

## Monitoring and Metrics

### Key Metrics

1. **Authentication Success Rate**: Target > 99%
2. **Token Verification Latency**: Target < 10ms (p95)
3. **Registration Completion Rate**: Target > 80%
4. **Email Verification Rate**: Target > 90%

### Logging

1. **Authentication Events**: Login, logout, token refresh
2. **Error Events**: Failed verifications, expired tokens
3. **Security Events**: Multiple failed attempts, suspicious activity

### Alerts

1. **High Error Rate**: > 5% authentication failures
2. **Slow Performance**: Token verification > 50ms (p95)
3. **Security Incidents**: > 10 failed attempts from single IP
