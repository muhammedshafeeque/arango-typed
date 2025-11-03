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

  constructor(database: Database, collectionName: string, options?: LeanQueryOptions) {
    this.database = database;
    this.collectionName = collectionName;
    this.builder = new QueryBuilder(collectionName);
    
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
    const builder = new QueryBuilder(this.collectionName);
    const whereOptions = this.builder.getOptions().where;
    if (whereOptions) {
      builder.where(whereOptions);
    }

    const { query, bindVars } = builder.buildAQL();
    const countQuery = query.replace(/RETURN.*/, 'RETURN COUNT(FOR doc IN @@collection FILTER true)');
    const cursor = await this.database.query(countQuery, bindVars);
    const results = await cursor.all();
    return results[0] || 0;
  }
}

