import { CacheService } from './CacheService';
import { AnalyticsService } from './AnalyticsService';
import { config } from '../config';

/**
 * Cache Warming Service
 * Pre-loads frequently accessed data into cache to improve response times
 */
export class CacheWarmingService {
  private cacheService: CacheService;
  private analyticsService: AnalyticsService;
  private warmingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cacheService = new CacheService({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      keyPrefix: 'cache-warming',
      defaultTTL: 3600, // 1 hour
    });
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Start cache warming process
   * Runs periodically to keep hot data in cache
   */
  start(intervalMinutes: number = 15): void {
    console.log(`Starting cache warming service (interval: ${intervalMinutes} minutes)`);

    // Run immediately
    this.warmCache().catch((error) => {
      console.error('Error during initial cache warming:', error);
    });

    // Schedule periodic warming
    this.warmingInterval = setInterval(() => {
      this.warmCache().catch((error) => {
        console.error('Error during cache warming:', error);
      });
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop cache warming process
   */
  stop(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      console.log('Cache warming service stopped');
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  private async warmCache(): Promise<void> {
    console.log('Starting cache warming...');
    const startTime = Date.now();

    try {
      // Get list of active merchants (top 100 by activity)
      const activeMerchants = await this.getActiveMerchants();

      // Warm cache for each merchant
      const warmingPromises = activeMerchants.map((merchantId) =>
        this.warmMerchantCache(merchantId)
      );

      await Promise.allSettled(warmingPromises);

      const duration = Date.now() - startTime;
      console.log(`Cache warming completed in ${duration}ms for ${activeMerchants.length} merchants`);
    } catch (error) {
      console.error('Error during cache warming:', error);
    }
  }

  /**
   * Warm cache for a specific merchant
   */
  private async warmMerchantCache(merchantId: string): Promise<void> {
    try {
      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Pre-load analytics overview
      await this.analyticsService.getOverview(merchantId, startDate, endDate);

      // Pre-load top queries
      await this.analyticsService.getTopQueries(merchantId, startDate, endDate, 20);

      // Pre-load performance metrics
      await this.analyticsService.getPerformanceMetrics(merchantId, startDate, endDate);

      console.log(`Cache warmed for merchant: ${merchantId}`);
    } catch (error) {
      console.error(`Error warming cache for merchant ${merchantId}:`, error);
    }
  }

  /**
   * Get list of active merchants
   * In production, this would query the database for merchants with recent activity
   */
  private async getActiveMerchants(): Promise<string[]> {
    // Placeholder implementation
    // In production, query database for merchants with activity in last 24 hours
    const cacheKey = 'active-merchants-list';

    try {
      const cached = await this.cacheService.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Failed to get cached active merchants list:', error);
    }

    // Mock data for now - in production, query from database
    const activeMerchants = [
      'acme_electronics_2024',
      'fashion_boutique_2024',
      'tech_gadgets_2024',
    ];

    // Cache the list for 5 minutes
    try {
      await this.cacheService.set(cacheKey, activeMerchants, 300);
    } catch (error) {
      console.warn('Failed to cache active merchants list:', error);
    }

    return activeMerchants;
  }

  /**
   * Manually warm cache for a specific merchant
   */
  async warmMerchantCacheManually(merchantId: string): Promise<void> {
    console.log(`Manually warming cache for merchant: ${merchantId}`);
    await this.warmMerchantCache(merchantId);
  }

  /**
   * Clear all warmed cache
   */
  async clearWarmedCache(): Promise<void> {
    console.log('Clearing all warmed cache...');
    // Implementation would clear all cache keys with 'cache-warming' prefix
    // This is a placeholder
  }
}

// Singleton instance
let cacheWarmingService: CacheWarmingService | null = null;

/**
 * Get cache warming service instance
 */
export function getCacheWarmingService(): CacheWarmingService {
  if (!cacheWarmingService) {
    cacheWarmingService = new CacheWarmingService();
  }
  return cacheWarmingService;
}
