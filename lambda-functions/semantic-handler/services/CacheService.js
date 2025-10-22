"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheService = exports.CacheService = void 0;
const redis_1 = require("redis");
const crypto_1 = require("crypto");
const config_1 = require("../config");
/**
 * Redis-based caching service with stale-while-revalidate pattern
 * Implements the cache key structure: merchant:{merchant_id}:query_hash:{sha256(query+context)}
 */
class CacheService {
    constructor(cacheConfig) {
        this.keyPrefix = cacheConfig.keyPrefix || "mindsdb-rag";
        this.defaultTTL = cacheConfig.defaultTTL || 3600; // 1 hour default
        this.redis = (0, redis_1.createClient)({
            socket: {
                host: cacheConfig.host,
                port: cacheConfig.port,
                tls: cacheConfig.tls || false,
                connectTimeout: 10000,
            },
            password: cacheConfig.password,
        });
        this.redis.on("error", (error) => {
            console.error("Redis connection error:", error);
        });
        this.redis.on("connect", () => {
            console.log("Redis connected successfully");
        });
        // Connect to Redis
        this.redis.connect().catch((error) => {
            console.error("Failed to connect to Redis:", error);
        });
    }
    /**
     * Generate cache key with the required structure
     * Format: merchant:{merchant_id}:query_hash:{sha256(query+context)}
     */
    generateCacheKey(merchantId, query, context, keyType = "query") {
        const contextStr = context ? JSON.stringify(context) : "";
        const combinedInput = `${query}${contextStr}`;
        const queryHash = (0, crypto_1.createHash)("sha256").update(combinedInput).digest("hex");
        return `${this.keyPrefix}:merchant:${merchantId}:${keyType}:${queryHash}`;
    }
    /**
     * Generate prediction cache key
     */
    generatePredictionKey(merchantId, sku, userContext) {
        const contextStr = userContext ? JSON.stringify(userContext) : "";
        const contextHash = (0, crypto_1.createHash)("sha256").update(contextStr).digest("hex");
        return `${this.keyPrefix}:merchant:${merchantId}:prediction:${sku}:${contextHash}`;
    }
    /**
     * Set cache entry with TTL
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const cacheEntry = {
                data: value,
                timestamp: Date.now(),
                ttl,
                version: "1.0",
            };
            await this.redis.setEx(key, ttl, JSON.stringify(cacheEntry));
        }
        catch (error) {
            console.error("Cache set error:", error);
            // Don't throw - cache failures shouldn't break the application
        }
    }
    /**
     * Get cache entry
     */
    async get(key) {
        try {
            const cached = await this.redis.get(key);
            if (!cached)
                return null;
            const cacheEntry = JSON.parse(cached);
            return cacheEntry.data;
        }
        catch (error) {
            console.error("Cache get error:", error);
            return null;
        }
    }
    /**
     * Get cache entry with metadata
     */
    async getWithMetadata(key) {
        try {
            const cached = await this.redis.get(key);
            if (!cached)
                return null;
            return JSON.parse(cached);
        }
        catch (error) {
            console.error("Cache get with metadata error:", error);
            return null;
        }
    }
    /**
     * Cache document retrieval results
     */
    async cacheRetrievalResults(merchantId, query, context, results, ttl = 1800 // 30 minutes for retrieval results
    ) {
        const key = this.generateCacheKey(merchantId, query, context, "retrieval");
        await this.set(key, results, ttl);
    }
    /**
     * Get cached retrieval results
     */
    async getCachedRetrievalResults(merchantId, query, context) {
        const key = this.generateCacheKey(merchantId, query, context, "retrieval");
        return this.get(key);
    }
    /**
     * Cache MindsDB prediction results
     */
    async cachePredictionResults(merchantId, sku, userContext, predictions, ttl = 3600 // 1 hour for predictions
    ) {
        const key = this.generatePredictionKey(merchantId, sku, userContext);
        await this.set(key, predictions, ttl);
    }
    /**
     * Get cached prediction results
     */
    async getCachedPredictionResults(merchantId, sku, userContext) {
        const key = this.generatePredictionKey(merchantId, sku, userContext);
        return this.get(key);
    }
    /**
     * Implement stale-while-revalidate pattern
     */
    async getWithStaleWhileRevalidate(key, options) {
        try {
            const cacheEntry = await this.getWithMetadata(key);
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
        }
        catch (error) {
            console.error("Stale-while-revalidate error:", error);
            return null;
        }
    }
    /**
     * Cache session data
     */
    async cacheSessionData(sessionId, merchantId, sessionData, ttl = 86400 // 24 hours
    ) {
        const key = `${this.keyPrefix}:session:${merchantId}:${sessionId}`;
        await this.set(key, sessionData, ttl);
    }
    /**
     * Get cached session data
     */
    async getCachedSessionData(sessionId, merchantId) {
        const key = `${this.keyPrefix}:session:${merchantId}:${sessionId}`;
        return this.get(key);
    }
    /**
     * Invalidate cache entries by pattern
     */
    async invalidateByPattern(pattern) {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length === 0)
                return 0;
            const pipeline = this.redis.multi();
            keys.forEach((key) => pipeline.del(key));
            await pipeline.exec();
            return keys.length;
        }
        catch (error) {
            console.error("Cache invalidation error:", error);
            return 0;
        }
    }
    /**
     * Invalidate all cache entries for a merchant
     */
    async invalidateMerchantCache(merchantId) {
        const pattern = `${this.keyPrefix}:merchant:${merchantId}:*`;
        return this.invalidateByPattern(pattern);
    }
    /**
     * Get cache statistics
     */
    async getCacheStats() {
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
            let hitRate;
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
        }
        catch (error) {
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
    async healthCheck() {
        try {
            const result = await this.redis.ping();
            return result === "PONG";
        }
        catch (error) {
            console.error("Redis health check failed:", error);
            return false;
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.redis.disconnect();
    }
    /**
     * Batch operations for better performance
     */
    async mget(keys) {
        try {
            if (keys.length === 0)
                return [];
            const results = await this.redis.mGet(keys);
            return results.map((result) => {
                if (!result)
                    return null;
                try {
                    const cacheEntry = JSON.parse(result);
                    return cacheEntry.data;
                }
                catch {
                    return null;
                }
            });
        }
        catch (error) {
            console.error("Cache mget error:", error);
            return keys.map(() => null);
        }
    }
    /**
     * Batch set operations
     */
    async mset(entries) {
        try {
            if (entries.length === 0)
                return;
            const pipeline = this.redis.multi();
            entries.forEach(({ key, value, ttl = this.defaultTTL }) => {
                const cacheEntry = {
                    data: value,
                    timestamp: Date.now(),
                    ttl,
                    version: "1.0",
                };
                pipeline.setEx(key, ttl, JSON.stringify(cacheEntry));
            });
            await pipeline.exec();
        }
        catch (error) {
            console.error("Cache mset error:", error);
        }
    }
    /**
     * Delete a cache entry
     */
    async delete(key) {
        try {
            await this.redis.del(key);
        }
        catch (error) {
            console.error("Cache delete error:", error);
        }
    }
    /**
     * Delete multiple cache entries
     */
    async deleteMultiple(keys) {
        try {
            if (keys.length === 0)
                return;
            await this.redis.del(keys);
        }
        catch (error) {
            console.error("Cache delete multiple error:", error);
        }
    }
}
exports.CacheService = CacheService;
// Export singleton instance
let cacheServiceInstance = null;
const getCacheService = () => {
    if (!cacheServiceInstance) {
        const cacheConfig = {
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password,
            tls: config_1.config.redis.tls,
            keyPrefix: "mindsdb-rag",
            defaultTTL: 3600,
        };
        cacheServiceInstance = new CacheService(cacheConfig);
    }
    return cacheServiceInstance;
};
exports.getCacheService = getCacheService;
