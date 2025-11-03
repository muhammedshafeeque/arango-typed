export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: 'json' | 'text';
  enableColors?: boolean;
}

export class Logger {
  private options: Required<LoggerOptions>;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level ?? LogLevel.INFO,
      format: options.format || 'text',
      enableColors: options.enableColors ?? true,
    };
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.options.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console
    this.output(entry);
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.options.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      const levelStr = LogLevel[entry.level];
      const timestamp = entry.timestamp.toISOString();
      const contextStr = entry.context ? JSON.stringify(entry.context) : '';
      const errorStr = entry.error ? `\nError: ${entry.error.stack}` : '';
      
      if (this.options.enableColors) {
        const colors = this.getColors(entry.level);
        console.log(
          `${colors.start}${timestamp} [${levelStr}] ${entry.message}${contextStr}${errorStr}${colors.end}`
        );
      } else {
        console.log(`${timestamp} [${levelStr}] ${entry.message}${contextStr}${errorStr}`);
      }
    }
  }

  /**
   * Get colors for log level
   */
  private getColors(level: LogLevel): { start: string; end: string } {
    const colors: Record<LogLevel, { start: string; end: string }> = {
      [LogLevel.DEBUG]: { start: '\x1b[36m', end: '\x1b[0m' }, // Cyan
      [LogLevel.INFO]: { start: '\x1b[32m', end: '\x1b[0m' }, // Green
      [LogLevel.WARN]: { start: '\x1b[33m', end: '\x1b[0m' }, // Yellow
      [LogLevel.ERROR]: { start: '\x1b[31m', end: '\x1b[0m' }, // Red
    };
    return colors[level] || { start: '', end: '' };
  }

  /**
   * Get logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter((log) => log.level === level);
    }
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }
}


