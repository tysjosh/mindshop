"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessIntelligenceDashboardService = void 0;
exports.getBusinessIntelligenceDashboardService = getBusinessIntelligenceDashboardService;
const LoggingService_1 = require("./LoggingService");
const MetricsCollectionService_1 = require("./MetricsCollectionService");
const CostTrackingService_1 = require("./CostTrackingService");
class BusinessIntelligenceDashboardService {
    constructor() {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsService = (0, MetricsCollectionService_1.getMetricsCollectionService)();
        this.costTrackingService = (0, CostTrackingService_1.getCostTrackingService)();
        this.dashboardCache = new Map();
        this.humanEvaluationTasks = new Map();
        this.initializeHumanEvaluationPipeline();
    }
    initializeHumanEvaluationPipeline() {
        // Set up periodic human evaluation task generation
        setInterval(async () => {
            await this.generateHumanEvaluationTasks();
        }, 24 * 60 * 60 * 1000); // Daily
    }
    async generateDashboard(merchantId, period) {
        const cacheKey = `${merchantId}_${period.start.getTime()}_${period.end.getTime()}`;
        const cached = this.dashboardCache.get(cacheKey);
        if (cached && cached.expiresAt > new Date()) {
            return cached.data;
        }
        const context = {
            merchantId,
            requestId: `generate-dashboard-${Date.now()}`,
            operation: 'generate_bi_dashboard'
        };
        try {
            await this.loggingService.logInfo('Generating BI dashboard', context, { period });
            const [usageAnalytics, conversionTracking, qualityMetrics, costAnalysis] = await Promise.all([
                this.generateUsageAnalytics(merchantId, period),
                this.generateConversionTracking(merchantId, period),
                this.generateQualityMetrics(merchantId, period),
                this.generateCostAnalysis(merchantId, period)
            ]);
            const alerts = await this.getRecentAlerts(merchantId);
            const dashboardData = {
                merchantId,
                generatedAt: new Date(),
                usageAnalytics,
                conversionTracking,
                qualityMetrics,
                costAnalysis,
                alerts
            };
            // Cache for 1 hour
            this.dashboardCache.set(cacheKey, {
                data: dashboardData,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000)
            });
            await this.loggingService.logInfo('BI dashboard generated successfully', context, {
                totalSessions: usageAnalytics.totalSessions,
                conversionRate: conversionTracking.conversionRate,
                overallAccuracy: qualityMetrics.overallAccuracy,
                totalCost: costAnalysis.totalCost
            });
            return dashboardData;
        }
        catch (error) {
            await this.loggingService.logError(error, context);
            throw error;
        }
    }
    async generateUsageAnalytics(merchantId, period) {
        // In a real implementation, this would query the database for actual session data
        // For now, we'll generate realistic mock data
        const totalSessions = Math.floor(Math.random() * 1000) + 500;
        const uniqueUsers = Math.floor(totalSessions * 0.7);
        const avgSessionDuration = Math.floor(Math.random() * 300) + 120; // 2-7 minutes
        const topQueries = [
            { query: "What are the best laptops under $1000?", count: 45, avgLatency: 850 },
            { query: "Show me wireless headphones", count: 38, avgLatency: 720 },
            { query: "I need a gaming mouse", count: 32, avgLatency: 680 },
            { query: "What's the return policy?", count: 28, avgLatency: 450 },
            { query: "Do you have iPhone cases?", count: 25, avgLatency: 520 }
        ];
        return {
            merchantId,
            period,
            totalSessions,
            uniqueUsers,
            avgSessionDuration,
            topQueries,
            userEngagement: {
                bounceRate: 0.25,
                avgQueriesPerSession: 3.2,
                returnUserRate: 0.35
            },
            performanceMetrics: {
                avgLatency: 750,
                p95Latency: 1200,
                successRate: 0.96,
                errorRate: 0.04
            }
        };
    }
    async generateConversionTracking(merchantId, period) {
        const totalConversions = Math.floor(Math.random() * 100) + 50;
        const conversionRate = (Math.random() * 0.1) + 0.05; // 5-15%
        const avgOrderValue = (Math.random() * 200) + 100; // $100-300
        const directRevenue = totalConversions * avgOrderValue * 0.6;
        const assistedRevenue = totalConversions * avgOrderValue * 0.4;
        return {
            merchantId,
            period,
            totalConversions,
            conversionRate,
            avgOrderValue,
            revenueAttribution: {
                directFromChat: directRevenue,
                assistedByChat: assistedRevenue,
                totalRevenue: directRevenue + assistedRevenue
            },
            conversionFunnel: [
                { stage: 'Initial Query', users: 1000, conversionRate: 1.0 },
                { stage: 'Product Interest', users: 400, conversionRate: 0.4 },
                { stage: 'Add to Cart', users: 150, conversionRate: 0.375 },
                { stage: 'Checkout Started', users: 80, conversionRate: 0.533 },
                { stage: 'Purchase Completed', users: totalConversions, conversionRate: 0.625 }
            ],
            topConvertingQueries: [
                { query: "Best laptop for programming", conversions: 12, conversionRate: 0.24, revenue: 2400 },
                { query: "Gaming headset under $100", conversions: 8, conversionRate: 0.21, revenue: 800 },
                { query: "Wireless mouse for MacBook", conversions: 6, conversionRate: 0.19, revenue: 360 }
            ]
        };
    }
    async generateQualityMetrics(merchantId, period) {
        const overallAccuracy = 0.87 + (Math.random() * 0.1); // 87-97%
        const groundingAccuracy = 0.85 + (Math.random() * 0.1); // 85-95%
        const hallucinationRate = Math.random() * 0.05; // 0-5%
        const totalRatings = Math.floor(Math.random() * 200) + 100;
        const positiveRatings = Math.floor(totalRatings * (0.7 + Math.random() * 0.2));
        const negativeRatings = totalRatings - positiveRatings;
        const avgRating = 3.5 + (Math.random() * 1.5); // 3.5-5.0
        // Generate quality trends for the past 7 days
        const qualityTrends = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            qualityTrends.push({
                date,
                accuracy: overallAccuracy + (Math.random() * 0.1 - 0.05),
                satisfaction: avgRating + (Math.random() * 0.5 - 0.25)
            });
        }
        return {
            merchantId,
            period,
            overallAccuracy,
            groundingAccuracy,
            hallucinationRate,
            userSatisfaction: {
                avgRating,
                totalRatings,
                positiveRatings,
                negativeRatings
            },
            qualityTrends
        };
    }
    async generateCostAnalysis(merchantId, period) {
        // Get cost attribution from cost tracking service
        const costAttribution = await this.costTrackingService.getMerchantCostAnalytics({
            merchantId,
            startDate: period.start,
            endDate: period.end,
            includeTopSessions: true,
        });
        const totalCost = costAttribution.totalCost;
        const costPerSession = costAttribution.avgCostPerSession;
        // Calculate cost per conversion (mock data)
        const conversions = Math.floor(Math.random() * 100) + 50;
        const costPerConversion = totalCost / conversions;
        // Calculate ROI (mock revenue data)
        const revenue = conversions * 150; // Assume $150 average order value
        const roi = ((revenue - totalCost) / totalCost) * 100;
        return {
            totalCost,
            costPerSession,
            costPerConversion,
            roi
        };
    }
    async getRecentAlerts(merchantId) {
        // In a real implementation, this would query the alerting service
        return [
            {
                type: 'performance',
                severity: 'medium',
                message: 'Average response latency increased by 15% in the last hour',
                timestamp: new Date(Date.now() - 30 * 60 * 1000)
            },
            {
                type: 'cost',
                severity: 'low',
                message: 'Daily cost is 5% above average',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
            }
        ];
    }
    async generateHumanEvaluationTasks() {
        const context = {
            merchantId: 'system',
            requestId: `generate-eval-tasks-${Date.now()}`,
            operation: 'generate_human_evaluation_tasks'
        };
        try {
            // In a real implementation, this would:
            // 1. Query recent conversations from the database
            // 2. Select a representative sample based on various criteria
            // 3. Create evaluation tasks for human reviewers
            const sampleQueries = [
                "What's the best smartphone for photography?",
                "I need a laptop for video editing under $2000",
                "Do you have any eco-friendly products?",
                "What's your return policy for electronics?",
                "Can you recommend a good wireless router?"
            ];
            const sampleResponses = [
                "Based on your interest in photography, I'd recommend the iPhone 15 Pro or Google Pixel 8 Pro. Both have excellent camera systems with advanced computational photography features.",
                "For video editing under $2000, I'd suggest the MacBook Air M2 or Dell XPS 15. Both offer powerful processors and sufficient RAM for video editing tasks.",
                "Yes, we have several eco-friendly options including solar chargers, bamboo phone cases, and energy-efficient appliances. Would you like to see specific categories?",
                "Our return policy allows 30 days for electronics in original condition. Items must include all original packaging and accessories for a full refund.",
                "For home use, I'd recommend the ASUS AX6000 or Netgear Nighthawk AX12. Both offer excellent coverage and Wi-Fi 6 support for multiple devices."
            ];
            for (let i = 0; i < 5; i++) {
                const taskId = `eval_${Date.now()}_${i}`;
                const task = {
                    id: taskId,
                    merchantId: 'sample_merchant',
                    query: sampleQueries[i],
                    response: sampleResponses[i],
                    context: { sessionId: `sample_session_${i}` },
                    evaluationCriteria: {
                        relevance: true,
                        accuracy: true,
                        helpfulness: true,
                        safety: true
                    },
                    status: 'pending'
                };
                this.humanEvaluationTasks.set(taskId, task);
            }
            await this.loggingService.logInfo('Human evaluation tasks generated', context, { tasksGenerated: 5 });
        }
        catch (error) {
            await this.loggingService.logError(error, context);
        }
    }
    async submitHumanEvaluation(taskId, evaluatorId, score, feedback) {
        const task = this.humanEvaluationTasks.get(taskId);
        if (!task) {
            throw new Error(`Evaluation task ${taskId} not found`);
        }
        task.evaluatorId = evaluatorId;
        task.evaluatedAt = new Date();
        task.score = score;
        task.feedback = feedback;
        task.status = 'completed';
        const context = {
            merchantId: task.merchantId,
            requestId: `submit-eval-${Date.now()}`,
            operation: 'submit_human_evaluation'
        };
        await this.loggingService.logInfo('Human evaluation submitted', context, {
            taskId,
            evaluatorId,
            score,
            query: task.query
        });
        // Emit evaluation metric
        await this.metricsService.collectMetrics({
            timestamp: new Date(),
            merchantId: task.merchantId,
            metrics: {
                groundingAccuracy: score
            },
            dimensions: {
                evaluation_type: 'human',
                evaluator_id: evaluatorId
            }
        });
    }
    getPendingEvaluationTasks(limit = 10) {
        return Array.from(this.humanEvaluationTasks.values())
            .filter(task => task.status === 'pending')
            .slice(0, limit);
    }
    async getEvaluationResults(merchantId) {
        const tasks = Array.from(this.humanEvaluationTasks.values())
            .filter(task => task.merchantId === merchantId && task.status === 'completed');
        if (tasks.length === 0) {
            return {
                totalEvaluations: 0,
                averageScore: 0,
                scoreDistribution: {},
                recentFeedback: []
            };
        }
        const totalEvaluations = tasks.length;
        const averageScore = tasks.reduce((sum, task) => sum + (task.score || 0), 0) / totalEvaluations;
        const scoreDistribution = tasks.reduce((dist, task) => {
            const scoreRange = Math.floor((task.score || 0) / 20) * 20; // Group by 20s (0-19, 20-39, etc.)
            dist[scoreRange] = (dist[scoreRange] || 0) + 1;
            return dist;
        }, {});
        const recentFeedback = tasks
            .filter(task => task.feedback)
            .sort((a, b) => (b.evaluatedAt?.getTime() || 0) - (a.evaluatedAt?.getTime() || 0))
            .slice(0, 5)
            .map(task => ({
            query: task.query,
            score: task.score,
            feedback: task.feedback,
            evaluatedAt: task.evaluatedAt
        }));
        return {
            totalEvaluations,
            averageScore,
            scoreDistribution,
            recentFeedback
        };
    }
    clearDashboardCache(merchantId) {
        if (merchantId) {
            // Clear cache for specific merchant
            for (const [key] of this.dashboardCache) {
                if (key.startsWith(merchantId)) {
                    this.dashboardCache.delete(key);
                }
            }
        }
        else {
            // Clear all cache
            this.dashboardCache.clear();
        }
    }
}
exports.BusinessIntelligenceDashboardService = BusinessIntelligenceDashboardService;
// Singleton instance
let biDashboardServiceInstance = null;
function getBusinessIntelligenceDashboardService() {
    if (!biDashboardServiceInstance) {
        biDashboardServiceInstance = new BusinessIntelligenceDashboardService();
    }
    return biDashboardServiceInstance;
}
//# sourceMappingURL=BusinessIntelligenceDashboardService.js.map