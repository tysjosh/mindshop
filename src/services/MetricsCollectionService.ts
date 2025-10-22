import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { getLoggingService, LogContext } from './LoggingService';

export interface SystemMetrics {
  // Retrieval metrics
  retrievalLatencyMs: number;
  retrievalRecallAtK: number;
  retrievalSuccessRate: number;
  
  // Prediction metrics
  predictLatencyMs: number;
  predictConfidence: number;
  predictDriftScore: number;
  featureImportanceStability: number;
  
  // Grounding and quality metrics
  groundingAccuracy: number;
  hallucinationRate: number;
  
  // LLM and orchestration metrics
  bedrockTokensPerSession: number;
  bedrockLatencyMs: number;
  agentStepsPerSession: number;
  
  // Infrastructure metrics
  cpuUtilization: number;
  memoryUtilization: number;
  connectionCount: number;
  
  // Business metrics
  conversionRate: number;
  avgOrderValue: number;
  costPerSession: number;
  
  // Security and audit metrics
  unauthorizedAccessAttempts: number;
  suspiciousActivityAlerts: number;
}

export interface MetricsBatch {
  timestamp: Date;
  merchantId: string;
  sessionId?: string;
  metrics: Partial<SystemMetrics>;
  dimensions?: Record<string, string>;
}

export class MetricsCollectionService {
  private cloudWatch: CloudWatchClient;
  private loggingService = getLoggingService();
  private metricsBuffer: MetricsBatch[] = [];
  private bufferFlushInterval: NodeJS.Timeout;
  private readonly bufferSize = 20; // CloudWatch limit
  private readonly flushIntervalMs = 60000; // 1 minute

  constructor(region: string = 'us-east-1') {
    this.cloudWatch = new CloudWatchClient({ region });
    
    // Set up periodic buffer flush
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.flushIntervalMs);
  }

  public async collectMetrics(batch: MetricsBatch): Promise<void> {
    // Add to buffer
    this.metricsBuffer.push(batch);
    
    // Log metrics collection
    const context: LogContext = {
      merchantId: batch.merchantId,
      sessionId: batch.sessionId,
      requestId: `metrics-${Date.now()}`,
      operation: 'metrics_collection'
    };
    
    await this.loggingService.logInfo('Metrics collected', context, {
      metricsCount: Object.keys(batch.metrics).length,
      timestamp: batch.timestamp
    });

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetricsBuffer();
    }
  }

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const batches = this.metricsBuffer.splice(0, this.bufferSize);
      const metricData: any[] = [];

      for (const batch of batches) {
        const baseDimensions = [
          { Name: 'MerchantId', Value: batch.merchantId },
          ...(batch.sessionId ? [{ Name: 'SessionId', Value: batch.sessionId }] : []),
          ...Object.entries(batch.dimensions || {}).map(([name, value]) => ({
            Name: name,
            Value: value
          }))
        ];

        // Convert metrics to CloudWatch format
        Object.entries(batch.metrics).forEach(([metricName, value]) => {
          if (value !== undefined && value !== null) {
            metricData.push({
              MetricName: this.normalizeMetricName(metricName),
              Value: value,
              Unit: this.getMetricUnit(metricName),
              Timestamp: batch.timestamp,
              Dimensions: baseDimensions
            });
          }
        });
      }

      if (metricData.length > 0) {
        await this.cloudWatch.send(new PutMetricDataCommand({
          Namespace: 'MindsDB/RAG',
          MetricData: metricData
        }));
      }
    } catch (error) {
      console.error('Failed to flush metrics buffer:', error);
      await this.loggingService.logError(
        error as Error,
        {
          merchantId: 'system',
          requestId: `metrics-flush-${Date.now()}`,
          operation: 'metrics_flush'
        }
      );
    }
  }

  private normalizeMetricName(metricName: string): string {
    // Convert camelCase to dot notation for CloudWatch
    return metricName
      .replace(/([A-Z])/g, '.$1')
      .toLowerCase()
      .replace(/^\./, '');
  }

  private getMetricUnit(metricName: string): string {
    const unitMap: Record<string, string> = {
      'retrievalLatencyMs': 'Milliseconds',
      'predictLatencyMs': 'Milliseconds',
      'bedrockLatencyMs': 'Milliseconds',
      'retrievalRecallAtK': 'Percent',
      'retrievalSuccessRate': 'Percent',
      'predictConfidence': 'Percent',
      'groundingAccuracy': 'Percent',
      'hallucinationRate': 'Percent',
      'conversionRate': 'Percent',
      'cpuUtilization': 'Percent',
      'memoryUtilization': 'Percent',
      'bedrockTokensPerSession': 'Count',
      'agentStepsPerSession': 'Count',
      'connectionCount': 'Count',
      'avgOrderValue': 'Count',
      'costPerSession': 'Count',
      'unauthorizedAccessAttempts': 'Count',
      'suspiciousActivityAlerts': 'Count',
      'predictDriftScore': 'Count',
      'featureImportanceStability': 'Count'
    };

    return unitMap[metricName] || 'Count';
  }

  // Convenience methods for specific metric types
  public async collectRetrievalMetrics(
    merchantId: string,
    sessionId: string,
    latencyMs: number,
    recallAtK: number,
    successRate: number,
    k: number = 5
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      sessionId,
      metrics: {
        retrievalLatencyMs: latencyMs,
        retrievalRecallAtK: recallAtK,
        retrievalSuccessRate: successRate
      },
      dimensions: { k: k.toString() }
    });
  }

  public async collectPredictionMetrics(
    merchantId: string,
    sessionId: string,
    latencyMs: number,
    confidence: number,
    driftScore: number,
    modelId: string
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      sessionId,
      metrics: {
        predictLatencyMs: latencyMs,
        predictConfidence: confidence,
        predictDriftScore: driftScore
      },
      dimensions: { modelId }
    });
  }

  public async collectGroundingMetrics(
    merchantId: string,
    sessionId: string,
    accuracy: number,
    hallucinationRate: number
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      sessionId,
      metrics: {
        groundingAccuracy: accuracy,
        hallucinationRate: hallucinationRate
      }
    });
  }

  public async collectLLMMetrics(
    merchantId: string,
    sessionId: string,
    tokensPerSession: number,
    latencyMs: number,
    stepsPerSession: number
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      sessionId,
      metrics: {
        bedrockTokensPerSession: tokensPerSession,
        bedrockLatencyMs: latencyMs,
        agentStepsPerSession: stepsPerSession
      }
    });
  }

  public async collectInfrastructureMetrics(
    merchantId: string,
    cpuUtilization: number,
    memoryUtilization: number,
    connectionCount: number,
    service: string
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      metrics: {
        cpuUtilization,
        memoryUtilization,
        connectionCount
      },
      dimensions: { service }
    });
  }

  public async collectBusinessMetrics(
    merchantId: string,
    conversionRate: number,
    avgOrderValue: number,
    costPerSession: number
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      metrics: {
        conversionRate,
        avgOrderValue,
        costPerSession
      }
    });
  }

  public async collectSecurityMetrics(
    merchantId: string,
    unauthorizedAccessAttempts: number,
    suspiciousActivityAlerts: number
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      metrics: {
        unauthorizedAccessAttempts,
        suspiciousActivityAlerts
      }
    });
  }

  // Method to create performance timers with automatic metric collection
  public createPerformanceTimer(
    metricName: keyof SystemMetrics,
    merchantId: string,
    sessionId?: string,
    dimensions?: Record<string, string>
  ) {
    const startTime = Date.now();
    
    return {
      end: async () => {
        const duration = Date.now() - startTime;
        await this.collectMetrics({
          timestamp: new Date(),
          merchantId,
          sessionId,
          metrics: { [metricName]: duration } as Partial<SystemMetrics>,
          dimensions
        });
        return duration;
      }
    };
  }

  // Method to increment counter metrics
  public async incrementCounter(
    metricName: keyof SystemMetrics,
    merchantId: string,
    value: number = 1,
    dimensions?: Record<string, string>
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      metrics: { [metricName]: value } as Partial<SystemMetrics>,
      dimensions
    });
  }

  // Method to set gauge metrics
  public async setGauge(
    metricName: keyof SystemMetrics,
    merchantId: string,
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    await this.collectMetrics({
      timestamp: new Date(),
      merchantId,
      metrics: { [metricName]: value } as Partial<SystemMetrics>,
      dimensions
    });
  }

  // Cleanup method
  public destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    // Flush any remaining metrics
    this.flushMetricsBuffer();
  }
}

// Singleton instance
let metricsServiceInstance: MetricsCollectionService | null = null;

export function getMetricsCollectionService(): MetricsCollectionService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsCollectionService(
      process.env.AWS_REGION || 'us-east-1'
    );
  }
  return metricsServiceInstance;
}