/**
 * Audit Context
 * Manages the current user context for audit logging
 */
export class AuditContext {
  private static context: Map<string, any> = new Map();

  /**
   * Set the current user ID for audit logging
   */
  static set(userId: string | null, metadata?: Record<string, any>): void {
    if (userId === null) {
      this.context.delete('userId');
      if (metadata) {
        this.context.delete('metadata');
      }
    } else {
      this.context.set('userId', userId);
      if (metadata) {
        this.context.set('metadata', metadata);
      }
    }
  }

  /**
   * Get the current user ID
   */
  static get(): string | null {
    return this.context.get('userId') || null;
  }

  /**
   * Get audit metadata
   */
  static getMetadata(): Record<string, any> | null {
    return this.context.get('metadata') || null;
  }

  /**
   * Clear the audit context
   */
  static clear(): void {
    this.context.clear();
  }

  /**
   * Run a function with a specific user context
   */
  static async run<T>(userId: string | null, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const previousUserId = this.get();
    const previousMetadata = this.getMetadata();
    
    try {
      this.set(userId, metadata);
      return await fn();
    } finally {
      if (previousUserId !== null) {
        this.set(previousUserId, previousMetadata || undefined);
      } else {
        this.clear();
      }
    }
  }
}

