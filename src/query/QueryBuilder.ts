export interface QueryOptions {
  select?: string[];
  where?: Record<string, any>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1> | Array<{ field: string; direction: 1 | -1 }>;
  returnCount?: boolean;
}

export class QueryBuilder {
  private collectionName: string;
  private options: QueryOptions;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.options = {};
  }

  /**
   * Set the where clause
   */
  where(conditions: Record<string, any>): this {
    this.options.where = { ...this.options.where, ...conditions };
    return this;
  }

  /**
   * Set fields to select
   */
  select(fields: string[]): this {
    this.options.select = fields;
    return this;
  }

  /**
   * Set limit
   */
  limit(value: number): this {
    this.options.limit = value;
    return this;
  }

  /**
   * Set skip
   */
  skip(value: number): this {
    this.options.skip = value;
    return this;
  }

  /**
   * Set sort
   */
  sort(fields: Record<string, 1 | -1> | Array<{ field: string; direction: 1 | -1 }>): this {
    this.options.sort = fields;
    return this;
  }

  /**
   * Build AQL query
   */
  buildAQL(): { query: string; bindVars: Record<string, any> } {
    const bindVars: Record<string, any> = {};
    const parts: string[] = [];
    let varCounter = 0;

    // FOR loop
    parts.push(`FOR doc IN @@collection`);

    // WHERE clause
    if (this.options.where && Object.keys(this.options.where).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(this.options.where)) {
        const varName = `value${varCounter++}`;
        
        // Check if value is an operator object (like { $gte: 18 })
        const isOperatorObject = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && Object.keys(value)[0]?.startsWith('$');
        
        // Determine if this field should use partial text search
        // Fields ending with "Contains" (case-insensitive) automatically use partial text search for string values
        // Examples: nameContains, codeContains, user.emailContains
        const keyLower = key.toLowerCase();
        const shouldUsePartialSearch = !isOperatorObject && 
                                       typeof value === 'string' && 
                                       keyLower.endsWith('contains');
        
        // Extract actual field name if using Contains suffix
        let actualFieldName = key;
        if (shouldUsePartialSearch) {
          // Remove "Contains" suffix (case-insensitive)
          actualFieldName = key.slice(0, -8); // "Contains" is 8 characters
        }

        if (actualFieldName.includes('.')) {
          // Nested field
          const pathParts = actualFieldName.split('.');
          let path = 'doc';
          for (const part of pathParts) {
            path += `['${part}']`;
          }
          
          if (shouldUsePartialSearch) {
            // Use LIKE for case-insensitive partial text search
            bindVars[varName] = value.toLowerCase();
            conditions.push(`LOWER(${path}) LIKE CONCAT('%', @${varName}, '%')`);
          } else {
            bindVars[varName] = value;
            conditions.push(`${path} == @${varName}`);
          }
        } else {
          // Escape key if it contains special characters
          const safeKey = actualFieldName.replace(/[^a-zA-Z0-9_]/g, '');
          const fieldPath = safeKey === actualFieldName ? `doc.${actualFieldName}` : `doc['${actualFieldName}']`;
          
          if (shouldUsePartialSearch) {
            // Use LIKE for case-insensitive partial text search
            bindVars[varName] = value.toLowerCase();
            conditions.push(`LOWER(${fieldPath}) LIKE CONCAT('%', @${varName}, '%')`);
          } else {
            bindVars[varName] = value;
            conditions.push(`${fieldPath} == @${varName}`);
          }
        }
      }
      if (conditions.length > 0) {
        parts.push(`FILTER ${conditions.join(' AND ')}`);
      }
    }

    // SORT
    if (this.options.sort) {
      const sortClauses: string[] = [];
      if (Array.isArray(this.options.sort)) {
        for (const sort of this.options.sort) {
          sortClauses.push(`doc.${sort.field} ${sort.direction === 1 ? 'ASC' : 'DESC'}`);
        }
      } else {
        for (const [field, direction] of Object.entries(this.options.sort)) {
          sortClauses.push(`doc.${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
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
    } else if (this.options.skip !== undefined) {
      parts.push(`LIMIT ${this.options.skip}, 999999`);
    }

    // RETURN
    if (this.options.select && this.options.select.length > 0) {
      const returnFields = this.options.select
        .map((field) => `doc.${field}`)
        .join(', ');
      parts.push(`RETURN { ${returnFields} }`);
    } else {
      parts.push(`RETURN doc`);
    }

    bindVars['@collection'] = this.collectionName;

    return {
      query: parts.join('\n'),
      bindVars,
    };
  }

  /**
   * Get options
   */
  getOptions(): QueryOptions {
    return { ...this.options };
  }
}

