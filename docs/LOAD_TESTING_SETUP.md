# Load Testing Setup for Merchant Platform

## Quick Start

### Prerequisites

1. **Start the API server:**
   ```bash
   npm run dev
   # or
   npm run start
   ```

2. **Set environment variables:**
   ```bash
   export API_BASE_URL=http://localhost:3000
   export TEST_API_KEY=your-test-api-key
   export TEST_MERCHANT_ID=test-merchant
   ```

### Running Load Tests

#### Option 1: Standalone Load Test Script (Recommended)

**Quick test (5 users, 5 seconds):**
```bash
npm run load-test -- --users 5 --duration 5
```

**Standard test (100 users, 30 seconds):**
```bash
npm run load-test:100
```

**Full scale test (1000 users, 60 seconds):**
```bash
npm run load-test:1k
```

**Custom configuration:**
```bash
npm run load-test -- \
  --users 500 \
  --duration 45 \
  --ramp-up 15 \
  --rps 100 \
  --url http://localhost:3000
```

#### Option 2: Vitest Performance Tests

**Run all performance tests:**
```bash
npm run test:performance
```

**Note:** The Vitest tests require proper module resolution. If you encounter module errors, use the standalone script instead.

## Test Scenarios

### 1. Smoke Test (Quick Validation)
```bash
npm run load-test -- --users 10 --duration 10
```
- **Purpose:** Quick validation that system is working
- **Duration:** ~10 seconds
- **Expected:** All requests succeed

### 2. Baseline Test (Normal Load)
```bash
npm run load-test -- --users 50 --duration 30
```
- **Purpose:** Establish baseline performance metrics
- **Duration:** ~30 seconds
- **Expected:** < 300ms average latency, < 1% error rate

### 3. Peak Load Test (2x Normal)
```bash
npm run load-test:100
```
- **Purpose:** Test system under peak traffic
- **Duration:** ~30 seconds
- **Expected:** < 500ms average latency, < 5% error rate

### 4. Stress Test (5x Normal)
```bash
npm run load-test -- --users 250 --duration 60
```
- **Purpose:** Identify breaking points
- **Duration:** ~60 seconds
- **Expected:** Graceful degradation, no crashes

### 5. Production Scale Test (1000 Users)
```bash
npm run load-test:1k
```
- **Purpose:** Validate production readiness
- **Duration:** ~80 seconds (20s ramp-up + 60s test)
- **Expected:** Meet SLA targets at scale

### 6. Endurance Test (Sustained Load)
```bash
npm run load-test -- --users 100 --duration 300
```
- **Purpose:** Test system stability over time
- **Duration:** ~5 minutes
- **Expected:** No memory leaks, consistent performance

## Understanding Results

### Metrics Explained

**Total Requests:** Number of HTTP requests made during the test

**Successful/Failed:** Count and percentage of successful vs failed requests

**Latency Metrics:**
- **Average:** Mean response time across all requests
- **P50 (Median):** 50% of requests completed faster than this
- **P95:** 95% of requests completed faster than this
- **P99:** 99% of requests completed faster than this
- **Min/Max:** Fastest and slowest request times

**Throughput:** Requests per second (RPS) achieved

**Error Rate:** Percentage of failed requests

### SLA Targets

✅ **PASS:**
- Average latency < 300ms
- P95 latency < 450ms
- Error rate < 1%

⚠️ **WARNING:**
- Average latency 300-500ms
- P95 latency 450-750ms
- Error rate 1-5%

❌ **FAIL:**
- Average latency > 500ms
- P95 latency > 750ms
- Error rate > 5%

## Troubleshooting

### Issue: 100% Error Rate

**Cause:** API server not running or wrong URL

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/health

# Start the server
npm run dev

# Or specify correct URL
npm run load-test -- --url http://your-server:3000
```

### Issue: High Latency (> 1000ms)

**Possible Causes:**
- Database not optimized
- No caching enabled
- External services slow
- Insufficient resources

**Solutions:**
1. Check database indexes
2. Enable Redis caching
3. Monitor external API calls
4. Scale infrastructure

### Issue: Connection Errors

**Cause:** Too many concurrent connections

**Solution:**
```bash
# Reduce concurrent users
npm run load-test -- --users 50

# Increase connection pool size in config
# Edit .env:
DB_POOL_SIZE=50
```

### Issue: Memory Leaks

**Symptoms:** Performance degrades over time

**Solution:**
```bash
# Run endurance test to identify
npm run load-test -- --users 50 --duration 600

# Monitor memory usage
node --inspect src/index.ts
```

## Advanced Configuration

### Environment Variables

```bash
# API Configuration
export API_BASE_URL=http://localhost:3000
export TEST_API_KEY=pk_test_your_key_here
export TEST_MERCHANT_ID=merchant_123

# Database Configuration
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=mindsdb_rag
export DB_USERNAME=postgres
export DB_PASSWORD=postgres

# Redis Configuration
export REDIS_HOST=localhost
export REDIS_PORT=6379

# AWS Configuration (if testing with real services)
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

### Custom Test Scenarios

Create a custom test script:

```typescript
// scripts/custom-load-test.ts
import { LoadTester } from './load-test';

const config = {
  baseUrl: 'http://localhost:3000',
  concurrentUsers: 200,
  testDurationSeconds: 120,
  rampUpSeconds: 30,
  requestsPerSecond: 100
};

const tester = new LoadTester(config);
const results = await tester.runLoadTest();
tester.printResults(results);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start API server
        run: |
          npm run build
          npm start &
          sleep 10
      
      - name: Run load test
        run: npm run load-test:100
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-test-results.json
```

## Performance Benchmarks

### Expected Performance (Local Development)

| Metric | Target | Typical |
|--------|--------|---------|
| Average Latency | < 300ms | 150-250ms |
| P95 Latency | < 450ms | 300-400ms |
| P99 Latency | < 600ms | 450-550ms |
| Throughput | > 50 RPS | 80-120 RPS |
| Error Rate | < 1% | 0.1-0.5% |

### Expected Performance (Production)

| Metric | Target | Typical |
|--------|--------|---------|
| Average Latency | < 300ms | 100-200ms |
| P95 Latency | < 450ms | 200-350ms |
| P99 Latency | < 600ms | 350-500ms |
| Throughput | > 100 RPS | 150-250 RPS |
| Error Rate | < 0.1% | 0.01-0.05% |

## Next Steps

1. **Baseline Testing:** Run baseline tests to establish current performance
2. **Optimization:** Identify and fix bottlenecks
3. **Scale Testing:** Gradually increase load to find limits
4. **Production Testing:** Test in production-like environment
5. **Monitoring:** Set up continuous performance monitoring

## Resources

- [Main Load Testing Documentation](../LOAD_TESTING.md)
- [Performance Optimization Guide](./best-practices.md)
- [API Documentation](./api-reference.md)
- [Troubleshooting Guide](./troubleshooting.md)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review application logs: `docker-compose logs -f`
- Open a GitHub issue
- Contact the DevOps team
