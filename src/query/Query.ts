import { Database } from 'arangojs';
import { QueryBuilder, QueryOptions } from './QueryBuilder';
import { QueryError } from '../errors/ArangoError';

// Compiled query cache for performance (key: query signature, value: { query, bindVars })
const queryCache = new Map<string, { query: string; bindVars: Record<string, any> }>();

export class Query<T = any> {
  private database: Database;
  private collectionName: string;
  private builder: QueryBuilder;
  private cacheKey: string | null = null;
  private softDeleteEnabled: boolean = false;

  constructor(database: Database, collectionName: string, options?: QueryOptions) {
    this.database = database;
    this.collectionName = collectionName;
    this.softDeleteEnabled = options?.softDeleteEnabled ?? false;
    this.builder = new QueryBuilder(collectionName, this.softDeleteEnabled);
    
    if (options) {
      this.applyOptions(options);
    }
  }

  private applyOptions(options: QueryOptions): void {
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
   * Build AQL query
   * Optimized with query caching for performance
   */
  buildAQL(): { query: string; bindVars: Record<string, any> } {
    // Generate cache key from query structure
    if (!this.cacheKey) {
      this.cacheKey = this.generateCacheKey();
    }

    // Check cache first
    const cached = queryCache.get(this.cacheKey);
    if (cached) {
      // Reuse query structure, but bindVars may differ
      const bindVars = this.builder.buildAQL().bindVars;
      return { query: cached.query, bindVars };
    }

    // Build new query and cache it
    const result = this.builder.buildAQL();
    queryCache.set(this.cacheKey, { query: result.query, bindVars: {} }); // Cache structure only
    
    return result;
  }

  /**
   * Generate cache key from query structure (not values)
   */
  private generateCacheKey(): string {
    // Create a key based on query structure, not values
    const builderState = this.builder as any;
    const parts = [
      this.collectionName,
      builderState.whereConditions ? 'w' : '',
      builderState.selectFields ? 's' : '',
      builderState.limitValue !== undefined ? `l:${builderState.limitValue}` : '',
      builderState.skipValue !== undefined ? `k:${builderState.skipValue}` : '',
      builderState.sortFields ? 'o' : '',
    ];
    return parts.join('|');
  }

  /**
   * Execute query and return all results
   */
  async all(): Promise<T[]> {
    try {
      const { query, bindVars } = this.builder.buildAQL();
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new QueryError(`Query execution failed: ${error.message}`, this.builder.buildAQL().query);
    }
  }

  /**
   * Execute query and return first result
   */
  async first(): Promise<T | null> {
    try {
      const { query, bindVars } = this.builder.buildAQL();
      const cursor = await this.database.query(query, bindVars);
      const results = await cursor.all();
      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      throw new QueryError(`Query execution failed: ${error.message}`, this.builder.buildAQL().query);
    }
  }

  /**
   * Count results
   */
  async count(): Promise<number> {
    try {
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
      const countQuery = query.replace(/RETURN doc/, 'RETURN LENGTH((' + query.split('RETURN')[0] + '))');
      const cursor = await this.database.query(countQuery, bindVars);
      const results = await cursor.all();
      return results[0] || 0;
    } catch (error: any) {
      throw new QueryError(`Count query failed: ${error.message}`);
    }
  }

  /**
   * Execute raw AQL query
   */
  async execute(query: string, bindVars: Record<string, any> = {}): Promise<any> {
    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new QueryError(`Query execution failed: ${error.message}`, query);
    }
  }
}

