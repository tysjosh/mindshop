import { createClient, RedisClientType } from "redis";
import { createHash } from "crypto";
import { config } from "../config";

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
  keyPrefix?: string;
  defaultTTL?: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  version?: string;
}

export interface StaleWhileRevalidateOptions {
  staleTTL: number;
  gracePeriod: number;
  revalidateCallback?: () => Promise<any>;
}

/**
 * Redis-based caching service with stale-while-revalidate pattern
 * Implements the cache key structure: merchant:{merchant_id}:query_hash:{sha256(query+context)}
 */
export class CacheService {
  private redis: RedisClientType;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(cacheConfig: CacheConfig) {
    this.keyPrefix = cacheConfig.keyPrefix || "mindsdb-rag";
    this.defaultTTL = cacheConfig.defaultTTL || 3600; // 1 hour default

    this.redis = createClient({
      socket: {
        host: cacheConfig.host,
        port: cacheConfig.port,
        tls: cacheConfig.tls || false,
        connectTimeout: 5000, // Reduced timeout
      },
      password: cacheConfig.password,
    });

    this.redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    this.redis.on("connect", () => {
      console.log("Redis connected successfully");
    });

    // Don't connect immediately - connect lazily when needed
  }

  /**
   * Ensure Redis connection is established
   */
  private async ensureConnection(): Promise<boolean> {
    try {
      if (!this.redis.isOpen) {
        await Promise.race([
          this.redis.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
          )
        ]);
      }
      return true;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      return false;
    }
  }

  /**
   * Generate cache key with the required structure
   * Format: merchant:{merchant_id}:query_hash:{sha256(query+context)}
   */
  private generateCacheKey(
    merchantId: string,
    query: string,
    context?: Record<string, any>,
    keyType: string = "query"
  ): string {
    const contextStr = context ? JSON.stringify(context) : "";
    const combinedInput = `${query}${contextStr}`;
    const queryHash = createHash("sha256").update(combinedInput).digest("hex");

    return `${this.keyPrefix}:merchant:${merchantId}:${keyType}:${queryHash}`;
  }

  /**
   * Generate prediction cache key
   */
  private generatePredictionKey(
    merchantId: string,
    sku: string,
    userContext?: Record<string, any>
  ): string {
    const contextStr = userContext ? JSON.stringify(userContext) : "";
    const contextHash = createHash("sha256").update(contextStr).digest("hex");

    return `${this.keyPrefix}:merchant:${merchantId}:prediction:${sku}:${contextHash}`;
  }

  /**
   * Set cache entry with TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.warn("Redis not available, skipping cache set");
        return;
      }

      const cacheEntry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        version: "1.0",
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheEntry));
    } catch (error) {
      console.error("Cache set error:", error);
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get cache entry
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.warn("Redis not available, skipping cache get");
        return null;
      }

      const cached = await this.redis.get(key);
      if (!cached) return null;

      const cacheEntry: CacheEntry<T> = JSON.parse(cached);
      return cacheEntry.data;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * Get cache entry with metadata
   */
  async getWithMetadata<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as CacheEntry<T>;
    } catch (error) {
      console.error("Cache get with metadata error:", error);
      return null;
    }
  }

  /**
   * Cache document retrieval results
   */
  async cacheRetrievalResults(
    merchantId: string,
    query: string,
    context: Record<string, any>,
    results: any[],
    ttl: number = 1800 // 30 minutes for retrieval results
  ): Promise<void> {
    const key = this.generateCacheKey(merchantId, query, context, "retrieval");
    await this.set(key, results, ttl);
  }

  /**
   * Get cached retrieval results
   */
  async getCachedRetrievalResults(
    merchantId: string,
    query: string,
    context: Record<string, any>
  ): Promise<any[] | null> {
    const key = this.generateCacheKey(merchantId, query, context, "retrieval");
    return this.get<any[]>(key);
  }

  /**
   * Cache MindsDB prediction results
   */
  async cachePredictionResults(
    merchantId: string,
    sku: string,
    userContext: Record<string, any>,
    predictions: any,
    ttl: number = 3600 // 1 hour for predictions
  ): Promise<void> {
    const key = this.generatePredictionKey(merchantId, sku, userContext);
    await this.set(key, predictions, ttl);
  }

  /**
   * Get cached prediction results
   */
  async getCachedPredictionResults(
    merchantId: string,
    sku: string,
    userContext: Record<string, any>
  ): Promise<any | null> {
    const key = this.generatePredictionKey(merchantId, sku, userContext);
    return this.get<any>(key);
  }

  /**
   * Implement stale-while-revalidate pattern
   */
  async getWithStaleWhileRevalidate<T>(
    key: string,
    options: StaleWhileRevalidateOptions
  ): Promise<T | null> {
    try {
      const cacheEntry = await this.getWithMetadata<T>(key);

      if (!cacheEntry) {
        return null;
      }

      const age = Date.now() - cacheEntry.timestamp;
      const isStale = age > cacheEntry.ttl * 1000 - options.gracePeriod * 1000;

      // If data is stale but within grace period, trigger background revalidation
      if (isStale && options.revalidateCallback) {
        // Fire and forget - don't await
        options
          .revalidateCallback()
          .then((newData) => {
            if (newData) {
              this.set(key, newData, options.staleTTL);
            }
          })
          .catch((error) => {
            console.error("Background revalidation failed:", error);
          });
      }

      return cacheEntry.data;
    } catch (error) {
      console.error("Stale-while-revalidate error:", error);
      return null;
    }
  }

  /**
   * Cache session data
   */
  async cacheSessionData(
    sessionId: string,
    merchantId: string,
    sessionData: any,
    ttl: number = 86400 // 24 hours
  ): Promise<void> {
    const key = `${this.keyPrefix}:session:${merchantId}:${sessionId}`;
    await this.set(key, sessionData, ttl);
  }

  /**
   * Get cached session data
   */
  async getCachedSessionData(
    sessionId: string,
    merchantId: string
  ): Promise<any | null> {
    const key = `${this.keyPrefix}:session:${merchantId}:${sessionId}`;
    return this.get<any>(key);
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.redis.multi();
      keys.forEach((key) => pipeline.del(key));
      await pipeline.exec();

      return keys.length;
    } catch (error) {
      console.error("Cache invalidation error:", error);
      return 0;
    }
  }

  /**
   * Invalidate all cache entries for a merchant
   */
  async invalidateMerchantCache(merchantId: string): Promise<number> {
    const pattern = `${this.keyPrefix}:merchant:${merchantId}:*`;
    return this.invalidateByPattern(pattern);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
    connections: number;
  }> {
    try {
      const info = await this.redis.info("memory");
      const keyspace = await this.redis.info("keyspace");
      const stats = await this.redis.info("stats");

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "unknown";

      // Parse total keys
      const keyspaceMatch = keyspace.match(/keys=(\d+)/);
      const totalKeys = keyspaceMatch ? parseInt(keyspaceMatch[1]) : 0;

      // Parse hit rate
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      let hitRate: number | undefined;

      if (hitsMatch && missesMatch) {
        const hits = parseInt(hitsMatch[1]);
        const misses = parseInt(missesMatch[1]);
        const total = hits + misses;
        hitRate = total > 0 ? (hits / total) * 100 : 0;
      }

      return {
        totalKeys,
        memoryUsage,
        hitRate,
        connections: 1, // Current connection
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return {
        totalKeys: 0,
        memoryUsage: "unknown",
        connections: 0,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch (error) {
      console.error("Redis health check failed:", error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.disconnect();
  }

  /**
   * Batch operations for better performance
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];

      const results = await this.redis.mGet(keys);
      return results.map((result) => {
        if (!result) return null;
        try {
          const cacheEntry: CacheEntry<T> = JSON.parse(result);
          return cacheEntry.data;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set operations
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    try {
      if (entries.length === 0) return;

      const pipeline = this.redis.multi();

      entries.forEach(({ key, value, ttl = this.defaultTTL }) => {
        const cacheEntry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl,
          version: "1.0",
        };
        pipeline.setEx(key, ttl, JSON.stringify(cacheEntry));
      });

      await pipeline.exec();
    } catch (error) {
      console.error("Cache mset error:", error);
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  /**
   * Delete multiple cache entries
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      if (keys.length === 0) return;
      await this.redis.del(keys);
    } catch (error) {
      console.error("Cache delete multiple error:", error);
    }
  }

  /**
   * Increment a numeric value in Redis atomically
   * Returns the new value after increment
   */
  async incrby(key: string, increment: number = 1): Promise<number> {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.warn("Redis not available, skipping increment");
        return 0;
      }

      return await this.redis.incrBy(key, increment);
    } catch (error) {
      console.error("Cache incrby error:", error);
      return 0;
    }
  }

  /**
   * Set expiration time on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.warn("Redis not available, skipping expire");
        return false;
      }

      return await this.redis.expire(key, seconds);
    } catch (error) {
      console.error("Cache expire error:", error);
      return false;
    }
  }

  /**
   * Get a raw numeric value from Redis (without JSON parsing)
   */
  async getRaw(key: string): Promise<string | null> {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.warn("Redis not available, skipping get raw");
        return null;
      }

      return await this.redis.get(key);
    } catch (error) {
      console.error("Cache get raw error:", error);
      return null;
    }
  }
}

// Export singleton instance
let cacheServiceInstance: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheServiceInstance) {
    const cacheConfig: CacheConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      tls: config.redis.tls,
      keyPrefix: "mindsdb-rag",
      defaultTTL: 3600,
    };

    cacheServiceInstance = new CacheService(cacheConfig);
  }

  return cacheServiceInstance;
};
