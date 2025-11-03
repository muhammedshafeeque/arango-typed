export interface SubqueryOptions {
  collection: string;
  where?: Record<string, any>;
  select?: string[];
  limit?: number;
}

/**
 * Subqueries for complex ORM-style queries
 */
export class Subquery {
  /**
   * Create a subquery expression
   */
  static create(options: SubqueryOptions): string {
    const { collection, where, select, limit } = options;
    
    let query = `FOR sub IN ${collection}`;

    // WHERE clause
    if (where && Object.keys(where).length > 0) {
      const conditions: string[] = [];
      let varCounter = 0;
      for (const [key, _value] of Object.entries(where)) {
        const varName = `subVar${varCounter++}`;
        conditions.push(`sub.${key} == @${varName}`);
      }
      query += ` FILTER ${conditions.join(' AND ')}`;
    }

    // SELECT
    if (select && select.length > 0) {
      const fields = select.map(f => `sub.${f}`).join(', ');
      query += ` RETURN { ${fields} }`;
    } else {
      query += ` RETURN sub`;
    }

    // LIMIT
    if (limit !== undefined) {
      query = query.replace(/RETURN/, `LIMIT ${limit} RETURN`);
    }

    return query;
  }

  /**
   * EXISTS subquery - check if subquery returns any results
   */
  static exists(options: SubqueryOptions): string {
    const subquery = this.create(options);
    return `LENGTH(${subquery}) > 0`;
  }

  /**
   * NOT EXISTS subquery
   */
  static notExists(options: SubqueryOptions): string {
    const subquery = this.create(options);
    return `LENGTH(${subquery}) == 0`;
  }

  /**
   * IN subquery - check if value is in subquery results
   */
  static in(value: string, options: SubqueryOptions & { field: string }): string {
    const subquery = this.create({
      ...options,
      select: [options.field],
    });
    return `${value} IN ${subquery}`;
  }

  /**
   * COUNT subquery
   */
  static count(options: SubqueryOptions): string {
    const subquery = this.create(options);
    return `LENGTH(${subquery})`;
  }
}

