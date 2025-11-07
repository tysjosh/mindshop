import { db } from '../database';
import { sql } from 'drizzle-orm';

/**
 * Query Optimization Service
 * Provides utilities for optimizing database queries
 */
export class QueryOptimizationService {
  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string): Promise<{
    executionTime: number;
    planningTime: number;
    totalCost: number;
    plan: any;
  }> {
    const startTime = Date.now();

    // Use EXPLAIN ANALYZE to get query plan
    const result = await db.execute(sql.raw(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`));
    const executionTime = Date.now() - startTime;

    const plan = (result[0] as any)['QUERY PLAN'][0];

    return {
      executionTime,
      planningTime: plan['Planning Time'] || 0,
      totalCost: plan['Plan']['Total Cost'] || 0,
      plan: plan['Plan'],
    };
  }

  /**
   * Get slow queries from pg_stat_statements
   * Requires pg_stat_statements extension
   */
  async getSlowQueries(limit: number = 10): Promise<Array<{
    query: string;
    calls: number;
    totalTime: number;
    meanTime: number;
    maxTime: number;
  }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          max_exec_time as max_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT ${limit}
      `);

      return (result as any[]).map((row) => ({
        query: row.query,
        calls: parseInt(row.calls),
        totalTime: parseFloat(row.total_time),
        meanTime: parseFloat(row.mean_time),
        maxTime: parseFloat(row.max_time),
      }));
    } catch (error) {
      console.warn('pg_stat_statements extension not available:', error);
      return [];
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(tableName: string): Promise<{
    rowCount: number;
    tableSize: string;
    indexSize: string;
    totalSize: string;
  }> {
    const result = await db.execute(sql`
      SELECT 
        (SELECT reltuples::bigint FROM pg_class WHERE relname = ${tableName}) as row_count,
        pg_size_pretty(pg_table_size(${tableName}::regclass)) as table_size,
        pg_size_pretty(pg_indexes_size(${tableName}::regclass)) as index_size,
        pg_size_pretty(pg_total_relation_size(${tableName}::regclass)) as total_size
    `);

    const row = (result as any[])[0];

    return {
      rowCount: parseInt(row.row_count) || 0,
      tableSize: row.table_size,
      indexSize: row.index_size,
      totalSize: row.total_size,
    };
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsage(tableName: string): Promise<Array<{
    indexName: string;
    indexScans: number;
    indexSize: string;
    indexDef: string;
  }>> {
    const result = await db.execute(sql`
      SELECT 
        indexrelname as index_name,
        idx_scan as index_scans,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        pg_get_indexdef(indexrelid) as index_def
      FROM pg_stat_user_indexes
      WHERE relname = ${tableName}
      ORDER BY idx_scan DESC
    `);

    return (result as any[]).map((row) => ({
      indexName: row.index_name,
      indexScans: parseInt(row.index_scans) || 0,
      indexSize: row.index_size,
      indexDef: row.index_def,
    }));
  }

  /**
   * Get unused indexes
   */
  async getUnusedIndexes(): Promise<Array<{
    tableName: string;
    indexName: string;
    indexSize: string;
    indexDef: string;
  }>> {
    const result = await db.execute(sql`
      SELECT 
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        pg_get_indexdef(indexrelid) as index_def
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
      ORDER BY pg_relation_size(indexrelid) DESC
    `);

    return (result as any[]).map((row) => ({
      tableName: row.table_name,
      indexName: row.index_name,
      indexSize: row.index_size,
      indexDef: row.index_def,
    }));
  }

  /**
   * Vacuum analyze table
   */
  async vacuumAnalyze(tableName: string): Promise<void> {
    console.log(`Running VACUUM ANALYZE on table: ${tableName}`);
    await db.execute(sql.raw(`VACUUM ANALYZE ${tableName}`));
    console.log(`VACUUM ANALYZE completed for table: ${tableName}`);
  }

  /**
   * Get database cache hit ratio
   */
  async getCacheHitRatio(): Promise<{
    cacheHitRatio: number;
    heapBlocksRead: number;
    heapBlocksHit: number;
  }> {
    const result = await db.execute(sql`
      SELECT 
        sum(heap_blks_read) as heap_blocks_read,
        sum(heap_blks_hit) as heap_blocks_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
      FROM pg_statio_user_tables
    `);

    const row = (result as any[])[0];

    return {
      cacheHitRatio: parseFloat(row.cache_hit_ratio) || 0,
      heapBlocksRead: parseInt(row.heap_blocks_read) || 0,
      heapBlocksHit: parseInt(row.heap_blocks_hit) || 0,
    };
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
  }> {
    const result = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    const row = (result as any[])[0];

    return {
      totalConnections: parseInt(row.total_connections) || 0,
      activeConnections: parseInt(row.active_connections) || 0,
      idleConnections: parseInt(row.idle_connections) || 0,
      maxConnections: parseInt(row.max_connections) || 0,
    };
  }

  /**
   * Get database size
   */
  async getDatabaseSize(): Promise<{
    databaseName: string;
    size: string;
    sizeBytes: number;
  }> {
    const result = await db.execute(sql`
      SELECT 
        current_database() as database_name,
        pg_size_pretty(pg_database_size(current_database())) as size,
        pg_database_size(current_database()) as size_bytes
    `);

    const row = (result as any[])[0];

    return {
      databaseName: row.database_name,
      size: row.size,
      sizeBytes: parseInt(row.size_bytes) || 0,
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    slowQueries: any[];
    unusedIndexes: any[];
    cacheHitRatio: any;
    connectionStats: any;
    databaseSize: any;
  }> {
    console.log('Generating database performance report...');

    const [slowQueries, unusedIndexes, cacheHitRatio, connectionStats, databaseSize] =
      await Promise.all([
        this.getSlowQueries(10),
        this.getUnusedIndexes(),
        this.getCacheHitRatio(),
        this.getConnectionStats(),
        this.getDatabaseSize(),
      ]);

    return {
      slowQueries,
      unusedIndexes,
      cacheHitRatio,
      connectionStats,
      databaseSize,
    };
  }
}

// Singleton instance
let queryOptimizationService: QueryOptimizationService | null = null;

/**
 * Get query optimization service instance
 */
export function getQueryOptimizationService(): QueryOptimizationService {
  if (!queryOptimizationService) {
    queryOptimizationService = new QueryOptimizationService();
  }
  return queryOptimizationService;
}
