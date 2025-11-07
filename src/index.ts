import 'dotenv/config';
import { createAPIGatewayApp } from './api/app';
import { config } from './config';
import { checkConnection } from './database';
import { getJobScheduler } from './jobs/scheduler';
import { initializePerformanceServices, cleanupPerformanceServices, setupGracefulShutdown, validateStartupConfig } from './api/startup';

// Create API Gateway application with configuration
const apiApp = createAPIGatewayApp({
  port: config.port,
  environment: config.nodeEnv,
  corsOrigins: config.security.corsOrigins,
  enableMetrics: config.monitoring.metricsEnabled,
  enableCognito: config.cognito.enabled,
  cognitoUserPoolId: config.cognito.userPoolId,
  cognitoClientId: config.cognito.clientId,
  awsRegion: config.cognito.region,
  enableMockAuth: config.cognito.enableMockAuth,
});

// Get the Express app instance
const app = apiApp.getApp();

// Start the server with enhanced initialization
async function startServer() {
  try {
    // Validate configuration at startup
    console.log('🔧 Validating configuration...');
    validateStartupConfig();
    
    // Check database connection
    console.log('🔍 Checking database connection...');
    const dbConnected = await checkConnection();
    console.log(`📊 Database connection: ${dbConnected ? '✅ Connected' : '❌ Failed'}`);
    
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, some features may not work properly');
    }

    // Start the API Gateway server
    apiApp.start();

    // Initialize performance optimization services
    if (process.env.ENABLE_PERFORMANCE_OPTIMIZATION !== 'false') {
      console.log('⚡ Initializing performance optimization services...');
      await initializePerformanceServices();
      console.log('✅ Performance optimization services initialized');
    }

    // Start background job scheduler if enabled
    if (process.env.ENABLE_JOB_SCHEDULER === 'true') {
      console.log('🔄 Starting background job scheduler...');
      const scheduler = getJobScheduler({
        usageAggregationInterval: parseInt(process.env.USAGE_AGGREGATION_INTERVAL || '3600000', 10), // 1 hour default
        enableUsageAggregation: process.env.ENABLE_USAGE_AGGREGATION !== 'false', // enabled by default
      });
      scheduler.start();
      console.log('✅ Background job scheduler started');
    }

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Note: Graceful shutdown is now handled by setupGracefulShutdown() in startup.ts

// Start the server
startServer();

export default app;