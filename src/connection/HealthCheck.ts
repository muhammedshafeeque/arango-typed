import { Database } from 'arangojs';

export interface HealthCheckResult {
  healthy: boolean;
  status: 'ok' | 'degraded' | 'down';
  latency?: number;
  error?: string;
  timestamp: Date;
}

export interface HealthCheckOptions {
  timeout?: number;
  checkInterval?: number;
  failureThreshold?: number;
}

export class HealthCheck {
  private database: Database;
  private options: Required<HealthCheckOptions>;
  private checkInterval?: NodeJS.Timeout;
  private lastResult?: HealthCheckResult;
  private consecutiveFailures: number = 0;

  constructor(database: Database, options: HealthCheckOptions = {}) {
    this.database = database;
    this.options = {
      timeout: options.timeout || 5000,
      checkInterval: options.checkInterval || 30000,
      failureThreshold: options.failureThreshold || 3,
    };
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple health check: get database version
      await Promise.race([
        this.database.version(),
        this.createTimeout(),
      ]);

      const latency = Date.now() - startTime;
      this.consecutiveFailures = 0;

      const result: HealthCheckResult = {
        healthy: true,
        status: 'ok',
        latency,
        timestamp: new Date(),
      };

      this.lastResult = result;
      return result;
    } catch (error: any) {
      this.consecutiveFailures++;

      const result: HealthCheckResult = {
        healthy: false,
        status: this.consecutiveFailures >= this.options.failureThreshold ? 'down' : 'degraded',
        error: error.message,
        timestamp: new Date(),
      };

      this.lastResult = result;
      return result;
    }
  }

  /**
   * Start periodic health checks
   */
  start(callback?: (result: HealthCheckResult) => void): void {
    this.stop(); // Stop existing interval

    this.checkInterval = setInterval(async () => {
      const result = await this.check();
      if (callback) {
        callback(result);
      }
    }, this.options.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Get last health check result
   */
  getLastResult(): HealthCheckResult | undefined {
    return this.lastResult;
  }

  /**
   * Check if database is healthy
   */
  isHealthy(): boolean {
    return this.lastResult?.healthy ?? false;
  }

  /**
   * Create timeout promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });
  }
}


