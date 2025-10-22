"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeCostMonitoringService = void 0;
exports.createRealTimeCostMonitoringService = createRealTimeCostMonitoringService;
const LoggingService_1 = require("./LoggingService");
const MetricsCollectionService_1 = require("./MetricsCollectionService");
const CostTrackingService_1 = require("./CostTrackingService");
const AlertingService_1 = require("./AlertingService");
class RealTimeCostMonitoringService {
    constructor(config) {
        this.loggingService = (0, LoggingService_1.getLoggingService)();
        this.metricsService = (0, MetricsCollectionService_1.getMetricsCollectionService)();
        this.costTrackingService = (0, CostTrackingService_1.getCostTrackingService)();
        this.alertingService = (0, AlertingService_1.getAlertingService)();
        this.costHistory = [];
        this.activeScalingActions = new Set();
        this.emergencyMode = false;
        this.config = config;
        this.initializeDefaultThresholds();
        this.startMonitoring();
    }
    initializeDefaultThresholds() {
        if (this.config.costThresholds.length === 0) {
            this.config.costThresholds = [
                {
                    name: 'session_cost_warning',
                    type: 'per_session',
                    threshold: 0.03, // $0.03 per session
                    windowSize: 300, // 5 minutes
                    action: 'alert',
                    enabled: true
                },
                {
                    name: 'session_cost_critical',
                    type: 'per_session',
                    threshold: 0.05, // $0.05 per session
                    windowSize: 300, // 5 minutes
                    action: 'throttle',
                    enabled: true
                },
                {
                    name: 'hourly_cost_warning',
                    type: 'per_hour',
                    threshold: 10, // $10 per hour
                    windowSize: 3600, // 1 hour
                    action: 'alert',
                    enabled: true
                },
                {
                    name: 'hourly_cost_critical',
                    type: 'per_hour',
                    threshold: 20, // $20 per hour
                    windowSize: 3600, // 1 hour
                    action: 'scale_down',
                    enabled: true
                },
                {
                    name: 'daily_cost_limit',
                    type: 'per_day',
                    threshold: 200, // $200 per day
                    windowSize: 86400, // 24 hours
                    action: 'block',
                    enabled: true
                }
            ];
        }
        if (this.config.scalingActions.length === 0) {
            this.config.scalingActions = [
                {
                    type: 'enable_caching',
                    parameters: { ttl: 3600, maxSize: 1000 },
                    estimatedSavings: 0.15,
                    reversible: true
                },
                {
                    type: 'reduce_model_size',
                    parameters: { fallbackToHaiku: true, complexityThreshold: 0.8 },
                    estimatedSavings: 0.40,
                    reversible: true
                },
                {
                    type: 'throttle_requests',
                    parameters: { maxRequestsPerMinute: 30, queueSize: 100 },
                    estimatedSavings: 0.20,
                    reversible: true
                },
                {
                    type: 'scale_down_replicas',
                    parameters: { targetReplicas: 1, minReplicas: 1 },
                    estimatedSavings: 0.50,
                    reversible: true
                },
                {
                    type: 'enable_spot_instances',
                    parameters: { spotPercentage: 0.7, maxSpotPrice: 0.02 },
                    estimatedSavings: 0.60,
                    reversible: false
                }
            ];
        }
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performCostCheck();
            }
            catch (error) {
                await this.loggingService.logError(error, {
                    merchantId: 'system',
                    requestId: `cost-monitoring-${Date.now()}`,
                    operation: 'real_time_cost_monitoring'
                });
            }
        }, this.config.monitoringIntervalMs);
    }
    async performCostCheck() {
        const context = {
            merchantId: 'system',
            requestId: `cost-check-${Date.now()}`,
            operation: 'perform_cost_check'
        };
        try {
            // Get current cost metrics
            const currentMetrics = await this.getCurrentCostMetrics();
            // Update cost history
            this.costHistory.push({
                timestamp: new Date(),
                cost: currentMetrics.currentHourlyCost
            });
            // Keep only last 24 hours of data
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            this.costHistory = this.costHistory.filter(entry => entry.timestamp > cutoff);
            // Check thresholds
            for (const threshold of this.config.costThresholds) {
                if (threshold.enabled) {
                    await this.checkThreshold(threshold, currentMetrics);
                }
            }
            // Emit metrics
            await this.emitCostMetrics(currentMetrics);
            await this.loggingService.logInfo('Cost monitoring check completed', context, {
                currentHourlyCost: currentMetrics.currentHourlyCost,
                projectedDailyCost: currentMetrics.projectedDailyCost,
                activeOptimizations: currentMetrics.activeOptimizations.length,
                emergencyMode: this.emergencyMode
            });
        }
        catch (error) {
            await this.loggingService.logError(error, context);
        }
    }
    async getCurrentCostMetrics() {
        // Calculate current hourly cost from recent history
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);
        const recentCosts = this.costHistory.filter(entry => entry.timestamp > lastHour);
        const currentHourlyCost = recentCosts.reduce((sum, entry) => sum + entry.cost, 0);
        // Project daily and monthly costs
        const projectedDailyCost = currentHourlyCost * 24;
        const projectedMonthlyCost = projectedDailyCost * 30;
        // Calculate cost per session (simplified)
        const costPerSession = currentHourlyCost / Math.max(1, recentCosts.length);
        // Determine cost trend
        const costTrend = this.calculateCostTrend();
        // Get active optimizations
        const activeOptimizations = Array.from(this.activeScalingActions);
        const savingsFromOptimizations = this.calculateOptimizationSavings();
        return {
            currentHourlyCost,
            projectedDailyCost,
            projectedMonthlyCost,
            costPerSession,
            costTrend,
            activeOptimizations,
            savingsFromOptimizations
        };
    }
    calculateCostTrend() {
        if (this.costHistory.length < 2)
            return 'stable';
        const recent = this.costHistory.slice(-6); // Last 6 data points
        const older = this.costHistory.slice(-12, -6); // Previous 6 data points
        if (recent.length === 0 || older.length === 0)
            return 'stable';
        const recentAvg = recent.reduce((sum, entry) => sum + entry.cost, 0) / recent.length;
        const olderAvg = older.reduce((sum, entry) => sum + entry.cost, 0) / older.length;
        const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (changePercent > 10)
            return 'increasing';
        if (changePercent < -10)
            return 'decreasing';
        return 'stable';
    }
    calculateOptimizationSavings() {
        return Array.from(this.activeScalingActions).reduce((total, actionType) => {
            const action = this.config.scalingActions.find(a => a.type === actionType);
            return total + (action?.estimatedSavings || 0);
        }, 0);
    }
    async checkThreshold(threshold, metrics) {
        let currentValue = 0;
        switch (threshold.type) {
            case 'per_session':
                currentValue = metrics.costPerSession;
                break;
            case 'per_hour':
                currentValue = metrics.currentHourlyCost;
                break;
            case 'per_day':
                currentValue = metrics.projectedDailyCost;
                break;
            default:
                return;
        }
        if (currentValue > threshold.threshold) {
            await this.handleThresholdBreach(threshold, currentValue, metrics);
        }
    }
    async handleThresholdBreach(threshold, currentValue, metrics) {
        const context = {
            merchantId: 'system',
            requestId: `threshold-breach-${Date.now()}`,
            operation: 'handle_threshold_breach'
        };
        await this.loggingService.logWarning(`Cost threshold breached: ${threshold.name}`, context, {
            thresholdName: threshold.name,
            threshold: threshold.threshold,
            currentValue,
            action: threshold.action
        });
        // Create alert notification
        const alertNotification = {
            alertName: `CostThresholdBreached_${threshold.name}`,
            severity: threshold.action === 'block' ? 'critical' : 'high',
            timestamp: new Date(),
            metricName: `cost.${threshold.type}`,
            currentValue,
            threshold: threshold.threshold,
            message: `Cost threshold '${threshold.name}' breached. Current: $${currentValue.toFixed(4)}, Threshold: $${threshold.threshold.toFixed(4)}`,
            actions: [
                { type: 'sns', target: 'cost-alerts' },
                { type: 'slack', target: process.env.SLACK_WEBHOOK_URL || '' }
            ]
        };
        await this.alertingService.handleAlert(alertNotification);
        // Execute threshold action
        switch (threshold.action) {
            case 'alert':
                // Alert already sent above
                break;
            case 'throttle':
                await this.executeScalingAction('throttle_requests');
                break;
            case 'scale_down':
                await this.executeScalingAction('scale_down_replicas');
                await this.executeScalingAction('enable_caching');
                break;
            case 'block':
                await this.enterEmergencyMode();
                break;
        }
    }
    async executeScalingAction(actionType) {
        if (this.activeScalingActions.has(actionType)) {
            return; // Already active
        }
        const action = this.config.scalingActions.find(a => a.type === actionType);
        if (!action) {
            await this.loggingService.logWarning(`Scaling action not found: ${actionType}`, {
                merchantId: 'system',
                requestId: `scaling-action-${Date.now()}`,
                operation: 'execute_scaling_action'
            });
            return;
        }
        const context = {
            merchantId: 'system',
            requestId: `execute-scaling-${Date.now()}`,
            operation: 'execute_scaling_action'
        };
        try {
            // Execute the scaling action based on type
            switch (actionType) {
                case 'enable_caching':
                    // TODO: Implement optimization lever functionality
                    console.log('Optimization lever: cache_utilization', action.parameters);
                    break;
                case 'reduce_model_size':
                    // TODO: Implement optimization lever functionality
                    console.log('Optimization lever: model_size_selection', action.parameters);
                    break;
                case 'throttle_requests':
                    // This would integrate with rate limiting middleware
                    break;
                case 'scale_down_replicas':
                    // This would integrate with Kubernetes API
                    break;
                case 'enable_spot_instances':
                    // This would integrate with AWS Auto Scaling
                    break;
            }
            this.activeScalingActions.add(actionType);
            await this.loggingService.logInfo(`Scaling action executed: ${actionType}`, context, {
                actionType,
                parameters: action.parameters,
                estimatedSavings: action.estimatedSavings
            });
            // Emit scaling action metric
            await this.metricsService.incrementCounter('suspiciousActivityAlerts', 'system', 1, {
                type: 'cost_scaling_action',
                action: actionType
            });
        }
        catch (error) {
            await this.loggingService.logError(error, context, { actionType });
        }
    }
    async enterEmergencyMode() {
        if (this.emergencyMode)
            return;
        this.emergencyMode = true;
        const context = {
            merchantId: 'system',
            requestId: `emergency-mode-${Date.now()}`,
            operation: 'enter_emergency_mode'
        };
        await this.loggingService.logError(new Error('Emergency cost threshold reached - entering emergency mode'), context);
        // Execute all available scaling actions
        for (const action of this.config.scalingActions) {
            if (action.reversible) {
                await this.executeScalingAction(action.type);
            }
        }
        // Send critical alert
        const emergencyAlert = {
            alertName: 'EmergencyCostThresholdReached',
            severity: 'critical',
            timestamp: new Date(),
            metricName: 'cost.emergency',
            currentValue: this.config.emergencyShutdownThreshold,
            threshold: this.config.emergencyShutdownThreshold,
            message: 'EMERGENCY: Cost threshold reached. All cost optimization measures activated.',
            actions: [
                { type: 'sns', target: 'emergency-alerts' },
                { type: 'slack', target: process.env.SLACK_WEBHOOK_URL || '' },
                { type: 'email', target: process.env.EMERGENCY_ALERT_EMAIL || '' }
            ]
        };
        await this.alertingService.handleAlert(emergencyAlert);
    }
    async emitCostMetrics(metrics) {
        await this.metricsService.collectMetrics({
            timestamp: new Date(),
            merchantId: 'system',
            metrics: {
                costPerSession: metrics.costPerSession
            },
            dimensions: {
                trend: metrics.costTrend,
                optimizations_active: metrics.activeOptimizations.length.toString()
            }
        });
    }
    async getCostProjection(timeHorizonHours) {
        const currentMetrics = await this.getCurrentCostMetrics();
        return currentMetrics.currentHourlyCost * timeHorizonHours;
    }
    async reverseScalingAction(actionType) {
        if (!this.activeScalingActions.has(actionType))
            return;
        const action = this.config.scalingActions.find(a => a.type === actionType);
        if (!action || !action.reversible)
            return;
        this.activeScalingActions.delete(actionType);
        await this.loggingService.logInfo(`Scaling action reversed: ${actionType}`, {
            merchantId: 'system',
            requestId: `reverse-scaling-${Date.now()}`,
            operation: 'reverse_scaling_action'
        }, { actionType });
    }
    async exitEmergencyMode() {
        if (!this.emergencyMode)
            return;
        this.emergencyMode = false;
        // Reverse all reversible scaling actions
        for (const actionType of Array.from(this.activeScalingActions)) {
            const action = this.config.scalingActions.find(a => a.type === actionType);
            if (action?.reversible) {
                await this.reverseScalingAction(actionType);
            }
        }
        await this.loggingService.logInfo('Exited emergency cost mode', {
            merchantId: 'system',
            requestId: `exit-emergency-${Date.now()}`,
            operation: 'exit_emergency_mode'
        });
    }
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}
exports.RealTimeCostMonitoringService = RealTimeCostMonitoringService;
// Factory function
function createRealTimeCostMonitoringService(config) {
    const defaultConfig = {
        monitoringIntervalMs: 60000, // 1 minute
        costThresholds: [],
        scalingActions: [],
        emergencyShutdownThreshold: 500, // $500
        enableAutomaticScaling: process.env.ENABLE_AUTOMATIC_COST_SCALING === 'true'
    };
    return new RealTimeCostMonitoringService({ ...defaultConfig, ...config });
}
//# sourceMappingURL=RealTimeCostMonitoringService.js.map