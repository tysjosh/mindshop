export interface SyntheticTest {
    id: string;
    name: string;
    type: 'latency' | 'grounding' | 'accuracy' | 'availability' | 'end_to_end';
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    payload?: any;
    headers?: Record<string, string>;
    expectedResponse?: {
        statusCode?: number;
        bodyContains?: string[];
        maxLatencyMs?: number;
        minAccuracy?: number;
    };
    frequency: number;
    timeout: number;
    retries: number;
    enabled: boolean;
    merchantId?: string;
}
export interface SyntheticTestResult {
    testId: string;
    timestamp: Date;
    success: boolean;
    latencyMs: number;
    statusCode?: number;
    responseSize?: number;
    errorMessage?: string;
    metrics: {
        accuracy?: number;
        grounding?: number;
        relevance?: number;
    };
}
export interface RegressionTestSuite {
    id: string;
    name: string;
    description: string;
    tests: RegressionTest[];
    schedule: string;
    enabled: boolean;
}
export interface RegressionTest {
    id: string;
    name: string;
    query: string;
    expectedResponse: {
        minAccuracy: number;
        maxLatency: number;
        requiredKeywords: string[];
        forbiddenKeywords: string[];
    };
    merchantId: string;
    context?: any;
}
export interface BusinessIntelligenceDashboard {
    id: string;
    name: string;
    merchantId: string;
    widgets: DashboardWidget[];
    refreshInterval: number;
    enabled: boolean;
}
export interface DashboardWidget {
    id: string;
    type: 'metric' | 'chart' | 'table' | 'alert_status';
    title: string;
    query: string;
    visualization: 'line' | 'bar' | 'pie' | 'gauge' | 'number';
    timeRange: string;
    refreshInterval: number;
}
export declare class SyntheticMonitoringService {
    private loggingService;
    private metricsService;
    private alertingService;
    private syntheticTests;
    private testIntervals;
    private regressionSuites;
    private testResults;
    constructor();
    private initializeDefaultTests;
    addSyntheticTest(test: SyntheticTest): void;
    private startTest;
    private executeTest;
    private performHttpRequest;
    private evaluateTestResult;
    private calculateGroundingAccuracy;
    private extractMetrics;
    private calculateRelevanceScore;
    private storeTestResult;
    private emitTestMetrics;
    private handleTestFailure;
    addRegressionTestSuite(suite: RegressionTestSuite): void;
    private scheduleRegressionSuite;
    private executeRegressionSuite;
    private executeRegressionTest;
    getTestResults(testId: string, limit?: number): SyntheticTestResult[];
    getTestSuccessRate(testId: string, timeRangeHours?: number): number;
    stopTest(testId: string): void;
    destroy(): void;
}
export declare function getSyntheticMonitoringService(): SyntheticMonitoringService;
//# sourceMappingURL=SyntheticMonitoringService.d.ts.map