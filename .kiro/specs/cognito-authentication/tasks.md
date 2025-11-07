# Implementation Plan: AWS Cognito Authentication

## Task Overview

This implementation plan breaks down the AWS Cognito authentication integration into discrete, manageable tasks. Each task builds incrementally on previous work and focuses on specific coding activities.

**Prerequisites:** AWS Cognito User Pool must be set up manually using the AWS Console. Follow the `MANUAL_SETUP_GUIDE.md` for step-by-step instructions.

---

## Phase 1: Lambda Triggers

- [x] 1. Implement Post-Confirmation Lambda trigger
  - Create Lambda function directory structure
  - Install dependencies (pg, uuid, aws-sdk)
  - _Requirements: 1.5, 3.1, 8.5_

- [x] 1.1 Write merchant creation logic
  - Generate unique merchant_id
  - Insert merchant record into PostgreSQL
  - Handle database errors and rollbacks
  - _Requirements: 1.5, 3.1_

- [x] 1.2 Update Cognito user attributes
  - Call AdminUpdateUserAttributes API
  - Set custom:merchant_id attribute
  - Set custom:roles attribute with default role
  - _Requirements: 3.1, 4.2_

- [x] 1.3 Add error handling and logging
  - Log merchant creation events
  - Handle duplicate merchant scenarios
  - Return appropriate error responses
  - _Requirements: 12.1, 12.3_

- [x] 1.4 Deploy Post-Confirmation Lambda
  - Package Lambda function with dependencies
  - Deploy to AWS Lambda
  - Attach to Cognito User Pool trigger
  - Test with sample user registration
  - _Requirements: 8.5_

- [x] 2. Implement Pre-Token-Generation Lambda trigger
  - Create Lambda function for token customization
  - Add custom claims to JWT tokens
  - Deploy and attach to Cognito trigger
  - _Requirements: 3.2, 4.4_

---

## Phase 2: Backend API Integration

- [x] 3. Update authentication middleware
  - Install aws-jwt-verify library
  - Update createAuthMiddleware function
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 3.1 Implement JWT token verification
  - Create CognitoJwtVerifier instance
  - Verify token signature against Cognito public keys
  - Extract and validate token claims
  - _Requirements: 2.3, 2.4, 10.2_

- [x] 3.2 Extract user information from token
  - Parse merchant_id from custom claims
  - Parse roles from custom claims
  - Attach user info to request object
  - _Requirements: 3.2, 3.3, 4.4_

- [x] 3.3 Add dual authentication support
  - Support both JWT and API key authentication
  - Detect authentication method from request
  - Route to appropriate verification logic
  - _Requirements: 10.4, 13.4_

- [x] 3.4 Implement merchant access validation
  - Update requireMerchantAccess middleware
  - Validate user's merchant_id matches requested resource
  - Allow admin role to bypass validation
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 3.5 Update permission middleware
  - Modify requirePermissions to work with JWT users
  - Grant full permissions to JWT-authenticated users
  - Maintain API key permission checks
  - _Requirements: 4.5, 10.4_

- [x] 4. Add environment configuration
  - Define Cognito environment variables in .env
  - Add validation for required variables
  - Support mock auth mode for development
  - _Requirements: 11.1, 11.2, 11.3, 13.1_

- [x] 4.1 Update configuration loading
  - Read Cognito config from environment
  - Validate configuration at startup
  - Log configuration status
  - _Requirements: 11.5_

- [x] 5. Implement error handling
  - Create standardized error response format
  - Add specific error codes for auth failures
  - Log authentication errors with context
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 5.1 Add security logging
  - Log failed authentication attempts
  - Track suspicious activity patterns
  - Implement rate limiting on auth endpoints
  - _Requirements: 14.5_

---

## Phase 3: Developer Portal Integration

- [x] 6. Configure NextAuth.js with Cognito
  - Install next-auth and cognito provider
  - Create NextAuth route handler
  - Configure CognitoProvider with credentials
  - _Requirements: 9.1, 9.2_

- [x] 6.1 Implement JWT and session callbacks
  - Extract tokens from Cognito response
  - Store merchant_id and roles in session
  - Configure session strategy and expiration
  - _Requirements: 7.1, 7.2, 9.3, 9.4_

- [x] 6.2 Configure authentication pages
  - Set custom sign-in page route
  - Set error page route
  - Configure redirect URLs
  - _Requirements: 9.2_

- [ ] 7. Create registration page
  - Build registration form UI
  - Add form validation
  - _Requirements: 1.1_

- [x] 7.1 Implement registration API calls
  - Call Cognito SignUp API
  - Handle registration errors
  - Show success message
  - _Requirements: 1.2_

- [x] 7.2 Create email verification flow
  - Build verification code input form
  - Call Cognito ConfirmSignUp API
  - Handle verification errors
  - Redirect to login on success
  - _Requirements: 1.3, 1.4, 6.3_

- [x] 7.3 Add resend verification code
  - Implement resend code button
  - Call Cognito ResendConfirmationCode API
  - Show success feedback
  - _Requirements: 6.5_

- [x] 8. Create login page
  - Build login form UI
  - Integrate with NextAuth signIn
  - Handle login errors
  - _Requirements: 2.1_

- [x] 8.1 Implement OAuth redirect flow
  - Configure OAuth callback handling
  - Store tokens in session
  - Redirect to dashboard on success
  - _Requirements: 2.2, 2.3, 9.2, 9.3_

- [x] 9. Create password reset flow
  - Build forgot password page
  - Call Cognito ForgotPassword API
  - _Requirements: 5.1, 5.2_

- [x] 9.1 Implement password reset confirmation
  - Build reset code input form
  - Call Cognito ConfirmForgotPassword API
  - Handle reset errors
  - Redirect to login on success
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 10. Implement token refresh logic
  - Detect expired access tokens
  - Automatically refresh using refresh token
  - Update session with new tokens
  - _Requirements: 7.2, 7.3_

- [x] 10.1 Handle refresh token expiration
  - Detect expired refresh tokens
  - Clear session and redirect to login
  - Show session expired message
  - _Requirements: 7.5_

- [x] 11. Add logout functionality
  - Implement logout button
  - Clear session tokens
  - Call Cognito GlobalSignOut API
  - Redirect to login page
  - _Requirements: 7.4_

- [x] 12. Update API client to use JWT tokens
  - Extract access token from session
  - Include token in Authorization header
  - Handle 401 responses with token refresh
  - _Requirements: 9.5_

- [x] 13. Add email verification banner
  - Check email_verified status in session
  - Display banner for unverified users
  - Provide resend verification link
  - _Requirements: 6.4_

---

## Phase 4: Database Updates

- [x] 14. Create database migration
  - Add cognito_user_id column to merchants table
  - Add email_verified column
  - Create index on cognito_user_id
  - _Requirements: 3.1_

- [x] 14.1 Update merchant repository
  - Add methods to query by cognito_user_id
  - Update merchant creation to include cognito_user_id
  - Handle unique constraint violations
  - _Requirements: 1.5, 3.1_

---

## Phase 5: Testing

- [x] 15. Write unit tests for auth middleware
  - Test valid JWT token verification
  - Test expired token rejection
  - Test invalid signature rejection
  - Test missing claims handling
  - _Requirements: 10.2, 10.3_

- [-] 15.1 Write unit tests for Lambda triggers
  - Test merchant creation logic
  - Test attribute assignment
  - Test error handling
  - Mock database and Cognito calls
  - _Requirements: 1.5, 3.1_

- [x] 16. Write integration tests for registration flow
  - Test complete signup process
  - Test email verification
  - Test merchant creation
  - Test first login
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 16.1 Write integration tests for authentication flow
  - Test login with valid credentials
  - Test token refresh
  - Test logout
  - Test session expiration
  - _Requirements: 2.1, 2.2, 2.3, 7.2, 7.4, 7.5_

- [x] 16.2 Write integration tests for API access
  - Test protected endpoint with JWT
  - Test protected endpoint with API key
  - Test cross-merchant access denial
  - Test admin override
  - _Requirements: 3.3, 3.4, 3.5, 10.4_

- [ ] 17. Write integration tests for password reset
  - Test forgot password flow
  - Test reset code validation
  - Test password update
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

---

## Phase 6: Security and Performance

- [ ] 18. Implement rate limiting
  - Add rate limiting to login endpoint
  - Add rate limiting to registration endpoint
  - Add rate limiting to password reset
  - _Requirements: 14.5_

- [ ] 18.1 Add security headers
  - Configure HTTPS enforcement
  - Set secure cookie flags
  - Add CORS configuration
  - _Requirements: 14.2_

- [ ] 19. Optimize token verification performance
  - Implement public key caching
  - Measure verification latency
  - Optimize for < 10ms target
  - _Requirements: Performance target_

- [ ] 19.1 Optimize Lambda cold starts
  - Implement connection pooling
  - Minimize Lambda package size
  - Configure provisioned concurrency
  - _Requirements: Performance target_

---

## Phase 7: Documentation and Deployment

- [ ] 20. Update API documentation
  - Document authentication endpoints
  - Add JWT token format examples
  - Document error responses
  - _Requirements: All_

- [ ] 20.1 Create deployment guide
  - Document infrastructure setup steps
  - Document environment configuration
  - Document migration process
  - _Requirements: 8.1, 11.1, 13.1_

- [ ] 21. Deploy to staging environment
  - Deploy Lambda triggers
  - Deploy backend updates
  - Deploy frontend updates
  - _Requirements: All_

- [ ] 21.1 Run end-to-end tests in staging
  - Test complete user flows
  - Verify all integrations
  - Check performance metrics
  - _Requirements: All_

- [ ] 22. Deploy to production
  - Update environment variables
  - Enable Cognito authentication
  - Monitor for issues
  - _Requirements: All_

- [ ] 22.1 Set up monitoring and alerts
  - Configure CloudWatch metrics
  - Set up authentication success rate alerts
  - Set up performance alerts
  - Set up security alerts
  - _Requirements: Monitoring section_

---

## Phase 8: Optional Enhancements

- [ ]* 23. Implement MFA support
  - Enable TOTP MFA in Cognito
  - Create MFA setup page
  - Generate QR code for authenticator apps
  - Test MFA login flow
  - _Requirements: 15.1, 15.2, 15.3_

- [ ]* 23.1 Add MFA management UI
  - Create settings page for MFA
  - Add enable/disable MFA toggle
  - Generate backup codes
  - _Requirements: 15.4, 15.5_

- [ ]* 24. Add social login providers
  - Configure Google OAuth provider
  - Configure GitHub OAuth provider
  - Update login page with social buttons
  - Test social login flows
  - _Requirements: Optional enhancement_

- [ ]* 25. Implement team management
  - Create team invitation flow
  - Add team member list page
  - Implement role assignment UI
  - Add remove team member functionality
  - _Requirements: 4.3_
