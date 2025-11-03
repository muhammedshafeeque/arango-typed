import { Database } from 'arangojs';

export interface TenantOptions {
  isolationMode: 'database' | 'collection';
  tenantField?: string;
}

export class TenantManager {
  private database: Database;
  private options: Required<TenantOptions>;

  constructor(database: Database, options: TenantOptions) {
    this.database = database;
    this.options = {
      isolationMode: options.isolationMode,
      tenantField: options.tenantField || 'tenantId',
    };
  }

  /**
   * Get tenant database
   */
  async getTenantDatabase(_tenantId: string): Promise<Database> {
    if (this.options.isolationMode !== 'database') {
      return this.database;
    }

    // Note: useDatabase doesn't exist in arangojs, this would need admin API
    // For now, return the same database with tenant isolation at collection level
    // In production, you'd need to handle database-per-tenant differently
    return this.database;
  }

  /**
   * Add tenant filter to query
   */
  addTenantFilter(query: any, tenantId: string): any {
    if (this.options.isolationMode === 'collection') {
      query[this.options.tenantField] = tenantId;
    }
    return query;
  }

  /**
   * Get tenant field name
   */
  getTenantField(): string {
    return this.options.tenantField;
  }

  /**
   * Check if isolation is by database
   */
  isDatabaseIsolation(): boolean {
    return this.options.isolationMode === 'database';
  }
}

