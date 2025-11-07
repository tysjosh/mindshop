# Authentication Guide

## Overview

The RAG Assistant platform uses two authentication methods:

1. **JWT Tokens** - For merchant portal access (dashboard, settings)
2. **API Keys** - For programmatic API access (chat, documents)

## JWT Authentication (Merchant Portal)

### Registration Flow

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant API
    participant Cognito
    participant Email

    User->>Portal: Fill registration form
    Portal->>API: POST /api/merchants/register
    API->>Cognito: SignUp
    Cognito->>Email: Send verification code
    Email->>User: Verification email
    User->>Portal: Enter verification code
    Portal->>API: POST /api/merchants/verify-email
    API->>Cognito: ConfirmSignUp
    Cognito->>API: Success
    API->>Portal: Account verified
```

### Login Flow

```mermaid
sequenceDiagram
    participant User
    participant Portal
    participant API
    participant Cognito

    User->>Portal: Enter credentials
    Portal->>API: POST /api/merchants/login
    API->>Cognito: InitiateAuth
    Cognito->>API: JWT tokens
    API->>Portal: Return tokens
    Portal->>Portal: Store tokens
    Portal->>User: Redirect to dashboard
```

### Token Types

#### Access Token
- **Purpose**: API authentication
- **Lifetime**: 1 hour
- **Usage**: Include in Authorization header
- **Format**: `Bearer eyJhbGciOiJIUzI1NiIs...`

#### ID Token
- **Purpose**: User identity information
- **Lifetime**: 1 hour
- **Contains**: User attributes (email, merchantId, roles)

#### Refresh Token
- **Purpose**: Obtain new access tokens
- **Lifetime**: 30 days
- **Usage**: Refresh expired access tokens

### Implementation

#### Register

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@acme.com',
    password: 'SecurePass123!',
    companyName: 'ACME Electronics',
    website: 'https://acme.com',
    industry: 'Electronics'
  })
});

const data = await response.json();
// { merchantId: 'acme_electronics_2024', email: 'john@acme.com' }
```

#### Verify Email

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/verify-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@acme.com',
    code: '123456' // From email
  })
});
```

#### Login

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@acme.com',
    password: 'SecurePass123!'
  })
});

const data = await response.json();
/*
{
  accessToken: 'eyJhbGciOiJIUzI1NiIs...',
  idToken: 'eyJhbGciOiJIUzI1NiIs...',
  refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
  expiresIn: 3600,
  merchantId: 'acme_electronics_2024'
}
*/

// Store tokens securely
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

#### Refresh Token

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/refresh-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const data = await response.json();
// Update stored tokens
localStorage.setItem('accessToken', data.accessToken);
```

#### Make Authenticated Request

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

const profile = await response.json();
```

### Token Refresh Strategy

Implement automatic token refresh:

```javascript
class AuthClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  async request(url, options = {}) {
    // Add access token to request
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`
    };

    let response = await fetch(url, options);

    // If token expired, refresh and retry
    if (response.status === 401) {
      await this.refreshAccessToken();
      
      // Retry with new token
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      response = await fetch(url, options);
    }

    return response;
  }

  async refreshAccessToken() {
    const response = await fetch('https://api.rag-assistant.com/api/merchants/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: this.refreshToken
      })
    });

    if (!response.ok) {
      // Refresh token expired, redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    localStorage.setItem('accessToken', data.accessToken);
  }
}

// Usage
const client = new AuthClient();
const response = await client.request('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/profile');
```

---

## API Key Authentication

### Key Types

#### Test Keys
- **Prefix**: `pk_test_`
- **Environment**: Development
- **Purpose**: Testing and development
- **Rate Limits**: Lower limits

#### Live Keys
- **Prefix**: `pk_live_`
- **Environment**: Production
- **Purpose**: Production traffic
- **Rate Limits**: Full plan limits

### Generate API Key

```javascript
const response = await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Production Key',
    environment: 'production',
    permissions: ['chat:read', 'documents:write'],
    expiresInDays: 365
  })
});

const data = await response.json();
/*
{
  keyId: 'key_abc123',
  key: 'pk_live_def456ghi789jkl012mno345pqr678',
  prefix: 'pk_live_',
  environment: 'production',
  expiresAt: '2026-11-01T10:00:00Z'
}
*/

// ⚠️ IMPORTANT: Store this key securely - it won't be shown again!
```

### Use API Key

```javascript
const response = await fetch('https://api.rag-assistant.com/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pk_live_def456ghi789jkl012mno345pqr678',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'wireless headphones',
    sessionId: 'session_abc123',
    merchantId: 'acme_electronics_2024'
  })
});
```

### Permissions

API keys can have granular permissions:

| Permission | Description |
|------------|-------------|
| `chat:read` | Send chat queries |
| `chat:write` | Manage chat sessions |
| `documents:read` | Search documents |
| `documents:write` | Create/update documents |
| `analytics:read` | View analytics |
| `webhooks:write` | Manage webhooks |
| `*` | All permissions |

### Key Rotation

Rotate keys regularly for security:

```javascript
// 1. Create new key
const newKey = await createApiKey({
  name: 'Production Key (Rotated)',
  environment: 'production',
  permissions: ['*']
});

// 2. Update your application to use new key
// (Deploy with grace period)

// 3. After grace period, revoke old key
await revokeApiKey('key_old123');
```

### Best Practices

1. **Never Commit Keys**: Don't commit API keys to version control
2. **Use Environment Variables**: Store keys in environment variables
3. **Rotate Regularly**: Rotate keys every 90 days
4. **Limit Permissions**: Grant minimum required permissions
5. **Monitor Usage**: Track API key usage for anomalies
6. **Revoke Compromised Keys**: Immediately revoke if compromised

---

## Security Best Practices

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Multi-Factor Authentication (MFA)

Enable MFA for additional security:

```javascript
// Enable MFA
const response = await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/mfa/enable', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
// { qrCode: 'data:image/png;base64,...', secret: 'JBSWY3DPEHPK3PXP' }

// Scan QR code with authenticator app
// Verify with code
await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/mfa/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: '123456'
  })
});
```

### IP Whitelisting

Restrict API access to specific IP addresses:

```javascript
await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    security: {
      ipWhitelist: [
        '203.0.113.0/24',
        '198.51.100.42'
      ]
    }
  })
});
```

### Domain Whitelisting

Restrict widget usage to specific domains:

```javascript
await fetch('https://api.rag-assistant.com/api/merchants/acme_electronics_2024/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    security: {
      allowedDomains: [
        'https://acme.com',
        'https://www.acme.com',
        'https://shop.acme.com'
      ]
    }
  })
});
```

### Rate Limiting

Implement client-side rate limiting:

```javascript
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requests = this.requests.filter(time => 
      now - time < this.windowMs
    );

    // Check if limit exceeded
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.throttle();
    }

    this.requests.push(now);
  }
}

// Usage
const limiter = new RateLimiter(100, 60000); // 100 requests per minute

async function makeRequest() {
  await limiter.throttle();
  return fetch('https://api.rag-assistant.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer pk_live_...'
    },
    body: JSON.stringify({...})
  });
}
```

### Secure Token Storage

#### Browser (Frontend)

```javascript
// ❌ DON'T: Store in localStorage (vulnerable to XSS)
localStorage.setItem('apiKey', 'pk_live_...');

// ✅ DO: Use httpOnly cookies (set by backend)
// Backend sets cookie:
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000
});

// Frontend automatically sends cookie with requests
```

#### Node.js (Backend)

```javascript
// ✅ DO: Use environment variables
const apiKey = process.env.RAG_ASSISTANT_API_KEY;

// ✅ DO: Use secrets manager (AWS Secrets Manager, etc.)
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getApiKey() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'rag-assistant-api-key'
  }).promise();
  
  return JSON.parse(secret.SecretString).apiKey;
}
```

---

## Error Handling

### Authentication Errors

```javascript
async function handleAuthError(response) {
  if (response.status === 401) {
    // Token expired or invalid
    const data = await response.json();
    
    if (data.code === 'TOKEN_EXPIRED') {
      // Try to refresh token
      await refreshAccessToken();
      // Retry request
    } else if (data.code === 'INVALID_API_KEY') {
      // API key is invalid
      console.error('Invalid API key');
      // Notify user to check API key
    }
  } else if (response.status === 403) {
    // Insufficient permissions
    console.error('Insufficient permissions');
    // Request additional permissions
  } else if (response.status === 429) {
    // Rate limit exceeded
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter}s`);
    // Wait and retry
  }
}
```

---

## Testing Authentication

### Test API Keys

Use test keys for development:

```bash
# Test key (safe to use in development)
pk_test_abc123def456ghi789jkl012mno345pqr678

# Live key (use only in production)
pk_live_xyz789uvw456rst123opq890lmn567ijk234
```

### Postman Collection

Import our [Postman collection](https://www.postman.com/rag-assistant/workspace) for testing:

1. Download collection
2. Import into Postman
3. Set environment variables:
   - `baseUrl`: `https://api.rag-assistant.com`
   - `apiKey`: Your test API key
   - `merchantId`: Your merchant ID
4. Run requests

---

## Migration Guide

### From Basic Auth to API Keys

If you're currently using basic authentication:

```javascript
// Old (deprecated)
fetch('https://api.rag-assistant.com/api/chat', {
  headers: {
    'Authorization': 'Basic ' + btoa('username:password')
  }
});

// New (recommended)
fetch('https://api.rag-assistant.com/api/chat', {
  headers: {
    'Authorization': 'Bearer pk_live_...'
  }
});
```

---

## Support

- 📚 [Security Best Practices](./security.md)
- 💬 [Community Forum](https://community.rag-assistant.com)
- 📧 [Security Issues](mailto:security@rag-assistant.com)
- 🔒 [Bug Bounty Program](https://rag-assistant.com/security/bounty)
