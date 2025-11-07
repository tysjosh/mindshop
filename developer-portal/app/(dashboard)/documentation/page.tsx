import { ApiPlayground } from '@/components/documentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DocumentationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Documentation</h2>
        <p className="text-muted-foreground">
          Learn how to integrate MindShop into your e-commerce platform
        </p>
      </div>

      <Tabs defaultValue="playground" className="space-y-6">
        <TabsList>
          <TabsTrigger value="playground">API Playground</TabsTrigger>
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="endpoints">API Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="playground">
          <ApiPlayground />
        </TabsContent>

        <TabsContent value="quickstart">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Quick Start Guide</h3>
              <p className="text-sm text-muted-foreground">
                Get started with the MindShop API in minutes
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">1. Get Your API Key</h4>
                <p className="text-sm text-muted-foreground">
                  Navigate to the <a href="/api-keys" className="text-blue-600 hover:underline">API Keys</a> page and create a new API key.
                  Store it securely - you&apos;ll only see it once!
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">2. Make Your First Request</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Use the API Playground above or send a request using cURL:
                </p>
                <pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
{`curl -X POST https://api.rag-assistant.com/api/chat \\
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Show me wireless headphones under $200",
    "sessionId": "session_abc123",
    "merchantId": "your_merchant_id"
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">3. Upload Your Products</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Add your product catalog to enable AI-powered recommendations:
                </p>
                <pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
{`curl -X POST https://api.rag-assistant.com/api/documents \\
  -H "Authorization: Bearer pk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "product",
    "title": "Wireless Headphones",
    "content": "Premium noise-cancelling headphones",
    "metadata": {
      "sku": "WBH-001",
      "price": 199.99,
      "inStock": true
    }
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">4. Integrate the Widget</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Add the chat widget to your website:
                </p>
                <pre className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-auto text-xs">
{`<!-- Load the RAG Assistant Widget -->
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>

<!-- Initialize the widget -->
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_YOUR_API_KEY',
    apiBaseUrl: 'https://api.rag-assistant.com',
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    },
    behavior: {
      autoOpen: false,
      greeting: 'Hi! How can I help you today?'
    },
    integration: {
      addToCartCallback: (product) => {
        // Your add to cart logic
        console.log('Add to cart:', product);
      }
    }
  });
</script>`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Configuration Options</h4>
                <div className="space-y-2 text-sm">
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium mb-1">Required Options:</p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-slate-200 px-1 rounded">merchantId</code> - Your merchant ID from the dashboard</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">apiKey</code> - Your public API key (pk_live_ or pk_test_)</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium mb-1">Optional Options:</p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground space-y-1">
                      <li><code className="text-xs bg-slate-200 px-1 rounded">apiBaseUrl</code> - API endpoint (default: https://api.rag-assistant.com)</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">theme.primaryColor</code> - Widget color theme</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">theme.position</code> - Widget position (bottom-right, bottom-left, etc.)</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">behavior.autoOpen</code> - Auto-open widget on page load</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">behavior.greeting</code> - Initial greeting message</li>
                      <li><code className="text-xs bg-slate-200 px-1 rounded">integration.addToCartCallback</code> - Function called when user adds product to cart</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Troubleshooting</h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium text-foreground mb-1">Widget not loading?</p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground space-y-1">
                      <li>Check browser console for errors</li>
                      <li>Verify API key is correct and active</li>
                      <li>Ensure merchant ID matches your account</li>
                      <li>Check that CDN URL is accessible</li>
                      <li>Verify the script tag is placed before the closing &lt;/body&gt; tag</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium text-foreground mb-1">CORS errors?</p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground space-y-1">
                      <li>Add your domain to allowed domains in settings</li>
                      <li>Ensure you&apos;re using the correct API base URL</li>
                      <li>Check that API key has proper permissions</li>
                      <li>Verify your domain is registered in the developer portal</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium text-foreground mb-1">Messages not sending?</p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground space-y-1">
                      <li>Verify API key is valid and not expired</li>
                      <li>Check rate limits in usage dashboard</li>
                      <li>Ensure session was created successfully</li>
                      <li>Check network tab for failed requests</li>
                      <li>Verify you have uploaded product documents</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="font-medium text-foreground mb-1">Need help?</p>
                    <p className="text-muted-foreground">
                      Contact support at{' '}
                      <a href="mailto:support@rag-assistant.com" className="text-blue-600 hover:underline">
                        support@rag-assistant.com
                      </a>
                      {' '}or check our{' '}
                      <a 
                        href="https://github.com/your-org/rag-assistant/blob/main/docs/merchant-platform/widget-integration.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        detailed widget integration guide
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="authentication">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Authentication</h3>
              <p className="text-sm text-muted-foreground">
                The MindShop API uses API keys for authentication
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">API Keys</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  All API requests require an API key in the Authorization header:
                </p>
                <pre className="bg-slate-100 rounded-md p-4 text-xs">
                  Authorization: Bearer pk_live_YOUR_API_KEY
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Key Types</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge>pk_live_</Badge>
                    <div>
                      <p className="text-sm font-medium">Production Keys</p>
                      <p className="text-sm text-muted-foreground">
                        Use these keys in your production environment
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary">pk_test_</Badge>
                    <div>
                      <p className="text-sm font-medium">Development Keys</p>
                      <p className="text-sm text-muted-foreground">
                        Use these keys for testing and development
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Security Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Never expose API keys in client-side code</li>
                  <li>Store keys securely using environment variables</li>
                  <li>Rotate keys regularly</li>
                  <li>Use different keys for different environments</li>
                  <li>Revoke compromised keys immediately</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">API Reference</h3>
              <p className="text-sm text-muted-foreground">
                Complete reference for all available endpoints
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>POST</Badge>
                  <code className="text-sm">/api/chat</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Send a chat query and get AI-powered product recommendations
                </p>
                <div className="bg-slate-50 rounded-md p-3 text-xs">
                  <p className="font-medium mb-1">Request Body:</p>
                  <pre>{`{
  "query": "string",
  "sessionId": "string",
  "merchantId": "string",
  "userId": "string" (optional)
}`}</pre>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>POST</Badge>
                  <code className="text-sm">/api/documents</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Create a new document (product, FAQ, policy, etc.)
                </p>
                <div className="bg-slate-50 rounded-md p-3 text-xs">
                  <p className="font-medium mb-1">Request Body:</p>
                  <pre>{`{
  "type": "product" | "faq" | "policy" | "review",
  "title": "string",
  "content": "string",
  "metadata": {
    "sku": "string",
    "price": number,
    "inStock": boolean
  }
}`}</pre>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-sm">/api/documents/search</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Search your document collection
                </p>
                <div className="bg-slate-50 rounded-md p-3 text-xs">
                  <p className="font-medium mb-1">Query Parameters:</p>
                  <pre>{`q: string (required) - Search query
limit: number (optional) - Max results (default: 10)`}</pre>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-sm">/api/merchants/:merchantId/usage/current</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Get current billing period usage statistics
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-sm">/api/merchants/:merchantId/analytics/overview</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Get analytics overview for a date range
                </p>
                <div className="bg-slate-50 rounded-md p-3 text-xs">
                  <p className="font-medium mb-1">Query Parameters:</p>
                  <pre>{`startDate: string (optional) - Start date (YYYY-MM-DD)
endDate: string (optional) - End date (YYYY-MM-DD)`}</pre>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                For complete API documentation, see the{' '}
                <a 
                  href="https://github.com/your-org/rag-assistant/blob/main/docs/merchant-platform/api-reference.md" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  full API reference
                </a>
                {' '}or download the{' '}
                <a 
                  href="/api/openapi.yaml" 
                  download
                  className="text-blue-600 hover:underline"
                >
                  OpenAPI specification
                </a>
                .
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
