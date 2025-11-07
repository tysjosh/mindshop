# Documentation Components

This directory contains components for the documentation page in the developer portal.

## ApiPlayground

An interactive API playground that allows merchants to test API endpoints directly from the browser.

### Features

- **Endpoint Selection**: Choose from pre-configured API endpoints
- **Environment Selection**: Switch between Production, Development, and Local environments
- **Authentication**: Support for both API Key and JWT token authentication
- **Request Configuration**: 
  - Path parameters (e.g., `:merchantId`)
  - Query parameters for GET requests
  - JSON request body for POST/PUT requests
- **Response Display**: View response status, headers, and body
- **cURL Generation**: Automatically generate cURL commands for testing
- **Copy to Clipboard**: Easy copying of responses and cURL commands

### Supported Endpoints

1. **POST /api/chat** - Send chat queries
2. **POST /api/documents** - Create documents
3. **GET /api/documents/search** - Search documents
4. **GET /api/merchants/:merchantId/usage/current** - Get usage stats
5. **GET /api/merchants/:merchantId/analytics/overview** - Get analytics

### Usage

The component is integrated into the Documentation page:

```tsx
import { ApiPlayground } from '@/components/documentation';

export default function DocumentationPage() {
  return (
    <div>
      <ApiPlayground />
    </div>
  );
}
```

### Adding New Endpoints

To add a new endpoint to the playground, update the `API_ENDPOINTS` array in `ApiPlayground.tsx`:

```typescript
const API_ENDPOINTS: ApiEndpoint[] = [
  // ... existing endpoints
  {
    id: 'new-endpoint',
    method: 'POST',
    path: '/api/new-endpoint',
    description: 'Description of the endpoint',
    requiresAuth: true,
    authType: 'apiKey',
    requestBody: JSON.stringify({
      // Default request body
    }, null, 2),
    parameters: [
      { name: 'param1', type: 'string', required: true, description: 'Parameter description' }
    ]
  }
];
```

### Security Considerations

- API keys and JWT tokens are stored in component state only (not persisted)
- Requests are made directly from the browser to the API
- CORS must be properly configured on the API server
- Users should use test/development keys in the playground

### Future Enhancements

- [ ] Save request history to localStorage
- [ ] Import/export request collections
- [ ] WebSocket support for real-time endpoints
- [ ] Request/response validation against OpenAPI spec
- [ ] Code generation for multiple languages (JavaScript, Python, PHP, etc.)
- [ ] Authentication token management (auto-refresh)
