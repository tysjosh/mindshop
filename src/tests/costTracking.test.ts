import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCostTrackingService, CostTrackingService } from '../services/CostTrackingService';

describe('Cost Tracking Service', () => {
  let costTrackingService: CostTrackingService;

  beforeEach(() => {
    costTrackingService = getCostTrackingService();
  });

  describe('Cost Estimation', () => {
    it('should estimate Bedrock costs correctly', () => {
      const estimate = costTrackingService.estimateBedrockCost({
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(estimate.operation).toBe('bedrock_generation');
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.tokens?.input).toBe(1000);
      expect(estimate.tokens?.output).toBe(500);
      expect(estimate.confidence).toBe(0.95);
    });

    it('should estimate MindsDB retrieval costs', () => {
      const estimate = costTrackingService.estimateMindsDBCost({
        operation: 'retrieval',
        documentCount: 100,
      });

      expect(estimate.operation).toBe('mindsdb_retrieval');
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBe(0.8);
    });

    it('should estimate MindsDB prediction costs', () => {
      const estimate = costTrackingService.estimateMindsDBCost({
        operation: 'prediction',
        complexity: 'complex',
      });

      expect(estimate.operation).toBe('mindsdb_prediction');
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBe(0.8);
    });

    it('should apply complexity multipliers correctly', () => {
      const simpleEstimate = costTrackingService.estimateMindsDBCost({
        operation: 'prediction',
        complexity: 'simple',
      });

      const complexEstimate = costTrackingService.estimateMindsDBCost({
        operation: 'prediction',
        complexity: 'complex',
      });

      expect(complexEstimate.estimatedCost).toBeGreaterThan(simpleEstimate.estimatedCost);
    });
  });

  describe('Session Cost Target Checking', () => {
    it('should return correct target cost', async () => {
      const sessionId = 'non-existent-session';
      
      const result = await costTrackingService.checkSessionCostTarget(sessionId);

      expect(result.exceedsTarget).toBe(false);
      expect(result.currentCost).toBe(0);
      expect(result.targetCost).toBe(0.05);
      expect(result.percentageOfTarget).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return health check structure', async () => {
      const health = await costTrackingService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(health.details).toHaveProperty('sessionCostTarget');
      expect(health.details.sessionCostTarget).toBe(0.05);
    });
  });

  describe('Cost Breakdown', () => {
    it('should return cost breakdown structure', async () => {
      const merchantId = 'test-merchant-breakdown';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const breakdown = await costTrackingService.getCostBreakdown({
        merchantId,
        startDate,
        endDate,
      });

      expect(breakdown).toHaveProperty('total');
      expect(breakdown).toHaveProperty('retrieval');
      expect(breakdown).toHaveProperty('prediction');
      expect(breakdown).toHaveProperty('generation');
      expect(breakdown).toHaveProperty('checkout');
      expect(typeof breakdown.total).toBe('number');
    });
  });

  describe('Merchant Cost Analytics', () => {
    it('should return analytics structure', async () => {
      const merchantId = 'test-merchant-analytics';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const analytics = await costTrackingService.getMerchantCostAnalytics({
        merchantId,
        startDate,
        endDate,
        includeTopSessions: false,
      });

      expect(analytics.merchantId).toBe(merchantId);
      expect(analytics).toHaveProperty('totalCost');
      expect(analytics).toHaveProperty('totalSessions');
      expect(analytics).toHaveProperty('avgCostPerSession');
      expect(analytics).toHaveProperty('costByOperation');
      expect(analytics).toHaveProperty('dailyTrend');
      expect(analytics).toHaveProperty('topExpensiveSessions');
      expect(analytics.dailyTrend).toBeInstanceOf(Array);
      expect(analytics.topExpensiveSessions).toBeInstanceOf(Array);
    });
  });
});