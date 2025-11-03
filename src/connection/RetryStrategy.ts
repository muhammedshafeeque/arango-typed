export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export class RetryStrategy {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffMultiplier: options.backoffMultiplier || 2,
      retryableErrors: options.retryableErrors || [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET',
      ],
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.options.initialDelay;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Check if we have more attempts
        if (attempt >= this.options.maxAttempts) {
          throw error;
        }

        // Call retry callback
        if (onRetry) {
          onRetry(attempt, error);
        }

        // Wait before retry (exponential backoff)
        await this.sleep(delay);
        delay = Math.min(
          delay * this.options.backoffMultiplier,
          this.options.maxDelay
        );
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    return this.options.retryableErrors.some(
      (retryableError) =>
        errorMessage.includes(retryableError) ||
        errorCode.includes(retryableError)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


