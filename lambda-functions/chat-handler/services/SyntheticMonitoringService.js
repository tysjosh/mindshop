"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticMonitoringService = void 0;
exports.getSyntheticMonitoringService = getSyntheticMonitoringService;
const LoggingService_1 = require("./LoggingService");
const MetricsCollectionService_1 = require("./MetricsCollectionService");
const AlertingService_1 = require("./AlertingService");
class SyntheticMonitoringService {
    constructor() {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsService = (0, MetricsCollectionService_1.getMetricsCollectionService)();
        this.alertingService = (0, AlertingService_1.getAlertingService)();
        this.syntheticTests = new Map();
        this.testIntervals = new Map();
        this.regressionSuites = new Map();
        this.testResults = new Map();
        this.initializeDefaultTests();
    }
    initializeDefaultTests() {
        // Latency monitoring test
        this.addSyntheticTest({
            id: 'latency_health_check',
            name: 'API Latency Health Check',
            type: 'latency',
            endpoint: '/health',
            method: 'GET',
            expectedResponse: {
                statusCode: 200,
                maxLatencyMs: 100
            },
            frequency: 300, // 5 minutes
            timeout: 10,
            retries: 3,
            enabled: true
        });
        // Grounding accuracy test
        this.addSyntheticTest({
            id: 'grounding_accuracy_test',
            name: 'Response Grounding Accuracy Test',
            type: 'grounding',
            endpoint: '/api/v1/chat',
            method: 'POST',
            payload: {
                message: "What are the features of the iPhone 15?",
                merchantId: "test_merchant",
                sessionId: "synthetic_test_session"
            },
            headers: {
                'Content-Type': 'application/json',
                'X-Merchant-ID': 'test_merchant'
            },
            expectedResponse: {
                statusCode: 200,
                maxLatencyMs: 5000,
                minAccuracy: 0.85,
                bodyContains: ['iPhone', '15']
            },
            frequency: 300, // 5 minutes
            timeout: 30,
            retries: 2,
            enabled: true,
            merchantId: 'test_merchant'
        });
        // End-to-end conversation test
        this.addSyntheticTest({
            id: 'e2e_conversation_test',
            name: 'End-to-End Conversation Flow',
            type: 'end_to_end',
            endpoint: '/api/v1/chat',
            method: 'POST',
            payload: {
                message: "I'm looking for a laptop under $1000",
                merchantId: "test_merchant",
                sessionId: "e2e_test_session"
            },
            headers: {
                'Content-Type': 'application/json',
                'X-Merchant-ID': 'test_merchant'
            },
            expectedResponse: {
                statusCode: 200,
                maxLatencyMs: 8000,
                minAccuracy: 0.80,
                bodyContains: ['laptop', 'budget', 'recommendation']
            },
            frequency: 600, // 10 minutes
            timeout: 45,
            retries: 2,
            enabled: true,
            merchantId: 'test_merchant'
        });
        // Availability test
        this.addSyntheticTest({
            id: 'service_availability',
            name: 'Service Availability Check',
            type: 'availability',
            endpoint: '/api/v1/status',
            method: 'GET',
            expectedResponse: {
                statusCode: 200,
                maxLatencyMs: 2000
            },
            frequency: 60, // 1 minute
            timeout: 10,
            retries: 3,
            enabled: true
        });
    }
    addSyntheticTest(test) {
        this.syntheticTests.set(test.id, test);
        if (test.enabled) {
            this.startTest(test);
        }
    }
    startTest(test) {
        // Clear existing interval if any
        const existingInterval = this.testIntervals.get(test.id);
        if (existingInterval) {
            clearInterval(existingInterval);
        }
        // Start new interval
        const interval = setInterval(async () => {
            await this.executeTest(test);
        }, test.frequency * 1000);
        this.testIntervals.set(test.id, interval);
        // Execute immediately
        this.executeTest(test);
    }
    async executeTest(test) {
        const context = {
            merchantId: test.merchantId || 'system',
            requestId: `synthetic-test-${test.id}-${Date.now()}`,
            operation: 'execute_synthetic_test'
        };
        const startTime = Date.now();
        let result;
        try {
            await this.loggingService.logInfo(`Executing synthetic test: ${test.name}`, context, { testId: test.id, testType: test.type });
            // Execute the test
            const response = await this.performHttpRequest(test);
            const endTime = Date.now();
            const latencyMs = endTime - startTime;
            // Evaluate test results
            const success = await this.evaluateTestResult(test, response, latencyMs);
            // Extract metrics if applicable
            const metrics = await this.extractMetrics(test, response);
            result = {
                testId: test.id,
                timestamp: new Date(),
                success,
                latencyMs,
                statusCode: response.status,
                responseSize: response.body ? JSON.stringify(response.body).length : 0,
                metrics
            };
            // Store result
            this.storeTestResult(result);
            // Emit metrics
            await this.emitTestMetrics(test, result);
            // Check for alerts
            if (!success) {
                await this.handleTestFailure(test, result);
            }
            await this.loggingService.logInfo(`Synthetic test completed: ${test.name}`, context, {
                success,
                latencyMs,
                statusCode: response.status,
                metrics
            });
        }
        catch (error) {
            const endTime = Date.now();
            const latencyMs = endTime - startTime;
            result = {
                testId: test.id,
                timestamp: new Date(),
                success: false,
                latencyMs,
                errorMessage: error.message,
                metrics: {}
            };
            this.storeTestResult(result);
            await this.handleTestFailure(test, result);
            await this.loggingService.logError(error, context, { testId: test.id, testName: test.name });
        }
    }
    async performHttpRequest(test) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), test.timeout * 1000);
        try {
            const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}${test.endpoint}`, {
                method: test.method,
                headers: test.headers || {},
                body: test.payload ? JSON.stringify(test.payload) : undefined,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const body = response.headers.get('content-type')?.includes('application/json')
                ? await response.json()
                : await response.text();
            return {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async evaluateTestResult(test, response, latencyMs) {
        const expected = test.expectedResponse;
        if (!expected)
            return response.status < 400;
        // Check status code
        if (expected.statusCode && response.status !== expected.statusCode) {
            return false;
        }
        // Check latency
        if (expected.maxLatencyMs && latencyMs > expected.maxLatencyMs) {
            return false;
        }
        // Check response body content
        if (expected.bodyContains && response.body) {
            const bodyText = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
            for (const keyword of expected.bodyContains) {
                if (!bodyText.toLowerCase().includes(keyword.toLowerCase())) {
                    return false;
                }
            }
        }
        // Check accuracy for grounding tests
        if (expected.minAccuracy && test.type === 'grounding') {
            const accuracy = await this.calculateGroundingAccuracy(response.body);
            if (accuracy < expected.minAccuracy) {
                return false;
            }
        }
        return true;
    }
    async calculateGroundingAccuracy(responseBody) {
        // Simplified grounding accuracy calculation
        // In a real implementation, this would use the ResponseGroundingService
        if (!responseBody || !responseBody.response) {
            return 0;
        }
        // Check if response contains citations or references
        const response = responseBody.response;
        const hasCitations = response.includes('[') && response.includes(']');
        const hasReferences = response.includes('source:') || response.includes('according to');
        // Simple heuristic: if response has citations or references, assume higher accuracy
        if (hasCitations && hasReferences) {
            return 0.9;
        }
        else if (hasCitations || hasReferences) {
            return 0.7;
        }
        else {
            return 0.5;
        }
    }
    async extractMetrics(test, response) {
        const metrics = {};
        if (test.type === 'grounding' || test.type === 'accuracy') {
            metrics.accuracy = await this.calculateGroundingAccuracy(response.body);
            metrics.grounding = metrics.accuracy; // Simplified
        }
        if (test.type === 'end_to_end') {
            metrics.relevance = await this.calculateRelevanceScore(response.body);
        }
        return metrics;
    }
    async calculateRelevanceScore(responseBody) {
        // Simplified relevance calculation
        if (!responseBody || !responseBody.response) {
            return 0;
        }
        const response = responseBody.response.toLowerCase();
        // Check for relevant keywords based on common e-commerce queries
        const relevantKeywords = ['product', 'price', 'feature', 'specification', 'recommend', 'available'];
        const foundKeywords = relevantKeywords.filter(keyword => response.includes(keyword));
        return Math.min(1.0, foundKeywords.length / relevantKeywords.length);
    }
    storeTestResult(result) {
        if (!this.testResults.has(result.testId)) {
            this.testResults.set(result.testId, []);
        }
        const results = this.testResults.get(result.testId);
        results.push(result);
        // Keep only last 1000 results per test
        if (results.length > 1000) {
            results.splice(0, results.length - 1000);
        }
    }
    async emitTestMetrics(test, result) {
        const dimensions = {
            testId: test.id,
            testType: test.type,
            merchantId: test.merchantId || 'system'
        };
        // Emit latency metric
        await this.metricsService.collectMetrics({
            timestamp: result.timestamp,
            merchantId: test.merchantId || 'system',
            metrics: {
                retrievalLatencyMs: result.latencyMs
            },
            dimensions: { ...dimensions, metric_type: 'synthetic_latency' }
        });
        // Emit success/failure metric
        await this.metricsService.collectMetrics({
            timestamp: result.timestamp,
            merchantId: test.merchantId || 'system',
            metrics: {
                retrievalSuccessRate: result.success ? 100 : 0
            },
            dimensions: { ...dimensions, metric_type: 'synthetic_success' }
        });
        // Emit accuracy metrics if available
        if (result.metrics.accuracy !== undefined) {
            await this.metricsService.collectMetrics({
                timestamp: result.timestamp,
                merchantId: test.merchantId || 'system',
                metrics: {
                    groundingAccuracy: result.metrics.accuracy * 100
                },
                dimensions: { ...dimensions, metric_type: 'synthetic_accuracy' }
            });
        }
    }
    async handleTestFailure(test, result) {
        const alertNotification = {
            alertName: `SyntheticTestFailure_${test.id}`,
            severity: test.type === 'availability' ? 'critical' : 'high',
            timestamp: result.timestamp,
            metricName: `synthetic.${test.type}.failure`,
            currentValue: 0,
            threshold: 1,
            merchantId: test.merchantId,
            message: `Synthetic test '${test.name}' failed. ${result.errorMessage || `Status: ${result.statusCode}, Latency: ${result.latencyMs}ms`}`,
            actions: [
                { type: 'sns', target: 'synthetic-alerts' },
                { type: 'slack', target: process.env.SLACK_WEBHOOK_URL || '' }
            ]
        };
        await this.alertingService.handleAlert(alertNotification);
    }
    addRegressionTestSuite(suite) {
        this.regressionSuites.set(suite.id, suite);
        if (suite.enabled) {
            this.scheduleRegressionSuite(suite);
        }
    }
    scheduleRegressionSuite(suite) {
        // In a real implementation, this would use a cron scheduler
        // For now, we'll run it every hour as an example
        setInterval(async () => {
            await this.executeRegressionSuite(suite);
        }, 60 * 60 * 1000); // 1 hour
    }
    async executeRegressionSuite(suite) {
        const context = {
            merchantId: 'system',
            requestId: `regression-suite-${suite.id}-${Date.now()}`,
            operation: 'execute_regression_suite'
        };
        try {
            await this.loggingService.logInfo(`Executing regression test suite: ${suite.name}`, context, { suiteId: suite.id, testsCount: suite.tests.length });
            const results = [];
            for (const test of suite.tests) {
                const result = await this.executeRegressionTest(test);
                results.push(result);
            }
            const passedTests = results.filter(r => r.success).length;
            const failedTests = results.length - passedTests;
            await this.loggingService.logInfo(`Regression test suite completed: ${suite.name}`, context, {
                totalTests: results.length,
                passedTests,
                failedTests,
                successRate: (passedTests / results.length) * 100
            });
            // Emit regression test metrics
            await this.metricsService.collectMetrics({
                timestamp: new Date(),
                merchantId: 'system',
                metrics: {
                    retrievalSuccessRate: (passedTests / results.length) * 100
                },
                dimensions: {
                    suite_id: suite.id,
                    metric_type: 'regression_success_rate'
                }
            });
        }
        catch (error) {
            await this.loggingService.logError(error, context, { suiteId: suite.id });
        }
    }
    async executeRegressionTest(test) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Merchant-ID': test.merchantId
                },
                body: JSON.stringify({
                    message: test.query,
                    merchantId: test.merchantId,
                    sessionId: `regression_test_${test.id}_${Date.now()}`,
                    context: test.context
                })
            });
            const endTime = Date.now();
            const latencyMs = endTime - startTime;
            const responseBody = await response.json();
            // Evaluate test
            const accuracy = await this.calculateGroundingAccuracy(responseBody);
            const latencyPassed = latencyMs <= test.expectedResponse.maxLatency;
            const accuracyPassed = accuracy >= test.expectedResponse.minAccuracy;
            const responseText = responseBody?.response?.toLowerCase() || '';
            const keywordsPassed = test.expectedResponse.requiredKeywords.every(keyword => responseText.includes(keyword.toLowerCase()));
            const forbiddenKeywordsPassed = !test.expectedResponse.forbiddenKeywords.some(keyword => responseText.includes(keyword.toLowerCase()));
            const success = latencyPassed && accuracyPassed && keywordsPassed && forbiddenKeywordsPassed;
            return {
                testId: test.id,
                timestamp: new Date(),
                success,
                latencyMs,
                statusCode: response.status,
                metrics: { accuracy }
            };
        }
        catch (error) {
            return {
                testId: test.id,
                timestamp: new Date(),
                success: false,
                latencyMs: Date.now() - startTime,
                errorMessage: error.message,
                metrics: {}
            };
        }
    }
    getTestResults(testId, limit = 100) {
        const results = this.testResults.get(testId) || [];
        return results.slice(-limit);
    }
    getTestSuccessRate(testId, timeRangeHours = 24) {
        const results = this.getTestResults(testId, 1000);
        const cutoff = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
        const recentResults = results.filter(r => r.timestamp > cutoff);
        if (recentResults.length === 0)
            return 0;
        const successfulResults = recentResults.filter(r => r.success).length;
        return (successfulResults / recentResults.length) * 100;
    }
    stopTest(testId) {
        const interval = this.testIntervals.get(testId);
        if (interval) {
            clearInterval(interval);
            this.testIntervals.delete(testId);
        }
    }
    destroy() {
        // Stop all running tests
        for (const [testId] of this.testIntervals) {
            this.stopTest(testId);
        }
    }
}
exports.SyntheticMonitoringService = SyntheticMonitoringService;
// Singleton instance
let syntheticMonitoringInstance = null;
function getSyntheticMonitoringService() {
    if (!syntheticMonitoringInstance) {
        syntheticMonitoringInstance = new SyntheticMonitoringService();
    }
    return syntheticMonitoringInstance;
}
//# sourceMappingURL=SyntheticMonitoringService.js.map