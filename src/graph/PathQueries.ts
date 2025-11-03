import { Database } from 'arangojs';

export interface ShortestPathOptions {
  direction?: 'outbound' | 'inbound' | 'any';
  weightAttribute?: string;
  defaultWeight?: number;
}

export interface AllPathsOptions {
  minDepth?: number;
  maxDepth?: number;
  direction?: 'outbound' | 'inbound' | 'any';
  filter?: string;
  uniqueVertices?: 'none' | 'global' | 'path';
  uniqueEdges?: 'none' | 'global' | 'path';
}

/**
 * Graph path queries for OGM features
 */
export class PathQueries {
  private database: Database;
  private graphName: string;

  constructor(database: Database, graphName: string) {
    this.database = database;
    this.graphName = graphName;
  }

  /**
   * Find shortest path between two vertices
   */
  async shortestPath(
    startVertex: string,
    endVertex: string,
    options: ShortestPathOptions = {}
  ): Promise<{
    vertices: string[];
    edges: string[];
    distance?: number;
  } | null> {
    const {
      direction = 'outbound',
      weightAttribute,
      defaultWeight = 1,
    } = options;

    let query = `
      FOR v, e, p IN SHORTEST_PATH
      @startVertex TO @endVertex
      GRAPH @graphName
      DIRECTION ${direction}
    `;

    if (weightAttribute) {
      query += `\n      OPTIONS { weightAttribute: '${weightAttribute}', defaultWeight: ${defaultWeight} }`;
    }

    query += `\n      RETURN { vertices: p.vertices[*]._id, edges: p.edges[*]._id, distance: p.weights[-1] }`;

    try {
      const cursor = await this.database.query(query, {
        startVertex,
        endVertex,
        graphName: this.graphName,
      });

      const results = await cursor.all();
      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      throw new Error(`Shortest path query failed: ${error.message}`);
    }
  }

  /**
   * Find all paths between two vertices
   */
  async allPaths(
    startVertex: string,
    endVertex: string,
    options: AllPathsOptions = {}
  ): Promise<Array<{
    vertices: string[];
    edges: string[];
    distance?: number;
  }>> {
    const {
      minDepth = 1,
      maxDepth = 10,
      direction = 'outbound',
      filter,
      uniqueVertices = 'global',
      uniqueEdges = 'path',
    } = options;

    let query = `
      FOR v, e, p IN ${minDepth}..${maxDepth} ${direction}
      @startVertex TO @endVertex
      GRAPH @graphName
      OPTIONS { uniqueVertices: '${uniqueVertices}', uniqueEdges: '${uniqueEdges}' }
    `;

    if (filter) {
      query += `\n      FILTER ${filter}`;
    }

    query += `\n      RETURN { vertices: p.vertices[*]._id, edges: p.edges[*]._id, distance: LENGTH(p.edges) }`;

    try {
      const cursor = await this.database.query(query, {
        startVertex,
        endVertex,
        graphName: this.graphName,
      });

      return await cursor.all();
    } catch (error: any) {
      throw new Error(`All paths query failed: ${error.message}`);
    }
  }

  /**
   * Find k-shortest paths (top K shortest paths)
   */
  async kShortestPaths(
    startVertex: string,
    endVertex: string,
    k: number = 3,
    options: ShortestPathOptions = {}
  ): Promise<Array<{
    vertices: string[];
    edges: string[];
    distance?: number;
  }>> {
    const paths = await this.allPaths(startVertex, endVertex, {
      ...options,
      maxDepth: 10, // Limit depth for performance
    });

    // Sort by distance and return top K
    paths.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return paths.slice(0, k);
  }

  /**
   * Check if path exists between vertices
   */
  async pathExists(
    startVertex: string,
    endVertex: string,
    maxDepth: number = 10
  ): Promise<boolean> {
    const path = await this.shortestPath(startVertex, endVertex, {
      direction: 'any',
    });

    return path !== null && (path.vertices?.length || 0) <= maxDepth;
  }

  /**
   * Get path distance (number of edges)
   */
  async pathDistance(
    startVertex: string,
    endVertex: string,
    options: ShortestPathOptions = {}
  ): Promise<number | null> {
    const path = await this.shortestPath(startVertex, endVertex, options);
    return path?.edges?.length || null;
  }
}


