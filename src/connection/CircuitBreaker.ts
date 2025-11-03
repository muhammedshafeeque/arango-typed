export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000,
      monitoringPeriod: options.monitoringPeriod || 60000,
    };
  }

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN. Service unavailable.');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const now = Date.now();
    return now - this.lastFailureTime >= this.options.resetTimeout;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Auto-reset if timeout has passed
    if (this.state === CircuitState.OPEN && this.shouldAttemptReset()) {
      this.state = CircuitState.HALF_OPEN;
    }
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    lastFailureTime: Date | null;
  } {
    return {
      state: this.getState(),
      failures: this.failures,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}


