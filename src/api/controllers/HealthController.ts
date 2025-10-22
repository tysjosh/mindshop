import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOrchestrationService, OrchestrationService } from '../../services/OrchestrationService';
import { checkConnection } from '../../database/connection';
import { ApiResponse } from '../../types';

export interface SystemHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  components: {
    orchestration: any;
    database: {
      status: 'healthy' | 'unhealthy';
      connectionTime?: number;
    };
    infrastructure: {
      memory: {
        used: number;
        total: number;
        percentage: number;
      };
      cpu: {
        usage: number;
      };
      disk: {
        available: number;
        total: number;
        percentage: number;
      };
    };
  };
  latencyBudget: {
    target: number;
    current: number;
    withinBudget: boolean;
  };
  alerts: Array<{
    level: 'warning' | 'error' | 'critical';
    message: string;
    component: string;
    timestamp: string;
  }>;
}

export class HealthController {
  private orchestrationService: OrchestrationService;
  private startTime: number;

  constructor() {
    this.orchestrationService = getOrchestrationService();
    this.startTime = Date.now();
  }

  /**
   * Comprehensive health check endpoint
   * GET /health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Get orchestration service health
      const orchestrationHealth = await this.orchestrationService.performHealthCheck();

      // Check database connection
      const dbStartTime = Date.now();
      const dbConnected = await checkConnection();
      const dbConnectionTime = Date.now() - dbStartTime;

      // Get system metrics
      const systemMetrics = this.getSystemMetrics();

      // Calculate overall status
      const overallStatus = this.calculateOverallStatus(orchestrationHealth, dbConnected, systemMetrics);

      // Generate alerts
      const alerts = this.generateAlerts(orchestrationHealth, dbConnected, systemMetrics);

      const currentLatency = Date.now() - startTime;

      const healthCheck: SystemHealthCheck = {
        service: 'MindsDB-RAG-Assistant',
        status: overallStatus,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        components: {
          orchestration: orchestrationHealth,
          database: {
            status: dbConnected ? 'healthy' : 'unhealthy',
            connectionTime: dbConnectionTime,
          },
          infrastructure: systemMetrics,
        },
        latencyBudget: {
          target: 300, // 300ms target
          current: currentLatency,
          withinBudget: currentLatency <= 300,
        },
        alerts,
      };

      const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

      const apiResponse: ApiResponse<SystemHealthCheck> = {
        success: overallStatus !== 'unhealthy',
        data: healthCheck,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(statusCode).json(apiResponse);

    } catch (error: any) {
      const apiResponse: ApiResponse = {
        success: false,
        error: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      };

      res.status(503).json(apiResponse);
    }
  }

  /**
   * Readiness probe endpoint
   * GET /ready
   */
  async readinessProbe(req: Request, res: Response): Promise<void> {
    try {
      // Quick checks for readiness
      const checks = await Promise.allSettled([
        checkConnection(),
        this.orchestrationService.performHealthCheck(),
      ]);

      const dbReady = checks[0].status === 'fulfilled' && checks[0].value;
      const orchestrationReady = checks[1].status === 'fulfilled' && 
        checks[1].value.status !== 'unhealthy';

      const ready = dbReady && orchestrationReady;

      const response = {
        ready,
        checks: {
          database: dbReady,
          orchestration: orchestrationReady,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(ready ? 200 : 503).json({
        success: ready,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });

    } catch (error: any) {
      res.status(503).json({
        success: false,
        error: `Readiness check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });
    }
  }

  /**
   * Liveness probe endpoint
   * GET /live
   */
  async livenessProbe(req: Request, res: Response): Promise<void> {
    try {
      // Simple liveness check - just verify the service is running
      const uptime = Date.now() - this.startTime;
      const memoryUsage = process.memoryUsage();

      const response = {
        alive: true,
        uptime,
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });

    } catch (error: any) {
      res.status(503).json({
        success: false,
        error: `Liveness check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });
    }
  }

  /**
   * Startup probe endpoint
   * GET /startup
   */
  async startupProbe(req: Request, res: Response): Promise<void> {
    try {
      // Check if all services have started successfully
      const uptime = Date.now() - this.startTime;
      const minimumStartupTime = 10000; // 10 seconds minimum startup time

      if (uptime < minimumStartupTime) {
        res.status(503).json({
          success: false,
          error: 'Service still starting up',
          data: {
            uptime,
            minimumStartupTime,
            ready: false,
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || uuidv4(),
        });
        return;
      }

      // Perform startup checks
      const orchestrationHealth = await this.orchestrationService.performHealthCheck();
      const dbConnected = await checkConnection();

      const started = orchestrationHealth.status !== 'unhealthy' && dbConnected;

      const response = {
        started,
        uptime,
        components: {
          orchestration: orchestrationHealth.status,
          database: dbConnected ? 'healthy' : 'unhealthy',
        },
        timestamp: new Date().toISOString(),
      };

      res.status(started ? 200 : 503).json({
        success: started,
        data: response,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });

    } catch (error: any) {
      res.status(503).json({
        success: false,
        error: `Startup check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || uuidv4(),
      });
    }
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): SystemHealthCheck['components']['infrastructure'] {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      cpu: {
        usage: cpuPercent,
      },
      disk: {
        available: 0, // Would need additional library to get disk stats
        total: 0,
        percentage: 0,
      },
    };
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(
    orchestrationHealth: any,
    dbConnected: boolean,
    systemMetrics: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Critical components
    if (!dbConnected || orchestrationHealth.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Check system resources
    if (systemMetrics.memory.percentage > 90 || systemMetrics.cpu.usage > 90) {
      return 'degraded';
    }

    // Check orchestration components
    if (orchestrationHealth.status === 'degraded') {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate system alerts
   */
  private generateAlerts(
    orchestrationHealth: any,
    dbConnected: boolean,
    systemMetrics: any
  ): SystemHealthCheck['alerts'] {
    const alerts: SystemHealthCheck['alerts'] = [];

    // Database alerts
    if (!dbConnected) {
      alerts.push({
        level: 'critical',
        message: 'Database connection failed',
        component: 'database',
        timestamp: new Date().toISOString(),
      });
    }

    // Memory alerts
    if (systemMetrics.memory.percentage > 90) {
      alerts.push({
        level: 'critical',
        message: `High memory usage: ${systemMetrics.memory.percentage.toFixed(1)}%`,
        component: 'infrastructure',
        timestamp: new Date().toISOString(),
      });
    } else if (systemMetrics.memory.percentage > 80) {
      alerts.push({
        level: 'warning',
        message: `Elevated memory usage: ${systemMetrics.memory.percentage.toFixed(1)}%`,
        component: 'infrastructure',
        timestamp: new Date().toISOString(),
      });
    }

    // CPU alerts
    if (systemMetrics.cpu.usage > 90) {
      alerts.push({
        level: 'critical',
        message: `High CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}%`,
        component: 'infrastructure',
        timestamp: new Date().toISOString(),
      });
    }

    // Orchestration alerts
    if (orchestrationHealth.status === 'unhealthy') {
      alerts.push({
        level: 'critical',
        message: 'Orchestration service is unhealthy',
        component: 'orchestration',
        timestamp: new Date().toISOString(),
      });
    } else if (orchestrationHealth.status === 'degraded') {
      alerts.push({
        level: 'warning',
        message: 'Orchestration service is degraded',
        component: 'orchestration',
        timestamp: new Date().toISOString(),
      });
    }

    // Latency budget alerts
    if (!orchestrationHealth.latencyBudget.withinBudget) {
      alerts.push({
        level: 'warning',
        message: `Latency budget exceeded: ${orchestrationHealth.latencyBudget.current}ms > ${orchestrationHealth.latencyBudget.target}ms`,
        component: 'performance',
        timestamp: new Date().toISOString(),
      });
    }

    return alerts;
  }
}

export const healthController = new HealthController();