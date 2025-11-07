# Requirements Document: AWS Cognito Authentication Implementation

## Introduction

This document outlines the requirements for implementing AWS Cognito as the production authentication system for the MindShop platform. The implementation will replace the current mock authentication system with a fully-featured, secure user management solution while maintaining backward compatibility with existing API key authentication for programmatic access.

## Glossary

- **Cognito User Pool**: AWS managed user directory service that handles user registration, authentication, and account recovery
- **JWT Token**: JSON Web Token used for authenticating API requests after successful login
- **Custom Attribute**: User profile field in Cognito that stores merchant-specific data
- **Merchant**: A business entity that uses the MindShop platform to provide AI shopping assistance
- **Developer Portal**: Web application where merchants manage their MindShop integration
- **Backend API**: Node.js/Express server that processes chat requests and manages merchant data
- **Lambda Trigger**: AWS Lambda function that executes during Cognito authentication lifecycle events
- **MFA**: Multi-Factor Authentication requiring additional verification beyond password

## Requirements

### Requirement 1: User Registration and Onboarding

**User Story:** As a new merchant, I want to create an account so that I can access the MindShop developer portal and integrate the AI assistant into my e-commerce platform.

#### Acceptance Criteria

1. WHEN a user visits the registration page, THE Developer Portal SHALL display a form requesting email, password, company name, and business details
2. WHEN a user submits valid registration information, THE Cognito User Pool SHALL create a new user account with status "UNCONFIRMED"
3. WHEN Cognito creates a user account, THE System SHALL send a verification email containing a confirmation code to the user's email address
4. WHEN a user enters a valid confirmation code, THE Cognito User Pool SHALL change the user status to "CONFIRMED"
5. WHEN a user's account is confirmed, THE Post-Confirmation Lambda Trigger SHALL create a corresponding merchant record in the PostgreSQL database with a unique merchant_id

### Requirement 2: User Authentication

**User Story:** As a registered merchant, I want to log in to the developer portal so that I can manage my API keys, view analytics, and configure my AI assistant.

#### Acceptance Criteria

1. WHEN a user enters valid credentials on the login page, THE Cognito User Pool SHALL authenticate the user and return JWT access and ID tokens
2. WHEN authentication succeeds, THE Developer Portal SHALL store the JWT tokens securely in the session
3. WHEN a user makes an API request with a valid JWT token, THE Backend API SHALL verify the token signature using Cognito public keys
4. WHEN token verification succeeds, THE Backend API SHALL extract the merchant_id from custom attributes and attach user information to the request object
5. IF a JWT token is expired, THEN THE Backend API SHALL return a 401 Unauthorized response with message "Invalid or expired token"

### Requirement 3: Merchant-User Association

**User Story:** As a platform administrator, I want each user to be associated with a specific merchant account so that data isolation and multi-tenancy are enforced.

#### Acceptance Criteria

1. WHEN a merchant record is created, THE Post-Confirmation Lambda SHALL assign the merchant_id to the user's Cognito custom attribute "custom:merchant_id"
2. WHEN a user authenticates, THE JWT Token SHALL include the custom:merchant_id claim in the token payload
3. WHEN the backend processes a request, THE Auth Middleware SHALL validate that the user's merchant_id matches the requested resource's merchant_id
4. IF a user attempts to access another merchant's resources, THEN THE Backend API SHALL return a 403 Forbidden response
5. WHERE a user has the "admin" role, THE Backend API SHALL allow access to any merchant's resources

### Requirement 4: Role-Based Access Control

**User Story:** As a merchant owner, I want to assign different roles to team members so that I can control who can perform sensitive operations like deleting data or managing billing.

#### Acceptance Criteria

1. THE Cognito User Pool SHALL support custom attribute "custom:roles" storing comma-separated role values
2. WHEN a user is created, THE System SHALL assign the default role "merchant_user"
3. WHEN an admin assigns roles to a user, THE System SHALL update the custom:roles attribute in Cognito
4. WHEN a user authenticates, THE JWT Token SHALL include roles in the custom:roles claim
5. WHEN the backend checks permissions, THE Auth Middleware SHALL parse roles from the token and validate against required roles for the endpoint

### Requirement 5: Password Management

**User Story:** As a user, I want to reset my password if I forget it so that I can regain access to my account without contacting support.

#### Acceptance Criteria

1. WHEN a user clicks "Forgot Password" on the login page, THE Developer Portal SHALL display a form requesting the user's email address
2. WHEN a user submits their email, THE Cognito User Pool SHALL send a password reset code to the email address
3. WHEN a user enters the reset code and a new password, THE Cognito User Pool SHALL validate the code and update the password
4. WHEN password reset succeeds, THE Developer Portal SHALL redirect the user to the login page with a success message
5. IF the reset code is invalid or expired, THEN THE Cognito User Pool SHALL return an error and THE Developer Portal SHALL display "Invalid or expired reset code"

### Requirement 6: Email Verification

**User Story:** As a platform operator, I want to verify that users own the email addresses they register with so that we prevent spam accounts and ensure communication reliability.

#### Acceptance Criteria

1. WHEN a user registers, THE Cognito User Pool SHALL set the email_verified attribute to false
2. WHEN Cognito sends a verification email, THE Email SHALL contain a 6-digit confirmation code valid for 24 hours
3. WHEN a user enters a valid confirmation code, THE Cognito User Pool SHALL set email_verified to true
4. WHEN a user attempts to log in with an unverified email, THE Cognito User Pool SHALL allow authentication but THE Developer Portal SHALL display a banner prompting email verification
5. WHEN a user requests a new verification code, THE Cognito User Pool SHALL send a new code and invalidate the previous code

### Requirement 7: Session Management

**User Story:** As a user, I want my session to remain active while I'm using the portal so that I don't have to re-authenticate frequently, but I want it to expire after inactivity for security.

#### Acceptance Criteria

1. WHEN a user logs in, THE Cognito User Pool SHALL issue an access token with 1-hour expiration and a refresh token with 30-day expiration
2. WHEN an access token expires, THE Developer Portal SHALL automatically use the refresh token to obtain a new access token
3. WHEN a refresh token is used, THE Cognito User Pool SHALL issue new access and refresh tokens
4. WHEN a user logs out, THE Developer Portal SHALL clear all tokens from the session and THE Backend SHALL invalidate the session
5. IF a refresh token expires, THEN THE Developer Portal SHALL redirect the user to the login page

### Requirement 8: Infrastructure Setup

**User Story:** As a DevOps engineer, I want automated infrastructure provisioning so that I can deploy Cognito resources consistently across environments.

#### Acceptance Criteria

1. THE Infrastructure-as-Code Script SHALL create a Cognito User Pool with name "mindshop-users-{environment}"
2. THE User Pool SHALL have custom attributes: custom:merchant_id (String, mutable) and custom:roles (String, mutable)
3. THE User Pool SHALL have an App Client configured with OAuth 2.0 flows: authorization code and implicit
4. THE User Pool SHALL have email as the required sign-in attribute and email_verified as a required attribute
5. THE Infrastructure Script SHALL create Lambda functions for Post-Confirmation and Pre-Token-Generation triggers

### Requirement 9: Developer Portal Integration

**User Story:** As a frontend developer, I want the developer portal to seamlessly integrate with Cognito so that users have a smooth authentication experience.

#### Acceptance Criteria

1. THE Developer Portal SHALL use NextAuth.js with CognitoProvider for authentication
2. WHEN a user logs in, THE Portal SHALL redirect to Cognito Hosted UI for authentication
3. WHEN authentication succeeds, THE Portal SHALL receive JWT tokens via OAuth callback
4. THE Portal SHALL store access tokens in HTTP-only cookies for security
5. THE Portal SHALL include the access token in the Authorization header for all API requests to the backend

### Requirement 10: Backend API Integration

**User Story:** As a backend developer, I want the API to validate Cognito JWT tokens so that only authenticated users can access protected endpoints.

#### Acceptance Criteria

1. THE Backend API SHALL use the aws-jwt-verify library to validate JWT tokens
2. WHEN a request includes an Authorization header with Bearer token, THE Auth Middleware SHALL verify the token signature against Cognito public keys
3. WHEN token verification succeeds, THE Middleware SHALL extract user information and attach it to req.user
4. THE Backend SHALL support both JWT authentication (for portal users) and API key authentication (for programmatic access) on the same endpoints
5. IF token verification fails, THEN THE Backend SHALL return 401 Unauthorized with a descriptive error message

### Requirement 11: Environment Configuration

**User Story:** As a system administrator, I want to configure Cognito settings via environment variables so that I can easily switch between development and production environments.

#### Acceptance Criteria

1. THE Backend SHALL read Cognito configuration from environment variables: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION
2. WHEN ENABLE_COGNITO_AUTH is set to "false", THE Backend SHALL use mock authentication for development
3. WHEN ENABLE_COGNITO_AUTH is set to "true", THE Backend SHALL use Cognito JWT verification
4. THE Developer Portal SHALL read Cognito configuration from: COGNITO_ISSUER, COGNITO_CLIENT_SECRET, COGNITO_DOMAIN
5. THE System SHALL validate that all required Cognito environment variables are present at startup and log an error if any are missing

### Requirement 12: Error Handling and Logging

**User Story:** As a support engineer, I want detailed error logs for authentication failures so that I can troubleshoot user issues quickly.

#### Acceptance Criteria

1. WHEN authentication fails, THE System SHALL log the error with context including user email, error type, and timestamp
2. THE Backend SHALL return standardized error responses with success: false, error message, and request ID
3. WHEN token verification fails, THE Backend SHALL log the failure reason (expired, invalid signature, missing claims)
4. THE Developer Portal SHALL display user-friendly error messages for common authentication errors
5. THE System SHALL NOT log sensitive information such as passwords or full JWT tokens

### Requirement 13: Migration from Mock Authentication

**User Story:** As a platform operator, I want to migrate from mock authentication to Cognito without disrupting existing functionality so that the transition is seamless.

#### Acceptance Criteria

1. THE Backend SHALL support both mock and Cognito authentication modes simultaneously during migration
2. WHEN mock authentication is enabled, THE Backend SHALL accept tokens in format "userId:merchantId"
3. THE Auth Middleware SHALL detect token format and route to appropriate verification method
4. THE System SHALL maintain backward compatibility with existing API key authentication
5. WHEN Cognito is fully deployed, THE System SHALL disable mock authentication by setting ENABLE_COGNITO_AUTH=true

### Requirement 14: Security and Compliance

**User Story:** As a security officer, I want the authentication system to follow security best practices so that user data is protected and compliance requirements are met.

#### Acceptance Criteria

1. THE Cognito User Pool SHALL enforce password policy: minimum 8 characters, require uppercase, lowercase, number, and special character
2. THE System SHALL use HTTPS for all authentication requests
3. THE Backend SHALL validate JWT token expiration and reject expired tokens
4. THE Developer Portal SHALL store tokens in HTTP-only cookies to prevent XSS attacks
5. THE System SHALL implement rate limiting on login attempts: maximum 5 failed attempts per IP per 5 minutes

### Requirement 15: Multi-Factor Authentication (Optional)

**User Story:** As a security-conscious merchant, I want to enable MFA on my account so that my data is protected even if my password is compromised.

#### Acceptance Criteria

1. THE Cognito User Pool SHALL support optional MFA using TOTP (Time-based One-Time Password)
2. WHEN a user enables MFA, THE System SHALL generate a QR code for scanning with an authenticator app
3. WHEN MFA is enabled, THE Cognito User Pool SHALL require a TOTP code in addition to password during login
4. THE Developer Portal SHALL provide a settings page where users can enable or disable MFA
5. WHERE MFA is enabled, THE User SHALL be able to generate backup codes for account recovery
