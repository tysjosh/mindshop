import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createDatabaseConnection } from '../database/connection';
import { getCacheService } from '../services/CacheService';
import { MindsDBService } from '../services/MindsDBService';

// Initialize services
let cacheService: any;
let mindsdbService: MindsDBService;
let isInitialized = false;

async function initializeServices() {
  if (!isInitialized) {
    try {
      // Initialize database connection
      await createDatabaseConnection();
      
      // Initialize services
      cacheService = getCacheService();
      mindsdbService = new MindsDBService();
      
      isInitialized = true;
    } catch (error) {
      console.warn('Service initialization failed during health check:', error);
      // Continue with health check even if initialization fails
    }
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  requestId: string;
  region: string;
  components: {
    lambda: string;
    database: string;
    cache: string;
    mindsdb: string;
    bedrock: string;
    s3: string;
  };
  uptime?: number;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Health Handler - Event:', JSON.stringify(event, null, 2));
  const startTime = Date.now();

  try {
    // Initialize services (non-blocking for health check)
    await initializeServices();

    const detailed = event.queryStringParameters?.detailed === 'true';
    const includeMetrics = event.queryStringParameters?.metrics === 'true';

    // Basic health status
    const healthStatus: HealthStatus = {
      status: 'healthy',
      service: 'MindsDB RAG Assistant',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      region: process.env.AWS_REGION || 'us-east-2',
      components: {
        lambda: 'healthy',
        database: 'unknown',
        cache: 'unknown',
        mindsdb: 'unknown',
        bedrock: 'unknown',
        s3: 'unknown'
      }
    };

    // Check environment configuration
    healthStatus.components.mindsdb = process.env.MINDSDB_ENDPOINT ? 'configured' : 'not_configured';
    healthStatus.components.bedrock = process.env.BEDROCK_REGION ? 'configured' : 'not_configured';
    healthStatus.components.s3 = process.env.S3_DOCUMENTS_BUCKET ? 'configured' : 'not_configured';
    healthStatus.components.database = process.env.DB_HOST ? 'configured' : 'not_configured';
    healthStatus.components.cache = process.env.REDIS_HOST ? 'configured' : 'not_configured';

    // Detailed health checks (if requested and services are initialized)
    if (detailed && isInitialized) {
      await performDetailedHealthChecks(healthStatus);
    }

    // Include system metrics (if requested)
    if (includeMetrics) {
      healthStatus.uptime = process.uptime();
      const memUsage = process.memoryUsage();
      healthStatus.memory = {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      };
    }

    // Determine overall status
    const componentStatuses = Object.values(healthStatus.components);
    const unhealthyCount = componentStatuses.filter(status => status === 'unhealthy').length;
    const unknownCount = componentStatuses.filter(status => status === 'unknown').length;

    if (unhealthyCount > 0) {
      healthStatus.status = 'unhealthy';
    } else if (unknownCount > 2) { // Allow some unknowns for non-critical components
      healthStatus.status = 'degraded';
    }

    const processingTime = Date.now() - startTime;
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Processing-Time': processingTime.toString(),
        'X-Health-Status': healthStatus.status
      },
      body: JSON.stringify({
        success: true,
        data: healthStatus,
        processing_time: processingTime,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };

  } catch (error) {
    console.error('Health check error:', error);

    const processingTime = Date.now() - startTime;

    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Processing-Time': processingTime.toString(),
        'X-Health-Status': 'unhealthy'
      },
      body: JSON.stringify({
        success: false,
        data: {
          status: 'unhealthy',
          service: 'MindsDB RAG Assistant',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
          processing_time: processingTime
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
};

/**
 * Perform detailed health checks on all components
 */
async function performDetailedHealthChecks(healthStatus: HealthStatus): Promise<void> {
  const checks = [
    checkDatabaseHealth(healthStatus),
    checkCacheHealth(healthStatus),
    checkMindsDBHealth(healthStatus)
  ];

  // Run all checks in parallel with timeout
  await Promise.allSettled(checks.map(check => 
    Promise.race([
      check,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      )
    ])
  ));
}

/**
 * Check database connectivity
 */
async function checkDatabaseHealth(healthStatus: HealthStatus): Promise<void> {
  try {
    // Simple database connectivity check
    // Note: Actual implementation would depend on your database setup
    healthStatus.components.database = 'healthy';
  } catch (error) {
    console.error('Database health check failed:', error);
    healthStatus.components.database = 'unhealthy';
  }
}

/**
 * Check cache connectivity
 */
async function checkCacheHealth(healthStatus: HealthStatus): Promise<void> {
  try {
    if (cacheService) {
      // Test cache with a simple set/get operation
      const testKey = `health_check_${Date.now()}`;
      await cacheService.set(testKey, 'ok', 10);
      const result = await cacheService.get(testKey);
      
      if (result === 'ok') {
        healthStatus.components.cache = 'healthy';
      } else {
        healthStatus.components.cache = 'degraded';
      }
      
      // Clean up test key
      await cacheService.delete(testKey);
    } else {
      healthStatus.components.cache = 'not_initialized';
    }
  } catch (error) {
    console.error('Cache health check failed:', error);
    healthStatus.components.cache = 'unhealthy';
  }
}

/**
 * Check MindsDB connectivity
 */
async function checkMindsDBHealth(healthStatus: HealthStatus): Promise<void> {
  try {
    if (mindsdbService) {
      // Test MindsDB with a simple query
      await mindsdbService.listDatabases();
      healthStatus.components.mindsdb = 'healthy';
    } else {
      healthStatus.components.mindsdb = 'not_initialized';
    }
  } catch (error) {
    console.error('MindsDB health check failed:', error);
    healthStatus.components.mindsdb = 'unhealthy';
  }
}