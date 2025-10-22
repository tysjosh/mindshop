"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerService = exports.CircuitBreakerState = void 0;
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class CircuitBreakerService {
    constructor() {
        this.states = new Map();
        this.failureCounts = new Map();
        this.lastFailureTime = new Map();
        this.successCounts = new Map();
    }
    async callWithBreaker(operation, fallback, config) {
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
    async executeInClosedState(operationKey, operation, fallback, config) {
        try {
            const result = await operation();
            this.onSuccess(operationKey);
            return result;
        }
        catch (error) {
            this.onFailure(operationKey, config);
            if (this.getState(operationKey) === CircuitBreakerState.OPEN) {
                return fallback();
            }
            throw error;
        }
    }
    async executeInOpenState(operationKey, operation, fallback, config) {
        const lastFailure = this.lastFailureTime.get(operationKey) || 0;
        const now = Date.now();
        if (now - lastFailure >= config.resetTimeout) {
            this.states.set(operationKey, CircuitBreakerState.HALF_OPEN);
            return this.executeInHalfOpenState(operationKey, operation, fallback, config);
        }
        return fallback();
    }
    async executeInHalfOpenState(operationKey, operation, fallback, config) {
        try {
            const result = await operation();
            this.onSuccess(operationKey);
            this.states.set(operationKey, CircuitBreakerState.CLOSED);
            return result;
        }
        catch (error) {
            this.onFailure(operationKey, config);
            this.states.set(operationKey, CircuitBreakerState.OPEN);
            return fallback();
        }
    }
    onSuccess(operationKey) {
        this.failureCounts.set(operationKey, 0);
        const successCount = (this.successCounts.get(operationKey) || 0) + 1;
        this.successCounts.set(operationKey, successCount);
    }
    onFailure(operationKey, config) {
        const failureCount = (this.failureCounts.get(operationKey) || 0) + 1;
        this.failureCounts.set(operationKey, failureCount);
        this.lastFailureTime.set(operationKey, Date.now());
        if (failureCount >= config.failureThreshold) {
            this.states.set(operationKey, CircuitBreakerState.OPEN);
        }
    }
    getState(operationKey) {
        return this.states.get(operationKey) || CircuitBreakerState.CLOSED;
    }
    getOperationKey(operation) {
        // Simple key generation based on function name or toString
        return operation.name || operation.toString().substring(0, 50);
    }
    getStats(operationKey) {
        return {
            state: this.getState(operationKey),
            failureCount: this.failureCounts.get(operationKey) || 0,
            successCount: this.successCounts.get(operationKey) || 0,
            lastFailureTime: this.lastFailureTime.get(operationKey),
        };
    }
    reset(operationKey) {
        this.states.set(operationKey, CircuitBreakerState.CLOSED);
        this.failureCounts.set(operationKey, 0);
        this.successCounts.set(operationKey, 0);
        this.lastFailureTime.delete(operationKey);
    }
}
exports.CircuitBreakerService = CircuitBreakerService;
//# sourceMappingURL=CircuitBreaker.js.map