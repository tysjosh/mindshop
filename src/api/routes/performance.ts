import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getQueryOptimizationService } from '../../services/QueryOptimizationService';
import { getCacheWarmingService } from '../../services/CacheWarmingService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateJWT());

/**
 * @route GET /api/performance/database/report
 * @desc Get comprehensive database performance report
 * @access Private (Admin only)
 */
router.get(
  '/database/report',
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptService = getQueryOptimizationService();
    const report = await queryOptService.generatePerformanceReport();

    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/slow-queries
 * @desc Get slow queries
 * @access Private (Admin only)
 */
router.get(
  '/database/slow-queries',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const queryOptService = getQueryOptimizationService();
    const slowQueries = await queryOptService.getSlowQueries(limit);

    res.status(200).json({
      success: true,
      data: slowQueries,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/cache-hit-ratio
 * @desc Get database cache hit ratio
 * @access Private (Admin only)
 */
router.get(
  '/database/cache-hit-ratio',
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptService = getQueryOptimizationService();
    const cacheHitRatio = await queryOptService.getCacheHitRatio();

    res.status(200).json({
      success: true,
      data: cacheHitRatio,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/connections
 * @desc Get database connection statistics
 * @access Private (Admin only)
 */
router.get(
  '/database/connections',
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptService = getQueryOptimizationService();
    const connectionStats = await queryOptService.getConnectionStats();

    res.status(200).json({
      success: true,
      data: connectionStats,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/table/:tableName/stats
 * @desc Get table statistics
 * @access Private (Admin only)
 */
router.get(
  '/database/table/:tableName/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const queryOptService = getQueryOptimizationService();
    const tableStats = await queryOptService.getTableStatistics(tableName);

    res.status(200).json({
      success: true,
      data: tableStats,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/table/:tableName/indexes
 * @desc Get index usage for a table
 * @access Private (Admin only)
 */
router.get(
  '/database/table/:tableName/indexes',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const queryOptService = getQueryOptimizationService();
    const indexUsage = await queryOptService.getIndexUsage(tableName);

    res.status(200).json({
      success: true,
      data: indexUsage,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/database/unused-indexes
 * @desc Get unused indexes
 * @access Private (Admin only)
 */
router.get(
  '/database/unused-indexes',
  asyncHandler(async (req: Request, res: Response) => {
    const queryOptService = getQueryOptimizationService();
    const unusedIndexes = await queryOptService.getUnusedIndexes();

    res.status(200).json({
      success: true,
      data: unusedIndexes,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route POST /api/performance/database/table/:tableName/vacuum
 * @desc Run VACUUM ANALYZE on a table
 * @access Private (Admin only)
 */
router.post(
  '/database/table/:tableName/vacuum',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const queryOptService = getQueryOptimizationService();
    await queryOptService.vacuumAnalyze(tableName);

    res.status(200).json({
      success: true,
      message: `VACUUM ANALYZE completed for table: ${tableName}`,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route POST /api/performance/cache/warm/:merchantId
 * @desc Manually warm cache for a merchant
 * @access Private (Admin only)
 */
router.post(
  '/cache/warm/:merchantId',
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.params;
    const cacheWarmingService = getCacheWarmingService();
    await cacheWarmingService.warmMerchantCacheManually(merchantId);

    res.status(200).json({
      success: true,
      message: `Cache warmed for merchant: ${merchantId}`,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/system/memory
 * @desc Get system memory usage
 * @access Private (Admin only)
 */
router.get(
  '/system/memory',
  asyncHandler(async (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();

    res.status(200).json({
      success: true,
      data: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)}MB`,
        heapUsedPercentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`,
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

/**
 * @route GET /api/performance/system/uptime
 * @desc Get system uptime
 * @access Private (Admin only)
 */
router.get(
  '/system/uptime',
  asyncHandler(async (req: Request, res: Response) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    res.status(200).json({
      success: true,
      data: {
        uptimeSeconds: uptime,
        uptimeFormatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        startTime: new Date(Date.now() - uptime * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  })
);

export default router;
