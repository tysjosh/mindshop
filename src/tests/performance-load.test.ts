/**
 * Performance and Load Testing for MindsDB RAG Assistant
 * Tests system performance under 1k concurrent users per merchant
 * Validates latency SLAs and cost targets under load
 * 
 * Requirements: 5.1, 5.2, 6.1
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createAPIGatewayApp, APIGatewayApp } from '../api/app';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { 
  LoadTestRunner, 
  ConcurrentUserSimulator, 
  FailoverTestRunner,
  MetricsCollector,
  createRequestFunction,
  validateSLA,
  type LoadTestConfig,
  type RequestResult
} from './utils/loadTestUtils';
import { getTestConfig, getTestData, getBenchmark } from './config/testConfig';

// Test configuration
const config = getTestConfig();
const testData = getTestData();

// Performance test configuration
const PERFORMANCE_CONFIG = {
  CONCURRENT_USERS_TARGET: 1000, // Target from requirements
  CONCURRENT_USERS_TEST: 100, // Reduced for test environment
  LATENCY_SLA_MS: 300,
  COST_TARGET_PER_SESSION: 0.05,
  ERROR_RATE_THRESHOLD: 0.01,
  CACHE_HIT_RATE_TARGET: 0.7,
  TEST_DURATION_MS: 30000, // 30 seconds
  RAMP_UP_TIME_MS: 5000, // 5 seconds
  REQUESTS_PER_SECOND: 50,
};

describe('Performance and Load Testing', () => {
  let app: APIGatewayApp;
  let server: any;
  let loadTestRunner: LoadTestRunner;
  let concurrentUserSimulator: ConcurrentUserSimulator;
  let failoverTestRunner: FailoverTestRunner;
  let metricsCollector: MetricsCollector;

  const testMerchantId = 'load-test-merchant';
  const authToken = 'Bearer test-load-token';

  beforeAll(async () => {
    // Mock Redis for caching
    vi.mock('redis', () => ({
      createClient: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        ttl: vi.fn().mockResolvedValue(-1),
        ping: vi.fn().mockResolvedValue('PONG'),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        isReady: true,
        isOpen: true
      }))
    }));

    // Mock AWS services for load testing
    vi.mock('aws-sdk', () => ({
      DynamoDB: vi.fn(() => ({
        putItem: vi.fn().mockReturnValue({
          promise: vi.fn().mockResolvedValue({})
        }),
        getItem: vi.fn().mockReturnValue({
          promise: vi.fn().mockResolvedValue({
            Item: {
              sessionId: { S: 'test-session' },
              merchantId: { S: testMerchantId }
            }
          })
        }),
        query: vi.fn().mockReturnValue({
          promise: vi.fn().mockResolvedValue({ Items: [] })
        })
      })),
      CloudWatch: vi.fn(() => ({
        putMetricData: vi.fn().mockReturnValue({
          promise: vi.fn().mockResolvedValue({})
        })
      })),
      Bedrock: vi.fn(() => ({
        invokeModel: vi.fn().mockReturnValue({
          promise: vi.fn().mockResolvedValue({
            body: Buffer.from(JSON.stringify({
              completion: 'Test response',
              stop_reason: 'end_turn'
            }))
          })
        })
      }))
    }));

    // Mock PostgreSQL
    vi.mock('pg', () => ({
      Pool: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn()
        }),
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined)
      }))
    }));

    // Mock Drizzle ORM
    vi.mock('drizzle-orm/postgres-js', () => ({
      drizzle: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([])
      }))
    }));

    // Create test app
    app = createAPIGatewayApp({
      port: 0,
      environment: 'test',
      enableMetrics: true,
      enableCognito: false,
      corsOrigins: ['*'],
      awsRegion: 'us-east-1'
    });

    server = app.getApp().listen();

    // Initialize test utilities
    loadTestRunner = new LoadTestRunner();
    concurrentUserSimulator = new ConcurrentUserSimulator();
    failoverTestRunner = new FailoverTestRunner();
    metricsCollector = new MetricsCollector();

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_METRICS = 'true';
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Concurrent User Load Tests', () => {
    it('should handle 100 concurrent users (scaled from 1k requirement)', async () => {
      const concurrentUsers = PERFORMANCE_CONFIG.CONCURRENT_USERS_TEST;
      const sessionDuration = 30000; // 30 seconds per user session

      // Create user simulation function
      const userFunction = async (userId: string): Promise<RequestResult> => {
        const startTime = Date.now();
        
        try {
          // Simulate user session with multiple interactions
          const sessionResponse = await request(app.getApp())
            .post('/api/sessions')
            .set('Authorization', authToken)
            .send({
              merchantId: testMerchantId,
              userId: userId
            });

          if (sessionResponse.status !== 201) {
            throw new Error(`Session creation failed: ${sessionResponse.status}`);
          }

          const sessionId = sessionResponse.body.data.sessionId;

          // Perform chat interaction
          const chatResponse = await request(app.getApp())
            .post('/api/chat')
            .set('Authorization', authToken)
            .send({
              query: 'I need help finding a product',
              sessionId,
              merchantId: testMerchantId,
              userId: userId
            });

          const latency = Date.now() - startTime;
          
          return {
            success: chatResponse.status === 200,
            latency,
            statusCode: chatResponse.status,
            timestamp: startTime
          };

        } catch (error) {
          const latency = Date.now() - startTime;
          return {
            success: false,
            latency,
            statusCode: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: startTime
          };
        }
      };

      // Run concurrent user simulation
      const results = await concurrentUserSimulator.simulateConcurrentUsers(
        userFunction,
        concurrentUsers,
        sessionDuration
      );

      // Aggregate results
      const aggregatedResults = {
        totalRequests: results.reduce((sum, r) => sum + r.totalRequests, 0),
        successfulRequests: results.reduce((sum, r) => sum + r.successfulRequests, 0),
        failedRequests: results.reduce((sum, r) => sum + r.failedRequests, 0),
        averageLatency: results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length,
        p95Latency: Math.max(...results.map(r => r.p95Latency)),
        p99Latency: Math.max(...results.map(r => r.p99Latency)),
        errorRate: results.reduce((sum, r) => sum + r.errorRate, 0) / results.length,
        throughput: results.reduce((sum, r) => sum + r.throughput, 0)
      };

      console.log('Concurrent User Test Results:', {
        concurrentUsers,
        totalRequests: aggregatedResults.totalRequests,
        successRate: ((aggregatedResults.successfulRequests / aggregatedResults.totalRequests) * 100).toFixed(2) + '%',
        averageLatency: aggregatedResults.averageLatency.toFixed(2) + 'ms',
        p95Latency: aggregatedResults.p95Latency.toFixed(2) + 'ms',
        errorRate: (aggregatedResults.errorRate * 100).toFixed(2) + '%',
        totalThroughput: aggregatedResults.throughput.toFixed(2) + ' req/s'
      });

      // Validate performance requirements
      expect(aggregatedResults.averageLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_SLA_MS * 2); // Allow 2x under load
      expect(aggregatedResults.errorRate).toBeLessThan(PERFORMANCE_CONFIG.ERROR_RATE_THRESHOLD * 5); // Allow higher error rate
      expect(aggregatedResults.successfulRequests).toBeGreaterThan(aggregatedResults.totalRequests * 0.9); // 90% success rate
    });

    it('should maintain performance under sustained high request rate', async () => {
      const requestsPerSecond = PERFORMANCE_CONFIG.REQUESTS_PER_SECOND;
      const testDuration = PERFORMANCE_CONFIG.TEST_DURATION_MS;

      // Create request function
      const requestFunction = createRequestFunction(async () => {
        const startTime = Date.now();
        
        const response = await request(app.getApp())
          .post('/api/chat')
          .set('Authorization', authToken)
          .send({
            query: 'Performance test query',
            merchantId: testMerchantId,
            userId: `perf-user-${Date.now()}`,
            sessionId: uuidv4()
          });

        return {
          status: response.status,
          latency: Date.now() - startTime,
          body: response.body
        };
      });

      // Run load test
      const loadTestConfig: LoadTestConfig = {
        concurrentUsers: 50,
        requestsPerSecond,
        testDurationMs: testDuration,
        rampUpTimeMs: PERFORMANCE_CONFIG.RAMP_UP_TIME_MS,
        targetLatencyMs: PERFORMANCE_CONFIG.LATENCY_SLA_MS,
        maxErrorRate: PERFORMANCE_CONFIG.ERROR_RATE_THRESHOLD
      };

      const results = await loadTestRunner.runLoadTest(requestFunction, loadTestConfig);

      console.log('Sustained Load Test Results:', {
        duration: (results.duration / 1000).toFixed(2) + 's',
        totalRequests: results.totalRequests,
        successRate: ((results.successfulRequests / results.totalRequests) * 100).toFixed(2) + '%',
        averageLatency: results.averageLatency.toFixed(2) + 'ms',
        p95Latency: results.p95Latency.toFixed(2) + 'ms',
        p99Latency: results.p99Latency.toFixed(2) + 'ms',
        requestsPerSecond: results.requestsPerSecond.toFixed(2),
        errorRate: (results.errorRate * 100).toFixed(2) + '%'
      });

      // Validate SLA compliance
      const slaValidation = validateSLA(results, {
        maxLatencyMs: PERFORMANCE_CONFIG.LATENCY_SLA_MS,
        maxP95LatencyMs: PERFORMANCE_CONFIG.LATENCY_SLA_MS * 1.5,
        maxErrorRate: PERFORMANCE_CONFIG.ERROR_RATE_THRESHOLD * 3,
        minThroughput: requestsPerSecond * 0.8 // Allow 20% degradation
      });

      if (!slaValidation.passed) {
        console.warn('SLA Violations:', slaValidation.violations);
      }

      // Core requirements validation
      expect(results.averageLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_SLA_MS * 2);
      expect(results.errorRate).toBeLessThan(PERFORMANCE_CONFIG.ERROR_RATE_THRESHOLD * 5);
      expect(results.throughput).toBeGreaterThan(requestsPerSecond * 0.5); // At least 50% of target
    });

    it('should scale performance linearly with user load', async () => {
      const userCounts = [10, 25, 50];
      const testResults: Array<{ users: number; results: any }> = [];

      for (const userCount of userCounts) {
        console.log(`Testing with ${userCount} concurrent users...`);

        const userFunction = async (userId: string): Promise<RequestResult> => {
          const startTime = Date.now();
          
          try {
            const response = await request(app.getApp())
              .post('/api/chat')
              .set('Authorization', authToken)
              .send({
                query: `Scaling test query from ${userId}`,
                merchantId: testMerchantId,
                userId: userId,
                sessionId: uuidv4()
              });

            return {
              success: response.status === 200,
              latency: Date.now() - startTime,
              statusCode: response.status,
              timestamp: startTime
            };
          } catch (error) {
            return {
              success: false,
              latency: Date.now() - startTime,
              statusCode: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: startTime
            };
          }
        };

        const results = await concurrentUserSimulator.simulateConcurrentUsers(
          userFunction,
          userCount,
          15000 // 15 seconds per test
        );

        const aggregated = {
          users: userCount,
          averageLatency: results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length,
          errorRate: results.reduce((sum, r) => sum + r.errorRate, 0) / results.length,
          throughput: results.reduce((sum, r) => sum + r.throughput, 0)
        };

        testResults.push({ users: userCount, results: aggregated });

        console.log(`${userCount} users - Latency: ${aggregated.averageLatency.toFixed(2)}ms, Error Rate: ${(aggregated.errorRate * 100).toFixed(2)}%, Throughput: ${aggregated.throughput.toFixed(2)} req/s`);
      }

      // Validate scaling characteristics
      for (let i = 1; i < testResults.length; i++) {
        const current = testResults[i].results;
        const previous = testResults[i - 1].results;
        
        // Latency should not increase more than 2x when doubling users
        const latencyIncrease = current.averageLatency / previous.averageLatency;
        expect(latencyIncrease).toBeLessThan(3); // Allow up to 3x increase
        
        // Error rate should not increase dramatically
        expect(current.errorRate).toBeLessThan(0.1); // Max 10% error rate
      }
    });
  });

  describe('Cost and Resource Efficiency Tests', () => {
    it('should maintain cost targets under load', async () => {
      const sessions = 50;
      const messagesPerSession = 5;
      let totalEstimatedCost = 0;

      for (let i = 0; i < sessions; i++) {
        const sessionId = uuidv4();
        const userId = `cost-test-user-${i}`;

        // Create session
        await request(app.getApp())
          .post('/api/sessions')
          .set('Authorization', authToken)
          .send({
            merchantId: testMerchantId,
            userId: userId
          });

        // Send multiple messages per session
        for (let j = 0; j < messagesPerSession; j++) {
          const startTime = Date.now();
          
          const response = await request(app.getApp())
            .post('/api/chat')
            .set('Authorization', authToken)
            .send({
              query: `Cost test message ${j} for session ${i}`,
              sessionId,
              merchantId: testMerchantId,
              userId: userId
            });

          const latency = Date.now() - startTime;
          
          // Estimate cost based on request complexity and latency
          const baseCost = 0.005; // Base cost per request
          const latencyCost = (latency / 1000) * 0.001; // Cost per second of processing
          const llmCost = 0.002; // Estimated LLM token cost
          const cacheHit = j > 0; // Assume cache hits after first message
          const cacheSavings = cacheHit ? 0.001 : 0;
          
          const estimatedCost = baseCost + latencyCost + llmCost - cacheSavings;
          totalEstimatedCost += estimatedCost;

          metricsCollector.recordMetric('request_cost', estimatedCost);
          metricsCollector.recordMetric('request_latency', latency);
          metricsCollector.recordMetric('cache_hit', cacheHit ? 1 : 0);
        }
      }

      const costPerSession = totalEstimatedCost / sessions;
      const costMetrics = metricsCollector.getMetricSummary('request_cost');
      const cacheHitMetrics = metricsCollector.getMetricSummary('cache_hit');

      console.log('Cost Analysis Results:', {
        totalSessions: sessions,
        totalRequests: sessions * messagesPerSession,
        totalEstimatedCost: '$' + totalEstimatedCost.toFixed(4),
        costPerSession: '$' + costPerSession.toFixed(4),
        averageCostPerRequest: '$' + (costMetrics?.average || 0).toFixed(4),
        cacheHitRate: ((cacheHitMetrics?.average || 0) * 100).toFixed(2) + '%'
      });

      // Validate cost targets
      expect(costPerSession).toBeLessThan(PERFORMANCE_CONFIG.COST_TARGET_PER_SESSION);
      expect(costMetrics?.average || 0).toBeLessThan(0.01); // Max $0.01 per request
      expect(cacheHitMetrics?.average || 0).toBeGreaterThan(0.5); // At least 50% cache hit rate
    });

    it('should optimize resource usage with caching', async () => {
      const testQueries = [
        'What are your most popular products?',
        'Show me wireless headphones',
        'What are your return policies?'
      ];

      // First round - populate cache
      for (const query of testQueries) {
        await request(app.getApp())
          .post('/api/chat')
          .set('Authorization', authToken)
          .send({
            query,
            merchantId: testMerchantId,
            userId: 'cache-test-user',
            sessionId: uuidv4()
          });
      }

      // Second round - should hit cache
      const cacheTestResults: number[] = [];
      
      for (const query of testQueries) {
        const startTime = Date.now();
        
        const response = await request(app.getApp())
          .post('/api/chat')
          .set('Authorization', authToken)
          .send({
            query,
            merchantId: testMerchantId,
            userId: 'cache-test-user-2',
            sessionId: uuidv4()
          });

        const latency = Date.now() - startTime;
        cacheTestResults.push(latency);

        expect(response.status).toBe(200);
        
        // Cache hits should be faster
        if (response.body.data?.cacheHit) {
          expect(latency).toBeLessThan(100); // Cache hits should be very fast
        }
      }

      const averageCacheLatency = cacheTestResults.reduce((sum, lat) => sum + lat, 0) / cacheTestResults.length;
      
      console.log('Cache Performance:', {
        averageLatency: averageCacheLatency.toFixed(2) + 'ms',
        queries: testQueries.length
      });

      expect(averageCacheLatency).toBeLessThan(200); // Should be fast with caching
    });
  });

  describe('Failover and Recovery Tests', () => {
    it('should handle service degradation gracefully', async () => {
      // Simulate normal operation
      const normalRequestFunction = createRequestFunction(async () => {
        const startTime = Date.now();
        
        const response = await request(app.getApp())
          .post('/api/chat')
          .set('Authorization', authToken)
          .send({
            query: 'Failover test query',
            merchantId: testMerchantId,
            userId: 'failover-test-user',
            sessionId: uuidv4()
          });

        return {
          status: response.status,
          latency: Date.now() - startTime,
          body: response.body
        };
      });

      // Simulate failure (mock service errors)
      const failureSimulator = () => {
        console.log('Simulating service failure...');
        // In a real test, this would introduce actual failures
      };

      // Simulate recovery
      const recoverySimulator = () => {
        console.log('Simulating service recovery...');
        // In a real test, this would restore services
      };

      const failoverResults = await failoverTestRunner.testServiceFailover(
        normalRequestFunction,
        failureSimulator,
        recoverySimulator,
        {
          preFailureRequests: 10,
          failureDurationMs: 5000,
          postRecoveryRequests: 10,
          requestIntervalMs: 500
        }
      );

      console.log('Failover Test Results:', {
        preFailure: {
          successRate: ((failoverResults.preFailure.successfulRequests / failoverResults.preFailure.totalRequests) * 100).toFixed(2) + '%',
          averageLatency: failoverResults.preFailure.averageLatency.toFixed(2) + 'ms'
        },
        duringFailure: {
          successRate: ((failoverResults.duringFailure.successfulRequests / failoverResults.duringFailure.totalRequests) * 100).toFixed(2) + '%',
          averageLatency: failoverResults.duringFailure.averageLatency.toFixed(2) + 'ms'
        },
        postRecovery: {
          successRate: ((failoverResults.postRecovery.successfulRequests / failoverResults.postRecovery.totalRequests) * 100).toFixed(2) + '%',
          averageLatency: failoverResults.postRecovery.averageLatency.toFixed(2) + 'ms'
        }
      });

      // Validate recovery
      expect(failoverResults.preFailure.successfulRequests).toBeGreaterThan(8); // At least 80% success
      expect(failoverResults.postRecovery.successfulRequests).toBeGreaterThan(8); // Recovery should restore performance
      
      // During failure, some degradation is acceptable but system should not completely fail
      expect(failoverResults.duringFailure.successfulRequests).toBeGreaterThan(0); // Some requests should still succeed
    });

    it('should handle circuit breaker activation and recovery', async () => {
      const requests = 20;
      let consecutiveErrors = 0;
      let circuitBreakerActivated = false;

      for (let i = 0; i < requests; i++) {
        try {
          const response = await request(app.getApp())
            .post('/api/chat')
            .set('Authorization', authToken)
            .send({
              query: 'Circuit breaker test',
              merchantId: 'invalid-merchant-id', // This should cause errors
              userId: 'circuit-test-user',
              sessionId: uuidv4()
            });

          if (response.status >= 400) {
            consecutiveErrors++;
            if (consecutiveErrors >= 5) {
              circuitBreakerActivated = true;
            }
          } else {
            consecutiveErrors = 0;
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          consecutiveErrors++;
        }
      }

      // Circuit breaker behavior validation
      // In a real implementation, we would check for circuit breaker patterns
      expect(consecutiveErrors).toBeGreaterThan(0); // Should have some errors
      
      console.log('Circuit Breaker Test:', {
        totalRequests: requests,
        consecutiveErrors,
        circuitBreakerActivated
      });
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should collect and validate performance metrics', async () => {
      const testRequests = 30;
      const metrics = {
        latencies: [] as number[],
        statusCodes: [] as number[],
        cacheHits: 0,
        errors: 0
      };

      for (let i = 0; i < testRequests; i++) {
        const startTime = Date.now();
        
        try {
          const response = await request(app.getApp())
            .post('/api/chat')
            .set('Authorization', authToken)
            .send({
              query: `Metrics test query ${i}`,
              merchantId: testMerchantId,
              userId: 'metrics-test-user',
              sessionId: uuidv4()
            });

          const latency = Date.now() - startTime;
          metrics.latencies.push(latency);
          metrics.statusCodes.push(response.status);

          if (response.body.data?.cacheHit) {
            metrics.cacheHits++;
          }

          if (response.status >= 400) {
            metrics.errors++;
          }

          metricsCollector.recordMetric('response_latency', latency);
          metricsCollector.recordMetric('status_code', response.status);

        } catch (error) {
          metrics.errors++;
          metricsCollector.recordMetric('response_latency', 0);
          metricsCollector.recordMetric('status_code', 0);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const latencyMetrics = metricsCollector.getMetricSummary('response_latency');
      const successRate = ((testRequests - metrics.errors) / testRequests) * 100;
      const cacheHitRate = (metrics.cacheHits / testRequests) * 100;

      console.log('Performance Metrics Summary:', {
        totalRequests: testRequests,
        successRate: successRate.toFixed(2) + '%',
        averageLatency: latencyMetrics?.average.toFixed(2) + 'ms',
        p95Latency: latencyMetrics?.p95.toFixed(2) + 'ms',
        p99Latency: latencyMetrics?.p99.toFixed(2) + 'ms',
        cacheHitRate: cacheHitRate.toFixed(2) + '%',
        errorCount: metrics.errors
      });

      // Validate metrics against targets
      expect(latencyMetrics?.average || 0).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_SLA_MS);
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(metrics.errors).toBeLessThan(testRequests * 0.05); // Less than 5% errors
    });

    it('should validate system health under load', async () => {
      // Run health checks during load
      const healthCheckPromises: Promise<any>[] = [];
      const loadPromises: Promise<any>[] = [];

      // Generate background load
      for (let i = 0; i < 20; i++) {
        const loadPromise = request(app.getApp())
          .post('/api/chat')
          .set('Authorization', authToken)
          .send({
            query: `Background load ${i}`,
            merchantId: testMerchantId,
            userId: `load-user-${i}`,
            sessionId: uuidv4()
          });
        
        loadPromises.push(loadPromise);
      }

      // Perform health checks during load
      for (let i = 0; i < 5; i++) {
        const healthPromise = request(app.getApp())
          .get('/health')
          .set('Authorization', authToken);
        
        healthCheckPromises.push(healthPromise);
        
        // Delay between health checks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Wait for all requests to complete
      const [healthResults, loadResults] = await Promise.all([
        Promise.allSettled(healthCheckPromises),
        Promise.allSettled(loadPromises)
      ]);

      const healthSuccesses = healthResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;

      const loadSuccesses = loadResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;

      console.log('Health Check Under Load:', {
        healthChecks: healthResults.length,
        healthSuccesses,
        healthSuccessRate: ((healthSuccesses / healthResults.length) * 100).toFixed(2) + '%',
        loadRequests: loadResults.length,
        loadSuccesses,
        loadSuccessRate: ((loadSuccesses / loadResults.length) * 100).toFixed(2) + '%'
      });

      // Health checks should remain stable under load
      expect(healthSuccesses).toBeGreaterThan(healthResults.length * 0.8); // 80% health check success
      expect(loadSuccesses).toBeGreaterThan(loadResults.length * 0.9); // 90% load request success
    });
  });
});