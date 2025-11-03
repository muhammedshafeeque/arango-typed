import { Database } from 'arangojs';
import { QueryError } from '../errors/ArangoError';

export interface AQLOptions {
  bindVars?: Record<string, any>;
  batchSize?: number;
  count?: boolean;
  ttl?: number;
  cache?: boolean;
  memoryLimit?: number;
  fillBlockCache?: boolean;
  allowRetry?: boolean;
}

export class AQLBuilder {
  private database: Database;
  private query: string = '';
  private bindVars: Record<string, any> = {};
  private queryOptions: AQLOptions = {};

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Set the AQL query string
   */
  queryString(query: string): this {
    this.query = query;
    return this;
  }

  /**
   * Add bind variables
   */
  bind(key: string, value: any): this {
    this.bindVars[key] = value;
    return this;
  }

  /**
   * Set multiple bind variables
   */
  binds(vars: Record<string, any>): this {
    this.bindVars = { ...this.bindVars, ...vars };
    return this;
  }

  /**
   * Set query options
   */
  setOptions(opts: AQLOptions): this {
    this.queryOptions = { ...this.queryOptions, ...opts };
    return this;
  }

  /**
   * Set batch size
   */
  batchSize(size: number): this {
    this.queryOptions.batchSize = size;
    return this;
  }

  /**
   * Enable counting
   */
  enableCount(enabled: boolean = true): this {
    this.queryOptions.count = enabled;
    return this;
  }

  /**
   * Set TTL
   */
  ttl(seconds: number): this {
    this.queryOptions.ttl = seconds;
    return this;
  }

  /**
   * Enable caching
   */
  cache(enabled: boolean = true): this {
    this.queryOptions.cache = enabled;
    return this;
  }

  /**
   * Set memory limit
   */
  memoryLimit(bytes: number): this {
    this.queryOptions.memoryLimit = bytes;
    return this;
  }

  /**
   * Execute the query
   */
  async execute<T = any>(): Promise<T[]> {
    try {
      const cursor = await this.database.query(this.query, this.bindVars, this.queryOptions);
      return await cursor.all();
    } catch (error: any) {
      throw new QueryError(`AQL query failed: ${error.message}`, this.query);
    }
  }

  /**
   * Execute and get cursor for streaming
   */
  async cursor(): Promise<any> {
    try {
      return await this.database.query(this.query, this.bindVars, this.queryOptions);
    } catch (error: any) {
      throw new QueryError(`AQL query failed: ${error.message}`, this.query);
    }
  }

  /**
   * Execute and get first result
   */
  async first<T = any>(): Promise<T | null> {
    const results = await this.execute<T>();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute and get count
   */
  async getCount(): Promise<number> {
    const countQuery = this.query.replace(/RETURN .*$/, 'RETURN COUNT()');
    try {
      const cursor = await this.database.query(countQuery, this.bindVars, this.queryOptions);
      const results = await cursor.all();
      return results[0] || 0;
    } catch (error: any) {
      throw new QueryError(`AQL count failed: ${error.message}`, countQuery);
    }
  }

  /**
   * Explain the query
   */
  async explain(): Promise<any> {
    try {
      return await this.database.explain(this.query, this.bindVars, {
        allPlans: false,
        maxNumberOfPlans: 1,
      });
    } catch (error: any) {
      throw new QueryError(`AQL explain failed: ${error.message}`, this.query);
    }
  }

  /**
   * Parse the query
   */
  async parse(): Promise<any> {
    try {
      return await this.database.parse(this.query);
    } catch (error: any) {
      throw new QueryError(`AQL parse failed: ${error.message}`, this.query);
    }
  }
}

/**
 * Create an AQL builder instance
 */
export function aql(database: Database): AQLBuilder {
  return new AQLBuilder(database);
}

