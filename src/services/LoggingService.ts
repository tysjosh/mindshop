import winston from 'winston';
import { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';

export interface LogContext {
  merchantId: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  timestamp?: Date;
  bucket?: string;
  fileName?: string;
  documentId?: string;
  key?: string;
  contentType?: string;
  contentLength?: number;
  executionId?: string;
  executionTime?: number;
}

export interface MetricData {
  name: string;
  value: number;
  unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Percent' | 'Bytes';
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface AuditLogEntry {
  timestamp: Date;
  merchant_id: string;
  user_id?: string;
  session_id?: string;
  operation: string;
  request_payload_hash: string;
  response_reference: string;
  outcome: 'success' | 'failure';
  reason?: string;
  actor: string;
}

export class LoggingService {
  private logger: winston.Logger;
  private cloudWatchLogs: CloudWatchLogsClient;
  private cloudWatch: CloudWatchClient;
  private kms: KMSClient;
  private logGroupName: string;
  private kmsKeyId?: string;

  // PII patterns for redaction
  private readonly piiPatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
  ];

  constructor(config: {
    logGroupName: string;
    kmsKeyId?: string;
    region?: string;
  }) {
    this.logGroupName = config.logGroupName;
    this.kmsKeyId = config.kmsKeyId;

    // Initialize AWS clients
    this.cloudWatchLogs = new CloudWatchLogsClient({ region: config.region || 'us-east-1' });
    this.cloudWatch = new CloudWatchClient({ region: config.region || 'us-east-1' });
    this.kms = new KMSClient({ region: config.region || 'us-east-1' });

    // Configure Winston logger with structured JSON format
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf((info) => {
          // Redact PII before logging
          const sanitized = this.redactPII(JSON.stringify(info));
          return sanitized;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });

    this.initializeCloudWatchLogGroup();
  }

  private async initializeCloudWatchLogGroup(): Promise<void> {
    try {
      await this.cloudWatchLogs.send(new CreateLogGroupCommand({
        logGroupName: this.logGroupName,
        kmsKeyId: this.kmsKeyId
      }));
    } catch (error: any) {
      if (error.name !== 'ResourceAlreadyExistsException') {
        console.error('Failed to create CloudWatch log group:', error);
      }
    }
  }

  private redactPII(text: string): string {
    let redacted = text;
    
    this.piiPatterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });

    // Additional custom redaction for sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'creditCard', 'ssn'];
    sensitiveFields.forEach(field => {
      const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
      redacted = redacted.replace(regex, `"${field}":"[REDACTED]"`);
    });

    return redacted;
  }

  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  public async logInfo(message: string, context: LogContext, metadata?: any): Promise<void> {
    const logEntry = {
      level: 'info',
      message,
      merchantId: context.merchantId,
      sessionId: context.sessionId,
      requestId: context.requestId || this.generateRequestId(),
      userId: context.userId,
      operation: context.operation,
      timestamp: context.timestamp || new Date(),
      metadata: metadata || {}
    };

    this.logger.info(logEntry);
    await this.sendToCloudWatch(logEntry);
  }

  public async logError(error: Error, context: LogContext, metadata?: any): Promise<void> {
    const logEntry = {
      level: 'error',
      message: error.message,
      stack: error.stack,
      merchantId: context.merchantId,
      sessionId: context.sessionId,
      requestId: context.requestId || this.generateRequestId(),
      userId: context.userId,
      operation: context.operation,
      timestamp: context.timestamp || new Date(),
      metadata: metadata || {}
    };

    this.logger.error(logEntry);
    await this.sendToCloudWatch(logEntry);
  }

  public async logWarning(message: string, context: LogContext, metadata?: any): Promise<void> {
    const logEntry = {
      level: 'warn',
      message,
      merchantId: context.merchantId,
      sessionId: context.sessionId,
      requestId: context.requestId || this.generateRequestId(),
      userId: context.userId,
      operation: context.operation,
      timestamp: context.timestamp || new Date(),
      metadata: metadata || {}
    };

    this.logger.warn(logEntry);
    await this.sendToCloudWatch(logEntry);
  }

  public async logAudit(auditEntry: AuditLogEntry): Promise<void> {
    const logEntry = {
      level: 'audit',
      ...auditEntry,
      timestamp: auditEntry.timestamp || new Date()
    };

    // Encrypt sensitive audit data if KMS key is provided
    if (this.kmsKeyId && auditEntry.request_payload_hash) {
      try {
        const encryptCommand = new EncryptCommand({
          KeyId: this.kmsKeyId,
          Plaintext: Buffer.from(auditEntry.request_payload_hash)
        });
        const encryptResult = await this.kms.send(encryptCommand);
        logEntry.request_payload_hash = Buffer.from(encryptResult.CiphertextBlob!).toString('base64');
      } catch (error) {
        console.error('Failed to encrypt audit log payload hash:', error);
      }
    }

    this.logger.info(logEntry);
    await this.sendToCloudWatch(logEntry, `${this.logGroupName}/audit`);
  }

  private async sendToCloudWatch(logEntry: any, logGroupName?: string): Promise<void> {
    try {
      const targetLogGroup = logGroupName || this.logGroupName;
      const logStreamName = `${logEntry.merchantId}-${new Date().toISOString().split('T')[0]}`;

      // Create log stream if it doesn't exist
      try {
        await this.cloudWatchLogs.send(new CreateLogStreamCommand({
          logGroupName: targetLogGroup,
          logStreamName
        }));
      } catch (error: any) {
        if (error.name !== 'ResourceAlreadyExistsException') {
          console.error('Failed to create log stream:', error);
        }
      }

      // Send log event
      await this.cloudWatchLogs.send(new PutLogEventsCommand({
        logGroupName: targetLogGroup,
        logStreamName,
        logEvents: [{
          timestamp: logEntry.timestamp.getTime(),
          message: JSON.stringify(logEntry)
        }]
      }));
    } catch (error) {
      console.error('Failed to send log to CloudWatch:', error);
    }
  }

  public async putMetric(metric: MetricData, namespace: string = 'MindsDB/RAG'): Promise<void> {
    try {
      const dimensions = Object.entries(metric.dimensions || {}).map(([name, value]) => ({
        Name: name,
        Value: value
      }));

      await this.cloudWatch.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [{
          MetricName: metric.name,
          Value: metric.value,
          Unit: metric.unit,
          Timestamp: metric.timestamp || new Date(),
          Dimensions: dimensions
        }]
      }));
    } catch (error) {
      console.error('Failed to put metric to CloudWatch:', error);
    }
  }

  public async putMetrics(metrics: MetricData[], namespace: string = 'MindsDB/RAG'): Promise<void> {
    try {
      const metricData = metrics.map(metric => ({
        MetricName: metric.name,
        Value: metric.value,
        Unit: metric.unit,
        Timestamp: metric.timestamp || new Date(),
        Dimensions: Object.entries(metric.dimensions || {}).map(([name, value]) => ({
          Name: name,
          Value: value
        }))
      }));

      await this.cloudWatch.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: metricData
      }));
    } catch (error) {
      console.error('Failed to put metrics to CloudWatch:', error);
    }
  }

  // Utility method to create performance timing metrics
  public createTimer(metricName: string, dimensions?: Record<string, string>) {
    const startTime = Date.now();
    
    return {
      end: async () => {
        const duration = Date.now() - startTime;
        await this.putMetric({
          name: metricName,
          value: duration,
          unit: 'Milliseconds',
          dimensions
        });
        return duration;
      }
    };
  }

  // Method to log retrieval metrics
  public async logRetrievalMetrics(
    latencyMs: number,
    recallAtK: number,
    successRate: number,
    merchantId: string,
    k: number = 5
  ): Promise<void> {
    const dimensions = { merchantId, k: k.toString() };
    
    await this.putMetrics([
      {
        name: 'retrieval.latency_ms',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions
      },
      {
        name: `retrieval.recall_at_${k}`,
        value: recallAtK,
        unit: 'Percent',
        dimensions
      },
      {
        name: 'retrieval.success_rate',
        value: successRate,
        unit: 'Percent',
        dimensions
      }
    ]);
  }

  // Method to log prediction metrics
  public async logPredictionMetrics(
    latencyMs: number,
    confidence: number,
    driftScore: number,
    merchantId: string,
    modelId: string
  ): Promise<void> {
    const dimensions = { merchantId, modelId };
    
    await this.putMetrics([
      {
        name: 'predict.latency_ms',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions
      },
      {
        name: 'predict.confidence',
        value: confidence,
        unit: 'Percent',
        dimensions
      },
      {
        name: 'predict.drift_score',
        value: driftScore,
        unit: 'Count',
        dimensions
      }
    ]);
  }

  // Method to log grounding and quality metrics
  public async logGroundingMetrics(
    accuracy: number,
    hallucination_rate: number,
    merchantId: string,
    sessionId: string
  ): Promise<void> {
    const dimensions = { merchantId, sessionId };
    
    await this.putMetrics([
      {
        name: 'grounding.accuracy',
        value: accuracy,
        unit: 'Percent',
        dimensions
      },
      {
        name: 'grounding.hallucination_rate',
        value: hallucination_rate,
        unit: 'Percent',
        dimensions
      }
    ]);
  }

  // Method to log LLM and orchestration metrics
  public async logLLMMetrics(
    tokensPerSession: number,
    latencyMs: number,
    stepsPerSession: number,
    merchantId: string,
    sessionId: string
  ): Promise<void> {
    const dimensions = { merchantId, sessionId };
    
    await this.putMetrics([
      {
        name: 'bedrock.tokens_per_session',
        value: tokensPerSession,
        unit: 'Count',
        dimensions
      },
      {
        name: 'bedrock.latency_ms',
        value: latencyMs,
        unit: 'Milliseconds',
        dimensions
      },
      {
        name: 'agent.steps_per_session',
        value: stepsPerSession,
        unit: 'Count',
        dimensions
      }
    ]);
  }

  // Method to log business metrics
  public async logBusinessMetrics(
    conversionRate: number,
    avgOrderValue: number,
    costPerSession: number,
    merchantId: string
  ): Promise<void> {
    const dimensions = { merchantId };
    
    await this.putMetrics([
      {
        name: 'business.conversion_rate',
        value: conversionRate,
        unit: 'Percent',
        dimensions
      },
      {
        name: 'business.avg_order_value',
        value: avgOrderValue,
        unit: 'Count',
        dimensions
      },
      {
        name: 'business.cost_per_session',
        value: costPerSession,
        unit: 'Count',
        dimensions
      }
    ]);
  }
}

// Singleton instance
let loggingServiceInstance: LoggingService | null = null;

export function getLoggingService(): LoggingService {
  if (!loggingServiceInstance) {
    loggingServiceInstance = new LoggingService({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP || '/aws/mindsdb-rag/application',
      kmsKeyId: process.env.KMS_KEY_ID,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
  return loggingServiceInstance;
}