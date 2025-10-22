"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionAnalyticsService = exports.SessionAnalyticsService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const SessionManager_1 = require("./SessionManager");
const AuditLogRepository_1 = require("../repositories/AuditLogRepository");
const config_1 = require("../config");
class SessionAnalyticsService {
    constructor() {
        // Cost constants (in USD)
        this.COST_PER_RAG_QUERY = 0.001; // $0.001 per RAG query
        this.COST_PER_1K_LLM_TOKENS = 0.002; // $0.002 per 1K tokens
        this.COST_PER_GB_STORAGE_MONTH = 0.25; // $0.25 per GB per month
        this.COST_PER_COMPUTE_HOUR = 0.10; // $0.10 per compute hour
        this.dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config_1.config.aws.region });
        this.cloudWatchClient = new client_cloudwatch_1.CloudWatchClient({ region: config_1.config.aws.region });
        this.sessionManager = (0, SessionManager_1.createSessionManager)();
        this.auditLogRepository = new AuditLogRepository_1.AuditLogRepository();
        this.tableName = process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev';
    }
    /**
     * Get comprehensive session analytics for a merchant
     */
    async getSessionAnalytics(merchantId, startDate, endDate) {
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
        }
        catch (error) {
            console.error('Failed to get session analytics:', error);
            throw new Error(`Failed to get session analytics: ${error}`);
        }
    }
    /**
     * Track session usage metrics for billing
     */
    async trackSessionUsage(usageMetrics) {
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
        }
        catch (error) {
            console.error('Failed to track session usage:', error);
            // Don't throw error to avoid breaking the main flow
        }
    }
    /**
     * Generate billing data for a merchant
     */
    async generateBillingData(merchantId, startDate, endDate) {
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
        }
        catch (error) {
            console.error('Failed to generate billing data:', error);
            throw new Error(`Failed to generate billing data: ${error}`);
        }
    }
    /**
     * Get sessions within a date range for a merchant
     */
    async getSessionsInDateRange(merchantId, startDate, endDate) {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'MerchantCreatedIndex',
            KeyConditionExpression: 'merchant_id = :merchantId AND created_at BETWEEN :startDate AND :endDate',
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                ':merchantId': merchantId,
                ':startDate': startDate.toISOString(),
                ':endDate': endDate.toISOString(),
            }),
        });
        const result = await this.dynamoClient.send(command);
        return result.Items?.map(item => (0, util_dynamodb_1.unmarshall)(item)) || [];
    }
    /**
     * Calculate session metrics
     */
    calculateSessionMetrics(sessions, startDate, endDate) {
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
        const sessionsByHour = {};
        const sessionsByDay = {};
        sessions.forEach(session => {
            const created = new Date(session.created_at);
            const hour = created.getHours().toString().padStart(2, '0');
            const day = created.toISOString().split('T')[0];
            sessionsByHour[hour] = (sessionsByHour[hour] || 0) + 1;
            sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
        });
        // Calculate top users
        const userStats = {};
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
    async calculateCostEstimates(merchantId, sessions, startDate, endDate) {
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
    async getPerformanceMetrics(merchantId, startDate, endDate) {
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
    calculateSessionCost(usage) {
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
    async emitCloudWatchMetrics(usage, cost) {
        const metrics = [
            {
                MetricName: 'SessionCost',
                Value: cost,
                Unit: 'None',
                Dimensions: [
                    { Name: 'MerchantId', Value: usage.merchantId },
                ],
            },
            {
                MetricName: 'MessageCount',
                Value: usage.messageCount,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'MerchantId', Value: usage.merchantId },
                ],
            },
            {
                MetricName: 'RAGQueries',
                Value: usage.ragQueries,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'MerchantId', Value: usage.merchantId },
                ],
            },
            {
                MetricName: 'ResponseTime',
                Value: usage.avgResponseTime,
                Unit: 'Milliseconds',
                Dimensions: [
                    { Name: 'MerchantId', Value: usage.merchantId },
                ],
            },
        ];
        await this.cloudWatchClient.send(new client_cloudwatch_1.PutMetricDataCommand({
            Namespace: 'MindsDB/RAGAssistant',
            MetricData: metrics,
        }));
    }
    /**
     * Store usage metrics (placeholder - would use separate table)
     */
    async storeUsageMetrics(usage) {
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
    calculateStorageUsage(sessions) {
        const totalDataSize = sessions.reduce((sum, session) => {
            const sessionSize = JSON.stringify(session).length;
            return sum + sessionSize;
        }, 0);
        return totalDataSize / (1024 * 1024 * 1024); // Convert bytes to GB
    }
    /**
     * Calculate compute hours
     */
    calculateComputeHours(sessions) {
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
    generateDailyBreakdown(sessions, startDate, endDate) {
        const dailyStats = {};
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
    calculateDailyCost(sessions, messages) {
        const ragCost = messages * this.COST_PER_RAG_QUERY;
        const llmCost = (messages * 100 / 1000) * this.COST_PER_1K_LLM_TOKENS; // Assume 100 tokens per message
        const storageCost = sessions * 0.001; // Small storage cost per session
        const computeCost = sessions * 0.01; // Small compute cost per session
        return ragCost + llmCost + storageCost + computeCost;
    }
}
exports.SessionAnalyticsService = SessionAnalyticsService;
// Export singleton instance
let sessionAnalyticsInstance = null;
const getSessionAnalyticsService = () => {
    if (!sessionAnalyticsInstance) {
        sessionAnalyticsInstance = new SessionAnalyticsService();
    }
    return sessionAnalyticsInstance;
};
exports.getSessionAnalyticsService = getSessionAnalyticsService;
//# sourceMappingURL=SessionAnalyticsService.js.map