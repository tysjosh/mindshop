# Performance Optimization Guide

## Overview

This document describes the performance optimizations implemented in the Merchant Platform to ensure production-ready performance, scalability, and reliability.

## Implemented Optimizations

### 1. HTTP Response Optimization

#### ETag Support
- **What**: Generates ETags for GET requests to enable conditional requests
- **Benefit**: Reduces bandwidth by returning 304 Not Modified for unchanged resources
- **Implementation**: `src/api/middleware/performanceOptimization.ts`
- **Usage**: Automatic for all GET requests

#### Cache-Control Headers
- **What**: Sets appropriate Cache-Control headers based on resource type
- **Benefit**: Improves client-side caching and reduces server load
- **Configuration**:
  - Analytics/Usage data: 5 minutes
  - Documents (GET): 1 hour
  - Sensitive data (API keys, merchants): No cache
  - Default: 1 minute

#### Response Compression
- **What**: Optimized gzip compression for responses
- **Benefit**: Reduces bandwidth usage by 60-80%
- **Configuration**:
  - Threshold: 1KB (only compress responses larger than 1KB)
  - Level: 6 (balanced compression ratio and speed)
  - Automatic content-type filtering

### 2. Request/Response Management

#### Response Time Tracking
- **What**: Tracks and logs response times for all requests
- **Benefit**: Identifies slow endpoints for optimization
- **Headers**: `X-Response-Time` header added to all responses
- **Alerting**: Logs warning for requests > 1 second

#### Request Timeouts
- **What**: Enforces 30-second timeout for requests and responses
- **Benefit**: Prevents resource exhaustion from hanging requests
- **Configuration**: Configurable timeout (default: 30 seconds)

#### Response Size Limiting
- **What**: Limits maximum response size to 10MB
- **Benefit**: Prevents memory issues from extremely large responses
- **Configuration**: Configurable limit (default: 10MB)

#### Pagination Helper
- **What**: Automatically parses and validates pagination parameters
- **Benefit**: Standardizes pagination across all endpoints
- **Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
  - `offset`: Calculated automatically

### 3. Database Optimization

#### Connection Pooling
- **File**: `src/database/connectionPool.ts`
- **Configuration by Environment**:

**Production:**
```typescript
{
  max: 20,              // Maximum connections
  min: 5,               // Minimum connections (kept warm)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statementTimeout: 30000,
  keepAlive: true
}
```

**Development:**
```typescript
{
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statementTimeout: 30000,
  keepAlive: true
}
```

#### Query Optimization Service
- **File**: `src/services/QueryOptimizationService.ts`
- **Features**:
  - Analyze query performance with EXPLAIN ANALYZE
  - Identify slow queries
  - Track index usage
  - Find unused indexes
  - Monitor cache hit ratio
  - Track connection statistics
  - Generate performance reports

#### Database Indexes
- **File**: `database/migrations/007_merchant_platform_indexes.sql`
- **Indexes Created**:
  - Primary lookup indexes (merchant_id, email, key_hash)
  - Composite indexes for common query patterns
  - GIN indexes for JSONB columns
  - Partial indexes for filtered queries
  - Temporal indexes for analytics

### 4. Caching Strategy

#### Redis Caching
- **Implementation**: All services use CacheService with Redis backend
- **TTL Strategy**:
  - Analytics data: 5 minutes
  - Usage data: 5 minutes (real-time tracking)
  - Document data: 1 hour
  - Active merchants list: 5 minutes

#### Cache Warming
- **File**: `src/services/CacheWarmingService.ts`
- **What**: Pre-loads frequently accessed data into cache
- **Schedule**: Runs every 15 minutes
- **Data Warmed**:
  - Analytics overview for active merchants
  - Top queries
  - Performance metrics
- **Benefit**: Reduces cache misses and improves response times

### 5. Memory Management

#### Memory Monitoring
- **What**: Tracks heap usage and logs warnings
- **Threshold**: Warns when heap usage > 80%
- **Headers**: `X-Memory-Usage` header in responses (production only)
- **Benefit**: Early detection of memory leaks

#### Garbage Collection
- **Recommendation**: Use Node.js with `--max-old-space-size=4096` for production
- **Monitoring**: Track memory usage via `/api/performance/system/memory`

### 6. Performance Monitoring Endpoints

All endpoints require authentication and are admin-only.

#### Database Performance
```
GET /api/performance/database/report
GET /api/performance/database/slow-queries?limit=10
GET /api/performance/database/cache-hit-ratio
GET /api/performance/database/connections
GET /api/performance/database/table/:tableName/stats
GET /api/performance/database/table/:tableName/indexes
GET /api/performance/database/unused-indexes
POST /api/performance/database/table/:tableName/vacuum
```

#### Cache Management
```
POST /api/performance/cache/warm/:merchantId
```

#### System Metrics
```
GET /api/performance/system/memory
GET /api/performance/system/uptime
```

## Configuration

### Environment Variables

```bash
# Performance Optimization
ENABLE_PERFORMANCE_OPTIMIZATION=true  # Enable performance services (default: true)

# Database Connection Pool
DB_POOL_MAX=20                        # Max connections (production: 20, dev: 10)
DB_POOL_MIN=5                         # Min connections (production: 5, dev: 2)

# Cache Warming
CACHE_WARMING_INTERVAL=15             # Minutes between cache warming (default: 15)

# Response Limits
MAX_RESPONSE_SIZE=10485760            # 10MB in bytes
REQUEST_TIMEOUT=30000                 # 30 seconds in milliseconds

# Memory Monitoring
ENABLE_MEMORY_MONITORING=true         # Enable in production only
```

## Performance Targets

### Response Times (p95)
- Chat queries: < 500ms
- Document search: < 300ms
- Analytics queries: < 1000ms
- API key operations: < 200ms

### Throughput
- Chat: 1000 requests/minute
- Documents: 500 requests/minute
- Analytics: 200 requests/minute

### Resource Usage
- Memory: < 2GB per instance
- CPU: < 70% average
- Database connections: < 80% of pool

### Cache Performance
- Cache hit ratio: > 80%
- Redis latency: < 5ms

## Monitoring

### Key Metrics to Track

1. **Response Times**
   - Track via `X-Response-Time` header
   - Alert on p95 > 1 second

2. **Database Performance**
   - Cache hit ratio (target: > 90%)
   - Connection pool usage (target: < 80%)
   - Slow queries (alert on queries > 1 second)

3. **Memory Usage**
   - Heap usage (alert on > 80%)
   - Memory leaks (track over time)

4. **Cache Performance**
   - Hit rate (target: > 80%)
   - Miss rate
   - Eviction rate

### Recommended Tools

- **APM**: New Relic, Datadog, or AWS X-Ray
- **Database**: pg_stat_statements, pgBadger
- **Caching**: Redis INFO command, RedisInsight
- **Logs**: CloudWatch Logs, ELK Stack

## Optimization Checklist

### Before Deployment

- [ ] Enable connection pooling with appropriate limits
- [ ] Configure cache warming for active merchants
- [ ] Set up database indexes (run migrations)
- [ ] Enable response compression
- [ ] Configure appropriate cache TTLs
- [ ] Set up performance monitoring endpoints
- [ ] Configure memory limits for Node.js
- [ ] Enable graceful shutdown handlers

### After Deployment

- [ ] Monitor response times
- [ ] Check database cache hit ratio (target: > 90%)
- [ ] Verify connection pool usage (target: < 80%)
- [ ] Review slow query logs
- [ ] Check for unused indexes
- [ ] Monitor memory usage trends
- [ ] Verify cache warming is running
- [ ] Test ETag functionality

### Regular Maintenance

- [ ] Weekly: Review slow queries and optimize
- [ ] Weekly: Check for unused indexes
- [ ] Monthly: Run VACUUM ANALYZE on large tables
- [ ] Monthly: Review and adjust cache TTLs
- [ ] Quarterly: Review and optimize database indexes
- [ ] Quarterly: Load test and adjust connection pool

## Troubleshooting

### High Response Times

1. Check slow queries: `GET /api/performance/database/slow-queries`
2. Check cache hit ratio: `GET /api/performance/database/cache-hit-ratio`
3. Check connection pool: `GET /api/performance/database/connections`
4. Review application logs for slow endpoints

### High Memory Usage

1. Check memory stats: `GET /api/performance/system/memory`
2. Review heap snapshots for memory leaks
3. Check for large response payloads
4. Verify cache eviction is working

### Database Performance Issues

1. Check cache hit ratio (should be > 90%)
2. Review slow queries
3. Check for missing indexes
4. Run VACUUM ANALYZE on large tables
5. Check connection pool saturation

### Cache Issues

1. Verify Redis is running and accessible
2. Check cache warming service is running
3. Review cache TTLs
4. Check for cache key collisions

## Best Practices

1. **Always use pagination** for list endpoints
2. **Set appropriate cache TTLs** based on data freshness requirements
3. **Monitor slow queries** and add indexes as needed
4. **Use connection pooling** with appropriate limits
5. **Enable compression** for all responses
6. **Implement ETag support** for cacheable resources
7. **Set request timeouts** to prevent hanging requests
8. **Monitor memory usage** and set appropriate limits
9. **Use cache warming** for frequently accessed data
10. **Regular maintenance** - VACUUM, index optimization, query review

## Performance Testing

### Load Testing

Use the provided load testing script:

```bash
npm run test:load
```

### Benchmarking

```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/chat"

# Test with ETag
curl -I "http://localhost:3000/api/analytics/overview?merchantId=test"
curl -H "If-None-Match: <etag>" "http://localhost:3000/api/analytics/overview?merchantId=test"
```

### Database Performance

```bash
# Check slow queries
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/performance/database/slow-queries"

# Check cache hit ratio
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/performance/database/cache-hit-ratio"
```

## Additional Resources

- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Redis Best Practices](https://redis.io/topics/optimization)
- [Express.js Performance Tips](https://expressjs.com/en/advanced/best-practice-performance.html)
