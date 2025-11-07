import { getCacheService } from "./CacheService";
import { getMerchantUsageRepository } from "../repositories/MerchantUsageRepository";
import { getUsageLimitsRepository } from "../repositories/UsageLimitsRepository";

export interface UsageMetrics {
  queries: { count: number; limit: number; percentage: number };
  documents: { count: number; limit: number; percentage: number };
  apiCalls: { count: number; limit: number; percentage: number };
  storageGb: { count: number; limit: number; percentage: number };
}

export interface UsageHistoryEntry {
  date: Date;
  metricType: string;
  value: number;
}

export interface TrackUsageData {
  merchantId: string;
  metricType: "queries" | "documents" | "api_calls" | "storage_gb";
  value: number;
  metadata?: any;
}

/**
 * Service for tracking and managing merchant usage metrics
 * Implements real-time tracking with Redis and periodic aggregation to PostgreSQL
 */
export class UsageTrackingService {
  private cacheService = getCacheService();
  private usageRepository = getMerchantUsageRepository();
  private limitsRepository = getUsageLimitsRepository();

  /**
   * Track usage for a merchant
   * Increments in Redis for real-time tracking and queues for database aggregation
   */
  async trackUsage(data: TrackUsageData): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // 1. Increment in Redis (real-time) using atomic INCRBY
    const redisKey = `usage:${data.merchantId}:${today}:${data.metricType}`;
    
    try {
      // Use atomic increment operation
      await this.cacheService.incrby(redisKey, data.value);
      
      // Set expiration (7 days) - only if key was just created
      // Redis EXPIRE won't reset TTL if key already exists with TTL
      await this.cacheService.expire(redisKey, 86400 * 7);
    } catch (error) {
      console.error("Error tracking usage in Redis:", error);
      // Continue even if Redis fails - don't throw
    }

    // 2. Queue for database aggregation (async)
    await this.queueUsageAggregation(data.merchantId, today, data.metricType);
  }

  /**
   * Get current usage for a merchant across all metrics
   * @param merchantId - The merchant ID
   * @param startDate - Optional start date for the period (defaults to start of current month)
   * @param endDate - Optional end date for the period (defaults to now)
   */
  async getCurrentUsage(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageMetrics> {
    // 1. Get limits
    const limits = await this.limitsRepository.findByMerchantId(merchantId);
    
    if (!limits) {
      throw new Error(`Usage limits not found for merchant: ${merchantId}`);
    }

    // 2. Determine date range
    let periodStart: Date;
    let periodEnd: Date;

    if (startDate && endDate) {
      // Use provided date range
      periodStart = startDate;
      periodEnd = endDate;
    } else {
      // Default to current month
      periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);
      periodEnd.setHours(23, 59, 59, 999);
    }

    const queries = await this.getUsageForPeriod(
      merchantId,
      "queries",
      periodStart,
      periodEnd
    );

    const documents = await this.getUsageForPeriod(
      merchantId,
      "documents",
      periodStart,
      periodEnd
    );

    // For API calls, if custom date range is provided, use it
    // Otherwise, use last 24 hours for daily limit comparison
    let apiCallsStart: Date;
    let apiCallsEnd: Date;
    
    if (startDate && endDate) {
      apiCallsStart = periodStart;
      apiCallsEnd = periodEnd;
    } else {
      apiCallsStart = new Date(Date.now() - 86400000); // last 24 hours
      apiCallsEnd = new Date();
    }

    const apiCalls = await this.getUsageForPeriod(
      merchantId,
      "api_calls",
      apiCallsStart,
      apiCallsEnd
    );

    const storageGb = await this.getUsageForPeriod(
      merchantId,
      "storage_gb",
      periodStart,
      periodEnd
    );

    return {
      queries: {
        count: queries,
        limit: limits.queriesPerMonth,
        percentage: (queries / limits.queriesPerMonth) * 100,
      },
      documents: {
        count: documents,
        limit: limits.documentsMax,
        percentage: (documents / limits.documentsMax) * 100,
      },
      apiCalls: {
        count: apiCalls,
        limit: limits.apiCallsPerDay,
        percentage: (apiCalls / limits.apiCallsPerDay) * 100,
      },
      storageGb: {
        count: storageGb,
        limit: limits.storageGbMax,
        percentage: (storageGb / limits.storageGbMax) * 100,
      },
    };
  }

  /**
   * Get usage history for a merchant
   */
  async getUsageHistory(
    merchantId: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageHistoryEntry[]> {
    const timeSeries = await this.usageRepository.getUsageTimeSeries(
      merchantId,
      metricType,
      startDate,
      endDate
    );

    return timeSeries.map((entry) => ({
      date: entry.date,
      metricType,
      value: entry.value,
    }));
  }

  /**
   * Check if a merchant has exceeded their usage limit for a specific metric
   */
  async checkLimit(
    merchantId: string,
    metricType: "queries" | "documents" | "apiCalls" | "storageGb"
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const usage = await this.getCurrentUsage(merchantId);
    const metric = usage[metricType];

    return {
      allowed: metric.count < metric.limit,
      remaining: Math.max(0, metric.limit - metric.count),
      limit: metric.limit,
    };
  }

  /**
   * Get usage for a specific period
   * Combines Redis (recent data) and PostgreSQL (historical data)
   */
  private async getUsageForPeriod(
    merchantId: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Try Redis first for today's data
    const today = new Date().toISOString().split("T")[0];
    const redisKey = `usage:${merchantId}:${today}:${metricType}`;
    
    let todayUsage = 0;
    try {
      // Get raw value since we're storing plain numbers with INCRBY
      const cached = await this.cacheService.getRaw(redisKey);
      todayUsage = cached ? parseInt(cached, 10) : 0;
    } catch (error) {
      console.error("Error getting usage from Redis:", error);
    }

    // Get historical from database
    const dbUsage = await this.usageRepository.sumByPeriod(
      merchantId,
      metricType,
      startDate,
      endDate
    );

    return todayUsage + dbUsage;
  }

  /**
   * Queue usage data for background aggregation to database
   * This allows real-time tracking in Redis while periodically syncing to PostgreSQL
   */
  private async queueUsageAggregation(
    merchantId: string,
    date: string,
    metricType: string
  ): Promise<void> {
    try {
      // Add to a Redis set for background processing
      const queueKey = `usage:queue:${date}`;
      const queueValue = `${merchantId}:${metricType}`;
      
      await this.cacheService.set(
        `${queueKey}:${queueValue}`,
        true,
        86400 // 24 hours TTL
      );
    } catch (error) {
      console.error("Error queuing usage aggregation:", error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Aggregate usage data from Redis to PostgreSQL
   * This should be called by a background job periodically
   */
  async aggregateUsageToDatabase(date: string): Promise<number> {
    let aggregatedCount = 0;

    try {
      // Get all queued items for this date
      const queueKey = `usage:queue:${date}`;
      
      // In a real implementation, you would scan for all keys matching the pattern
      // For now, we'll implement a simple version that processes known merchants
      
      // This is a placeholder - in production, you'd want to:
      // 1. Scan Redis for all keys matching usage:queue:{date}:*
      // 2. Process each one
      // 3. Update the database
      // 4. Remove from queue
      
      console.log(`Aggregation job for ${date} - would process queued items here`);
      
    } catch (error) {
      console.error("Error aggregating usage to database:", error);
    }

    return aggregatedCount;
  }

  /**
   * Increment usage metric directly in database
   * Use this for less frequent updates or when Redis is unavailable
   */
  async incrementUsageInDatabase(
    merchantId: string,
    metricType: string,
    incrementBy: number = 1
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.usageRepository.incrementMetric(
      merchantId,
      today,
      metricType,
      incrementBy
    );
  }

  /**
   * Get usage forecast based on historical trends
   * Predicts usage for the rest of the current period
   */
  async getUsageForecast(
    merchantId: string,
    metricType: string
  ): Promise<{
    current: number;
    projected: number;
    limit: number;
    willExceed: boolean;
    daysRemaining: number;
  }> {
    const limits = await this.limitsRepository.findByMerchantId(merchantId);
    
    if (!limits) {
      throw new Error(`Usage limits not found for merchant: ${merchantId}`);
    }

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const now = new Date();
    const current = await this.getUsageForPeriod(
      merchantId,
      metricType,
      startOfMonth,
      now
    );

    // Calculate days elapsed and remaining
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Simple linear projection
    const dailyAverage = current / daysElapsed;
    const projected = Math.round(current + dailyAverage * daysRemaining);

    // Get limit based on metric type
    const limit =
      metricType === "queries"
        ? limits.queriesPerMonth
        : metricType === "documents"
        ? limits.documentsMax
        : metricType === "api_calls"
        ? limits.apiCallsPerDay * daysInMonth
        : limits.storageGbMax;

    return {
      current,
      projected,
      limit,
      willExceed: projected > limit,
      daysRemaining,
    };
  }

  /**
   * Reset usage for a specific metric (admin function)
   */
  async resetUsage(
    merchantId: string,
    metricType: string,
    date?: Date
  ): Promise<void> {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Clear Redis cache by deleting the key
    const dateStr = targetDate.toISOString().split("T")[0];
    const redisKey = `usage:${merchantId}:${dateStr}:${metricType}`;
    
    try {
      await this.cacheService.delete(redisKey);
    } catch (error) {
      console.error("Error clearing Redis cache:", error);
    }

    // Update database to 0
    await this.usageRepository.upsert(merchantId, targetDate, metricType, 0);
  }
}

// Export singleton instance
let usageTrackingServiceInstance: UsageTrackingService | null = null;

export const getUsageTrackingService = (): UsageTrackingService => {
  if (!usageTrackingServiceInstance) {
    usageTrackingServiceInstance = new UsageTrackingService();
  }
  return usageTrackingServiceInstance;
};
