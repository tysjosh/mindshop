import { CircuitBreakerConfig } from '../types';
export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreaker {
    callWithBreaker<T>(operation: () => Promise<T>, fallback: () => Promise<T>, config: CircuitBreakerConfig): Promise<T>;
}
export declare class CircuitBreakerService implements CircuitBreaker {
    private states;
    private failureCounts;
    private lastFailureTime;
    private successCounts;
    callWithBreaker<T>(operation: () => Promise<T>, fallback: () => Promise<T>, config: CircuitBreakerConfig): Promise<T>;
    private executeInClosedState;
    private executeInOpenState;
    private executeInHalfOpenState;
    private onSuccess;
    private onFailure;
    private getState;
    private getOperationKey;
    getStats(operationKey: string): {
        state: CircuitBreakerState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number | undefined;
    };
    reset(operationKey: string): void;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map