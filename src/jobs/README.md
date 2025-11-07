# Background Jobs

This directory contains background jobs for the Merchant Platform.

## Usage Aggregation Job

The Usage Aggregation Job periodically moves usage data from Redis to PostgreSQL for long-term storage and analytics.

### How It Works

1. **Real-time Tracking**: Usage is tracked in Redis using atomic `INCRBY` operations for fast writes
   - Key format: `usage:{merchantId}:{date}:{metricType}`
   - Example: `usage:acme_electronics_2024:2025-11-01:queries`

2. **Background Aggregation**: The job scans Redis for usage keys and aggregates them to PostgreSQL
   - Runs periodically (default: every hour)
   - Processes data from previous days
   - Updates or inserts records in the `merchant_usage` table

3. **Cleanup**: Old Redis keys are automatically cleaned up after 7 days (handled by Redis TTL)

### Running the Job

#### Manual Execution

```bash
# Aggregate yesterday's usage data
npm run job:aggregate

# Aggregate usage for a specific date
npm run job:aggregate-date 2025-11-01

# Aggregate usage for a date range
npm run job:aggregate-range 2025-11-01 2025-11-07

# Aggregate usage for a specific merchant
npm run job:aggregate-merchant acme_electronics_2024 2025-11-01

# Check aggregation status for a date
npm run job:status 2025-11-01
```

#### Automatic Scheduling

The job scheduler can be enabled in the main application by setting environment variables:

```bash
# Enable the job scheduler
ENABLE_JOB_SCHEDULER=true

# Set aggregation interval (in milliseconds, default: 3600000 = 1 hour)
USAGE_AGGREGATION_INTERVAL=3600000

# Enable/disable usage aggregation (default: true)
ENABLE_USAGE_AGGREGATION=true
```

Then start the application normally:

```bash
npm run dev
# or
npm start
```

#### Standalone Scheduler

You can also run the scheduler as a standalone process:

```bash
npm run job:scheduler
```

This is useful for:
- Running the scheduler in a separate container/process
- Testing the scheduler without starting the full application
- Debugging job execution

### Production Deployment

For production, you have several options:

#### Option 1: AWS EventBridge (Recommended)

Create a scheduled Lambda function that runs the aggregation job:

```typescript
// lambda/usageAggregationHandler.ts
import { getUsageAggregationJob } from '../src/jobs/UsageAggregationJob';

export const handler = async (event: any) => {
  const job = getUsageAggregationJob();
  const result = await job.run();
  
  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
  };
};
```

Configure EventBridge to trigger this Lambda:
- Schedule: `cron(0 * * * ? *)` (every hour)
- Or: `rate(1 hour)`

#### Option 2: Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: usage-aggregation
spec:
  schedule: "0 * * * *"  # Every hour
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: usage-aggregation
            image: your-app-image:latest
            command: ["npm", "run", "job:aggregate"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          restartPolicy: OnFailure
```

#### Option 3: ECS Scheduled Task

Use AWS ECS Scheduled Tasks with CloudWatch Events to run the job periodically.

#### Option 4: In-Process Scheduler

Enable the scheduler in your main application (as shown above). This is the simplest option but:
- Only one instance should run the scheduler (use leader election if running multiple instances)
- The scheduler stops if the application crashes
- Not recommended for high-availability requirements

### Monitoring

The job logs detailed information about its execution:

```
[UsageAggregationJob] Starting aggregation for date: 2025-11-01
[UsageAggregationJob] Found 42 usage keys to process
[UsageAggregationJob] Aggregated: acme_electronics_2024 - queries = 1523
[UsageAggregationJob] Aggregated: acme_electronics_2024 - api_calls = 8456
[UsageAggregationJob] Completed. Records aggregated: 42, Errors: 0
```

Monitor these logs in production to ensure the job is running successfully.

### Error Handling

The job is designed to be resilient:
- Individual key failures don't stop the entire job
- Errors are logged and returned in the result
- Failed aggregations can be retried manually
- Redis connection failures are handled gracefully

### Performance Considerations

- The job uses Redis SCAN to iterate through keys (cursor-based, memory-efficient)
- Database operations use upsert (INSERT ... ON CONFLICT UPDATE) for efficiency
- Large date ranges are processed one day at a time
- Consider running during off-peak hours for large datasets

### Troubleshooting

#### Job not finding any keys

Check that usage is being tracked:
```bash
# Connect to Redis
redis-cli

# List usage keys
KEYS usage:*

# Check a specific key
GET usage:acme_electronics_2024:2025-11-01:queries
```

#### Database connection errors

Ensure the database connection is configured correctly:
```bash
# Check database connection
npm run health
```

#### Redis connection errors

Verify Redis is accessible:
```bash
# Test Redis connection
redis-cli ping
```

### Future Enhancements

Potential improvements for the job:
- [ ] Add metrics/monitoring integration (CloudWatch, Datadog)
- [ ] Implement distributed locking for multi-instance deployments
- [ ] Add retry logic with exponential backoff
- [ ] Support for custom aggregation windows (hourly, daily, weekly)
- [ ] Parallel processing for large datasets
- [ ] Dead letter queue for failed aggregations
- [ ] Alerting for job failures
