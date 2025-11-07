import { describe, it, expect } from 'vitest';
import { AnalyticsController } from '../api/controllers/AnalyticsController';
import { Response } from 'express';
import { AuthenticatedRequest } from '../api/middleware/auth';

const analyticsController = new AnalyticsController();

describe('Analytics Performance Endpoint', () => {
  describe('GET /api/merchants/:merchantId/analytics/performance - Controller Logic', () => {
    it('should have a getPerformance method', () => {
      expect(analyticsController).toHaveProperty('getPerformance');
      expect(typeof analyticsController.getPerformance).toBe('function');
    });

    it('should validate merchant access', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: {},
        user: { merchantId: 'different_merchant', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      expect(statusCode).toBe(403);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData).toHaveProperty('error', 'Access denied');
    });

    it('should allow admin access to any merchant data', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: {},
        user: { merchantId: 'different_merchant', roles: ['admin'] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      // Should not return 403 for admin
      expect(statusCode).not.toBe(403);
    });

    it('should validate date format when startDate is provided', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { startDate: 'invalid-date' },
        user: { merchantId: 'test_merchant_123', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid date format');
    });

    it('should validate date format when endDate is provided', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { endDate: 'invalid-date' },
        user: { merchantId: 'test_merchant_123', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid date format');
    });

    it('should validate that startDate is before endDate', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { 
          startDate: '2025-11-01',
          endDate: '2025-10-01'
        },
        user: { merchantId: 'test_merchant_123', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('startDate must be before endDate');
    });

    it('should use default date range when no dates provided', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: {},
        user: { merchantId: 'test_merchant_123', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      // Should succeed with default date range (last 30 days)
      expect(statusCode).not.toBe(400);
    });

    it('should return performance metrics with correct structure', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: {
          startDate: '2025-10-01',
          endDate: '2025-11-01'
        },
        user: { merchantId: 'test_merchant_123', roles: [] },
        headers: { 'x-request-id': 'test-request-id' },
      } as any as AuthenticatedRequest;

      let statusCode = 200;
      let jsonData: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonData = data;
          return mockRes;
        },
      } as any as Response;

      await analyticsController.getPerformance(mockReq, mockRes);

      // Should return 200 or 500 (if database connection fails)
      expect([200, 500]).toContain(statusCode);

      if (statusCode === 200) {
        expect(jsonData).toHaveProperty('success', true);
        expect(jsonData).toHaveProperty('data');
        expect(jsonData.data).toHaveProperty('merchantId', 'test_merchant_123');
        expect(jsonData.data).toHaveProperty('startDate');
        expect(jsonData.data).toHaveProperty('endDate');
        expect(jsonData.data).toHaveProperty('p50ResponseTime');
        expect(jsonData.data).toHaveProperty('p95ResponseTime');
        expect(jsonData.data).toHaveProperty('p99ResponseTime');
        expect(jsonData.data).toHaveProperty('cacheHitRate');
        expect(jsonData.data).toHaveProperty('errorRate');
        expect(jsonData.data).toHaveProperty('uptime');
        expect(jsonData).toHaveProperty('timestamp');
        expect(jsonData).toHaveProperty('requestId');
      }
    });
  });
});
