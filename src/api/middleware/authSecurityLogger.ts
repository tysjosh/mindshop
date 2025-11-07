/**
 * Authentication Security Logger
 * Tracks authentication events, failed attempts, and suspicious activity
 */

import { Request } from 'express';
import { getLoggingService, LogContext } from '../../services/LoggingService';
import { AuthErrorCode, shouldAlertOnError, getLogLevelForError } from './authErrors';

/**
 * Authentication event types
 */
export enum AuthEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_VALIDATION_FAILURE = 'TOKEN_VALIDATION_FAILURE',
  LOGOUT = 'LOGOUT',
  API_KEY_VALIDATION_SUCCESS = 'API_KEY_VALIDATION_SUCCESS',
  API_KEY_VALIDATION_FAILURE = 'API_KEY_VALIDATION_FAILURE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_TRIGGERED = 'RATE_LIMIT_TRIGGERED',
}

/**
 * Authentication event data
 */
export interface AuthEvent {
  eventType: AuthEventType;
  userId?: string;
  merchantId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
  requestPath?: string;
  requestMethod?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Failed attempt tracking for rate limiting and suspicious activity detection
 */
interface FailedAttempt {
  ipAddress: string;
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
  userIdentifiers: Set<string>; // Track different users/emails attempted
}

/**
 * Security logger for authentication events
 */
export class AuthSecurityLogger {
  private loggingService = getLoggingService();
  private failedAttempts: Map<string, FailedAttempt> = new Map();
  
  // Configuration
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly FAILED_ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly SUSPICIOUS_THRESHOLD = 10; // Different users from same IP
  private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Periodically clean up old failed attempt records
    setInterval(() => this.cleanupOldAttempts(), this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Log an authentication event
   */
  public async logAuthEvent(event: AuthEvent): Promise<void> {
    const context: LogContext = {
      merchantId: event.merchantId || 'unknown',
      userId: event.userId,
      operation: event.eventType,
      timestamp: event.timestamp,
      requestId: this.generateRequestId(),
    };

    const metadata = {
      eventType: event.eventType,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
      requestPath: event.requestPath,
      requestMethod: event.requestMethod,
      email: event.email,
      ...event.metadata,
    };

    // Determine log level based on event type
    const logLevel = this.getLogLevel(event);

    switch (logLevel) {
      case 'error':
        await this.loggingService.logError(
          new Error(event.errorMessage || event.eventType),
          context,
          metadata
        );
        break;
      case 'warn':
        await this.loggingService.logWarning(
          event.errorMessage || event.eventType,
          context,
          metadata
        );
        break;
      default:
        await this.loggingService.logInfo(
          event.errorMessage || event.eventType,
          context,
          metadata
        );
    }

    // Track failed attempts for rate limiting and suspicious activity detection
    if (this.isFailureEvent(event.eventType)) {
      await this.trackFailedAttempt(event);
    }

    // Send metrics to CloudWatch
    await this.sendMetrics(event);
  }

  /**
   * Log authentication failure with error code
   */
  public async logAuthFailure(
    req: Request,
    errorCode: AuthErrorCode,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    const event: AuthEvent = {
      eventType: AuthEventType.TOKEN_VALIDATION_FAILURE,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      errorCode,
      errorMessage: `Authentication failed: ${errorCode}`,
      requestPath: req.path,
      requestMethod: req.method,
      timestamp: new Date(),
      metadata: additionalInfo,
    };

    await this.logAuthEvent(event);
  }

  /**
   * Log successful authentication
   */
  public async logAuthSuccess(
    req: Request,
    userId: string,
    merchantId: string,
    authMethod: 'jwt' | 'apikey'
  ): Promise<void> {
    const event: AuthEvent = {
      eventType: authMethod === 'jwt' 
        ? AuthEventType.LOGIN_SUCCESS 
        : AuthEventType.API_KEY_VALIDATION_SUCCESS,
      userId,
      merchantId,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestPath: req.path,
      requestMethod: req.method,
      timestamp: new Date(),
      metadata: { authMethod },
    };

    await this.logAuthEvent(event);
    
    // Clear failed attempts for this IP on successful auth
    this.clearFailedAttempts(event.ipAddress!);
  }

  /**
   * Log access denied event
   */
  public async logAccessDenied(
    req: Request,
    userId: string,
    merchantId: string,
    reason: string
  ): Promise<void> {
    const event: AuthEvent = {
      eventType: AuthEventType.ACCESS_DENIED,
      userId,
      merchantId,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      errorMessage: reason,
      requestPath: req.path,
      requestMethod: req.method,
      timestamp: new Date(),
    };

    await this.logAuthEvent(event);
  }

  /**
   * Check if rate limit is exceeded for an IP address
   */
  public isRateLimitExceeded(ipAddress: string): boolean {
    const attempts = this.failedAttempts.get(ipAddress);
    
    if (!attempts) {
      return false;
    }

    // Check if attempts are within the time window
    const now = Date.now();
    const windowStart = now - this.FAILED_ATTEMPT_WINDOW_MS;
    
    if (attempts.firstAttempt.getTime() < windowStart) {
      // Window has expired, clear old attempts
      this.failedAttempts.delete(ipAddress);
      return false;
    }

    return attempts.count >= this.MAX_FAILED_ATTEMPTS;
  }

  /**
   * Log rate limit exceeded event
   */
  public async logRateLimitExceeded(req: Request): Promise<void> {
    const ipAddress = this.getClientIp(req);
    const attempts = this.failedAttempts.get(ipAddress);

    const event: AuthEvent = {
      eventType: AuthEventType.RATE_LIMIT_TRIGGERED,
      ipAddress,
      userAgent: req.headers['user-agent'],
      errorCode: AuthErrorCode.RATE_LIMIT_EXCEEDED,
      errorMessage: 'Rate limit exceeded for authentication attempts',
      requestPath: req.path,
      requestMethod: req.method,
      timestamp: new Date(),
      metadata: {
        failedAttempts: attempts?.count || 0,
        uniqueUsers: attempts?.userIdentifiers.size || 0,
      },
    };

    await this.logAuthEvent(event);
  }

  /**
   * Track failed authentication attempt
   */
  private async trackFailedAttempt(event: AuthEvent): Promise<void> {
    if (!event.ipAddress) {
      return;
    }

    const existing = this.failedAttempts.get(event.ipAddress);
    const now = new Date();

    if (existing) {
      // Check if we're still within the time window
      const windowStart = now.getTime() - this.FAILED_ATTEMPT_WINDOW_MS;
      
      if (existing.firstAttempt.getTime() < windowStart) {
        // Window expired, start fresh
        this.failedAttempts.set(event.ipAddress, {
          ipAddress: event.ipAddress,
          count: 1,
          firstAttempt: now,
          lastAttempt: now,
          userIdentifiers: new Set(event.userId ? [event.userId] : []),
        });
      } else {
        // Increment within window
        existing.count++;
        existing.lastAttempt = now;
        if (event.userId) {
          existing.userIdentifiers.add(event.userId);
        }
        
        // Check for suspicious activity (many different users from same IP)
        if (existing.userIdentifiers.size >= this.SUSPICIOUS_THRESHOLD) {
          await this.logSuspiciousActivity(event.ipAddress, existing);
        }
      }
    } else {
      // First failed attempt
      this.failedAttempts.set(event.ipAddress, {
        ipAddress: event.ipAddress,
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
        userIdentifiers: new Set(event.userId ? [event.userId] : []),
      });
    }
  }

  /**
   * Log suspicious activity
   */
  private async logSuspiciousActivity(ipAddress: string, attempts: FailedAttempt): Promise<void> {
    const event: AuthEvent = {
      eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
      ipAddress,
      errorMessage: 'Suspicious authentication activity detected',
      timestamp: new Date(),
      metadata: {
        failedAttempts: attempts.count,
        uniqueUsers: attempts.userIdentifiers.size,
        timeWindow: this.FAILED_ATTEMPT_WINDOW_MS / 1000 / 60 + ' minutes',
      },
    };

    await this.logAuthEvent(event);
  }

  /**
   * Clear failed attempts for an IP address
   */
  private clearFailedAttempts(ipAddress: string): void {
    this.failedAttempts.delete(ipAddress);
  }

  /**
   * Clean up old failed attempt records
   */
  private cleanupOldAttempts(): void {
    const now = Date.now();
    const windowStart = now - this.FAILED_ATTEMPT_WINDOW_MS;

    for (const [ipAddress, attempts] of this.failedAttempts.entries()) {
      if (attempts.lastAttempt.getTime() < windowStart) {
        this.failedAttempts.delete(ipAddress);
      }
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Determine log level based on event type
   */
  private getLogLevel(event: AuthEvent): 'info' | 'warn' | 'error' {
    if (event.errorCode) {
      return getLogLevelForError(event.errorCode);
    }

    switch (event.eventType) {
      case AuthEventType.LOGIN_FAILURE:
      case AuthEventType.TOKEN_VALIDATION_FAILURE:
      case AuthEventType.API_KEY_VALIDATION_FAILURE:
      case AuthEventType.ACCESS_DENIED:
        return 'warn';
      
      case AuthEventType.SUSPICIOUS_ACTIVITY:
      case AuthEventType.RATE_LIMIT_TRIGGERED:
        return 'error';
      
      default:
        return 'info';
    }
  }

  /**
   * Check if event type represents a failure
   */
  private isFailureEvent(eventType: AuthEventType): boolean {
    return [
      AuthEventType.LOGIN_FAILURE,
      AuthEventType.TOKEN_VALIDATION_FAILURE,
      AuthEventType.API_KEY_VALIDATION_FAILURE,
      AuthEventType.ACCESS_DENIED,
    ].includes(eventType);
  }

  /**
   * Send metrics to CloudWatch
   */
  private async sendMetrics(event: AuthEvent): Promise<void> {
    const dimensions: Record<string, string> = {
      eventType: event.eventType,
    };

    if (event.merchantId) {
      dimensions.merchantId = event.merchantId;
    }

    // Send event count metric
    await this.loggingService.putMetric(
      {
        name: 'auth.events',
        value: 1,
        unit: 'Count',
        dimensions,
      },
      'MindShop/Authentication'
    );

    // Send failure rate metric for failure events
    if (this.isFailureEvent(event.eventType)) {
      await this.loggingService.putMetric(
        {
          name: 'auth.failures',
          value: 1,
          unit: 'Count',
          dimensions,
        },
        'MindShop/Authentication'
      );
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let authSecurityLoggerInstance: AuthSecurityLogger | null = null;

export function getAuthSecurityLogger(): AuthSecurityLogger {
  if (!authSecurityLoggerInstance) {
    authSecurityLoggerInstance = new AuthSecurityLogger();
  }
  return authSecurityLoggerInstance;
}
