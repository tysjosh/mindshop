#!/usr/bin/env ts-node
/**
 * Load Testing Script for Merchant Platform
 * Tests system performance under 1000 concurrent users
 * 
 * Usage:
 *   npm run load-test
 *   npm run load-test -- --users 1000 --duration 60
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDurationSeconds: number;
  rampUpSeconds: number;
  requestsPerSecond: number;
}

interface RequestResult {
  success: boolean;
  latency: number;
  statusCode: number;
  error?: string;
  timestamp: number;
}

interface LoadTestResults {
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
  duration: number;
}

class LoadTester {
  private config: LoadTestConfig;
  private client: AxiosInstance;
  private results: RequestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_API_KEY || 'test-key'}`
      }
    });
  }

  async runLoadTest(): Promise<LoadTestResults> {
    console.log('🚀 Starting load test...');
    console.log(`   Base URL: ${this.config.baseUrl}`);
    console.log(`   Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`   Duration: ${this.config.testDurationSeconds}s`);
    console.log(`   Ramp-up: ${this.config.rampUpSeconds}s`);
    console.log(`   Target RPS: ${this.config.requestsPerSecond}`);
    console.log('');

    this.results = [];
    this.startTime = performance.now();

    // Create user simulation promises
    const userPromises: Promise<void>[] = [];
    const usersPerSecond = this.config.concurrentUsers / this.config.rampUpSeconds;

    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const delay = (i / usersPerSecond) * 1000; // Ramp-up delay
      userPromises.push(this.simulateUser(i, delay));
    }

    // Wait for all users to complete
    await Promise.allSettled(userPromises);
    this.endTime = performance.now();

    return this.calculateResults();
  }

  private async simulateUser(userId: number, startDelay: number): Promise<void> {
    // Wait for ramp-up delay
    await this.sleep(startDelay);

    const userStartTime = performance.now();
    const sessionDuration = this.config.testDurationSeconds * 1000;
    const sessionId = `load-test-session-${userId}-${Date.now()}`;
    const merchantId = process.env.TEST_MERCHANT_ID || 'test-merchant';

    // Simulate user session with multiple requests
    while (performance.now() - userStartTime < sessionDuration) {
      // Chat request
      await this.makeRequest({
        method: 'POST',
        url: '/api/chat',
        data: {
          query: `Load test query from user ${userId}`,
          sessionId,
          merchantId,
          userId: `load-user-${userId}`
        }
      });

      // Random delay between requests (1-3 seconds)
      const delay = Math.random() * 2000 + 1000;
      await this.sleep(delay);
    }
  }

  private async makeRequest(config: {
    method: string;
    url: string;
    data?: any;
  }): Promise<void> {
    const startTime = performance.now();

    try {
      const response = await this.client.request({
        method: config.method,
        url: config.url,
        data: config.data
      });

      const latency = performance.now() - startTime;

      this.results.push({
        success: response.status >= 200 && response.status < 400,
        latency,
        statusCode: response.status,
        timestamp: startTime
      });
    } catch (error: any) {
      const latency = performance.now() - startTime;

      this.results.push({
        success: false,
        latency,
        statusCode: error.response?.status || 0,
        error: error.message,
        timestamp: startTime
      });
    }
  }

  private calculateResults(): LoadTestResults {
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
      duration
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults(results: LoadTestResults): void {
    console.log('\n📊 Load Test Results');
    console.log('═'.repeat(60));
    console.log(`Duration:              ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`Total Requests:        ${results.totalRequests}`);
    console.log(`Successful:            ${results.successfulRequests} (${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`Failed:                ${results.failedRequests} (${((results.failedRequests / results.totalRequests) * 100).toFixed(2)}%)`);
    console.log('');
    console.log('Latency:');
    console.log(`  Average:             ${results.averageLatency.toFixed(2)}ms`);
    console.log(`  P50:                 ${results.p50Latency.toFixed(2)}ms`);
    console.log(`  P95:                 ${results.p95Latency.toFixed(2)}ms`);
    console.log(`  P99:                 ${results.p99Latency.toFixed(2)}ms`);
    console.log(`  Min:                 ${results.minLatency.toFixed(2)}ms`);
    console.log(`  Max:                 ${results.maxLatency.toFixed(2)}ms`);
    console.log('');
    console.log(`Throughput:            ${results.requestsPerSecond.toFixed(2)} req/s`);
    console.log(`Error Rate:            ${(results.errorRate * 100).toFixed(2)}%`);
    console.log('═'.repeat(60));

    // Validate against SLA
    const slaLatency = 300; // 300ms target
    const slaErrorRate = 0.01; // 1% max error rate

    console.log('\n✅ SLA Validation');
    console.log('─'.repeat(60));
    
    if (results.averageLatency <= slaLatency) {
      console.log(`✓ Average latency ${results.averageLatency.toFixed(2)}ms <= ${slaLatency}ms target`);
    } else {
      console.log(`✗ Average latency ${results.averageLatency.toFixed(2)}ms > ${slaLatency}ms target`);
    }

    if (results.p95Latency <= slaLatency * 1.5) {
      console.log(`✓ P95 latency ${results.p95Latency.toFixed(2)}ms <= ${slaLatency * 1.5}ms target`);
    } else {
      console.log(`✗ P95 latency ${results.p95Latency.toFixed(2)}ms > ${slaLatency * 1.5}ms target`);
    }

    if (results.errorRate <= slaErrorRate) {
      console.log(`✓ Error rate ${(results.errorRate * 100).toFixed(2)}% <= ${slaErrorRate * 100}% target`);
    } else {
      console.log(`✗ Error rate ${(results.errorRate * 100).toFixed(2)}% > ${slaErrorRate * 100}% target`);
    }

    console.log('─'.repeat(60));
  }
}

// Parse command line arguments
function parseArgs(): LoadTestConfig {
  const args = process.argv.slice(2);
  const config: LoadTestConfig = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    concurrentUsers: 100, // Default to 100 for testing
    testDurationSeconds: 30,
    rampUpSeconds: 10,
    requestsPerSecond: 50
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--users':
      case '-u':
        config.concurrentUsers = parseInt(value);
        break;
      case '--duration':
      case '-d':
        config.testDurationSeconds = parseInt(value);
        break;
      case '--ramp-up':
      case '-r':
        config.rampUpSeconds = parseInt(value);
        break;
      case '--rps':
        config.requestsPerSecond = parseInt(value);
        break;
      case '--url':
        config.baseUrl = value;
        break;
    }
  }

  return config;
}

// Main execution
async function main() {
  const config = parseArgs();
  const tester = new LoadTester(config);

  try {
    const results = await tester.runLoadTest();
    tester.printResults(results);

    // Exit with error code if SLA violated
    const slaViolated = results.averageLatency > 300 || results.errorRate > 0.01;
    process.exit(slaViolated ? 1 : 0);
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { LoadTester, LoadTestConfig, LoadTestResults };
