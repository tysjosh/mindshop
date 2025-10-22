import { Request, Response, NextFunction } from 'express';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { config } from '../../config';

const cloudWatchClient = new CloudWatchClient({ region: config.aws.region });

export const metricsLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const merchantId = req.body?.merchantId || req.query?.merchantId || req.params?.merchantId;

    // Emit metrics to CloudWatch (async, don't block response)
    emitMetrics({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      merchantId,
    }).catch(error => {
      console.error('Failed to emit metrics:', error);
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

async function emitMetrics(data: {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  merchantId?: string;
}): Promise<void> {
  try {
    const metrics = [
      {
        MetricName: 'RequestCount',
        Value: 1,
        Unit: 'Count' as const,
        Dimensions: [
          { Name: 'Method', Value: data.method },
          { Name: 'Path', Value: data.path },
          { Name: 'StatusCode', Value: data.statusCode.toString() },
        ],
      },
      {
        MetricName: 'ResponseTime',
        Value: data.duration,
        Unit: 'Milliseconds' as const,
        Dimensions: [
          { Name: 'Method', Value: data.method },
          { Name: 'Path', Value: data.path },
        ],
      },
    ];

    if (data.merchantId) {
      metrics.forEach(metric => {
        metric.Dimensions.push({ Name: 'MerchantId', Value: data.merchantId! });
      });
    }

    await cloudWatchClient.send(new PutMetricDataCommand({
      Namespace: 'MindsDB/RAGAssistant/API',
      MetricData: metrics,
    }));
  } catch (error) {
    console.error('CloudWatch metrics emission failed:', error);
  }
}