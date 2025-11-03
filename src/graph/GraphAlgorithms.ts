import { Database } from 'arangojs';

export interface GraphStatistics {
  vertexCount: number;
  edgeCount: number;
  averageDegree: number;
  maxDegree: number;
  minDegree: number;
}

/**
 * Graph algorithms and statistics for OGM
 */
export class GraphAlgorithms {
  private database: Database;
  private graphName: string;

  constructor(database: Database, graphName: string) {
    this.database = database;
    this.graphName = graphName;
  }

  /**
   * Get graph statistics
   */
  async getStatistics(): Promise<GraphStatistics> {
    const query = `
      LET vertices = (
        FOR v IN GRAPH_VERTICES(@graphName)
        COLLECT WITH COUNT INTO count
        RETURN count
      )
      LET edges = (
        FOR e IN GRAPH_EDGES(@graphName)
        COLLECT WITH COUNT INTO count
        RETURN count
      )
      LET degrees = (
        FOR v IN GRAPH_VERTICES(@graphName)
        LET degree = LENGTH(GRAPH_NEIGHBORS(@graphName, v, { direction: 'any' }))
        RETURN degree
      )
      RETURN {
        vertexCount: vertices[0],
        edgeCount: edges[0],
        averageDegree: AVERAGE(degrees),
        maxDegree: MAX(degrees),
        minDegree: MIN(degrees)
      }
    `;

    try {
      const cursor = await this.database.query(query, { graphName: this.graphName });
      const results = await cursor.all();
      return results[0] || {
        vertexCount: 0,
        edgeCount: 0,
        averageDegree: 0,
        maxDegree: 0,
        minDegree: 0,
      };
    } catch (error: any) {
      throw new Error(`Graph statistics failed: ${error.message}`);
    }
  }

  /**
   * Find neighbors of a vertex
   */
  async getNeighbors(
    vertexId: string,
    options: { direction?: 'outbound' | 'inbound' | 'any'; depth?: number } = {}
  ): Promise<any[]> {
    const { direction = 'any', depth = 1 } = options;

    let query = `
      FOR v, e, p IN 1..${depth} ${direction}
      @vertexId
      GRAPH @graphName
      RETURN DISTINCT v
    `;

    try {
      const cursor = await this.database.query(query, {
        vertexId,
        graphName: this.graphName,
      });
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Get neighbors failed: ${error.message}`);
    }
  }

  /**
   * Find common neighbors between two vertices
   */
  async getCommonNeighbors(
    vertex1Id: string,
    vertex2Id: string
  ): Promise<any[]> {
    const query = `
      LET neighbors1 = (
        FOR v IN GRAPH_NEIGHBORS(@graphName, @vertex1Id, { direction: 'any' })
        RETURN v._id
      )
      LET neighbors2 = (
        FOR v IN GRAPH_NEIGHBORS(@graphName, @vertex2Id, { direction: 'any' })
        RETURN v._id
      )
      FOR common IN INTERSECTION(neighbors1, neighbors2)
      FOR v IN GRAPH_VERTICES(@graphName)
      FILTER v._id == common
      RETURN v
    `;

    try {
      const cursor = await this.database.query(query, {
        vertex1Id,
        vertex2Id,
        graphName: this.graphName,
      });
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Get common neighbors failed: ${error.message}`);
    }
  }

  /**
   * Detect connected components
   */
  async getConnectedComponents(): Promise<Array<{ componentId: number; vertices: string[] }>> {
    // This is a simplified version - full implementation would use BFS/DFS
    const query = `
      FOR v IN GRAPH_VERTICES(@graphName)
      LET reachable = (
        FOR reachable_v IN 0..10 ANY v._id GRAPH @graphName
        RETURN DISTINCT reachable_v._id
      )
      RETURN { componentId: 1, vertices: reachable }
    `;

    try {
      const cursor = await this.database.query(query, { graphName: this.graphName });
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Connected components failed: ${error.message}`);
    }
  }

  /**
   * Find vertex with highest degree (hub)
   */
  async findHub(): Promise<{ vertex: any; degree: number } | null> {
    const query = `
      FOR v IN GRAPH_VERTICES(@graphName)
      LET degree = LENGTH(GRAPH_NEIGHBORS(@graphName, v, { direction: 'any' }))
      SORT degree DESC
      LIMIT 1
      RETURN { vertex: v, degree: degree }
    `;

    try {
      const cursor = await this.database.query(query, { graphName: this.graphName });
      const results = await cursor.all();
      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      throw new Error(`Find hub failed: ${error.message}`);
    }
  }
}


