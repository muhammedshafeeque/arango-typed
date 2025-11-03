export class TenantContext {
  private static currentTenant: string | null = null;
  private static tenantStack: string[] = [];

  /**
   * Set current tenant
   */
  static set(tenantId: string): void {
    this.currentTenant = tenantId;
    this.tenantStack.push(tenantId);
  }

  /**
   * Get current tenant
   */
  static get(): string | null {
    return this.currentTenant;
  }

  /**
   * Clear current tenant
   */
  static clear(): void {
    this.currentTenant = null;
    this.tenantStack.pop();
    
    if (this.tenantStack.length > 0) {
      this.currentTenant = this.tenantStack[this.tenantStack.length - 1];
    }
  }

  /**
   * Run function with tenant context
   */
  static async run<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    this.set(tenantId);
    try {
      return await fn();
    } finally {
      this.clear();
    }
  }
}


