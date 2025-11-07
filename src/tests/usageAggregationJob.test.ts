import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UsageAggregationJob } from "../jobs/UsageAggregationJob";
import { getCacheService } from "../services/CacheService";
import { getMerchantUsageRepository } from "../repositories/MerchantUsageRepository";

describe("UsageAggregationJob", () => {
  let job: UsageAggregationJob;
  let cacheService: ReturnType<typeof getCacheService>;
  let usageRepository: ReturnType<typeof getMerchantUsageRepository>;

  beforeEach(() => {
    job = new UsageAggregationJob();
    cacheService = getCacheService();
    usageRepository = getMerchantUsageRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("aggregateMerchant", () => {
    it("should aggregate usage data for a specific merchant", async () => {
      const merchantId = "test_merchant_123";
      const date = new Date("2025-11-01");
      const dateStr = "2025-11-01";

      // Mock Redis data
      const mockUsageData = {
        queries: "150",
        documents: "25",
        api_calls: "500",
        storage_gb: "2",
      };

      // Mock getRaw to return usage values
      vi.spyOn(cacheService, "getRaw").mockImplementation(async (key: string) => {
        if (key.includes("queries")) return mockUsageData.queries;
        if (key.includes("documents")) return mockUsageData.documents;
        if (key.includes("api_calls")) return mockUsageData.api_calls;
        if (key.includes("storage_gb")) return mockUsageData.storage_gb;
        return null;
      });

      // Mock upsert
      const upsertSpy = vi.spyOn(usageRepository, "upsert").mockResolvedValue({
        id: "test-id",
        merchantId,
        date,
        metricType: "queries",
        metricValue: 150,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Run aggregation
      const result = await job.aggregateMerchant(merchantId, date);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.metricsAggregated).toBe(4); // queries, documents, api_calls, storage_gb
      expect(result.errors).toHaveLength(0);

      // Verify upsert was called for each metric
      expect(upsertSpy).toHaveBeenCalledTimes(4);
      expect(upsertSpy).toHaveBeenCalledWith(merchantId, date, "queries", 150);
      expect(upsertSpy).toHaveBeenCalledWith(merchantId, date, "documents", 25);
      expect(upsertSpy).toHaveBeenCalledWith(merchantId, date, "api_calls", 500);
      expect(upsertSpy).toHaveBeenCalledWith(merchantId, date, "storage_gb", 2);
    });

    it("should handle missing Redis data gracefully", async () => {
      const merchantId = "test_merchant_456";
      const date = new Date("2025-11-01");

      // Mock getRaw to return null (no data)
      vi.spyOn(cacheService, "getRaw").mockResolvedValue(null);

      // Mock upsert (should not be called)
      const upsertSpy = vi.spyOn(usageRepository, "upsert");

      // Run aggregation
      const result = await job.aggregateMerchant(merchantId, date);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.metricsAggregated).toBe(0); // No data to aggregate
      expect(result.errors).toHaveLength(0);

      // Verify upsert was not called
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it("should handle errors during aggregation", async () => {
      const merchantId = "test_merchant_789";
      const date = new Date("2025-11-01");

      // Mock getRaw to return valid data
      vi.spyOn(cacheService, "getRaw").mockResolvedValue("100");

      // Mock upsert to throw an error
      vi.spyOn(usageRepository, "upsert").mockRejectedValue(
        new Error("Database error")
      );

      // Run aggregation
      const result = await job.aggregateMerchant(merchantId, date);

      // Verify results
      expect(result.success).toBe(false);
      expect(result.metricsAggregated).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Database error");
    });
  });

  describe("getAggregationStatus", () => {
    it("should return aggregation status for a date", async () => {
      const date = new Date("2025-11-01");

      // Mock findByMerchantAndDate to return some records
      vi.spyOn(usageRepository, "findByMerchantAndDate").mockResolvedValue([
        {
          id: "1",
          merchantId: "merchant_1",
          date,
          metricType: "queries",
          metricValue: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          merchantId: "merchant_1",
          date,
          metricType: "documents",
          metricValue: 50,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          merchantId: "merchant_2",
          date,
          metricType: "queries",
          metricValue: 200,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      // Get status
      const status = await job.getAggregationStatus(date);

      // Verify results
      expect(status.date).toBe("2025-11-01");
      expect(status.isAggregated).toBe(true);
      expect(status.merchantCount).toBe(2); // merchant_1 and merchant_2
      expect(status.totalRecords).toBe(3);
    });

    it("should return not aggregated status when no records exist", async () => {
      const date = new Date("2025-11-01");

      // Mock findByMerchantAndDate to return empty array
      vi.spyOn(usageRepository, "findByMerchantAndDate").mockResolvedValue([]);

      // Get status
      const status = await job.getAggregationStatus(date);

      // Verify results
      expect(status.date).toBe("2025-11-01");
      expect(status.isAggregated).toBe(false);
      expect(status.merchantCount).toBe(0);
      expect(status.totalRecords).toBe(0);
    });
  });
});
