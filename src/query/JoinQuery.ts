import { Database } from 'arangojs';

export interface JoinOptions {
  type?: 'inner' | 'left' | 'right';
  on: string | { localField: string; foreignField: string };
  select?: string[];
  as?: string;
}

export interface JoinQueryOptions {
  joins: Array<{ collection: string; options: JoinOptions }>;
  select?: string[];
  where?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

/**
 * Join queries for ORM-like document joins
 */
export class JoinQuery {
  private database: Database;
  private fromCollection: string;
  private options: JoinQueryOptions;

  constructor(database: Database, fromCollection: string, options: JoinQueryOptions) {
    this.database = database;
    this.fromCollection = fromCollection;
    this.options = options;
  }

  /**
   * Execute join query
   */
  async execute<T = any>(): Promise<T[]> {
    const { joins, select, where, sort, limit, skip } = this.options;

    let query = `FOR doc IN @@fromCollection`;
    const bindVars: Record<string, any> = {
      '@fromCollection': this.fromCollection,
    };

    let varCounter = 0;

    // WHERE clause
    if (where && Object.keys(where).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(where)) {
        const varName = `where${varCounter++}`;
        bindVars[varName] = value;
        conditions.push(`doc.${key} == @${varName}`);
      }
      query += `\nFILTER ${conditions.join(' AND ')}`;
    }

    // JOIN clauses
    for (const join of joins) {
      const joinType = join.options.type || 'left';
      const alias = join.options.as || `joined${varCounter}`;
      const onCondition = typeof join.options.on === 'string' 
        ? join.options.on 
        : `doc.${join.options.on.localField} == ${alias}._key`;
      
      if (joinType === 'left') {
        query += `\nFOR ${alias} IN @@collection${varCounter}`;
        query += `\nFILTER ${onCondition}`;
      } else if (joinType === 'inner') {
        query += `\nFOR ${alias} IN @@collection${varCounter}`;
        query += `\nFILTER ${onCondition}`;
      }

      bindVars[`@collection${varCounter}`] = join.collection;
      varCounter++;
    }

    // SELECT
    if (select && select.length > 0) {
      const fields = select.map(f => {
        if (f.includes('.')) {
          const [alias, field] = f.split('.');
          return `${alias}.${field}`;
        }
        return `doc.${f}`;
      }).join(', ');
      query += `\nRETURN { ${fields} }`;
    } else {
      query += `\nRETURN doc`;
    }

    // SORT
    if (sort) {
      const sortClauses: string[] = [];
      for (const [field, direction] of Object.entries(sort)) {
        sortClauses.push(`doc.${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
      }
      query += `\nSORT ${sortClauses.join(', ')}`;
    }

    // LIMIT/SKIP
    if (skip !== undefined && limit !== undefined) {
      query += `\nLIMIT ${skip}, ${limit}`;
    } else if (limit !== undefined) {
      query += `\nLIMIT ${limit}`;
    }

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Join query failed: ${error.message}`);
    }
  }
}


