import { Database } from 'arangojs';

export interface StreamOptions {
  batchSize?: number;
  timeout?: number;
}

export class StreamingQuery {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Execute query with streaming results
   */
  async *stream(
    query: string,
    bindVars?: Record<string, any>,
    options: StreamOptions = {}
  ): AsyncGenerator<any, void, unknown> {
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Add LIMIT and OFFSET to query
      const paginatedQuery = this.addPagination(query, offset, batchSize);
      
      const cursor = await this.database.query(paginatedQuery, bindVars);
      const batch = await cursor.all();

      for (const item of batch) {
        yield item;
      }

      hasMore = batch.length === batchSize;
      offset += batchSize;
    }
  }

  /**
   * Process query results in batches
   */
  async processBatches<T>(
    query: string,
    bindVars: Record<string, any> | undefined,
    processor: (batch: T[]) => Promise<void>,
    options: StreamOptions = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const paginatedQuery = this.addPagination(query, offset, batchSize);
      
      const cursor = await this.database.query(paginatedQuery, bindVars);
      const batch = await cursor.all() as T[];

      await processor(batch);

      hasMore = batch.length === batchSize;
      offset += batchSize;
    }
  }

  /**
   * Add pagination to query
   */
  private addPagination(query: string, offset: number, limit: number): string {
    // Validate query structure
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: query must be a non-empty string');
    }

    const trimmedQuery = query.trim();
    
    // Check for existing LIMIT clause
    const limitRegex = /\bLIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i;
    const limitMatch = trimmedQuery.match(limitRegex);
    
    // Check for existing OFFSET clause without LIMIT
    const offsetOnlyRegex = /\bOFFSET\s+(\d+)(?!.*LIMIT)/i;
    const offsetOnlyMatch = trimmedQuery.match(offsetOnlyRegex);

    if (limitMatch) {
      // Query has LIMIT (and possibly OFFSET)
      if (limitMatch[2]) {
        // Has both LIMIT and OFFSET - replace both
        return trimmedQuery.replace(limitRegex, `LIMIT ${limit} OFFSET ${offset}`);
      } else {
        // Has LIMIT but no OFFSET - add OFFSET
        return trimmedQuery.replace(limitRegex, `LIMIT ${limitMatch[1]} OFFSET ${offset}`);
      }
    } else if (offsetOnlyMatch) {
      // Has OFFSET but no LIMIT - add LIMIT before OFFSET
      return trimmedQuery.replace(offsetOnlyRegex, `LIMIT ${limit} OFFSET ${offset}`);
    } else {
      // No LIMIT or OFFSET - append both
      // Check if query ends with semicolon
      const hasSemicolon = trimmedQuery.endsWith(';');
      const queryWithoutSemicolon = hasSemicolon ? trimmedQuery.slice(0, -1) : trimmedQuery;
      return `${queryWithoutSemicolon} LIMIT ${limit} OFFSET ${offset}${hasSemicolon ? ';' : ''}`;
    }
  }
}


