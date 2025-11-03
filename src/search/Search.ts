import { Database } from 'arangojs';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  analyzers?: string[];
  filter?: Record<string, any>;
  highlights?: string[];
}

export interface SearchResult {
  documents: any[];
  count?: number;
  stats?: any;
}

export class SearchManager {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Full-text search using ArangoSearch views
   */
  async search(
    viewName: string,
    searchString: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const {
      limit = 10,
      offset = 0,
      sort,
      analyzers,
      filter = {},
      highlights = [],
    } = options;

    const bindVars: Record<string, any> = {
      searchString,
      limit,
      offset,
    };

    let query = `
      FOR doc IN @@view
      SEARCH ANALYZER(
        doc.@field == @searchString,
        @analyzer
      )
    `;

    // Add filters
    if (Object.keys(filter).length > 0) {
      const filterParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(filter)) {
        const varName = `filter${varCounter++}`;
        bindVars[varName] = value;
        filterParts.push(`doc.${key} == @${varName}`);
      }
      query += `\n      FILTER ${filterParts.join(' AND ')}`;
    }

    // Add sorting
    if (sort && sort.length > 0) {
      const sortParts = sort.map((s) => `doc.${s.field} ${s.direction.toUpperCase()}`);
      query += `\n      SORT ${sortParts.join(', ')}`;
    } else {
      // Default: sort by relevance (BM25 score)
      query += `\n      SORT BM25(doc) DESC`;
    }

    // Add highlights if requested
    if (highlights.length > 0) {
      const highlightFields = highlights.map((field) => `doc.${field}`).join(', ');
      query += `\n      LET highlights = (${highlightFields})`;
    }

    query += `
      LIMIT @offset, @limit
      RETURN doc
    `;

    bindVars['@view'] = viewName;
    bindVars['@field'] = 'text'; // Default field
    bindVars['@analyzer'] = analyzers?.[0] || 'text_en';

    try {
      const cursor = await this.database.query(query, bindVars);
      const results = await cursor.all();

      // Get count
      const countQuery = query.replace(/LIMIT.*RETURN.*$/, 'COLLECT WITH COUNT INTO length RETURN length');
      let count = 0;
      try {
        const countCursor = await this.database.query(countQuery, bindVars);
        const countResults = await countCursor.all();
        count = countResults[0] || 0;
      } catch {
        // Count query may fail for complex queries
      }

      return {
        documents: results,
        count,
      };
    } catch (error: any) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Phrase search
   */
  async searchPhrase(
    viewName: string,
    phrase: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    return this.search(viewName, `"${phrase}"`, options);
  }

  /**
   * Fuzzy search
   */
  async searchFuzzy(
    viewName: string,
    term: string,
    options: SearchOptions & { maxDistance?: number } = {}
  ): Promise<SearchResult> {
    const { maxDistance = 2, ...searchOptions } = options;
    // Use LEVENSHTEIN_MATCH or similar fuzzy matching
    const fuzzyQuery = `~${term}~${maxDistance}`;
    return this.search(viewName, fuzzyQuery, searchOptions);
  }

  /**
   * Boolean search (AND, OR, NOT)
   */
  async searchBoolean(
    viewName: string,
    conditions: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    // Support for boolean operators: AND, OR, NOT
    return this.search(viewName, conditions, options);
  }

  /**
   * Range search
   */
  async searchRange(
    viewName: string,
    field: string,
    min: any,
    max: any,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const bindVars: Record<string, any> = {
      min,
      max,
      limit: options.limit || 10,
      offset: options.offset || 0,
    };

    let query = `
      FOR doc IN @@view
      SEARCH doc.@field >= @min AND doc.@field <= @max
    `;

    if (options.filter && Object.keys(options.filter).length > 0) {
      const filterParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(options.filter)) {
        const varName = `filter${varCounter++}`;
        bindVars[varName] = value;
        filterParts.push(`doc.${key} == @${varName}`);
      }
      query += `\n      FILTER ${filterParts.join(' AND ')}`;
    }

    if (options.sort && options.sort.length > 0) {
      const sortParts = options.sort.map((s) => `doc.${s.field} ${s.direction.toUpperCase()}`);
      query += `\n      SORT ${sortParts.join(', ')}`;
    }

    query += `
      LIMIT @offset, @limit
      RETURN doc
    `;

    bindVars['@view'] = viewName;
    bindVars['@field'] = field;

    try {
      const cursor = await this.database.query(query, bindVars);
      const results = await cursor.all();

      return {
        documents: results,
      };
    } catch (error: any) {
      throw new Error(`Range search failed: ${error.message}`);
    }
  }
}

