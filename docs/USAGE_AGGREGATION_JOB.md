# Usage Aggregation Background Job

## Overview

The Usage Aggregation Job is a background process that periodically moves usage data from Redis to PostgreSQL for long-term storage, analytics, and billing purposes.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Real-time Usage Tracking                  │
│                                                              │
│  API Request → UsageTrackingService → Redis (INCRBY)        │
│                                                              │
│  Key: usage:{merchantId}:{date}:{metricType}                │
│  Value: Atomic counter (incremented on each usage)          │
│  TTL: 7 days                                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Background Aggregation Job                  │
│                                                              │
│  1. Scan Redis for usage keys (SCAN with pattern)           │
│  2. Read counter values (GET)                                │
│  3. Upsert to PostgreSQL (INSERT ... ON CONFLICT UPDATE)    │
│  4. Clean up old keys (optional, after 7 days)              │
│                                                              │
│  Schedule: Hourly (configurable)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Storage                        │
│                                                              │
│  Table: merchant_usage                                       │
│  - merchantId, date, metricType, metricValue                │
│  - Used for: Analytics, Billing, Historical Reports         │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Files Created

1. **`src/jobs/UsageAggregationJob.ts`** - Main job implementation
   - `run(date?)` - Aggregate usage for a specific date
   - `aggregateMerchant(merchantId, date)` - Aggregate for a specific merchant
   - `aggregateDateRange(startDate, endDate)` - Backfill historical data
   - `getAggregationStatus(date)` - Check if data has been aggregated

2. **`src/jobs/scheduler.ts`** - Job scheduler and CLI
   - `JobScheduler` class for periodic execution
   - CLI interface for manual job execution
   - Integration with main application

3. **`src/jobs/README.md`** - Comprehensive documentation
   - Usage instructions
   - Deployment options
   - Troubleshooting guide

4. **`src/tests/usageAggregationJob.test.ts`** - Unit tests
   - Tests for merchant aggregation
   - Tests for error handling
   - Tests for status checking

### Integration Points

1. **Main Application** (`src/index.ts`)
   - Optional scheduler startup via `ENABLE_JOB_SCHEDULER` env var
   - Graceful shutdown handling
   - Configuration via environment variables

2. **Package Scripts** (`package.json`)
   - `npm run job:aggregate` - Run aggregation for yesterday
   - `npm run job:aggregate-date YYYY-MM-DD` - Run for specific date
   - `npm run job:aggregate-range START END` - Run for date range
   - `npm run job:aggregate-merchant ID [DATE]` - Run for specific merchant
   - `npm run job:status [DATE]` - Check aggregation status
   - `npm run job:scheduler` - Run standalone scheduler

3. **Environment Variables** (`.env.example`)
   - `ENABLE_JOB_SCHEDULER` - Enable/disable scheduler (default: false)
   - `USAGE_AGGREGATION_INTERVAL` - Interval in ms (default: 3600000 = 1 hour)
   - `ENABLE_USAGE_AGGREGATION` - Enable/disable aggregation (default: true)

## Usage

### Development

#### Run manually for testing:
```bash
# Aggregate yesterday's data
npm run job:aggregate

# Aggregate specific date
npm run job:aggregate-date 2025-11-01

# Check status
npm run job:status 2025-11-01
```

#### Enable in-process scheduler:
```bash
# Add to .env
ENABLE_JOB_SCHEDULER=true
USAGE_AGGREGATION_INTERVAL=60000  # 1 minute for testing

# Start application
npm run dev
```

### Production

#### Option 1: AWS Lambda + EventBridge (Recommended)

Create a Lambda function:
```typescript
// lambda/usageAggregationHandler.ts
import { getUsageAggregationJob } from '../src/jobs/UsageAggregationJob';

export const handler = async () => {
  const job = getUsageAggregationJob();
  const result = await job.run();
  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
  };
};
```

Configure EventBridge:
- Schedule: `cron(0 * * * ? *)` (every hour)
- Target: Lambda function

#### Option 2: Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: usage-aggregation
spec:
  schedule: "0 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: aggregation
            image: your-app:latest
            command: ["npm", "run", "job:aggregate"]
          restartPolicy: OnFailure
```

#### Option 3: ECS Scheduled Task

Use AWS ECS Scheduled Tasks with CloudWatch Events.

#### Option 4: In-Process Scheduler

Enable in main application (ensure only one instance runs the scheduler).

## Monitoring

### Logs

The job logs detailed information:
```
[UsageAggregationJob] Starting aggregation for date: 2025-11-01
[UsageAggregationJob] Found 42 usage keys to process
[UsageAggregationJob] Aggregated: merchant_1 - queries = 1523
[UsageAggregationJob] Completed. Records aggregated: 42, Errors: 0
```

### Metrics to Track

- Records aggregated per run
- Execution time
- Error count
- Redis keys processed
- Database operations

### Alerts

Set up alerts for:
- Job failures (errors > 0)
- No data aggregated (might indicate Redis issues)
- Long execution times (> 5 minutes)
- Repeated failures

## Performance

### Optimization Strategies

1. **Redis Scanning**
   - Uses cursor-based SCAN (memory-efficient)
   - Processes keys in batches of 100

2. **Database Operations**
   - Uses UPSERT (INSERT ... ON CONFLICT UPDATE)
   - Single transaction per key
   - Could be optimized with batch operations

3. **Parallel Processing**
   - Currently sequential
   - Could process multiple merchants in parallel
   - Trade-off: complexity vs. performance

### Scalability

- Handles thousands of merchants
- Processes ~1000 keys/minute
- Database operations are the bottleneck
- Consider sharding for very large datasets

## Error Handling

### Resilience Features

1. **Individual Key Failures**
   - One key failure doesn't stop the job
   - Errors are logged and returned
   - Failed keys can be retried

2. **Redis Connection Issues**
   - Gracefully handles connection failures
   - Returns empty result set
   - Logs warnings

3. **Database Errors**
   - Caught and logged per key
   - Transaction rollback per key
   - Doesn't affect other keys

### Recovery

If aggregation fails:
```bash
# Retry specific date
npm run job:aggregate-date 2025-11-01

# Retry date range
npm run job:aggregate-range 2025-11-01 2025-11-07

# Retry specific merchant
npm run job:aggregate-merchant merchant_id 2025-11-01
```

## Testing

### Unit Tests

Run tests:
```bash
npm test -- src/tests/usageAggregationJob.test.ts --run
```

Tests cover:
- ✅ Successful aggregation
- ✅ Missing Redis data
- ✅ Database errors
- ✅ Status checking

### Integration Testing

Test end-to-end:
```bash
# 1. Track some usage
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer pk_test_..." \
  -d '{"query": "test"}'

# 2. Check Redis
redis-cli GET usage:merchant_id:2025-11-01:queries

# 3. Run aggregation
npm run job:aggregate

# 4. Check database
psql -d mindsdb_rag -c "SELECT * FROM merchant_usage WHERE date = '2025-11-01';"
```

## Troubleshooting

### No keys found

**Symptom**: Job reports 0 keys found

**Causes**:
- No usage data in Redis
- Wrong date (data already expired)
- Redis connection issues

**Solution**:
```bash
# Check Redis
redis-cli KEYS "usage:*"

# Check specific key
redis-cli GET usage:merchant_id:2025-11-01:queries
```

### Database errors

**Symptom**: Errors during upsert

**Causes**:
- Database connection issues
- Schema mismatch
- Constraint violations

**Solution**:
```bash
# Check database connection
npm run health

# Check schema
psql -d mindsdb_rag -c "\d merchant_usage"
```

### Slow execution

**Symptom**: Job takes > 5 minutes

**Causes**:
- Large number of keys
- Slow database
- Network latency

**Solution**:
- Run during off-peak hours
- Optimize database indexes
- Consider parallel processing

## Future Enhancements

Potential improvements:
- [ ] Distributed locking for multi-instance deployments
- [ ] Batch database operations for better performance
- [ ] Parallel processing for large datasets
- [ ] Metrics/monitoring integration (CloudWatch, Datadog)
- [ ] Dead letter queue for failed aggregations
- [ ] Configurable aggregation windows (hourly, daily, weekly)
- [ ] Automatic retry with exponential backoff
- [ ] Alerting integration (PagerDuty, Slack)

## References

- [Usage Tracking Service](../src/services/UsageTrackingService.ts)
- [Merchant Usage Repository](../src/repositories/MerchantUsageRepository.ts)
- [Cache Service](../src/services/CacheService.ts)
- [Job README](../src/jobs/README.md)
