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
export declare class CacheService {
    private redis;
    private readonly keyPrefix;
    private readonly defaultTTL;
    constructor(cacheConfig: CacheConfig);
    /**
     * Ensure Redis connection is established
     */
    private ensureConnection;
    /**
     * Generate cache key with the required structure
     * Format: merchant:{merchant_id}:query_hash:{sha256(query+context)}
     */
    private generateCacheKey;
    /**
     * Generate prediction cache key
     */
    private generatePredictionKey;
    /**
     * Set cache entry with TTL
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Get cache entry
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Get cache entry with metadata
     */
    getWithMetadata<T>(key: string): Promise<CacheEntry<T> | null>;
    /**
     * Cache document retrieval results
     */
    cacheRetrievalResults(merchantId: string, query: string, context: Record<string, any>, results: any[], ttl?: number): Promise<void>;
    /**
     * Get cached retrieval results
     */
    getCachedRetrievalResults(merchantId: string, query: string, context: Record<string, any>): Promise<any[] | null>;
    /**
     * Cache MindsDB prediction results
     */
    cachePredictionResults(merchantId: string, sku: string, userContext: Record<string, any>, predictions: any, ttl?: number): Promise<void>;
    /**
     * Get cached prediction results
     */
    getCachedPredictionResults(merchantId: string, sku: string, userContext: Record<string, any>): Promise<any | null>;
    /**
     * Implement stale-while-revalidate pattern
     */
    getWithStaleWhileRevalidate<T>(key: string, options: StaleWhileRevalidateOptions): Promise<T | null>;
    /**
     * Cache session data
     */
    cacheSessionData(sessionId: string, merchantId: string, sessionData: any, ttl?: number): Promise<void>;
    /**
     * Get cached session data
     */
    getCachedSessionData(sessionId: string, merchantId: string): Promise<any | null>;
    /**
     * Invalidate cache entries by pattern
     */
    invalidateByPattern(pattern: string): Promise<number>;
    /**
     * Invalidate all cache entries for a merchant
     */
    invalidateMerchantCache(merchantId: string): Promise<number>;
    /**
     * Get cache statistics
     */
    getCacheStats(): Promise<{
        totalKeys: number;
        memoryUsage: string;
        hitRate?: number;
        connections: number;
    }>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
    /**
     * Batch operations for better performance
     */
    mget<T>(keys: string[]): Promise<(T | null)[]>;
    /**
     * Batch set operations
     */
    mset<T>(entries: Array<{
        key: string;
        value: T;
        ttl?: number;
    }>): Promise<void>;
    /**
     * Delete a cache entry
     */
    delete(key: string): Promise<void>;
    /**
     * Delete multiple cache entries
     */
    deleteMultiple(keys: string[]): Promise<void>;
}
export declare const getCacheService: () => CacheService;
//# sourceMappingURL=CacheService.d.ts.map