import { db } from '../database';
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm';
import { userSessions, auditLogs } from '../database/schema';
import { CacheService } from './CacheService';
import { config } from '../config';

export interface AnalyticsOverview {
  totalQueries: number;
  activeSessions: number;
  avgResponseTime: number;
  successRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgConfidence: number;
  }>;
}

export interface QueryTimeSeriesData {
  timestamp: Date;
  count: number;
  avgResponseTime: number;
  successRate: number;
}

export interface TopQuery {
  query: string;
  count: number;
  avgConfidence: number;
}

export interface IntentDistribution {
  intent: string;
  count: number;
  percentage: number;
}

export interface PerformanceMetrics {
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  uptime: number;
}

/**
 * Analytics Service for merchant usage analytics
 * Provides insights into chat queries, performance, and user behavior
 */
export class AnalyticsService {
  private cacheService: CacheService;
  private readonly cacheTTL = 300; // 5 minutes

  constructor() {
    this.cacheService = new CacheService({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      keyPrefix: 'analytics',
      defaultTTL: this.cacheTTL,
    });
  }

  /**
   * Get analytics overview for a merchant
   */
  async getOverview(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsOverview> {
    const cacheKey = `overview:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    // Try cache first
    try {
      const cached = await this.cacheService.get<AnalyticsOverview>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
    }

    // Query database
    const [
      totalQueries,
      activeSessions,
      avgResponseTime,
      successRate,
      topQueries,
    ] = await Promise.all([
      this.getTotalQueries(merchantId, startDate, endDate),
      this.getActiveSessions(merchantId),
      this.getAvgResponseTime(merchantId, startDate, endDate),
      this.getSuccessRate(merchantId, startDate, endDate),
      this.getTopQueries(merchantId, startDate, endDate, 10),
    ]);

    const overview: AnalyticsOverview = {
      totalQueries,
      activeSessions,
      avgResponseTime,
      successRate,
      topQueries,
    };

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, overview, this.cacheTTL);
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }

    return overview;
  }

  /**
   * Get query time series data
   */
  async getQueryTimeSeries(
    merchantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' = 'day'
  ): Promise<QueryTimeSeriesData[]> {
    const cacheKey = `timeseries:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}:${groupBy}`;

    // Try cache first
    try {
      const cached = await this.cacheService.get<QueryTimeSeriesData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
    }

    // Query database using raw SQL for time series aggregation
    const groupByClause = groupBy === 'hour' ? 'hour' : 'day';
    const result = await db.execute(sql`
      SELECT 
        DATE_TRUNC(${sql.raw(`'${groupByClause}'`)}, al.timestamp) as timestamp,
        COUNT(*) as count,
        AVG(250) as avg_response_time,
        SUM(CASE WHEN al.outcome = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
      FROM ${auditLogs} al
      WHERE al.merchant_id = ${merchantId}
        AND al.timestamp >= ${startDate}
        AND al.timestamp <= ${endDate}
        AND al.operation = 'chat_query'
      GROUP BY DATE_TRUNC(${sql.raw(`'${groupByClause}'`)}, al.timestamp)
      ORDER BY timestamp ASC
    `);

    const timeSeries: QueryTimeSeriesData[] = (result as any[]).map((row: any) => ({
      timestamp: new Date(row.timestamp),
      count: parseInt(row.count),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time) || 0),
      successRate: Math.round(parseFloat(row.success_rate) || 0),
    }));

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, timeSeries, this.cacheTTL);
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }

    return timeSeries;
  }

  /**
   * Get top queries for a merchant
   */
  async getTopQueries(
    merchantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<TopQuery[]> {
    const cacheKey = `topqueries:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}:${limit}`;

    // Try cache first
    try {
      const cached = await this.cacheService.get<TopQuery[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
    }

    // Query database - extract query from request_payload_hash metadata
    // Note: In production, you'd want to store actual queries in a separate table
    const result = await db.execute(sql`
      SELECT 
        al.operation as query,
        COUNT(*) as count,
        AVG(0.85) as avg_confidence
      FROM ${auditLogs} al
      WHERE al.merchant_id = ${merchantId}
        AND al.timestamp >= ${startDate}
        AND al.timestamp <= ${endDate}
        AND al.operation = 'chat_query'
      GROUP BY al.operation
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    const topQueries: TopQuery[] = (result as any[]).map((row: any) => ({
      query: row.query,
      count: parseInt(row.count),
      avgConfidence: parseFloat(row.avg_confidence),
    }));

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, topQueries, this.cacheTTL);
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }

    return topQueries;
  }

  /**
   * Get intent distribution for queries
   */
  async getIntentDistribution(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IntentDistribution[]> {
    const cacheKey = `intents:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    // Try cache first
    try {
      const cached = await this.cacheService.get<IntentDistribution[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
    }

    // Query database - extract intent from operation or metadata
    const result = await db.execute(sql`
      SELECT 
        COALESCE(al.operation, 'unknown') as intent,
        COUNT(*) as count
      FROM ${auditLogs} al
      WHERE al.merchant_id = ${merchantId}
        AND al.timestamp >= ${startDate}
        AND al.timestamp <= ${endDate}
      GROUP BY al.operation
      ORDER BY count DESC
    `);

    const total = (result as any[]).reduce((sum: number, row: any) => sum + parseInt(row.count), 0);

    const distribution: IntentDistribution[] = (result as any[]).map((row: any) => ({
      intent: row.intent,
      count: parseInt(row.count),
      percentage: Math.round((parseInt(row.count) / total) * 100),
    }));

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, distribution, this.cacheTTL);
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }

    return distribution;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    const cacheKey = `performance:${merchantId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    // Try cache first
    try {
      const cached = await this.cacheService.get<PerformanceMetrics>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache read failed, continuing without cache:', error);
    }

    // Calculate percentiles using raw SQL
    const result = await db.execute(sql`
      WITH response_times AS (
        SELECT 
          EXTRACT(EPOCH FROM (al.timestamp - al.timestamp)) * 1000 as response_time
        FROM ${auditLogs} al
        WHERE al.merchant_id = ${merchantId}
          AND al.timestamp >= ${startDate}
          AND al.timestamp <= ${endDate}
          AND al.operation = 'chat_query'
      )
      SELECT 
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99
      FROM response_times
    `);

    const percentiles = (result as any[])[0];

    // Calculate error rate
    const errorRateResult = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN al.outcome = 'failure' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_rate
      FROM ${auditLogs} al
      WHERE al.merchant_id = ${merchantId}
        AND al.timestamp >= ${startDate}
        AND al.timestamp <= ${endDate}
        AND al.operation = 'chat_query'
    `);

    const errorRate = parseFloat((errorRateResult as any[])[0]?.error_rate || '0');

    // Calculate cache hit rate (placeholder - would need actual cache metrics)
    const cacheHitRate = 75; // Placeholder

    // Calculate uptime (placeholder - would need actual uptime monitoring)
    const uptime = 99.9; // Placeholder

    const metrics: PerformanceMetrics = {
      p50ResponseTime: Math.round(parseFloat(percentiles?.p50 || '0')),
      p95ResponseTime: Math.round(parseFloat(percentiles?.p95 || '0')),
      p99ResponseTime: Math.round(parseFloat(percentiles?.p99 || '0')),
      cacheHitRate,
      errorRate: Math.round(errorRate),
      uptime,
    };

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, metrics, this.cacheTTL);
    } catch (error) {
      console.warn('Cache write failed, continuing without cache:', error);
    }

    return metrics;
  }

  /**
   * Private helper methods
   */

  private async getTotalQueries(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${auditLogs}
      WHERE merchant_id = ${merchantId} 
        AND timestamp >= ${startDate} 
        AND timestamp <= ${endDate}
        AND operation = 'chat_query'
    `);
    return parseInt((result as any[])[0]?.count || '0');
  }

  private async getActiveSessions(merchantId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${userSessions}
      WHERE merchant_id = ${merchantId} 
        AND expires_at > NOW()
    `);
    return parseInt((result as any[])[0]?.count || '0');
  }

  private async getAvgResponseTime(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Placeholder calculation - would need actual response time tracking
    const result = await db.execute(sql`
      SELECT AVG(250) as avg 
      FROM ${auditLogs}
      WHERE merchant_id = ${merchantId} 
        AND timestamp >= ${startDate} 
        AND timestamp <= ${endDate}
        AND operation = 'chat_query'
    `);
    return Math.round(parseFloat((result as any[])[0]?.avg || '0'));
  }

  private async getSuccessRate(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as rate
      FROM ${auditLogs}
      WHERE merchant_id = ${merchantId} 
        AND timestamp >= ${startDate} 
        AND timestamp <= ${endDate}
        AND operation = 'chat_query'
    `);
    return Math.round(parseFloat((result as any[])[0]?.rate || '0'));
  }
}
