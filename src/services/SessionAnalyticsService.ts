import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { createSessionManager, SessionManager } from './SessionManager';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { config } from '../config';

export interface SessionAnalytics {
  merchantId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalSessions: number;
    activeSessions: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    avgMessagesPerSession: number;
    totalMessages: number;
    sessionsByHour: Record<string, number>;
    sessionsByDay: Record<string, number>;
    topUsers: Array<{
      userId: string;
      sessionCount: number;
      totalMessages: number;
      avgSessionDuration: number;
    }>;
  };
  costs: {
    totalCostEstimate: number;
    costPerSession: number;
    costPerMessage: number;
    costBreakdown: {
      ragProcessing: number;
      llmGeneration: number;
      storage: number;
      compute: number;
    };
  };
  performance: {
    avgResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    p95ResponseTime: number;
  };
}

export interface UsageMetrics {
  sessionId: string;
  merchantId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  ragQueries: number;
  llmTokensUsed: number;
  cacheHits: number;
  cacheMisses: number;
  totalCost: number;
  avgResponseTime: number;
  errors: number;
}

export interface BillingData {
  merchantId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  usage: {
    totalSessions: number;
    totalMessages: number;
    totalRAGQueries: number;
    totalLLMTokens: number;
    totalStorageGB: number;
    totalComputeHours: number;
  };
  costs: {
    ragProcessingCost: number;
    llmGenerationCost: number;
    storageCost: number;
    computeCost: number;
    totalCost: number;
  };
  breakdown: Array<{
    date: string;
    sessions: number;
    messages: number;
    cost: number;
  }>;
}

export class SessionAnalyticsService {
  private dynamoClient?: DynamoDBClient;
  private cloudWatchClient?: CloudWatchClient;
  private sessionManager: SessionManager;
  private auditLogRepository: AuditLogRepository;
  private tableName: string;

  // Cost constants (in USD)
  private readonly COST_PER_RAG_QUERY = 0.001; // $0.001 per RAG query
  private readonly COST_PER_1K_LLM_TOKENS = 0.002; // $0.002 per 1K tokens
  private readonly COST_PER_GB_STORAGE_MONTH = 0.25; // $0.25 per GB per month
  private readonly COST_PER_COMPUTE_HOUR = 0.10; // $0.10 per compute hour

  constructor() {
    // Skip DynamoDB/CloudWatch initialization in development with Postgres
    const usePostgres = process.env.USE_POSTGRES_SESSIONS === 'true' ||
                        (process.env.NODE_ENV === 'development' && process.env.USE_POSTGRES_SESSIONS !== 'false');
    
    if (!usePostgres) {
      this.dynamoClient = new DynamoDBClient({ region: config.aws.region });
      this.cloudWatchClient = new CloudWatchClient({ region: config.aws.region });
    }
    
    this.sessionManager = createSessionManager();
    this.auditLogRepository = new AuditLogRepository();
    this.tableName = process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev';
  }

  /**
   * Get comprehensive session analytics for a merchant
   */
  async getSessionAnalytics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SessionAnalytics> {
    try {
      // Query sessions for the merchant within the date range
      const sessions = await this.getSessionsInDateRange(merchantId, startDate, endDate);

      // Calculate basic metrics
      const metrics = this.calculateSessionMetrics(sessions, startDate, endDate);

      // Calculate cost estimates
      const costs = await this.calculateCostEstimates(merchantId, sessions, startDate, endDate);

      // Get performance metrics
      const performance = await this.getPerformanceMetrics(merchantId, startDate, endDate);

      return {
        merchantId,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        metrics,
        costs,
        performance,
      };

    } catch (error) {
      console.error('Failed to get session analytics:', error);
      throw new Error(`Failed to get session analytics: ${error}`);
    }
  }

  /**
   * Track session usage metrics for billing
   */
  async trackSessionUsage(usageMetrics: UsageMetrics): Promise<void> {
    try {
      // Calculate cost for this session
      const sessionCost = this.calculateSessionCost(usageMetrics);

      // Emit CloudWatch metrics
      await this.emitCloudWatchMetrics(usageMetrics, sessionCost);

      // Store usage data for billing (could be in a separate DynamoDB table)
      await this.storeUsageMetrics({
        ...usageMetrics,
        totalCost: sessionCost,
      });

      console.log(`Tracked usage for session ${usageMetrics.sessionId}: $${sessionCost.toFixed(4)}`);

    } catch (error) {
      console.error('Failed to track session usage:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Generate billing data for a merchant
   */
  async generateBillingData(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BillingData> {
    try {
      const sessions = await this.getSessionsInDateRange(merchantId, startDate, endDate);
      
      // Calculate usage totals
      const usage = {
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((sum, s) => sum + (s.conversation_history?.length || 0), 0),
        totalRAGQueries: sessions.reduce((sum, s) => sum + (s.metadata?.ragQueries || 0), 0),
        totalLLMTokens: sessions.reduce((sum, s) => sum + (s.metadata?.llmTokens || 0), 0),
        totalStorageGB: this.calculateStorageUsage(sessions),
        totalComputeHours: this.calculateComputeHours(sessions),
      };

      // Calculate costs
      const costs = {
        ragProcessingCost: usage.totalRAGQueries * this.COST_PER_RAG_QUERY,
        llmGenerationCost: (usage.totalLLMTokens / 1000) * this.COST_PER_1K_LLM_TOKENS,
        storageCost: usage.totalStorageGB * this.COST_PER_GB_STORAGE_MONTH,
        computeCost: usage.totalComputeHours * this.COST_PER_COMPUTE_HOUR,
        totalCost: 0,
      };
      costs.totalCost = costs.ragProcessingCost + costs.llmGenerationCost + costs.storageCost + costs.computeCost;

      // Generate daily breakdown
      const breakdown = this.generateDailyBreakdown(sessions, startDate, endDate);

      return {
        merchantId,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        usage,
        costs,
        breakdown,
      };

    } catch (error) {
      console.error('Failed to generate billing data:', error);
      throw new Error(`Failed to generate billing data: ${error}`);
    }
  }

  /**
   * Get sessions within a date range for a merchant
   */
  private async getSessionsInDateRange(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'MerchantCreatedIndex',
      KeyConditionExpression: 'merchant_id = :merchantId AND created_at BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: marshall({
        ':merchantId': merchantId,
        ':startDate': startDate.toISOString(),
        ':endDate': endDate.toISOString(),
      }),
    });

    if (!this.dynamoClient) {
      return [];
    }
    const result = await this.dynamoClient.send(command);
    return result.Items?.map(item => unmarshall(item)) || [];
  }

  /**
   * Calculate session metrics
   */
  private calculateSessionMetrics(sessions: any[], startDate: Date, endDate: Date): SessionAnalytics['metrics'] {
    const now = new Date();
    const activeSessions = sessions.filter(s => {
      const ttl = s.ttl * 1000; // Convert to milliseconds
      return ttl > now.getTime();
    });

    const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;

    const totalDuration = sessions.reduce((sum, s) => {
      const created = new Date(s.created_at).getTime();
      const lastActivity = new Date(s.last_activity).getTime();
      return sum + (lastActivity - created);
    }, 0);

    const avgSessionDuration = sessions.length > 0 ? totalDuration / sessions.length / 1000 / 60 : 0; // minutes

    const totalMessages = sessions.reduce((sum, s) => sum + (s.conversation_history?.length || 0), 0);
    const avgMessagesPerSession = sessions.length > 0 ? totalMessages / sessions.length : 0;

    // Group sessions by hour and day
    const sessionsByHour: Record<string, number> = {};
    const sessionsByDay: Record<string, number> = {};

    sessions.forEach(session => {
      const created = new Date(session.created_at);
      const hour = created.getHours().toString().padStart(2, '0');
      const day = created.toISOString().split('T')[0];

      sessionsByHour[hour] = (sessionsByHour[hour] || 0) + 1;
      sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
    });

    // Calculate top users
    const userStats: Record<string, { sessionCount: number; totalMessages: number; totalDuration: number }> = {};
    
    sessions.forEach(session => {
      const userId = session.user_id;
      if (!userStats[userId]) {
        userStats[userId] = { sessionCount: 0, totalMessages: 0, totalDuration: 0 };
      }
      
      userStats[userId].sessionCount++;
      userStats[userId].totalMessages += session.conversation_history?.length || 0;
      
      const created = new Date(session.created_at).getTime();
      const lastActivity = new Date(session.last_activity).getTime();
      userStats[userId].totalDuration += lastActivity - created;
    });

    const topUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        sessionCount: stats.sessionCount,
        totalMessages: stats.totalMessages,
        avgSessionDuration: stats.totalDuration / stats.sessionCount / 1000 / 60, // minutes
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      uniqueUsers,
      avgSessionDuration,
      avgMessagesPerSession,
      totalMessages,
      sessionsByHour,
      sessionsByDay,
      topUsers,
    };
  }

  /**
   * Calculate cost estimates
   */
  private async calculateCostEstimates(
    merchantId: string,
    sessions: any[],
    startDate: Date,
    endDate: Date
  ): Promise<SessionAnalytics['costs']> {
    // Estimate costs based on session data and usage patterns
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + (s.conversation_history?.length || 0), 0);

    // Estimate RAG queries (assume 1 per message)
    const ragProcessing = totalMessages * this.COST_PER_RAG_QUERY;

    // Estimate LLM tokens (assume 100 tokens per message)
    const estimatedTokens = totalMessages * 100;
    const llmGeneration = (estimatedTokens / 1000) * this.COST_PER_1K_LLM_TOKENS;

    // Estimate storage (based on session data size)
    const storageGB = this.calculateStorageUsage(sessions);
    const storage = storageGB * this.COST_PER_GB_STORAGE_MONTH;

    // Estimate compute (based on session duration)
    const computeHours = this.calculateComputeHours(sessions);
    const compute = computeHours * this.COST_PER_COMPUTE_HOUR;

    const totalCostEstimate = ragProcessing + llmGeneration + storage + compute;
    const costPerSession = totalSessions > 0 ? totalCostEstimate / totalSessions : 0;
    const costPerMessage = totalMessages > 0 ? totalCostEstimate / totalMessages : 0;

    return {
      totalCostEstimate,
      costPerSession,
      costPerMessage,
      costBreakdown: {
        ragProcessing,
        llmGeneration,
        storage,
        compute,
      },
    };
  }

  /**
   * Get performance metrics from CloudWatch or audit logs
   */
  private async getPerformanceMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SessionAnalytics['performance']> {
    // This would typically query CloudWatch metrics
    // For now, return estimated values
    return {
      avgResponseTime: 250, // ms
      cacheHitRate: 0.75, // 75%
      errorRate: 0.02, // 2%
      p95ResponseTime: 500, // ms
    };
  }

  /**
   * Calculate session cost
   */
  private calculateSessionCost(usage: UsageMetrics): number {
    const ragCost = usage.ragQueries * this.COST_PER_RAG_QUERY;
    const llmCost = (usage.llmTokensUsed / 1000) * this.COST_PER_1K_LLM_TOKENS;
    
    // Estimate storage and compute costs
    const storageCost = 0.001; // Small amount per session
    const computeCost = usage.avgResponseTime * 0.00001; // Based on response time

    return ragCost + llmCost + storageCost + computeCost;
  }

  /**
   * Emit CloudWatch metrics
   */
  private async emitCloudWatchMetrics(usage: UsageMetrics, cost: number): Promise<void> {
    const metrics = [
      {
        MetricName: 'SessionCost',
        Value: cost,
        Unit: 'None' as const,
        Dimensions: [
          { Name: 'MerchantId', Value: usage.merchantId },
        ],
      },
      {
        MetricName: 'MessageCount',
        Value: usage.messageCount,
        Unit: 'Count' as const,
        Dimensions: [
          { Name: 'MerchantId', Value: usage.merchantId },
        ],
      },
      {
        MetricName: 'RAGQueries',
        Value: usage.ragQueries,
        Unit: 'Count' as const,
        Dimensions: [
          { Name: 'MerchantId', Value: usage.merchantId },
        ],
      },
      {
        MetricName: 'ResponseTime',
        Value: usage.avgResponseTime,
        Unit: 'Milliseconds' as const,
        Dimensions: [
          { Name: 'MerchantId', Value: usage.merchantId },
        ],
      },
    ];

    if (this.cloudWatchClient) {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: 'MindsDB/RAGAssistant',
        MetricData: metrics,
      }));
    }
  }

  /**
   * Store usage metrics (placeholder - would use separate table)
   */
  private async storeUsageMetrics(usage: UsageMetrics): Promise<void> {
    // This would store in a separate DynamoDB table for billing
    // For now, just log it
    console.log('Usage metrics stored:', {
      sessionId: usage.sessionId,
      merchantId: usage.merchantId,
      cost: usage.totalCost,
    });
  }

  /**
   * Calculate storage usage in GB
   */
  private calculateStorageUsage(sessions: any[]): number {
    const totalDataSize = sessions.reduce((sum, session) => {
      const sessionSize = JSON.stringify(session).length;
      return sum + sessionSize;
    }, 0);

    return totalDataSize / (1024 * 1024 * 1024); // Convert bytes to GB
  }

  /**
   * Calculate compute hours
   */
  private calculateComputeHours(sessions: any[]): number {
    const totalDuration = sessions.reduce((sum, session) => {
      const created = new Date(session.created_at).getTime();
      const lastActivity = new Date(session.last_activity).getTime();
      return sum + (lastActivity - created);
    }, 0);

    return totalDuration / (1000 * 60 * 60); // Convert ms to hours
  }

  /**
   * Generate daily breakdown
   */
  private generateDailyBreakdown(
    sessions: any[],
    startDate: Date,
    endDate: Date
  ): BillingData['breakdown'] {
    const dailyStats: Record<string, { sessions: number; messages: number }> = {};

    sessions.forEach(session => {
      const date = new Date(session.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sessions: 0, messages: 0 };
      }
      
      dailyStats[date].sessions++;
      dailyStats[date].messages += session.conversation_history?.length || 0;
    });

    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      messages: stats.messages,
      cost: this.calculateDailyCost(stats.sessions, stats.messages),
    }));
  }

  /**
   * Calculate daily cost estimate
   */
  private calculateDailyCost(sessions: number, messages: number): number {
    const ragCost = messages * this.COST_PER_RAG_QUERY;
    const llmCost = (messages * 100 / 1000) * this.COST_PER_1K_LLM_TOKENS; // Assume 100 tokens per message
    const storageCost = sessions * 0.001; // Small storage cost per session
    const computeCost = sessions * 0.01; // Small compute cost per session

    return ragCost + llmCost + storageCost + computeCost;
  }
}

// Export singleton instance
let sessionAnalyticsInstance: SessionAnalyticsService | null = null;

export const getSessionAnalyticsService = (): SessionAnalyticsService => {
  if (!sessionAnalyticsInstance) {
    sessionAnalyticsInstance = new SessionAnalyticsService();
  }
  return sessionAnalyticsInstance;
};