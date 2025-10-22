/**
 * Load Testing Utilities for E2E Integration Tests
 * Provides utilities for performance testing, load generation, and metrics collection
 */

import { performance } from 'perf_hooks';

export interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerSecond: number;
  testDurationMs: number;
  rampUpTimeMs: number;
  targetLatencyMs: number;
  maxErrorRate: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  requestsPerSecond: number;
  errorRate: number;
  throughput: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface RequestResult {
  success: boolean;
  latency: number;
  statusCode: number;
  error?: string;
  timestamp: number;
}

export class LoadTestRunner {
  private results: RequestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  async runLoadTest(
    requestFunction: () => Promise<RequestResult>,
    config: LoadTestConfig
  ): Promise<LoadTestResult> {
    this.results = [];
    this.startTime = performance.now();

    const promises: Promise<void>[] = [];
    const requestInterval = 1000 / config.requestsPerSecond;
    let requestCount = 0;
    const maxRequests = Math.floor((config.testDurationMs / 1000) * config.requestsPerSecond);

    // Ramp up phase
    const rampUpRequests = Math.floor((config.rampUpTimeMs / 1000) * config.requestsPerSecond);
    const rampUpInterval = config.rampUpTimeMs / rampUpRequests;

    // Ramp up
    for (let i = 0; i < rampUpRequests && requestCount < maxRequests; i++) {
      const delay = i * rampUpInterval;
      promises.push(this.scheduleRequest(requestFunction, delay));
      requestCount++;
    }

    // Steady state
    const steadyStateStart = config.rampUpTimeMs;
    const steadyStateDuration = config.testDurationMs - config.rampUpTimeMs;
    const steadyStateRequests = Math.floor((steadyStateDuration / 1000) * config.requestsPerSecond);

    for (let i = 0; i < steadyStateRequests && requestCount < maxRequests; i++) {
      const delay = steadyStateStart + (i * requestInterval);
      promises.push(this.scheduleRequest(requestFunction, delay));
      requestCount++;
    }

    // Wait for all requests to complete
    await Promise.allSettled(promises);
    this.endTime = performance.now();

    return this.calculateResults();
  }

  private async scheduleRequest(
    requestFunction: () => Promise<RequestResult>,
    delayMs: number
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    try {
      const result = await requestFunction();
      this.results.push(result);
    } catch (error) {
      this.results.push({
        success: false,
        latency: 0,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: performance.now()
      });
    }
  }

  private calculateResults(): LoadTestResult {
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const latencies = this.results.map(r => r.latency).sort((a, b) => a - b);
    const duration = this.endTime - this.startTime;
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      p50Latency: this.getPercentile(latencies, 0.5),
      p95Latency: this.getPercentile(latencies, 0.95),
      p99Latency: this.getPercentile(latencies, 0.99),
      maxLatency: Math.max(...latencies) || 0,
      minLatency: Math.min(...latencies) || 0,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: failedRequests / totalRequests,
      throughput: (successfulRequests / duration) * 1000,
      startTime: this.startTime,
      endTime: this.endTime,
      duration
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }
}

export class ConcurrentUserSimulator {
  async simulateConcurrentUsers(
    userFunction: (userId: string) => Promise<RequestResult>,
    userCount: number,
    sessionDurationMs: number = 60000
  ): Promise<LoadTestResult[]> {
    const promises: Promise<LoadTestResult>[] = [];

    for (let i = 0; i < userCount; i++) {
      const userId = `user-${i}`;
      const promise = this.simulateUserSession(userFunction, userId, sessionDurationMs);
      promises.push(promise);
    }

    return Promise.all(promises);
  }

  private async simulateUserSession(
    userFunction: (userId: string) => Promise<RequestResult>,
    userId: string,
    durationMs: number
  ): Promise<LoadTestResult> {
    const results: RequestResult[] = [];
    const startTime = performance.now();
    const endTime = startTime + durationMs;

    while (performance.now() < endTime) {
      try {
        const result = await userFunction(userId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          latency: 0,
          statusCode: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: performance.now()
        });
      }

      // Random delay between requests (1-5 seconds)
      const delay = Math.random() * 4000 + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const actualEndTime = performance.now();
    const duration = actualEndTime - startTime;
    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    const successfulRequests = results.filter(r => r.success).length;

    return {
      totalRequests: results.length,
      successfulRequests,
      failedRequests: results.length - successfulRequests,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      p50Latency: this.getPercentile(latencies, 0.5),
      p95Latency: this.getPercentile(latencies, 0.95),
      p99Latency: this.getPercentile(latencies, 0.99),
      maxLatency: Math.max(...latencies) || 0,
      minLatency: Math.min(...latencies) || 0,
      requestsPerSecond: (results.length / duration) * 1000,
      errorRate: (results.length - successfulRequests) / results.length,
      throughput: (successfulRequests / duration) * 1000,
      startTime,
      endTime: actualEndTime,
      duration
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }
}

export class FailoverTestRunner {
  async testServiceFailover(
    normalRequestFunction: () => Promise<RequestResult>,
    failureSimulator: () => void,
    recoverySimulator: () => void,
    testConfig: {
      preFailureRequests: number;
      failureDurationMs: number;
      postRecoveryRequests: number;
      requestIntervalMs: number;
    }
  ): Promise<{
    preFailure: LoadTestResult;
    duringFailure: LoadTestResult;
    postRecovery: LoadTestResult;
  }> {
    // Pre-failure phase
    const preFailureResults = await this.runPhase(
      normalRequestFunction,
      testConfig.preFailureRequests,
      testConfig.requestIntervalMs
    );

    // Simulate failure
    failureSimulator();

    // During failure phase
    const duringFailureResults = await this.runPhase(
      normalRequestFunction,
      Math.floor(testConfig.failureDurationMs / testConfig.requestIntervalMs),
      testConfig.requestIntervalMs
    );

    // Simulate recovery
    recoverySimulator();

    // Post-recovery phase
    const postRecoveryResults = await this.runPhase(
      normalRequestFunction,
      testConfig.postRecoveryRequests,
      testConfig.requestIntervalMs
    );

    return {
      preFailure: preFailureResults,
      duringFailure: duringFailureResults,
      postRecovery: postRecoveryResults
    };
  }

  private async runPhase(
    requestFunction: () => Promise<RequestResult>,
    requestCount: number,
    intervalMs: number
  ): Promise<LoadTestResult> {
    const results: RequestResult[] = [];
    const startTime = performance.now();

    for (let i = 0; i < requestCount; i++) {
      try {
        const result = await requestFunction();
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          latency: 0,
          statusCode: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: performance.now()
        });
      }

      if (i < requestCount - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    const successfulRequests = results.filter(r => r.success).length;

    return {
      totalRequests: results.length,
      successfulRequests,
      failedRequests: results.length - successfulRequests,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      p50Latency: this.getPercentile(latencies, 0.5),
      p95Latency: this.getPercentile(latencies, 0.95),
      p99Latency: this.getPercentile(latencies, 0.99),
      maxLatency: Math.max(...latencies) || 0,
      minLatency: Math.min(...latencies) || 0,
      requestsPerSecond: (results.length / duration) * 1000,
      errorRate: (results.length - successfulRequests) / results.length,
      throughput: (successfulRequests / duration) * 1000,
      startTime,
      endTime,
      duration
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }
}

export class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getMetricSummary(name: string): {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      sum,
      average: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99)
    };
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetricSummary(name);
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }
}

export function createRequestFunction(
  requestExecutor: () => Promise<{ status: number; latency: number; body?: any }>,
  successCriteria: (response: { status: number; body?: any }) => boolean = (res) => res.status < 400
): () => Promise<RequestResult> {
  return async (): Promise<RequestResult> => {
    const startTime = performance.now();
    
    try {
      const response = await requestExecutor();
      const latency = performance.now() - startTime;
      const success = successCriteria(response);

      return {
        success,
        latency,
        statusCode: response.status,
        timestamp: startTime
      };
    } catch (error) {
      const latency = performance.now() - startTime;
      return {
        success: false,
        latency,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime
      };
    }
  };
}

export function validateSLA(
  results: LoadTestResult,
  sla: {
    maxLatencyMs?: number;
    maxP95LatencyMs?: number;
    maxP99LatencyMs?: number;
    maxErrorRate?: number;
    minThroughput?: number;
  }
): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (sla.maxLatencyMs && results.averageLatency > sla.maxLatencyMs) {
    violations.push(`Average latency ${results.averageLatency.toFixed(2)}ms exceeds SLA ${sla.maxLatencyMs}ms`);
  }

  if (sla.maxP95LatencyMs && results.p95Latency > sla.maxP95LatencyMs) {
    violations.push(`P95 latency ${results.p95Latency.toFixed(2)}ms exceeds SLA ${sla.maxP95LatencyMs}ms`);
  }

  if (sla.maxP99LatencyMs && results.p99Latency > sla.maxP99LatencyMs) {
    violations.push(`P99 latency ${results.p99Latency.toFixed(2)}ms exceeds SLA ${sla.maxP99LatencyMs}ms`);
  }

  if (sla.maxErrorRate && results.errorRate > sla.maxErrorRate) {
    violations.push(`Error rate ${(results.errorRate * 100).toFixed(2)}% exceeds SLA ${(sla.maxErrorRate * 100).toFixed(2)}%`);
  }

  if (sla.minThroughput && results.throughput < sla.minThroughput) {
    violations.push(`Throughput ${results.throughput.toFixed(2)} req/s below SLA ${sla.minThroughput} req/s`);
  }

  return {
    passed: violations.length === 0,
    violations
  };
}