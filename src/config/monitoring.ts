export interface MonitoringConfig {
  cloudWatch: {
    region: string;
    logGroupName: string;
    auditLogGroupName: string;
    metricsNamespace: string;
  };
  kms: {
    keyId?: string;
  };
  logging: {
    level: string;
    enableCloudWatch: boolean;
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
  };
  metrics: {
    bufferSize: number;
    flushIntervalMs: number;
    enableCustomMetrics: boolean;
  };
  alerts: {
    groundingAccuracyThreshold: number;
    costPerSessionThreshold: number;
    latencyThresholdMs: number;
    confidenceDriftThreshold: number;
  };
}

export const monitoringConfig: MonitoringConfig = {
  cloudWatch: {
    region: process.env.AWS_REGION || 'us-east-1',
    logGroupName: process.env.CLOUDWATCH_LOG_GROUP || '/aws/mindsdb-rag/application',
    auditLogGroupName: process.env.CLOUDWATCH_AUDIT_LOG_GROUP || '/aws/mindsdb-rag/audit',
    metricsNamespace: process.env.CLOUDWATCH_METRICS_NAMESPACE || 'MindsDB/RAG'
  },
  kms: {
    keyId: process.env.KMS_KEY_ID
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableCloudWatch: process.env.ENABLE_CLOUDWATCH_LOGS !== 'false',
    enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
    enableFile: process.env.ENABLE_FILE_LOGS !== 'false',
    logDirectory: process.env.LOG_DIRECTORY || 'logs'
  },
  metrics: {
    bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '20'),
    flushIntervalMs: parseInt(process.env.METRICS_FLUSH_INTERVAL_MS || '60000'),
    enableCustomMetrics: process.env.ENABLE_CUSTOM_METRICS !== 'false'
  },
  alerts: {
    groundingAccuracyThreshold: parseFloat(process.env.GROUNDING_ACCURACY_THRESHOLD || '0.85'),
    costPerSessionThreshold: parseFloat(process.env.COST_PER_SESSION_THRESHOLD || '0.05'),
    latencyThresholdMs: parseInt(process.env.LATENCY_THRESHOLD_MS || '250'),
    confidenceDriftThreshold: parseFloat(process.env.CONFIDENCE_DRIFT_THRESHOLD || '0.1')
  }
};

// Validation function for monitoring configuration
export function validateMonitoringConfig(config: MonitoringConfig): string[] {
  const errors: string[] = [];

  if (!config.cloudWatch.region) {
    errors.push('CloudWatch region is required');
  }

  if (!config.cloudWatch.logGroupName) {
    errors.push('CloudWatch log group name is required');
  }

  if (config.alerts.groundingAccuracyThreshold < 0 || config.alerts.groundingAccuracyThreshold > 1) {
    errors.push('Grounding accuracy threshold must be between 0 and 1');
  }

  if (config.alerts.costPerSessionThreshold <= 0) {
    errors.push('Cost per session threshold must be positive');
  }

  if (config.alerts.latencyThresholdMs <= 0) {
    errors.push('Latency threshold must be positive');
  }

  if (config.metrics.bufferSize <= 0 || config.metrics.bufferSize > 20) {
    errors.push('Metrics buffer size must be between 1 and 20');
  }

  return errors;
}

// Environment-specific configurations
export const getEnvironmentConfig = (): Partial<MonitoringConfig> => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        logging: {
          level: 'warn',
          enableCloudWatch: true,
          enableConsole: false,
          enableFile: true,
          logDirectory: '/var/log/mindsdb-rag'
        },
        metrics: {
          bufferSize: 20,
          flushIntervalMs: 30000, // More frequent in production
          enableCustomMetrics: true
        }
      };

    case 'staging':
      return {
        logging: {
          level: 'info',
          enableCloudWatch: true,
          enableConsole: true,
          enableFile: true,
          logDirectory: 'logs'
        },
        metrics: {
          bufferSize: 10,
          flushIntervalMs: 60000,
          enableCustomMetrics: true
        }
      };

    case 'development':
    default:
      return {
        logging: {
          level: 'debug',
          enableCloudWatch: false,
          enableConsole: true,
          enableFile: true,
          logDirectory: 'logs'
        },
        metrics: {
          bufferSize: 5,
          flushIntervalMs: 120000, // Less frequent in development
          enableCustomMetrics: false
        }
      };
  }
};

// Merge environment-specific config with base config
export const getFinalMonitoringConfig = (): MonitoringConfig => {
  const envConfig = getEnvironmentConfig();
  return {
    ...monitoringConfig,
    ...envConfig,
    cloudWatch: {
      ...monitoringConfig.cloudWatch,
      ...envConfig.cloudWatch
    },
    logging: {
      ...monitoringConfig.logging,
      ...envConfig.logging
    },
    metrics: {
      ...monitoringConfig.metrics,
      ...envConfig.metrics
    },
    alerts: {
      ...monitoringConfig.alerts,
      ...envConfig.alerts
    }
  };
};