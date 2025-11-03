export interface QueryProfile {
  query: string;
  bindVars?: Record<string, any>;
  executionTime: number;
  timestamp: Date;
  cached?: boolean;
  plan?: any;
}

export interface ProfilerOptions {
  slowQueryThreshold?: number;
  logSlowQueries?: boolean;
  trackPlans?: boolean;
}

export class Profiler {
  private profiles: QueryProfile[] = [];
  private options: Required<ProfilerOptions>;
  private slowQueries: QueryProfile[] = [];

  constructor(options: ProfilerOptions = {}) {
    this.options = {
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1 second
      logSlowQueries: options.logSlowQueries ?? true,
      trackPlans: options.trackPlans ?? false,
    };
  }

  /**
   * Profile a query execution
   */
  async profile<T>(
    query: string,
    bindVars: Record<string, any> | undefined,
    executor: () => Promise<T>,
    cached: boolean = false
  ): Promise<T> {
    const startTime = Date.now();
    let plan: any;

    try {
      // Get execution plan if enabled
      if (this.options.trackPlans) {
        try {
          plan = await this.getExecutionPlan(query, bindVars);
        } catch {
          // Plan fetching failed, continue anyway
        }
      }

      const result = await executor();
      const executionTime = Date.now() - startTime;

      const profile: QueryProfile = {
        query,
        bindVars,
        executionTime,
        timestamp: new Date(),
        cached,
        plan,
      };

      this.profiles.push(profile);

      // Track slow queries
      if (executionTime >= this.options.slowQueryThreshold) {
        this.slowQueries.push(profile);
        
        if (this.options.logSlowQueries) {
          console.warn(`Slow query detected (${executionTime}ms):`, query.substring(0, 200));
        }
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const profile: QueryProfile = {
        query,
        bindVars,
        executionTime,
        timestamp: new Date(),
        cached,
      };
      this.profiles.push(profile);
      throw error;
    }
  }

  /**
   * Get execution plan
   */
  private async getExecutionPlan(_query: string, _bindVars?: Record<string, any>): Promise<any> {
    // This would use ArangoDB's explain API
    // For now, return empty object as placeholder
    return {};
  }

  /**
   * Get all profiles
   */
  getProfiles(): QueryProfile[] {
    return [...this.profiles];
  }

  /**
   * Get slow queries
   */
  getSlowQueries(): QueryProfile[] {
    return [...this.slowQueries];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
    cacheHitRate: number;
  } {
    const total = this.profiles.length;
    const slow = this.slowQueries.length;
    const totalTime = this.profiles.reduce((sum, p) => sum + p.executionTime, 0);
    const cached = this.profiles.filter((p) => p.cached).length;

    return {
      totalQueries: total,
      slowQueries: slow,
      averageExecutionTime: total > 0 ? totalTime / total : 0,
      totalExecutionTime: totalTime,
      cacheHitRate: total > 0 ? cached / total : 0,
    };
  }

  /**
   * Clear profiles
   */
  clear(): void {
    this.profiles = [];
    this.slowQueries = [];
  }
}

