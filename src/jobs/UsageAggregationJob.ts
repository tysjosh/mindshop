import { getCacheService } from "../services/CacheService";
import { getMerchantUsageRepository } from "../repositories/MerchantUsageRepository";

/**
 * Background job for aggregating usage data from Redis to PostgreSQL
 * 
 * This job should be run periodically (e.g., every hour or daily) to:
 * 1. Scan Redis for usage data keys
 * 2. Aggregate the data
 * 3. Update PostgreSQL with the aggregated values
 * 4. Clean up processed Redis keys (optional)
 * 
 * Usage patterns:
 * - Redis keys: usage:{merchantId}:{date}:{metricType}
 * - Queue keys: usage:queue:{date}:{merchantId}:{metricType}
 */
export class UsageAggregationJob {
  private cacheService = getCacheService();
  private usageRepository = getMerchantUsageRepository();

  /**
   * Run the aggregation job for a specific date
   * @param date - The date to aggregate (defaults to yesterday)
   * @returns Number of records aggregated
   */
  async run(date?: Date): Promise<{
    success: boolean;
    recordsAggregated: number;
    errors: string[];
  }> {
    const targetDate = date || this.getYesterday();
    const dateStr = targetDate.toISOString().split("T")[0];
    
    console.log(`[UsageAggregationJob] Starting aggregation for date: ${dateStr}`);
    
    const errors: string[] = [];
    let recordsAggregated = 0;

    try {
      // 1. Scan Redis for all usage keys for this date
      const usageKeys = await this.scanUsageKeys(dateStr);
      console.log(`[UsageAggregationJob] Found ${usageKeys.length} usage keys to process`);

      // 2. Process each key
      for (const key of usageKeys) {
        try {
          const aggregated = await this.aggregateKey(key, targetDate);
          if (aggregated) {
            recordsAggregated++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to aggregate key ${key}: ${error.message}`;
          console.error(`[UsageAggregationJob] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 3. Clean up old Redis keys (optional - only if aggregation was successful)
      if (errors.length === 0) {
        await this.cleanupOldKeys(dateStr);
      }

      console.log(
        `[UsageAggregationJob] Completed. Records aggregated: ${recordsAggregated}, Errors: ${errors.length}`
      );

      return {
        success: errors.length === 0,
        recordsAggregated,
        errors,
      };
    } catch (error: any) {
      console.error(`[UsageAggregationJob] Fatal error:`, error);
      return {
        success: false,
        recordsAggregated,
        errors: [error.message],
      };
    }
  }

  /**
   * Scan Redis for all usage keys matching the pattern for a specific date
   * Pattern: usage:{merchantId}:{date}:{metricType}
   */
  private async scanUsageKeys(dateStr: string): Promise<string[]> {
    try {
      // Use Redis SCAN to find all keys matching the pattern
      // Pattern: usage:*:{date}:*
      const pattern = `mindsdb-rag:usage:*:${dateStr}:*`;
      
      // Note: In production, you'd want to use SCAN with cursor for large datasets
      // For now, using a simpler approach
      const keys: string[] = [];
      
      // Get all keys matching the pattern
      // This is a simplified version - in production, implement proper SCAN iteration
      const redisClient = (this.cacheService as any).redis;
      
      if (!redisClient || !redisClient.isOpen) {
        console.warn("[UsageAggregationJob] Redis not connected, skipping scan");
        return [];
      }

      // Use SCAN command with pattern
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      return keys;
    } catch (error: any) {
      console.error("[UsageAggregationJob] Error scanning Redis keys:", error);
      return [];
    }
  }

  /**
   * Aggregate a single usage key from Redis to PostgreSQL
   * @param key - Redis key in format: usage:{merchantId}:{date}:{metricType}
   * @param date - The date object for the aggregation
   */
  private async aggregateKey(key: string, date: Date): Promise<boolean> {
    try {
      // Parse the key to extract merchantId and metricType
      // Key format: mindsdb-rag:usage:{merchantId}:{date}:{metricType}
      const parts = key.split(":");
      
      if (parts.length < 5) {
        console.warn(`[UsageAggregationJob] Invalid key format: ${key}`);
        return false;
      }

      // Extract components (accounting for prefix)
      const merchantId = parts[2]; // usage:{merchantId}
      const metricType = parts[4]; // {metricType}

      // Get the value from Redis
      const value = await this.cacheService.getRaw(key);
      
      if (!value) {
        console.warn(`[UsageAggregationJob] No value found for key: ${key}`);
        return false;
      }

      const metricValue = parseInt(value, 10);
      
      if (isNaN(metricValue)) {
        console.warn(`[UsageAggregationJob] Invalid numeric value for key: ${key}`);
        return false;
      }

      // Upsert to database
      await this.usageRepository.upsert(
        merchantId,
        date,
        metricType,
        metricValue
      );

      console.log(
        `[UsageAggregationJob] Aggregated: ${merchantId} - ${metricType} = ${metricValue}`
      );

      return true;
    } catch (error: any) {
      console.error(`[UsageAggregationJob] Error aggregating key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old Redis keys after successful aggregation
   * Only deletes keys older than the retention period (7 days by default)
   */
  private async cleanupOldKeys(dateStr: string): Promise<void> {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only clean up keys older than 7 days (Redis TTL should handle this, but double-check)
      if (daysDiff > 7) {
        const pattern = `mindsdb-rag:usage:*:${dateStr}:*`;
        const redisClient = (this.cacheService as any).redis;
        
        if (!redisClient || !redisClient.isOpen) {
          return;
        }

        let cursor = 0;
        let deletedCount = 0;
        
        do {
          const result = await redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          
          cursor = result.cursor;
          
          if (result.keys.length > 0) {
            await redisClient.del(result.keys);
            deletedCount += result.keys.length;
          }
        } while (cursor !== 0);

        console.log(
          `[UsageAggregationJob] Cleaned up ${deletedCount} old Redis keys for ${dateStr}`
        );
      }
    } catch (error: any) {
      console.error("[UsageAggregationJob] Error cleaning up old keys:", error);
      // Don't throw - cleanup is not critical
    }
  }

  /**
   * Get yesterday's date (default aggregation target)
   */
  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }

  /**
   * Aggregate usage for a specific merchant and date
   * Useful for manual/on-demand aggregation
   */
  async aggregateMerchant(
    merchantId: string,
    date: Date
  ): Promise<{
    success: boolean;
    metricsAggregated: number;
    errors: string[];
  }> {
    const dateStr = date.toISOString().split("T")[0];
    console.log(
      `[UsageAggregationJob] Aggregating merchant ${merchantId} for ${dateStr}`
    );

    const errors: string[] = [];
    let metricsAggregated = 0;

    const metricTypes = ["queries", "documents", "api_calls", "storage_gb"];

    for (const metricType of metricTypes) {
      try {
        const key = `mindsdb-rag:usage:${merchantId}:${dateStr}:${metricType}`;
        const value = await this.cacheService.getRaw(key);

        if (value) {
          const metricValue = parseInt(value, 10);
          
          if (!isNaN(metricValue)) {
            await this.usageRepository.upsert(
              merchantId,
              date,
              metricType,
              metricValue
            );
            metricsAggregated++;
            console.log(
              `[UsageAggregationJob] Aggregated ${merchantId} - ${metricType} = ${metricValue}`
            );
          }
        }
      } catch (error: any) {
        const errorMsg = `Failed to aggregate ${metricType} for ${merchantId}: ${error.message}`;
        console.error(`[UsageAggregationJob] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      metricsAggregated,
      errors,
    };
  }

  /**
   * Aggregate usage for a date range
   * Useful for backfilling historical data
   */
  async aggregateDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<{
    success: boolean;
    daysProcessed: number;
    totalRecords: number;
    errors: string[];
  }> {
    console.log(
      `[UsageAggregationJob] Aggregating date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    const allErrors: string[] = [];
    let daysProcessed = 0;
    let totalRecords = 0;

    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const result = await this.run(new Date(currentDate));
      
      daysProcessed++;
      totalRecords += result.recordsAggregated;
      allErrors.push(...result.errors);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(
      `[UsageAggregationJob] Date range aggregation complete. Days: ${daysProcessed}, Records: ${totalRecords}, Errors: ${allErrors.length}`
    );

    return {
      success: allErrors.length === 0,
      daysProcessed,
      totalRecords,
      errors: allErrors,
    };
  }

  /**
   * Get aggregation status for a specific date
   * Checks if data has been aggregated to the database
   */
  async getAggregationStatus(date: Date): Promise<{
    date: string;
    isAggregated: boolean;
    merchantCount: number;
    totalRecords: number;
  }> {
    const dateStr = date.toISOString().split("T")[0];
    
    try {
      // Check if there are any records in the database for this date
      const records = await this.usageRepository.findByMerchantAndDate(
        "", // Empty string to get all merchants - this is a limitation of current API
        date
      );

      // Count unique merchants
      const uniqueMerchants = new Set(records.map((r) => r.merchantId));

      return {
        date: dateStr,
        isAggregated: records.length > 0,
        merchantCount: uniqueMerchants.size,
        totalRecords: records.length,
      };
    } catch (error: any) {
      console.error(
        `[UsageAggregationJob] Error checking aggregation status:`,
        error
      );
      return {
        date: dateStr,
        isAggregated: false,
        merchantCount: 0,
        totalRecords: 0,
      };
    }
  }
}

// Export singleton instance
let usageAggregationJobInstance: UsageAggregationJob | null = null;

export const getUsageAggregationJob = (): UsageAggregationJob => {
  if (!usageAggregationJobInstance) {
    usageAggregationJobInstance = new UsageAggregationJob();
  }
  return usageAggregationJobInstance;
};
