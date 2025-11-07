/**
 * Rate Limit Headers CORS Integration Test
 * Verifies that rate limit headers are properly exposed via CORS
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { rateLimitMiddleware } from '../api/middleware/rateLimit';

describe('Rate Limit Headers - CORS Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Add CORS middleware with exposed headers (matching production config)
    app.use(
      cors({
        origin: true, // Allow all origins for testing
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Request-ID',
          'X-Merchant-ID',
          'X-User-ID',
          'X-Impersonation-Token',
          'X-API-Key',
        ],
        exposedHeaders: [
          'X-Impersonating',
          'X-Impersonated-By',
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset',
          'X-Request-ID',
        ],
      })
    );

    // Add rate limiting middleware
    app.use('/api/test', rateLimitMiddleware({
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 requests per minute
      message: 'Too many requests'
    }));

    // Test endpoint
    app.get('/api/test', (req: Request, res: Response) => {
      res.json({ success: true, message: 'OK' });
    });
  });

  it('should expose rate limit headers in CORS preflight response', async () => {
    const response = await request(app)
      .options('/api/test')
      .set('Origin', 'https://merchant-store.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type');

    // Check CORS headers
    expect(response.headers['access-control-allow-origin']).toBe('https://merchant-store.com');
    expect(response.headers['access-control-expose-headers']).toBeDefined();
    
    // Verify rate limit headers are in exposed headers list
    const exposedHeaders = response.headers['access-control-expose-headers'];
    expect(exposedHeaders).toContain('X-RateLimit-Limit');
    expect(exposedHeaders).toContain('X-RateLimit-Remaining');
    expect(exposedHeaders).toContain('X-RateLimit-Reset');
  });

  it('should include rate limit headers in actual response with CORS', async () => {
    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'https://merchant-store.com')
      .expect(200);

    // Check CORS headers
    expect(response.headers['access-control-allow-origin']).toBe('https://merchant-store.com');
    expect(response.headers['access-control-expose-headers']).toBeDefined();

    // Verify rate limit headers are present
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should expose rate limit headers for requests from external domain', async () => {
    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'https://external-merchant.com')
      .expect(200);

    // Check CORS allows the request
    expect(response.headers['access-control-allow-origin']).toBe('https://external-merchant.com');
    
    // Verify rate limit headers are accessible
    const exposedHeaders = response.headers['access-control-expose-headers'];
    expect(exposedHeaders).toContain('X-RateLimit-Limit');
    expect(exposedHeaders).toContain('X-RateLimit-Remaining');
    expect(exposedHeaders).toContain('X-RateLimit-Reset');

    // Verify headers are actually set
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should expose all required headers including impersonation and request ID', async () => {
    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'https://merchant-store.com')
      .set('X-Request-ID', 'test-request-123')
      .expect(200);

    const exposedHeaders = response.headers['access-control-expose-headers'];
    
    // Verify all required headers are exposed
    expect(exposedHeaders).toContain('X-RateLimit-Limit');
    expect(exposedHeaders).toContain('X-RateLimit-Remaining');
    expect(exposedHeaders).toContain('X-RateLimit-Reset');
    expect(exposedHeaders).toContain('X-Request-ID');
    expect(exposedHeaders).toContain('X-Impersonating');
    expect(exposedHeaders).toContain('X-Impersonated-By');
  });

  it('should expose rate limit headers when rate limit is exceeded', async () => {
    // Make 5 requests to hit the limit
    for (let i = 0; i < 5; i++) {
      await request(app)
        .get('/api/test')
        .set('Origin', 'https://merchant-store.com');
    }

    // 6th request should be rate limited
    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'https://merchant-store.com')
      .expect(429);

    // Check CORS headers are still present
    expect(response.headers['access-control-allow-origin']).toBe('https://merchant-store.com');
    expect(response.headers['access-control-expose-headers']).toBeDefined();

    // Verify rate limit headers are present even on error
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
    
    // Verify exposed headers list includes rate limit headers
    const exposedHeaders = response.headers['access-control-expose-headers'];
    expect(exposedHeaders).toContain('X-RateLimit-Limit');
    expect(exposedHeaders).toContain('X-RateLimit-Remaining');
    expect(exposedHeaders).toContain('X-RateLimit-Reset');
  });
});
