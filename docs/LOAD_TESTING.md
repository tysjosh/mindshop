# Load Testing Guide

## Overview

This document describes the load testing infrastructure for the Merchant Platform, designed to validate system performance under high concurrent user loads (up to 1000 concurrent users).

## Load Testing Tools

### 1. Standalone Load Test Script

**Location:** `scripts/load-test.ts`

A standalone TypeScript script that simulates concurrent users making requests to the API.

**Features:**
- Configurable concurrent users (default: 100, target: 1000)
- Ramp-up period to gradually increase load
- Realistic user session simulation
- Detailed performance metrics (latency, throughput, error rates)
- SLA validation against performance targets

**Usage:**

```bash
# Run with default settings (100 users, 30 seconds)
npm run load-test

# Run with 1000 concurrent users for 60 seconds
npm run load-test:1k

# Run with 100 concurrent users for 30 seconds
npm run load-test:100

# Custom configuration
npm run load-test -- --users 500 --duration 45 --ramp-up 15 --url http://localhost:3000
```

**Command Line Options:**
- `--users, -u`: Number of concurrent users (default: 100)
- `--duration, -d`: Test duration in seconds (default: 30)
- `--ramp-up, -r`: Ramp-up period in seconds (default: 10)
- `--rps`: Target requests per second (default: 50)
- `--url`: API base URL (default: http://localhost:3000)

**Environment Variables:**
- `API_BASE_URL`: Base URL for the API (default: http://localhost:3000)
- `TEST_API_KEY`: API key for authentication (default: test-key)
- `TEST_MERCHANT_ID`: Merchant ID for testing (default: test-merchant)

### 2. Vitest Performance Tests

**Location:** `src/tests/performance-load.test.ts`

Comprehensive test suite using Vitest for automated performance testing.

**Test Categories:**
1. **Concurrent User Load Tests**
   - Simulates 100 concurrent users (scaled from 1k requirement)
   - Validates performance under sustained high request rates
   - Tests linear scaling with increasing user loads

2. **Cost and Resource Efficiency Tests**
   - Validates cost targets under load
   - Tests caching effectiveness
   - Measures resource optimization

3. **Failover and Recovery Tests**
   - Tests service degradation handling
   - Validates circuit breaker patterns
   - Ensures graceful recovery

4. **Performance Monitoring Tests**
   - Collects and validates performance metrics
   - Tests system health under load
   - Validates monitoring infrastructure

**Usage:**

```bash
# Run all performance tests
npm run test:performance

# Run with coverage
npm run test:coverage -- src/tests/performance-load.test.ts
```

## Performance Targets (SLA)

### Latency Targets
- **Average Latency:** < 300ms
- **P95 Latency:** < 450ms (1.5x average)
- **P99 Latency:** < 600ms (2x average)

### Reliability Targets
- **Success Rate:** > 99% (< 1% error rate)
- **Uptime:** 99.9%

### Throughput Targets
- **Concurrent Users:** 1000 users per merchant
- **Requests Per Second:** 50+ RPS sustained
- **Sessions Per Day:** 100,000+ per merchant

### Cost Targets
- **Cost Per Session:** < $0.05
- **Cost Per Request:** < $0.01
- **Cache Hit Rate:** > 70%

## Load Test Scenarios

### Scenario 1: Normal Load (Baseline)
```bash
npm run load-test -- --users 50 --duration 30
```
- **Purpose:** Establish baseline performance metrics
- **Expected:** All SLA targets met with margin

### Scenario 2: Peak Load (2x Normal)
```bash
npm run load-test -- --users 100 --duration 60
```
- **Purpose:** Test system under peak traffic
- **Expected:** SLA targets met, some degradation acceptable

### Scenario 3: Stress Test (5x Normal)
```bash
npm run load-test -- --users 250 --duration 60
```
- **Purpose:** Identify breaking points and bottlenecks
- **Expected:** Graceful degradation, no crashes

### Scenario 4: Target Load (1000 Users)
```bash
npm run load-test:1k
```
- **Purpose:** Validate production readiness
- **Expected:** Meet SLA targets at scale

### Scenario 5: Sustained Load
```bash
npm run load-test -- --users 100 --duration 300
```
- **Purpose:** Test system stability over time
- **Expected:** No memory leaks, consistent performance

## Interpreting Results

### Success Criteria

✅ **PASS** - All of the following:
- Average latency < 300ms
- P95 latency < 450ms
- Error rate < 1%
- Success rate > 99%

⚠️ **WARNING** - Any of the following:
- Average latency 300-500ms
- P95 latency 450-750ms
- Error rate 1-5%
- Success rate 95-99%

❌ **FAIL** - Any of the following:
- Average latency > 500ms
- P95 latency > 750ms
- Error rate > 5%
- Success rate < 95%

### Sample Output

```
📊 Load Test Results
════════════════════════════════════════════════════════════
Duration:              60.23s
Total Requests:        5,432
Successful:            5,378 (99.01%)
Failed:                54 (0.99%)

Latency:
  Average:             245.32ms
  P50:                 198.45ms
  P95:                 412.67ms
  P99:                 589.23ms
  Min:                 45.12ms
  Max:                 1,234.56ms

Throughput:            90.18 req/s
Error Rate:            0.99%
════════════════════════════════════════════════════════════

✅ SLA Validation
────────────────────────────────────────────────────────────
✓ Average latency 245.32ms <= 300ms target
✓ P95 latency 412.67ms <= 450ms target
✓ Error rate 0.99% <= 1% target
────────────────────────────────────────────────────────────
```

## Performance Optimization Tips

### 1. Database Optimization
- Add indexes on frequently queried columns
- Use connection pooling
- Implement query result caching
- Optimize N+1 queries

### 2. Caching Strategy
- Cache frequently accessed data (Redis)
- Implement cache warming
- Use appropriate TTL values
- Monitor cache hit rates

### 3. API Optimization
- Enable response compression
- Implement rate limiting
- Use CDN for static assets
- Optimize payload sizes

### 4. Infrastructure Scaling
- Horizontal scaling (add more instances)
- Auto-scaling based on metrics
- Load balancing across instances
- Database read replicas

### 5. Code Optimization
- Async/await for I/O operations
- Batch database operations
- Minimize external API calls
- Profile and optimize hot paths

## Monitoring During Load Tests

### Key Metrics to Monitor

1. **Application Metrics**
   - Request latency (avg, p95, p99)
   - Throughput (requests/second)
   - Error rate
   - Active connections

2. **System Metrics**
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network bandwidth

3. **Database Metrics**
   - Query execution time
   - Connection pool usage
   - Lock contention
   - Cache hit rate

4. **External Services**
   - AWS Bedrock latency
   - MindsDB response time
   - Redis latency
   - S3 operation time

### Monitoring Tools

- **CloudWatch:** AWS infrastructure metrics
- **Application Logs:** Winston logging
- **Database Logs:** PostgreSQL slow query log
- **APM Tools:** New Relic, Datadog (optional)

## Troubleshooting Common Issues

### High Latency

**Symptoms:** Average latency > 500ms

**Possible Causes:**
- Database query performance
- External API calls blocking
- Insufficient resources (CPU/Memory)
- Network latency

**Solutions:**
- Add database indexes
- Implement caching
- Optimize queries
- Scale infrastructure

### High Error Rate

**Symptoms:** Error rate > 5%

**Possible Causes:**
- Rate limiting triggered
- Database connection exhaustion
- Memory leaks
- Timeout issues

**Solutions:**
- Increase rate limits
- Increase connection pool size
- Fix memory leaks
- Adjust timeout values

### Low Throughput

**Symptoms:** RPS < 20

**Possible Causes:**
- Synchronous blocking operations
- Single-threaded bottlenecks
- Resource contention
- Network bandwidth limits

**Solutions:**
- Use async operations
- Implement worker threads
- Scale horizontally
- Optimize network usage

## CI/CD Integration

### Automated Load Testing

Add to your CI/CD pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run load-test:100
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: load-test-results
          path: load-test-results.json
```

### Performance Regression Detection

Track performance metrics over time:

```bash
# Store baseline metrics
npm run load-test -- --users 100 > baseline.txt

# Compare against baseline in CI
npm run load-test -- --users 100 > current.txt
./scripts/compare-performance.sh baseline.txt current.txt
```

## Best Practices

1. **Test in Production-Like Environment**
   - Use similar infrastructure
   - Same data volumes
   - Realistic network conditions

2. **Gradual Ramp-Up**
   - Start with low load
   - Gradually increase users
   - Monitor for issues

3. **Test Regularly**
   - Run load tests before releases
   - Schedule periodic tests
   - Test after infrastructure changes

4. **Document Results**
   - Keep historical metrics
   - Track performance trends
   - Document optimizations

5. **Test Different Scenarios**
   - Normal load
   - Peak load
   - Stress test
   - Sustained load
   - Spike test

## References

- [Performance Testing Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/test-at-production-scale.html)
- [Load Testing with Artillery](https://www.artillery.io/docs)
- [k6 Load Testing](https://k6.io/docs/)
- [Apache JMeter](https://jmeter.apache.org/)

## Support

For questions or issues with load testing:
- Check the troubleshooting section above
- Review application logs
- Contact the DevOps team
- Open a GitHub issue
