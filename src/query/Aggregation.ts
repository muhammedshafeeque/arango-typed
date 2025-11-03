import { Database } from 'arangojs';
import { QueryBuilder, QueryOptions } from './QueryBuilder';

export interface AggregationOptions extends QueryOptions {
  groupBy?: string | string[];
  aggregate?: Record<string, { $sum?: string; $avg?: string; $min?: string; $max?: string; $count?: boolean }>;
  having?: Record<string, any>;
}

export class AggregationQuery {
  private database: Database;
  private collectionName: string;
  private builder: QueryBuilder;
  private options: AggregationOptions;

  constructor(database: Database, collectionName: string, options: AggregationOptions = {}) {
    this.database = database;
    this.collectionName = collectionName;
    this.builder = new QueryBuilder(collectionName);
    this.options = options;

    if (options.where) {
      this.builder.where(options.where);
    }
  }

  /**
   * Group by fields
   */
  groupBy(fields: string | string[]): this {
    this.options.groupBy = fields;
    return this;
  }

  /**
   * Add aggregation functions
   */
  aggregate(fields: Record<string, { $sum?: string; $avg?: string; $min?: string; $max?: string; $count?: boolean }>): this {
    this.options.aggregate = { ...this.options.aggregate, ...fields };
    return this;
  }

  /**
   * Add having clause
   */
  having(conditions: Record<string, any>): this {
    this.options.having = { ...this.options.having, ...conditions };
    return this;
  }

  /**
   * Build AQL aggregation query
   */
  buildAQL(): { query: string; bindVars: Record<string, any> } {
    const baseQuery = this.builder.buildAQL();
    const bindVars = { ...baseQuery.bindVars };
    bindVars['@collection'] = this.collectionName;
    const parts: string[] = [];

    // Start with FOR
    parts.push(`FOR doc IN @@collection`);

    // Add WHERE if exists
    if (this.options.where && Object.keys(this.options.where).length > 0) {
      const whereParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(this.options.where)) {
        const varName = `value${varCounter++}`;
        bindVars[varName] = value;
        whereParts.push(`doc.${key} == @${varName}`);
      }
      parts.push(`FILTER ${whereParts.join(' AND ')}`);
    }

    // COLLECT for grouping
    if (this.options.groupBy || this.options.aggregate) {
      const groupFields = Array.isArray(this.options.groupBy) 
        ? this.options.groupBy 
        : this.options.groupBy ? [this.options.groupBy] : [];

      const collectParts: string[] = [];

      if (groupFields.length > 0) {
        collectParts.push(...groupFields.map((field) => `${field} = doc.${field}`));
      }

      const aggregateParts: string[] = [];
      if (this.options.aggregate) {
        for (const [alias, operations] of Object.entries(this.options.aggregate)) {
          if (operations.$sum) {
            aggregateParts.push(`${alias} = SUM(doc.${operations.$sum})`);
          }
          if (operations.$avg) {
            aggregateParts.push(`${alias} = AVERAGE(doc.${operations.$avg})`);
          }
          if (operations.$min) {
            aggregateParts.push(`${alias} = MIN(doc.${operations.$min})`);
          }
          if (operations.$max) {
            aggregateParts.push(`${alias} = MAX(doc.${operations.$max})`);
          }
          if (operations.$count) {
            aggregateParts.push(`${alias} = COUNT()`);
          }
        }
      }

      if (groupFields.length > 0 || aggregateParts.length > 0) {
        parts.push(`COLLECT ${[...collectParts, ...aggregateParts].join(', ')}`);
      }
    }

    // HAVING clause
    if (this.options.having && Object.keys(this.options.having).length > 0) {
      const havingParts: string[] = [];
      let varCounter = 1000;
      for (const [key, value] of Object.entries(this.options.having)) {
        const varName = `having${varCounter++}`;
        bindVars[varName] = value;
        havingParts.push(`${key} == @${varName}`);
      }
      parts.push(`FILTER ${havingParts.join(' AND ')}`);
    }

    // SORT
    if (this.options.sort) {
      const sortClauses: string[] = [];
      if (Array.isArray(this.options.sort)) {
        for (const sort of this.options.sort) {
          sortClauses.push(`${sort.field} ${sort.direction === 1 ? 'ASC' : 'DESC'}`);
        }
      } else {
        for (const [field, direction] of Object.entries(this.options.sort)) {
          sortClauses.push(`${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
        }
      }
      if (sortClauses.length > 0) {
        parts.push(`SORT ${sortClauses.join(', ')}`);
      }
    }

    // LIMIT
    if (this.options.limit !== undefined) {
      if (this.options.skip !== undefined) {
        parts.push(`LIMIT ${this.options.skip}, ${this.options.limit}`);
      } else {
        parts.push(`LIMIT ${this.options.limit}`);
      }
    }

    // RETURN
    if (this.options.select && this.options.select.length > 0) {
      const returnFields = this.options.select.join(', ');
      parts.push(`RETURN { ${returnFields} }`);
    } else {
      parts.push(`RETURN { ${this.options.groupBy ? (Array.isArray(this.options.groupBy) ? this.options.groupBy.join(', ') : this.options.groupBy) : '*'}, * }`);
    }

    return {
      query: parts.join('\n'),
      bindVars,
    };
  }

  /**
   * Execute aggregation query
   */
  async execute<T = any>(): Promise<T[]> {
    try {
      const { query, bindVars } = this.buildAQL();
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Aggregation query failed: ${error.message}`);
    }
  }
}

