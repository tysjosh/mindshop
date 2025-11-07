/**
 * Widget CORS Integration Test
 * 
 * Tests that the widget works correctly when loaded from an external domain,
 * verifying CORS configuration allows cross-origin requests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Application } from 'express';
import { Server } from 'http';
import axios from 'axios';
import path from 'path';
import { createAPIGatewayApp } from '../api/app';

describe('Widget CORS Integration', () => {
  let apiServer: Server;
  let externalServer: Server;
  let apiApp: any;
  let externalApp: Application;
  const API_PORT = 3099;
  const EXTERNAL_PORT = 3098;
  const API_BASE_URL = `http://localhost:${API_PORT}`;
  const EXTERNAL_ORIGIN = `http://localhost:${EXTERNAL_PORT}`;

  beforeAll(async () => {
    // Start API server with CORS enabled
    apiApp = createAPIGatewayApp({
      port: API_PORT,
      environment: 'test',
      corsOrigins: ['*'], // Allow all origins for testing
      enableMetrics: false,
      enableCognito: false,
      enableMockAuth: true,
      awsRegion: 'us-east-1',
    });

    apiServer = apiApp.getApp().listen(API_PORT);

    // Wait for API server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create external server to simulate merchant website
    externalApp = express();
    externalApp.use(express.static(path.join(__dirname, '../../widget/dist')));
    
    // Serve test HTML page
    externalApp.get('/test-widget.html', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget CORS Test</title>
</head>
<body>
  <h1>Widget CORS Test</h1>
  <div id="test-status">Testing...</div>
  <div id="test-results"></div>

  <script>
    // Test results
    const results = {
      sessionCreated: false,
      chatSent: false,
      historyFetched: false,
      corsHeaders: false,
      errors: []
    };

    // Helper to log results
    function logResult(test, success, message) {
      results[test] = success;
      if (!success) {
        results.errors.push(message);
      }
      updateDisplay();
    }

    function updateDisplay() {
      const statusEl = document.getElementById('test-status');
      const resultsEl = document.getElementById('test-results');
      
      const allPassed = results.sessionCreated && results.chatSent && 
                        results.historyFetched && results.corsHeaders;
      
      statusEl.textContent = allPassed ? '✓ All tests passed!' : '✗ Some tests failed';
      statusEl.style.color = allPassed ? 'green' : 'red';
      
      resultsEl.innerHTML = '<pre>' + JSON.stringify(results, null, 2) + '</pre>';
      
      // Make results available globally for test assertions
      window.testResults = results;
    }

    // Test CORS by making direct fetch requests
    async function testCORS() {
      try {
        // Test 1: Create session with CORS
        const sessionResponse = await fetch('${API_BASE_URL}/api/chat/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_key',
            'X-Merchant-ID': 'test_merchant'
          },
          body: JSON.stringify({
            merchantId: 'test_merchant',
            userId: 'test_user_' + Date.now()
          })
        });

        // Check CORS headers
        const corsHeader = sessionResponse.headers.get('Access-Control-Allow-Origin');
        logResult('corsHeaders', !!corsHeader, 'CORS headers present: ' + corsHeader);

        if (!sessionResponse.ok) {
          throw new Error('Session creation failed: ' + sessionResponse.status);
        }

        const sessionData = await sessionResponse.json();
        const sessionId = sessionData.data?.sessionId || sessionData.sessionId;
        
        if (!sessionId) {
          throw new Error('No session ID returned');
        }

        logResult('sessionCreated', true, 'Session created: ' + sessionId);

        // Test 2: Send chat message
        const chatResponse = await fetch('${API_BASE_URL}/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_key',
            'X-Merchant-ID': 'test_merchant'
          },
          body: JSON.stringify({
            query: 'Test message from external domain',
            sessionId: sessionId,
            merchantId: 'test_merchant',
            userId: 'test_user'
          })
        });

        if (!chatResponse.ok) {
          throw new Error('Chat request failed: ' + chatResponse.status);
        }

        const chatData = await chatResponse.json();
        logResult('chatSent', true, 'Chat message sent successfully');

        // Test 3: Fetch history
        const historyResponse = await fetch(
          '${API_BASE_URL}/api/chat/sessions/' + sessionId + '/history?merchantId=test_merchant',
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test_key',
              'X-Merchant-ID': 'test_merchant'
            }
          }
        );

        if (!historyResponse.ok) {
          throw new Error('History fetch failed: ' + historyResponse.status);
        }

        const historyData = await historyResponse.json();
        logResult('historyFetched', true, 'History fetched successfully');

      } catch (error) {
        console.error('CORS test error:', error);
        results.errors.push(error.message);
        updateDisplay();
      }
    }

    // Run tests when page loads
    window.addEventListener('load', () => {
      testCORS();
    });
  </script>
</body>
</html>
      `);
    });

    externalServer = externalApp.listen(EXTERNAL_PORT);

    // Wait for external server to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Close servers
    if (apiServer) {
      await new Promise((resolve) => apiServer.close(resolve));
    }
    if (externalServer) {
      await new Promise((resolve) => externalServer.close(resolve));
    }
  });

  it('should allow CORS requests from external domain', async () => {
    // Make a preflight OPTIONS request
    const response = await axios.options(`${API_BASE_URL}/api/chat/sessions`, {
      headers: {
        'Origin': EXTERNAL_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization,X-Merchant-ID'
      },
      validateStatus: () => true // Don't throw on any status
    });

    // Should return 204 or 200 for OPTIONS
    expect([200, 204]).toContain(response.status);
    
    // Should have CORS headers
    expect(response.headers['access-control-allow-origin']).toBeTruthy();
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('should allow session creation from external domain', async () => {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/sessions`,
      {
        merchantId: 'test_merchant',
        userId: 'test_user_' + Date.now()
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        },
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(201);
    expect(response.headers['access-control-allow-origin']).toBeTruthy();
    expect(response.data.success).toBe(true);
    expect(response.data.data?.sessionId || response.data.sessionId).toBeTruthy();
  });

  it('should allow chat requests from external domain', async () => {
    // First create a session
    const sessionResponse = await axios.post(
      `${API_BASE_URL}/api/chat/sessions`,
      {
        merchantId: 'test_merchant',
        userId: 'test_user_cors'
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        }
      }
    );

    const sessionId = sessionResponse.data.data?.sessionId || sessionResponse.data.sessionId;

    // Send chat message
    const chatResponse = await axios.post(
      `${API_BASE_URL}/api/chat`,
      {
        query: 'Test message from external domain',
        sessionId: sessionId,
        merchantId: 'test_merchant',
        userId: 'test_user_cors'
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        },
        validateStatus: () => true
      }
    );

    expect(chatResponse.status).toBe(200);
    expect(chatResponse.headers['access-control-allow-origin']).toBeTruthy();
    expect(chatResponse.data.success).toBe(true);
  });

  it('should expose required headers via CORS', async () => {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/sessions`,
      {
        merchantId: 'test_merchant',
        userId: 'test_user_headers'
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        }
      }
    );

    // Check that required headers are exposed
    const exposedHeaders = response.headers['access-control-expose-headers'];
    expect(exposedHeaders).toBeTruthy();
    
    // Should expose rate limit and request ID headers
    const exposedHeadersList = exposedHeaders?.toLowerCase() || '';
    expect(
      exposedHeadersList.includes('x-request-id') ||
      exposedHeadersList.includes('*')
    ).toBe(true);
  });

  it('should handle preflight requests correctly', async () => {
    const response = await axios.options(
      `${API_BASE_URL}/api/chat`,
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization,X-Merchant-ID'
        },
        validateStatus: () => true
      }
    );

    expect([200, 204]).toContain(response.status);
    expect(response.headers['access-control-allow-origin']).toBeTruthy();
    expect(response.headers['access-control-allow-methods']).toBeTruthy();
    expect(response.headers['access-control-allow-headers']).toBeTruthy();
  });

  it('should allow document endpoints from external domain', async () => {
    const response = await axios.get(
      `${API_BASE_URL}/api/documents/search?merchantId=test_merchant&limit=10`,
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        },
        validateStatus: () => true
      }
    );

    expect(response.headers['access-control-allow-origin']).toBeTruthy();
    // Status might be 200 or 404 depending on data, but CORS should work
    expect([200, 404]).toContain(response.status);
  });

  it('should allow session history from external domain', async () => {
    // Create a session first
    const sessionResponse = await axios.post(
      `${API_BASE_URL}/api/chat/sessions`,
      {
        merchantId: 'test_merchant',
        userId: 'test_user_history'
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        }
      }
    );

    const sessionId = sessionResponse.data.data?.sessionId || sessionResponse.data.sessionId;

    // Fetch history
    const historyResponse = await axios.get(
      `${API_BASE_URL}/api/chat/sessions/${sessionId}/history?merchantId=test_merchant`,
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        },
        validateStatus: () => true
      }
    );

    expect(historyResponse.headers['access-control-allow-origin']).toBeTruthy();
    expect(historyResponse.status).toBe(200);
  });

  it('should support credentials in CORS requests', async () => {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/sessions`,
      {
        merchantId: 'test_merchant',
        userId: 'test_user_credentials'
      },
      {
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_key',
          'X-Merchant-ID': 'test_merchant'
        },
        withCredentials: true,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(201);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
