import { CircuitBreakerConfig } from '../types';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreaker {
  callWithBreaker<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T>;
}

export class CircuitBreakerService implements CircuitBreaker {
  private states = new Map<string, CircuitBreakerState>();
  private failureCounts = new Map<string, number>();
  private lastFailureTime = new Map<string, number>();
  private successCounts = new Map<string, number>();

  public async callWithBreaker<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    const operationKey = this.getOperationKey(operation);
    const state = this.getState(operationKey);

    switch (state) {
      case CircuitBreakerState.CLOSED:
        return this.executeInClosedState(operationKey, operation, fallback, config);
      
      case CircuitBreakerState.OPEN:
        return this.executeInOpenState(operationKey, operation, fallback, config);
      
      case CircuitBreakerState.HALF_OPEN:
        return this.executeInHalfOpenState(operationKey, operation, fallback, config);
      
      default:
        return this.executeInClosedState(operationKey, operation, fallback, config);
    }
  }

  private async executeInClosedState<T>(
    operationKey: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    try {
      const result = await operation();
      this.onSuccess(operationKey);
      return result;
    } catch (error) {
      this.onFailure(operationKey, config);
      
      if (this.getState(operationKey) === CircuitBreakerState.OPEN) {
        return fallback();
      }
      
      throw error;
    }
  }

  private async executeInOpenState<T>(
    operationKey: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    const lastFailure = this.lastFailureTime.get(operationKey) || 0;
    const now = Date.now();

    if (now - lastFailure >= config.resetTimeout) {
      this.states.set(operationKey, CircuitBreakerState.HALF_OPEN);
      return this.executeInHalfOpenState(operationKey, operation, fallback, config);
    }

    return fallback();
  }

  private async executeInHalfOpenState<T>(
    operationKey: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    try {
      const result = await operation();
      this.onSuccess(operationKey);
      this.states.set(operationKey, CircuitBreakerState.CLOSED);
      return result;
    } catch (error) {
      this.onFailure(operationKey, config);
      this.states.set(operationKey, CircuitBreakerState.OPEN);
      return fallback();
    }
  }

  private onSuccess(operationKey: string): void {
    this.failureCounts.set(operationKey, 0);
    const successCount = (this.successCounts.get(operationKey) || 0) + 1;
    this.successCounts.set(operationKey, successCount);
  }

  private onFailure(operationKey: string, config: CircuitBreakerConfig): void {
    const failureCount = (this.failureCounts.get(operationKey) || 0) + 1;
    this.failureCounts.set(operationKey, failureCount);
    this.lastFailureTime.set(operationKey, Date.now());

    if (failureCount >= config.failureThreshold) {
      this.states.set(operationKey, CircuitBreakerState.OPEN);
    }
  }

  private getState(operationKey: string): CircuitBreakerState {
    return this.states.get(operationKey) || CircuitBreakerState.CLOSED;
  }

  private getOperationKey(operation: () => Promise<any>): string {
    // Simple key generation based on function name or toString
    return operation.name || operation.toString().substring(0, 50);
  }

  public getStats(operationKey: string) {
    return {
      state: this.getState(operationKey),
      failureCount: this.failureCounts.get(operationKey) || 0,
      successCount: this.successCounts.get(operationKey) || 0,
      lastFailureTime: this.lastFailureTime.get(operationKey),
    };
  }

  public reset(operationKey: string): void {
    this.states.set(operationKey, CircuitBreakerState.CLOSED);
    this.failureCounts.set(operationKey, 0);
    this.successCounts.set(operationKey, 0);
    this.lastFailureTime.delete(operationKey);
  }
}