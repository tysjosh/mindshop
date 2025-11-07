import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { rateLimitMiddleware } from '../api/middleware/rateLimit';

describe('Rate Limit Headers', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Add rate limiting middleware
    app.use('/test', rateLimitMiddleware({
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 requests per minute
      message: 'Too many requests'
    }));

    // Test endpoint
    app.get('/test', (req: Request, res: Response) => {
      res.json({ success: true, message: 'OK' });
    });
  });

  it('should set X-RateLimit-Limit header', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBe('5');
  });

  it('should set X-RateLimit-Remaining header', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeLessThanOrEqual(5);
  });

  it('should set X-RateLimit-Reset header', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers['x-ratelimit-reset']).toBeDefined();
    const resetTime = parseInt(response.headers['x-ratelimit-reset']);
    // Reset time should be a valid Unix timestamp (positive number)
    expect(resetTime).toBeGreaterThan(0);
    // Should be within reasonable range (not in the past, not too far in future)
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(resetTime - now)).toBeLessThan(120); // Within 2 minutes
  });

  it('should decrement X-RateLimit-Remaining on subsequent requests', async () => {
    const response1 = await request(app).get('/test').expect(200);
    const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

    const response2 = await request(app).get('/test').expect(200);
    const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

    expect(remaining2).toBeLessThan(remaining1);
  });

  it('should set headers when rate limit is exceeded', async () => {
    // Make 5 requests to hit the limit
    for (let i = 0; i < 5; i++) {
      await request(app).get('/test').expect(200);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .get('/test')
      .expect(429);

    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
    
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Too many requests');
  });

  it('should include all three rate limit headers on every response', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });
});
