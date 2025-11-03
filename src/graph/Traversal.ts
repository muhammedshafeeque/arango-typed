import { Database } from 'arangojs';

export interface TraversalOptions {
  direction?: 'outbound' | 'inbound' | 'any';
  minDepth?: number;
  maxDepth?: number;
  visitor?: string; // AQL visitor function
  filter?: string; // AQL filter expression
  sort?: Record<string, 1 | -1>;
  limit?: number;
  uniqueVertices?: 'none' | 'global' | 'path';
  uniqueEdges?: 'none' | 'global' | 'path';
  bfs?: boolean; // Breadth-first search
}

export class GraphTraversal {
  private database: Database;
  private graphName: string;
  private startVertex: string;
  private options: TraversalOptions;

  constructor(
    database: Database,
    graphName: string,
    startVertex: string,
    options: TraversalOptions = {}
  ) {
    this.database = database;
    this.graphName = graphName;
    this.startVertex = startVertex;
    this.options = {
      direction: 'outbound',
      minDepth: 1,
      maxDepth: 1,
      uniqueVertices: 'path',
      uniqueEdges: 'path',
      ...options,
    };
  }

  /**
   * Execute traversal query
   */
  async execute<T = any>(): Promise<T[]> {
    const {
      direction,
      minDepth,
      maxDepth,
      visitor,
      filter,
      sort,
      limit,
      uniqueVertices,
      uniqueEdges,
      bfs,
    } = this.options;

    let query = `
      FOR vertex, edge, path IN ${minDepth}..${maxDepth} ${direction || 'outbound'}
      @startVertex
      GRAPH @graphName
    `;

    if (filter) {
      query += `\n      FILTER ${filter}`;
    }

    if (uniqueVertices) {
      query += `\n      OPTIONS { uniqueVertices: '${uniqueVertices}', uniqueEdges: '${uniqueEdges || 'path'}' }`;
    }

    if (bfs) {
      query += `\n      OPTIONS { bfs: true }`;
    }

    if (sort) {
      const sortClauses: string[] = [];
      for (const [field, dir] of Object.entries(sort)) {
        sortClauses.push(`path.vertices[-1].${field} ${dir === 1 ? 'ASC' : 'DESC'}`);
      }
      query += `\n      SORT ${sortClauses.join(', ')}`;
    }

    if (limit) {
      query += `\n      LIMIT ${limit}`;
    }

    if (visitor) {
      query += `\n      ${visitor}`;
    } else {
      query += `\n      RETURN { vertex, edge, path }`;
    }

    const bindVars = {
      startVertex: this.startVertex,
      graphName: this.graphName,
    };

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Traversal failed: ${error.message}`);
    }
  }

  /**
   * Get only vertices
   */
  async vertices<T = any>(): Promise<T[]> {
    this.options.visitor = 'RETURN vertex';
    return this.execute<T>();
  }

  /**
   * Get only edges
   */
  async edges<T = any>(): Promise<T[]> {
    this.options.visitor = 'RETURN edge';
    return this.execute<T>();
  }

  /**
   * Get paths
   */
  async paths<T = any>(): Promise<T[]> {
    this.options.visitor = 'RETURN path';
    return this.execute<T>();
  }

  /**
   * Set direction
   */
  direction(dir: 'outbound' | 'inbound' | 'any'): this {
    this.options.direction = dir;
    return this;
  }

  /**
   * Set depth range
   */
  depth(min: number, max?: number): this {
    this.options.minDepth = min;
    this.options.maxDepth = max || min;
    return this;
  }

  /**
   * Set filter
   */
  filter(filterExpr: string): this {
    this.options.filter = filterExpr;
    return this;
  }

  /**
   * Set limit
   */
  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  /**
   * Set unique vertices
   */
  uniqueVertices(mode: 'none' | 'global' | 'path'): this {
    this.options.uniqueVertices = mode;
    return this;
  }

  /**
   * Use breadth-first search
   */
  bfs(enabled: boolean = true): this {
    this.options.bfs = enabled;
    return this;
  }
}

