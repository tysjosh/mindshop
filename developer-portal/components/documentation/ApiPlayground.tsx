'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy, Play, Loader2 } from 'lucide-react';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
  authType?: 'jwt' | 'apiKey';
  requestBody?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'chat',
    method: 'POST',
    path: '/api/chat',
    description: 'Send a chat query and get AI-powered recommendations',
    requiresAuth: true,
    authType: 'apiKey',
    requestBody: JSON.stringify({
      query: 'Show me wireless headphones under $200',
      sessionId: 'session_abc123',
      merchantId: 'your_merchant_id',
      userId: 'user_xyz789'
    }, null, 2),
    parameters: []
  },
  {
    id: 'create-document',
    method: 'POST',
    path: '/api/documents',
    description: 'Create a new document (product, FAQ, policy, etc.)',
    requiresAuth: true,
    authType: 'apiKey',
    requestBody: JSON.stringify({
      type: 'product',
      title: 'Wireless Bluetooth Headphones',
      content: 'Premium noise-cancelling headphones with 30-hour battery life',
      metadata: {
        sku: 'WBH-001',
        price: 199.99,
        category: 'Electronics',
        inStock: true
      }
    }, null, 2),
    parameters: []
  },
  {
    id: 'search-documents',
    method: 'GET',
    path: '/api/documents/search',
    description: 'Search your document collection',
    requiresAuth: true,
    authType: 'apiKey',
    parameters: [
      { name: 'q', type: 'string', required: true, description: 'Search query' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 10)' }
    ]
  },
  {
    id: 'get-usage',
    method: 'GET',
    path: '/api/merchants/:merchantId/usage/current',
    description: 'Get current billing period usage',
    requiresAuth: true,
    authType: 'jwt',
    parameters: [
      { name: 'merchantId', type: 'string', required: true, description: 'Your merchant ID' }
    ]
  },
  {
    id: 'get-analytics',
    method: 'GET',
    path: '/api/merchants/:merchantId/analytics/overview',
    description: 'Get analytics overview for a date range',
    requiresAuth: true,
    authType: 'jwt',
    parameters: [
      { name: 'merchantId', type: 'string', required: true, description: 'Your merchant ID' },
      { name: 'startDate', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
      { name: 'endDate', type: 'string', required: false, description: 'End date (YYYY-MM-DD)' }
    ]
  }
];

export function ApiPlayground() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(API_ENDPOINTS[0]);
  const [baseUrl, setBaseUrl] = useState('https://api.rag-assistant.com');
  const [apiKey, setApiKey] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [requestBody, setRequestBody] = useState(API_ENDPOINTS[0].requestBody || '');
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEndpointChange = (endpointId: string) => {
    const endpoint = API_ENDPOINTS.find(e => e.id === endpointId);
    if (endpoint) {
      setSelectedEndpoint(endpoint);
      setRequestBody(endpoint.requestBody || '');
      setQueryParams({});
      setResponse(null);
      setError(null);
    }
  };

  const handleSendRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Build URL with path parameters and query params
      let url = baseUrl + selectedEndpoint.path;
      
      // Replace path parameters
      if (queryParams.merchantId) {
        url = url.replace(':merchantId', queryParams.merchantId);
      }

      // Add query parameters for GET requests
      if (selectedEndpoint.method === 'GET' && selectedEndpoint.parameters) {
        const params = new URLSearchParams();
        selectedEndpoint.parameters.forEach(param => {
          if (queryParams[param.name] && param.name !== 'merchantId') {
            params.append(param.name, queryParams[param.name]);
          }
        });
        if (params.toString()) {
          url += '?' + params.toString();
        }
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (selectedEndpoint.requiresAuth) {
        if (selectedEndpoint.authType === 'apiKey' && apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (selectedEndpoint.authType === 'jwt' && jwtToken) {
          headers['Authorization'] = `Bearer ${jwtToken}`;
        }
      }

      // Build request options
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers
      };

      // Add body for POST/PUT requests
      if ((selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && requestBody) {
        try {
          JSON.parse(requestBody); // Validate JSON
          options.body = requestBody;
        } catch {
          throw new Error('Invalid JSON in request body');
        }
      }

      // Send request
      const res = await fetch(url, options);
      const data = await res.json();

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: data
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateCurlCommand = () => {
    let url = baseUrl + selectedEndpoint.path;
    
    if (queryParams.merchantId) {
      url = url.replace(':merchantId', queryParams.merchantId);
    }

    if (selectedEndpoint.method === 'GET' && selectedEndpoint.parameters) {
      const params = new URLSearchParams();
      selectedEndpoint.parameters.forEach(param => {
        if (queryParams[param.name] && param.name !== 'merchantId') {
          params.append(param.name, queryParams[param.name]);
        }
      });
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }

    let curl = `curl -X ${selectedEndpoint.method} ${url}`;
    
    if (selectedEndpoint.requiresAuth) {
      const token = selectedEndpoint.authType === 'apiKey' ? apiKey : jwtToken;
      if (token) {
        curl += ` \\\n  -H "Authorization: Bearer ${token}"`;
      }
    }

    curl += ` \\\n  -H "Content-Type: application/json"`;

    if ((selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && requestBody) {
      curl += ` \\\n  -d '${requestBody.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;
    }

    return curl;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">API Playground</h3>
        <p className="text-sm text-muted-foreground">
          Test API endpoints directly from your browser. Select an endpoint, configure parameters, and send requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Configuration */}
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="endpoint">Endpoint</Label>
            <Select value={selectedEndpoint.id} onValueChange={handleEndpointChange}>
              <SelectTrigger id="endpoint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {API_ENDPOINTS.map(endpoint => (
                  <SelectItem key={endpoint.id} value={endpoint.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                        {endpoint.method}
                      </Badge>
                      <span className="text-sm">{endpoint.path}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedEndpoint.description}
            </p>
          </div>

          <div>
            <Label htmlFor="baseUrl">Base URL</Label>
            <Select value={baseUrl} onValueChange={setBaseUrl}>
              <SelectTrigger id="baseUrl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="https://api.rag-assistant.com">Production</SelectItem>
                <SelectItem value="https://api-dev.rag-assistant.com">Development</SelectItem>
                <SelectItem value="http://localhost:3000">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedEndpoint.requiresAuth && (
            <div>
              <Label htmlFor="auth">
                {selectedEndpoint.authType === 'apiKey' ? 'API Key' : 'JWT Token'}
              </Label>
              <Input
                id="auth"
                type="password"
                placeholder={selectedEndpoint.authType === 'apiKey' ? 'pk_live_...' : 'eyJhbGciOiJIUzI1NiIs...'}
                value={selectedEndpoint.authType === 'apiKey' ? apiKey : jwtToken}
                onChange={(e) => selectedEndpoint.authType === 'apiKey' ? setApiKey(e.target.value) : setJwtToken(e.target.value)}
              />
            </div>
          )}

          {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
            <div className="space-y-3">
              <Label>Parameters</Label>
              {selectedEndpoint.parameters.map(param => (
                <div key={param.name}>
                  <Label htmlFor={param.name} className="text-sm">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={param.name}
                    placeholder={param.description}
                    value={queryParams[param.name] || ''}
                    onChange={(e) => setQueryParams({ ...queryParams, [param.name]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {(selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && (
            <div>
              <Label htmlFor="requestBody">Request Body (JSON)</Label>
              <Textarea
                id="requestBody"
                className="font-mono text-sm min-h-[200px]"
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
              />
            </div>
          )}

          <Button 
            onClick={handleSendRequest} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Send Request
              </>
            )}
          </Button>
        </Card>

        {/* Response */}
        <Card className="p-6 space-y-4">
          <Tabs defaultValue="response">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>

            <TabsContent value="response" className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800 font-medium">Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              )}

              {response && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={response.status < 300 ? 'default' : 'destructive'}>
                        {response.status} {response.statusText}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(response.body, null, 2))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Response Body</Label>
                    <pre className="mt-2 bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto max-h-[400px] text-xs">
                      {JSON.stringify(response.body, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Response Headers</Label>
                    <pre className="mt-2 bg-slate-100 rounded-md p-4 overflow-auto max-h-[200px] text-xs">
                      {JSON.stringify(response.headers, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {!response && !error && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Configure your request and click &quot;Send Request&quot; to see the response</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="curl">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">cURL Command</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generateCurlCommand())}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
                  {generateCurlCommand()}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
