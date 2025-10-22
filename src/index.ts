import 'dotenv/config';
import { createAPIGatewayApp } from './api/app';
import { config } from './config';
import { checkConnection } from './database';

// Create API Gateway application with configuration
const apiApp = createAPIGatewayApp({
  port: config.port,
  environment: config.nodeEnv,
  corsOrigins: config.security.corsOrigins,
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  enableCognito: process.env.ENABLE_COGNITO === 'true',
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
  cognitoClientId: process.env.COGNITO_CLIENT_ID,
  awsRegion: config.aws.region,
});

// Get the Express app instance
const app = apiApp.getApp();

// Start the server with enhanced initialization
async function startServer() {
  try {
    // Check database connection
    console.log('🔍 Checking database connection...');
    const dbConnected = await checkConnection();
    console.log(`📊 Database connection: ${dbConnected ? '✅ Connected' : '❌ Failed'}`);
    
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, some features may not work properly');
    }

    // Start the API Gateway server
    apiApp.start();

    // Log configuration
    console.log('⚙️  Configuration:');
    console.log(`   - Environment: ${config.nodeEnv}`);
    console.log(`   - AWS Region: ${config.aws.region}`);
    console.log(`   - CORS Origins: ${config.security.corsOrigins.join(', ')}`);
    console.log(`   - Cognito Auth: ${process.env.ENABLE_COGNITO === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   - Metrics: ${process.env.ENABLE_METRICS === 'true' ? '✅ Enabled' : '❌ Disabled'}`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  // Close server
  const server = app.listen();
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      
      // Close database connections
      // Note: Add database cleanup here if needed
      
      console.log('👋 Process terminated gracefully');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;