# Load Testing Quick Reference

## Quick Commands

```bash
# Quick test (5 users, 5 seconds)
npm run load-test -- --users 5 --duration 5

# Standard test (100 users, 30 seconds)
npm run load-test:100

# Full scale test (1000 users, 60 seconds)
npm run load-test:1k

# Custom test
npm run load-test -- --users 500 --duration 45 --ramp-up 15
```

## Command Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--users` | `-u` | Number of concurrent users | 100 |
| `--duration` | `-d` | Test duration in seconds | 30 |
| `--ramp-up` | `-r` | Ramp-up period in seconds | 10 |
| `--rps` | - | Target requests per second | 50 |
| `--url` | - | API base URL | http://localhost:3000 |

## Environment Variables

```bash
export API_BASE_URL=http://localhost:3000
export TEST_API_KEY=your-test-api-key
export TEST_MERCHANT_ID=test-merchant
```

## SLA Targets

| Metric | Target | Warning | Fail |
|--------|--------|---------|------|
| Avg Latency | < 300ms | 300-500ms | > 500ms |
| P95 Latency | < 450ms | 450-750ms | > 750ms |
| Error Rate | < 1% | 1-5% | > 5% |
| Success Rate | > 99% | 95-99% | < 95% |

## Test Scenarios

| Scenario | Users | Duration | Purpose |
|----------|-------|----------|---------|
| Smoke | 10 | 10s | Quick validation |
| Baseline | 50 | 30s | Establish baseline |
| Peak | 100 | 60s | Peak traffic |
| Stress | 250 | 60s | Find limits |
| Scale | 1000 | 60s | Production ready |
| Endurance | 100 | 300s | Stability |

## Interpreting Results

### ✅ PASS
- Average latency < 300ms
- P95 latency < 450ms
- Error rate < 1%

### ⚠️ WARNING
- Average latency 300-500ms
- P95 latency 450-750ms
- Error rate 1-5%

### ❌ FAIL
- Average latency > 500ms
- P95 latency > 750ms
- Error rate > 5%

## Common Issues

### 100% Error Rate
```bash
# Check server is running
curl http://localhost:3000/health

# Start server
npm run dev
```

### High Latency
- Check database indexes
- Enable Redis caching
- Monitor external APIs
- Scale infrastructure

### Connection Errors
- Reduce concurrent users
- Increase connection pool
- Check rate limits

## Files

| File | Purpose |
|------|---------|
| `scripts/load-test.ts` | Main load test script |
| `docs/LOAD_TESTING.md` | Complete guide |
| `docs/merchant-platform/LOAD_TESTING_SETUP.md` | Setup guide |
| `docs/merchant-platform/LOAD_TESTING_SUMMARY.md` | Implementation summary |

## Support

- 📖 [Full Documentation](./LOAD_TESTING_SETUP.md)
- 🐛 [Troubleshooting](./troubleshooting.md)
- 💬 Open a GitHub issue
