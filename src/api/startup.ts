import { getCacheWarmingService } from '../services/CacheWarmingService';
import { validateConfig, logConfigStatus } from '../config';

/**
 * Validate configuration at startup
 * Throws error if critical configuration is missing
 */
export function validateStartupConfig(): void {
  console.log('Validating configuration...');
  
  // Log configuration status
  logConfigStatus();
  
  // Validate configuration
  const validation = validateConfig();
  
  if (!validation.valid) {
    console.error('\n❌ Configuration validation failed!');
    console.error('The following errors must be fixed before starting:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nPlease check your .env file and environment variables.\n');
    throw new Error('Configuration validation failed');
  }
  
  console.log('✓ Configuration validated successfully\n');
}

/**
 * Initialize performance optimization services on startup
 */
export async function initializePerformanceServices(): Promise<void> {
  console.log('Initializing performance optimization services...');

  try {
    // Start cache warming service (runs every 15 minutes)
    const cacheWarmingService = getCacheWarmingService();
    cacheWarmingService.start(15);

    console.log('✓ Cache warming service started');
  } catch (error) {
    console.error('Error initializing performance services:', error);
    // Don't throw - allow app to start even if performance services fail
  }
}

/**
 * Cleanup performance services on shutdown
 */
export async function cleanupPerformanceServices(): Promise<void> {
  console.log('Cleaning up performance optimization services...');

  try {
    const cacheWarmingService = getCacheWarmingService();
    cacheWarmingService.stop();

    console.log('✓ Performance services cleaned up');
  } catch (error) {
    console.error('Error cleaning up performance services:', error);
  }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, starting graceful shutdown...`);

      try {
        await cleanupPerformanceServices();
        console.log('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanupPerformanceServices()
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    cleanupPerformanceServices()
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });
}
