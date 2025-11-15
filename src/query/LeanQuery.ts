import { Database } from 'arangojs';
import { QueryBuilder, QueryOptions } from './QueryBuilder';

export interface LeanQueryOptions extends QueryOptions {
  lean?: boolean;
}

/**
 * Lean queries return plain JavaScript objects instead of Document instances
 * This provides better performance and lower memory usage
 */
export class LeanQuery<T = any> {
  private database: Database;
  private collectionName: string;
  private builder: QueryBuilder;
  private softDeleteEnabled: boolean = false;

  constructor(database: Database, collectionName: string, options?: LeanQueryOptions) {
    this.database = database;
    this.collectionName = collectionName;
    this.softDeleteEnabled = options?.softDeleteEnabled ?? false;
    this.builder = new QueryBuilder(collectionName, this.softDeleteEnabled);
    
    if (options) {
      this.applyOptions(options);
    }
  }

  private applyOptions(options: LeanQueryOptions): void {
    if (options.where) {
      this.builder.where(options.where);
    }
    if (options.select) {
      this.builder.select(options.select);
    }
    if (options.limit !== undefined) {
      this.builder.limit(options.limit);
    }
    if (options.skip !== undefined) {
      this.builder.skip(options.skip);
    }
    if (options.sort) {
      this.builder.sort(options.sort);
    }
    if (options.includeDeleted) {
      this.builder.withDeleted();
    }
    if (options.onlyDeleted) {
      this.builder.onlyDeleted();
    }
  }

  where(conditions: Record<string, any>): this {
    this.builder.where(conditions);
    return this;
  }

  select(fields: string[]): this {
    this.builder.select(fields);
    return this;
  }

  limit(value: number): this {
    this.builder.limit(value);
    return this;
  }

  skip(value: number): this {
    this.builder.skip(value);
    return this;
  }

  sort(fields: Record<string, 1 | -1> | Array<{ field: string; direction: 1 | -1 }>): this {
    this.builder.sort(fields);
    return this;
  }

  /**
   * Include soft-deleted documents in query
   */
  withDeleted(): this {
    this.builder.withDeleted();
    return this;
  }

  /**
   * Only return soft-deleted documents
   */
  onlyDeleted(): this {
    this.builder.onlyDeleted();
    return this;
  }

  /**
   * Execute query and return plain objects (lean mode)
   */
  async all(): Promise<T[]> {
    const { query, bindVars } = this.builder.buildAQL();
    const cursor = await this.database.query(query, bindVars);
    return await cursor.all() as T[];
  }

  /**
   * Execute query and return first plain object
   */
  async first(): Promise<T | null> {
    const results = await this.all();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count results
   */
  async count(): Promise<number> {
    const builder = new QueryBuilder(this.collectionName, this.softDeleteEnabled);
    const whereOptions = this.builder.getOptions().where;
    if (whereOptions) {
      builder.where(whereOptions);
    }
    // Preserve soft delete options
    if ((this.builder as any).includeDeleted) {
      builder.withDeleted();
    }
    if ((this.builder as any).onlyDeletedFlag) {
      builder.onlyDeleted();
    }

    const { query, bindVars } = builder.buildAQL();
    const countQuery = query.replace(/RETURN.*/, 'RETURN COUNT(FOR doc IN @@collection FILTER true)');
    const cursor = await this.database.query(countQuery, bindVars);
    const results = await cursor.all();
    return results[0] || 0;
  }
}

