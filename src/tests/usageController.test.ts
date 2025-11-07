import { describe, it, expect } from 'vitest';
import { UsageController } from '../api/controllers/UsageController';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../api/middleware/auth';

const usageController = new UsageController();

describe('Usage Controller Endpoints', () => {
  describe('GET /api/merchants/:merchantId/usage/current - Controller Logic', () => {
    it('should have a getCurrentUsage method', () => {
      expect(usageController).toHaveProperty('getCurrentUsage');
      expect(typeof usageController.getCurrentUsage).toBe('function');
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

      await usageController.getCurrentUsage(mockReq, mockRes);

      expect(statusCode).toBe(403);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData).toHaveProperty('error', 'Access denied');
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

      await usageController.getCurrentUsage(mockReq, mockRes);

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

      await usageController.getCurrentUsage(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid date format');
    });

    it('should validate startDate is before endDate', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { 
          startDate: '2025-12-31', 
          endDate: '2025-01-01' 
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

      await usageController.getCurrentUsage(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('startDate must be before endDate');
    });
  });

  describe('GET /api/merchants/:merchantId/usage/history - Controller Logic', () => {
    it('should have a getUsageHistory method', () => {
      expect(usageController).toHaveProperty('getUsageHistory');
      expect(typeof usageController.getUsageHistory).toBe('function');
    });

    it('should validate metricType is required', async () => {
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

      await usageController.getUsageHistory(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('metricType');
    });

    it('should validate metricType is valid', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { metricType: 'invalid_metric' },
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

      await usageController.getUsageHistory(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid metricType');
    });

    it('should validate date format', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { metricType: 'queries', startDate: 'invalid-date' },
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

      await usageController.getUsageHistory(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid date format');
    });

    it('should validate startDate is before endDate', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { 
          metricType: 'queries', 
          startDate: '2025-12-31', 
          endDate: '2025-01-01' 
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

      await usageController.getUsageHistory(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('startDate must be before endDate');
    });
  });

  describe('GET /api/merchants/:merchantId/usage/forecast - Controller Logic', () => {
    it('should have a getUsageForecast method', () => {
      expect(usageController).toHaveProperty('getUsageForecast');
      expect(typeof usageController.getUsageForecast).toBe('function');
    });

    it('should validate metricType is required', async () => {
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

      await usageController.getUsageForecast(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('metricType');
    });

    it('should validate metricType is valid', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        query: { metricType: 'invalid_metric' },
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

      await usageController.getUsageForecast(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid metricType');
    });
  });

  describe('POST /api/merchants/:merchantId/usage/limits - Controller Logic', () => {
    it('should have a setUsageLimits method', () => {
      expect(usageController).toHaveProperty('setUsageLimits');
      expect(typeof usageController.setUsageLimits).toBe('function');
    });

    it('should require admin access', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        body: {
          plan: 'starter',
          queriesPerMonth: 1000,
          documentsMax: 100,
          apiCallsPerDay: 5000,
          storageGbMax: 1,
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

      await usageController.setUsageLimits(mockReq, mockRes);

      expect(statusCode).toBe(403);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData).toHaveProperty('error', 'Admin access required');
    });

    it('should validate all required fields are present', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        body: {
          plan: 'starter',
          // Missing other required fields
        },
        user: { merchantId: 'test_merchant_123', roles: ['admin'] },
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

      await usageController.setUsageLimits(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('All limit fields are required');
    });

    it('should validate plan is valid', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        body: {
          plan: 'invalid_plan',
          queriesPerMonth: 1000,
          documentsMax: 100,
          apiCallsPerDay: 5000,
          storageGbMax: 1,
        },
        user: { merchantId: 'test_merchant_123', roles: ['admin'] },
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

      await usageController.setUsageLimits(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('Invalid plan');
    });

    it('should validate numeric values are non-negative', async () => {
      const mockReq = {
        params: { merchantId: 'test_merchant_123' },
        body: {
          plan: 'starter',
          queriesPerMonth: -1000,
          documentsMax: 100,
          apiCallsPerDay: 5000,
          storageGbMax: 1,
        },
        user: { merchantId: 'test_merchant_123', roles: ['admin'] },
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

      await usageController.setUsageLimits(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonData).toHaveProperty('success', false);
      expect(jsonData.error).toContain('non-negative');
    });
  });
});
