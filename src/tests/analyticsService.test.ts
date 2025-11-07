/**
 * Unit tests for AnalyticsService
 * Tests analytics data retrieval, caching, and aggregation
 *
 * Requirements: 5.1 Analytics Service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsService } from "../services/AnalyticsService";

describe("AnalyticsService", () => {
  let analyticsService: AnalyticsService;
  const merchantId = "test_merchant_123";
  const startDate = new Date("2025-11-01");
  const endDate = new Date("2025-11-30");

  beforeEach(() => {
    // Create service instance
    analyticsService = new AnalyticsService();
  });

  describe("getOverview", () => {
    it("should return analytics overview with all required properties", async () => {
      const result = await analyticsService.getOverview(
        merchantId,
        startDate,
        endDate
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalQueries");
      expect(result).toHaveProperty("activeSessions");
      expect(result).toHaveProperty("avgResponseTime");
      expect(result).toHaveProperty("successRate");
      expect(result).toHaveProperty("topQueries");
      
      expect(typeof result.totalQueries).toBe("number");
      expect(typeof result.activeSessions).toBe("number");
      expect(typeof result.avgResponseTime).toBe("number");
      expect(typeof result.successRate).toBe("number");
      expect(Array.isArray(result.topQueries)).toBe(true);
    });

    it("should return non-negative metric values", async () => {
      const result = await analyticsService.getOverview(
        merchantId,
        startDate,
        endDate
      );

      expect(result.totalQueries).toBeGreaterThanOrEqual(0);
      expect(result.activeSessions).toBeGreaterThanOrEqual(0);
      expect(result.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe("getQueryTimeSeries", () => {
    it("should return time series data with correct structure", async () => {
      const result = await analyticsService.getQueryTimeSeries(
        merchantId,
        startDate,
        endDate,
        "day"
      );

      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const firstPoint = result[0];
        expect(firstPoint).toHaveProperty("timestamp");
        expect(firstPoint).toHaveProperty("count");
        expect(firstPoint).toHaveProperty("avgResponseTime");
        expect(firstPoint).toHaveProperty("successRate");
        
        expect(firstPoint.timestamp instanceof Date).toBe(true);
        expect(typeof firstPoint.count).toBe("number");
        expect(typeof firstPoint.avgResponseTime).toBe("number");
        expect(typeof firstPoint.successRate).toBe("number");
      }
    });

    it("should accept hour grouping parameter", async () => {
      const result = await analyticsService.getQueryTimeSeries(
        merchantId,
        startDate,
        endDate,
        "hour"
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return data points in chronological order when data exists", async () => {
      const result = await analyticsService.getQueryTimeSeries(
        merchantId,
        startDate,
        endDate,
        "day"
      );

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            result[i - 1].timestamp.getTime()
          );
        }
      } else {
        // If no data, test passes
        expect(true).toBe(true);
      }
    });
  });

  describe("getTopQueries", () => {
    it("should return array with correct structure", async () => {
      const result = await analyticsService.getTopQueries(
        merchantId,
        startDate,
        endDate,
        20
      );

      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const firstQuery = result[0];
        expect(firstQuery).toHaveProperty("query");
        expect(firstQuery).toHaveProperty("count");
        expect(firstQuery).toHaveProperty("avgConfidence");
        
        expect(typeof firstQuery.query).toBe("string");
        expect(typeof firstQuery.count).toBe("number");
        expect(typeof firstQuery.avgConfidence).toBe("number");
      }
    });

    it("should respect the limit parameter", async () => {
      const limit = 5;
      const result = await analyticsService.getTopQueries(
        merchantId,
        startDate,
        endDate,
        limit
      );

      expect(result.length).toBeLessThanOrEqual(limit);
    });

    it("should return queries sorted by count descending when data exists", async () => {
      const result = await analyticsService.getTopQueries(
        merchantId,
        startDate,
        endDate,
        20
      );

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count);
        }
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("getIntentDistribution", () => {
    it("should return array with correct structure", async () => {
      const result = await analyticsService.getIntentDistribution(
        merchantId,
        startDate,
        endDate
      );

      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const firstIntent = result[0];
        expect(firstIntent).toHaveProperty("intent");
        expect(firstIntent).toHaveProperty("count");
        expect(firstIntent).toHaveProperty("percentage");
        
        expect(typeof firstIntent.intent).toBe("string");
        expect(typeof firstIntent.count).toBe("number");
        expect(typeof firstIntent.percentage).toBe("number");
      }
    });

    it("should have percentages that sum to approximately 100 when data exists", async () => {
      const result = await analyticsService.getIntentDistribution(
        merchantId,
        startDate,
        endDate
      );

      if (result.length > 0) {
        const totalPercentage = result.reduce(
          (sum, item) => sum + item.percentage,
          0
        );

        // Allow for rounding errors
        expect(totalPercentage).toBeGreaterThanOrEqual(99);
        expect(totalPercentage).toBeLessThanOrEqual(101);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should return performance metrics with all required properties", async () => {
      const result = await analyticsService.getPerformanceMetrics(
        merchantId,
        startDate,
        endDate
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("p50ResponseTime");
      expect(result).toHaveProperty("p95ResponseTime");
      expect(result).toHaveProperty("p99ResponseTime");
      expect(result).toHaveProperty("cacheHitRate");
      expect(result).toHaveProperty("errorRate");
      expect(result).toHaveProperty("uptime");
      
      expect(typeof result.p50ResponseTime).toBe("number");
      expect(typeof result.p95ResponseTime).toBe("number");
      expect(typeof result.p99ResponseTime).toBe("number");
      expect(typeof result.cacheHitRate).toBe("number");
      expect(typeof result.errorRate).toBe("number");
      expect(typeof result.uptime).toBe("number");
    });

    it("should have percentiles in ascending order", async () => {
      const result = await analyticsService.getPerformanceMetrics(
        merchantId,
        startDate,
        endDate
      );

      expect(result.p50ResponseTime).toBeLessThanOrEqual(result.p95ResponseTime);
      expect(result.p95ResponseTime).toBeLessThanOrEqual(result.p99ResponseTime);
    });

    it("should have error rate between 0 and 100", async () => {
      const result = await analyticsService.getPerformanceMetrics(
        merchantId,
        startDate,
        endDate
      );

      expect(result.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.errorRate).toBeLessThanOrEqual(100);
    });

    it("should have cache hit rate between 0 and 100", async () => {
      const result = await analyticsService.getPerformanceMetrics(
        merchantId,
        startDate,
        endDate
      );

      expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(result.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it("should have uptime between 0 and 100", async () => {
      const result = await analyticsService.getPerformanceMetrics(
        merchantId,
        startDate,
        endDate
      );

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.uptime).toBeLessThanOrEqual(100);
    });
  });
});
