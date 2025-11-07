# Performance Optimization Quick Reference

## Quick Start

### Enable Performance Optimizations

Add to `.env`:
```bash
ENABLE_PERFORMANCE_OPTIMIZATION=true
```

Restart the server - performance services will start automatically.

## Common Tasks

### Check Response Time
```bash
curl -I http://localhost:3000/api/chat
# Look for: X-Response-Time: 245ms
```

### Test ETag Support
```bash
# Get ETag
curl -I http://localhost:3000/api/analytics/overview?merchantId=test
# Returns: ETag: "abc123..."

# Use ETag (should return 304)
curl -H "If-None-Match: \"abc123...\"" \
  http://localhost:3000/api/analytics/overview?merchantId=test
```

### Monitor Database Performance
```bash
# Slow queries
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/database/slow-queries?limit=10

# Cache hit ratio (should be > 90%)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/database/cache-hit-ratio

# Connection pool usage
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/database/connections
```

### Check Memory Usage
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/system/memory
```

### Warm Cache Manually
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/cache/warm/merchant_id_123
```

### Run VACUUM on Table
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/database/table/documents/vacuum
```

## Configuration

### Connection Pool (Production)
```bash
DB_POOL_MAX=20
DB_POOL_MIN=5
```

### Cache Warming
```bash
CACHE_WARMING_INTERVAL=15  # minutes
```

### Timeouts
```bash
REQUEST_TIMEOUT=30000  # 30 seconds
```

## Performance Targets

| Metric | Target | Check |
|--------|--------|-------|
| Response time (p95) | < 500ms | `X-Response-Time` header |
| Cache hit ratio | > 80% | `/api/performance/database/cache-hit-ratio` |
| Memory usage | < 2GB | `/api/performance/system/memory` |
| DB connections | < 80% of pool | `/api/performance/database/connections` |

## Troubleshooting

### Slow Responses
1. Check slow queries: `/api/performance/database/slow-queries`
2. Check cache hit ratio: `/api/performance/database/cache-hit-ratio`
3. Check connection pool: `/api/performance/database/connections`

### High Memory
1. Check memory: `/api/performance/system/memory`
2. Look for large responses in logs
3. Check for memory leaks with heap snapshots

### Database Issues
1. Check cache hit ratio (should be > 90%)
2. Review slow queries
3. Check for missing indexes: `/api/performance/database/unused-indexes`
4. Run VACUUM ANALYZE on large tables

## Best Practices

✅ Always use pagination (`?page=1&limit=20`)
✅ Set appropriate cache TTLs
✅ Monitor slow queries weekly
✅ Run VACUUM ANALYZE monthly
✅ Keep connection pool < 80% usage
✅ Enable compression for all responses
✅ Use ETags for cacheable resources
✅ Set request timeouts
✅ Monitor memory usage

## Monitoring Checklist

Daily:
- [ ] Check response times
- [ ] Monitor error rates
- [ ] Check memory usage

Weekly:
- [ ] Review slow queries
- [ ] Check cache hit ratio
- [ ] Review connection pool usage

Monthly:
- [ ] Run VACUUM ANALYZE
- [ ] Review and optimize indexes
- [ ] Adjust cache TTLs if needed

## Quick Commands

```bash
# Start server with performance monitoring
npm start

# Check if performance services are running
curl http://localhost:3000/health

# Get full performance report
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/database/report

# Check system uptime
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/performance/system/uptime
```

## Environment Variables Reference

```bash
# Core
ENABLE_PERFORMANCE_OPTIMIZATION=true
NODE_ENV=production

# Database
DB_POOL_MAX=20
DB_POOL_MIN=5

# Cache
CACHE_WARMING_INTERVAL=15
REDIS_HOST=localhost
REDIS_PORT=6379

# Limits
MAX_RESPONSE_SIZE=10485760
REQUEST_TIMEOUT=30000

# Monitoring
ENABLE_MEMORY_MONITORING=true
ENABLE_METRICS=true
```

## Support

For detailed documentation, see:
- `docs/PERFORMANCE_OPTIMIZATION.md` - Full guide
- `docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md` - Implementation summary
