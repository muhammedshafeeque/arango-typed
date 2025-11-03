import { QueryProfile } from './Profiler';
import { Logger, LogLevel } from './Logger';

export interface SlowQueryLoggerOptions {
  threshold?: number;
  maxLogs?: number;
  logToFile?: boolean;
  logFile?: string;
}

export class SlowQueryLogger {
  private slowQueries: QueryProfile[] = [];
  private logger: Logger;
  private options: Required<SlowQueryLoggerOptions>;

  constructor(options: SlowQueryLoggerOptions = {}, logger?: Logger) {
    this.options = {
      threshold: options.threshold || 1000,
      maxLogs: options.maxLogs || 100,
      logToFile: options.logToFile || false,
      logFile: options.logFile || 'slow-queries.log',
    };
    this.logger = logger || new Logger({ level: LogLevel.WARN });
  }

  /**
   * Log slow query
   */
  log(profile: QueryProfile): void {
    if (profile.executionTime < this.options.threshold) {
      return;
    }

    this.slowQueries.push(profile);

    // Keep only last N logs
    if (this.slowQueries.length > this.options.maxLogs) {
      this.slowQueries.shift();
    }

    // Log warning
    this.logger.warn('Slow query detected', {
      query: profile.query.substring(0, 200),
      executionTime: `${profile.executionTime}ms`,
      timestamp: profile.timestamp.toISOString(),
      cached: profile.cached,
    });

    // Log to file if enabled
    if (this.options.logToFile) {
      this.logToFile(profile);
    }
  }

  /**
   * Get slow queries
   */
  getSlowQueries(): QueryProfile[] {
    return [...this.slowQueries];
  }

  /**
   * Get slow queries summary
   */
  getSummary(): {
    total: number;
    averageTime: number;
    slowest: QueryProfile | null;
    threshold: number;
  } {
    if (this.slowQueries.length === 0) {
      return {
        total: 0,
        averageTime: 0,
        slowest: null,
        threshold: this.options.threshold,
      };
    }

    const totalTime = this.slowQueries.reduce((sum, q) => sum + q.executionTime, 0);
    const slowest = this.slowQueries.reduce((prev, current) => 
      (prev.executionTime > current.executionTime) ? prev : current
    );

    return {
      total: this.slowQueries.length,
      averageTime: totalTime / this.slowQueries.length,
      slowest,
      threshold: this.options.threshold,
    };
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.slowQueries = [];
  }

  /**
   * Log to file
   */
  private logToFile(profile: QueryProfile): void {
    // File logging would be implemented here
    // For now, just log to console
    const fs = require('fs');
    const logLine = JSON.stringify({
      timestamp: profile.timestamp.toISOString(),
      executionTime: profile.executionTime,
      query: profile.query,
      bindVars: profile.bindVars,
      cached: profile.cached,
    }) + '\n';
    
    try {
      fs.appendFileSync(this.options.logFile, logLine);
    } catch (error) {
      // File logging failed, ignore
    }
  }
}


