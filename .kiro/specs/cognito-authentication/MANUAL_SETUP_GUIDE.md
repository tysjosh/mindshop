# AWS Cognito Manual Setup Guide

This guide walks you through setting up AWS Cognito User Pool manually using the AWS Console. This is an alternative to using CloudFormation/Terraform scripts.

## Prerequisites

- AWS Account with appropriate permissions
- Access to AWS Console
- Region selected (recommended: us-east-1)

---

## Step 1: Create Cognito User Pool

### 1.1 Navigate to Cognito

1. Log in to AWS Console
2. Search for "Cognito" in the services search bar
3. Click on **Amazon Cognito**
4. Click **Create user pool**

### 1.2 Configure Sign-in Experience

**Step 1 of 6: Configure sign-in experience**

1. **Provider types**: Select **Cognito user pool**
2. **Cognito user pool sign-in options**: Check **Email**
3. Click **Next**

### 1.3 Configure Security Requirements

**Step 2 of 6: Configure security requirements**

1. **Password policy**:
   - Select **Cognito defaults** or **Custom**
   - If Custom, set:
     - Minimum length: **8 characters**
     - ✅ Require lowercase letters
     - ✅ Require uppercase letters
     - ✅ Require numbers
     - ✅ Require special characters

2. **Multi-factor authentication**:
   - Select **Optional MFA** (users can enable it themselves)
   - MFA methods: Check **Authenticator apps**

3. **User account recovery**:
   - ✅ Enable self-service account recovery
   - Delivery method: **Email only**

4. Click **Next**

### 1.4 Configure Sign-up Experience

**Step 3 of 6: Configure sign-up experience**

1. **Self-service sign-up**: ✅ **Enable self-registration**

2. **Attribute verification and user account confirmation**:
   - ✅ Allow Cognito to automatically send messages to verify and confirm
   - Attributes to verify: **Send email message, verify email address**

3. **Required attributes**:
   - ✅ **email** (already selected)
   - ✅ **name** (optional, but recommended)

4. **Custom attributes** (IMPORTANT):
   - Click **Add custom attribute**
   - Attribute 1:
     - Name: `merchant_id`
     - Type: **String**
     - Min length: 1
     - Max length: 255
     - ✅ Mutable
   - Click **Add custom attribute** again
   - Attribute 2:
     - Name: `roles`
     - Type: **String**
     - Min length: 1
     - Max length: 500
     - ✅ Mutable
   - Click **Add custom attribute** again (optional)
   - Attribute 3:
     - Name: `company_name`
     - Type: **String**
     - Min length: 1
     - Max length: 255
     - ✅ Mutable

5. Click **Next**

### 1.5 Configure Message Delivery

**Step 4 of 6: Configure message delivery**

1. **Email provider**:
   - Select **Send email with Cognito** (for testing/development)
   - OR **Send email with Amazon SES** (for production)

2. **SES Region** (if using SES): Select your region

3. **FROM email address**:
   - If using Cognito: `no-reply@verificationemail.com` (default)
   - If using SES: Your verified email (e.g., `noreply@mindshop.com`)

4. **REPLY-TO email address** (optional):
   - Enter: `support@mindshop.com` (or your support email)

5. Click **Next**

### 1.6 Integrate Your App

**Step 5 of 6: Integrate your app**

1. **User pool name**: `mindshop-users-production` (or `mindshop-users-staging`)

2. **Hosted authentication pages**:
   - ✅ **Use the Cognito Hosted UI**

3. **Domain**:
   - **Domain type**: Select **Use a Cognito domain**
   - **Cognito domain**: Enter a unique prefix (e.g., `mindshop-auth` or `mindshop-portal`)
   - Click **Check availability**
   - Your full domain will be: `https://mindshop-auth.auth.us-east-1.amazoncognito.com`

4. **Initial app client**:
   - **App type**: Select **Public client**
   - **App client name**: `mindshop-developer-portal`
   - **Client secret**: Select **Generate a client secret**

5. **Allowed callback URLs**:
   - Add: `http://localhost:3001/api/auth/callback/cognito`
   - Add: `https://portal.mindshop.com/api/auth/callback/cognito` (for production)

6. **Allowed sign-out URLs**:
   - Add: `http://localhost:3001`
   - Add: `https://portal.mindshop.com` (for production)

7. **Identity providers**: ✅ **Cognito user pool**

8. **OAuth 2.0 grant types**:
   - ✅ **Authorization code grant**
   - ✅ **Implicit grant**

9. **OpenID Connect scopes**:
   - ✅ **OpenID**
   - ✅ **Email**
   - ✅ **Profile**

10. **Advanced app client settings**:
    - **Authentication flows**: ✅ **ALLOW_USER_PASSWORD_AUTH**
    - **Token expiration**:
      - Access token: **1 hour**
      - ID token: **1 hour**
      - Refresh token: **30 days**

11. Click **Next**

### 1.7 Review and Create

**Step 6 of 6: Review and create**

1. Review all settings
2. Click **Create user pool**
3. Wait for creation to complete (usually 1-2 minutes)

---

## Step 2: Get Configuration Values

After the user pool is created, you need to collect configuration values for your application.

### 2.1 User Pool ID

1. On the User Pool page, find **User pool ID** at the top
2. Copy the value (format: `us-east-1_XXXXXXXXX`)
3. Save this as `COGNITO_USER_POOL_ID`

### 2.2 App Client Details

1. Click on the **App integration** tab
2. Scroll down to **App clients and analytics**
3. Click on your app client name (`mindshop-developer-portal`)
4. Copy the following values:
   - **Client ID**: Save as `COGNITO_CLIENT_ID`
   - **Client secret**: Click **Show client secret**, copy and save as `COGNITO_CLIENT_SECRET`

### 2.3 Cognito Domain

1. Still in the **App integration** tab
2. Scroll to **Domain** section
3. Copy the domain URL (e.g., `https://mindshop-auth.auth.us-east-1.amazoncognito.com`)
4. Save as `COGNITO_DOMAIN`

### 2.4 Issuer URL

1. The issuer URL format is: `https://cognito-idp.{region}.amazonaws.com/{user-pool-id}`
2. Example: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX`
3. Save as `COGNITO_ISSUER`

---

## Step 3: Update Environment Variables

### 3.1 Backend API (.env)

Add these variables to your backend `.env` file:

```bash
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your_client_id_here
COGNITO_REGION=us-east-1
ENABLE_COGNITO_AUTH=true

# For development, you can keep mock auth enabled
# ENABLE_COGNITO_AUTH=false
```

### 3.2 Developer Portal (.env.local)

Add these variables to your developer portal `.env.local` file:

```bash
# AWS Cognito Configuration
COGNITO_CLIENT_ID=your_client_id_here
COGNITO_CLIENT_SECRET=your_client_secret_here
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX
COGNITO_DOMAIN=https://mindshop-auth.auth.us-east-1.amazoncognito.com

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-here-change-in-production

# Disable dev mode to use real Cognito
NEXT_PUBLIC_DEV_MODE=false
```

---

## Step 4: Test the Setup

### 4.1 Test User Pool

1. In AWS Console, go to your User Pool
2. Click on **Users** tab
3. Click **Create user**
4. Create a test user:
   - Username: Your email
   - Email: Your email
   - Temporary password: Create a strong password
   - ✅ Mark email as verified (for testing)
5. Click **Create user**

### 4.2 Test Hosted UI

1. Go to **App integration** tab
2. Scroll to **App clients**
3. Click **View Hosted UI**
4. Try logging in with your test user
5. You should see the Cognito login page

### 4.3 Test Custom Attributes

1. Go to **Users** tab
2. Click on your test user
3. Scroll to **User attributes**
4. Click **Edit**
5. Add custom attributes:
   - `custom:merchant_id`: `test_merchant_123`
   - `custom:roles`: `merchant_user,merchant_admin`
6. Click **Save changes**

---

## Step 5: Verify Configuration

### 5.1 Check User Pool Settings

Go through each tab and verify:

- ✅ **Sign-in experience**: Email is enabled
- ✅ **Security requirements**: Password policy is set
- ✅ **Sign-up experience**: Custom attributes are created
- ✅ **Message delivery**: Email is configured
- ✅ **App integration**: App client is configured with correct URLs

### 5.2 Test Token Generation

You can test token generation using AWS CLI:

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=your-email@example.com,PASSWORD=your-password \
  --region us-east-1
```

This should return access, ID, and refresh tokens.

---

## Common Issues and Solutions

### Issue 1: "Invalid callback URL"

**Solution**: Make sure the callback URL in your app exactly matches what's configured in Cognito (including http/https and trailing slashes).

### Issue 2: "Custom attribute not found"

**Solution**: Custom attributes must be prefixed with `custom:` when setting them programmatically, but not when defining them in the console.

### Issue 3: "Email not verified"

**Solution**: For testing, you can manually mark emails as verified in the user details page. For production, users must verify via email code.

### Issue 4: "Client secret required"

**Solution**: Make sure you selected "Generate a client secret" when creating the app client. Public clients don't have secrets.

### Issue 5: "Domain already in use"

**Solution**: Cognito domains must be globally unique. Try a different prefix or use a custom domain.

---

## Next Steps

After completing Phase 1 manually:

1. ✅ You have a working Cognito User Pool
2. ✅ You have all configuration values
3. ✅ You can test authentication via Hosted UI
4. ➡️ **Next**: Proceed to Phase 2 (Lambda Triggers) or Phase 3 (Backend Integration)

You can skip the infrastructure-as-code scripts in Phase 1 since you've done it manually. Just make sure to document your configuration for future reference or disaster recovery.

---

## Backup Your Configuration

Create a document with all your settings:

```
User Pool Name: mindshop-users-production
User Pool ID: us-east-1_XXXXXXXXX
Region: us-east-1
App Client Name: mindshop-developer-portal
Client ID: xxxxxxxxxxxxxxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Domain: https://mindshop-auth.auth.us-east-1.amazoncognito.com
Issuer: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX

Custom Attributes:
- custom:merchant_id (String, mutable)
- custom:roles (String, mutable)
- custom:company_name (String, mutable)

Callback URLs:
- http://localhost:3001/api/auth/callback/cognito
- https://portal.mindshop.com/api/auth/callback/cognito

Sign-out URLs:
- http://localhost:3001
- https://portal.mindshop.com
```

Keep this document secure as it contains sensitive information!
