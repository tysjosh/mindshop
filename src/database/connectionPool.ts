import { Pool, PoolConfig } from 'pg';
import { config } from '../config';

/**
 * Optimized PostgreSQL connection pool configuration
 * Implements best practices for production performance
 */

export interface ConnectionPoolOptions {
  // Maximum number of clients in the pool
  max?: number;
  // Minimum number of clients in the pool
  min?: number;
  // Maximum time (ms) a client can be idle before being closed
  idleTimeoutMillis?: number;
  // Maximum time (ms) to wait for a connection
  connectionTimeoutMillis?: number;
  // Maximum time (ms) a query can run before timing out
  statementTimeout?: number;
  // Enable connection keep-alive
  keepAlive?: boolean;
  // Keep-alive initial delay (ms)
  keepAliveInitialDelayMillis?: number;
}

/**
 * Get optimized pool configuration based on environment
 */
export function getOptimizedPoolConfig(
  environment: string = process.env.NODE_ENV || 'development'
): PoolConfig {
  const baseConfig: PoolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.username,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  };

  // Environment-specific optimizations
  const envConfig: ConnectionPoolOptions = getEnvironmentConfig(environment);

  return {
    ...baseConfig,
    max: envConfig.max,
    min: envConfig.min,
    idleTimeoutMillis: envConfig.idleTimeoutMillis,
    connectionTimeoutMillis: envConfig.connectionTimeoutMillis,
    statement_timeout: envConfig.statementTimeout,
    keepAlive: envConfig.keepAlive,
    keepAliveInitialDelayMillis: envConfig.keepAliveInitialDelayMillis,
    
    // Additional optimizations
    allowExitOnIdle: false, // Keep pool alive
    application_name: 'rag-assistant-api',
  };
}

/**
 * Get environment-specific configuration
 */
function getEnvironmentConfig(environment: string): ConnectionPoolOptions {
  switch (environment) {
    case 'production':
      return {
        max: 20, // Higher for production load
        min: 5, // Keep minimum connections warm
        idleTimeoutMillis: 30000, // 30 seconds
        connectionTimeoutMillis: 5000, // 5 seconds
        statementTimeout: 30000, // 30 seconds
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000, // 10 seconds
      };

    case 'staging':
      return {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statementTimeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };

    case 'test':
      return {
        max: 5,
        min: 1,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 3000,
        statementTimeout: 10000,
        keepAlive: false,
      };

    case 'development':
    default:
      return {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statementTimeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };
  }
}

/**
 * Create and configure connection pool with monitoring
 */
export function createOptimizedPool(environment?: string): Pool {
  const poolConfig = getOptimizedPoolConfig(environment);
  const pool = new Pool(poolConfig);

  // Pool event handlers for monitoring
  pool.on('connect', (client) => {
    console.log('New database connection established');
  });

  pool.on('acquire', (client) => {
    // Client acquired from pool
  });

  pool.on('remove', (client) => {
    console.log('Database connection removed from pool');
  });

  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle database client:', err);
  });

  // Log pool statistics periodically (every 5 minutes in production)
  if (environment === 'production') {
    setInterval(() => {
      logPoolStatistics(pool);
    }, 5 * 60 * 1000);
  }

  return pool;
}

/**
 * Log pool statistics for monitoring
 */
export function logPoolStatistics(pool: Pool): void {
  console.log('Database Pool Statistics:', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  });
}

/**
 * Gracefully close pool
 */
export async function closePool(pool: Pool): Promise<void> {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection pool closed');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(pool: Pool): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const result = await pool.query('SELECT 1 as health_check');
    const latency = Date.now() - startTime;

    return {
      healthy: result.rows[0].health_check === 1,
      latency,
    };
  } catch (error: any) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}
