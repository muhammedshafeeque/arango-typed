import { Database } from 'arangojs';
import { Model } from '../model/Model';
import { Schema } from '../schema/Schema';
import { Document } from '../model/Document';

/**
 * Graph Model - OGM (Object Graph Mapper) support
 * Provides a model-like interface for graph vertices with relationship support
 */
export interface GraphRelationshipOptions {
  relationship: string;
  direction: 'outbound' | 'inbound' | 'any';
  collection?: string;
  filter?: any;
  limit?: number;
  depth?: number;
}

export class GraphModel<T = any> extends Model<T> {
  private graphName: string;
  private database: Database;

  constructor(
    database: Database,
    graphName: string,
    collectionName: string,
    schema: Schema
  ) {
    super(schema, collectionName, { connection: database });
    this.graphName = graphName;
    this.database = database;
  }

  /**
   * Get connected vertices (OGM relationship access)
   */
  async getConnected(
    vertexId: string,
    _relationship: string,
    options: {
      direction?: 'outbound' | 'inbound' | 'any';
      filter?: any;
      limit?: number;
      depth?: number;
    } = {}
  ): Promise<Document[]> {
    const direction = options.direction || 'outbound';
    const depth = options.depth || 1;
    const limit = options.limit || 100;

    const query = `
      FOR v, e, p IN ${depth} ${direction}
      @startVertex
      GRAPH @graphName
      ${options.filter ? `FILTER ${this.buildFilter(options.filter)}` : ''}
      LIMIT @limit
      RETURN DISTINCT v
    `;

    const result = await this.database.query(query, {
      startVertex: vertexId,
      graphName: this.graphName,
      limit,
    });

    const vertices = await result.all();
    return vertices.map((v: any) => this.createDocument(v));
  }

  /**
   * Get outbound relationships
   */
  async getOutbound(
    vertexId: string,
    relationship?: string,
    options: { filter?: any; limit?: number } = {}
  ): Promise<Document[]> {
    return this.getConnected(vertexId, relationship || '*', {
      direction: 'outbound',
      ...options,
    });
  }

  /**
   * Get inbound relationships
   */
  async getInbound(
    vertexId: string,
    relationship?: string,
    options: { filter?: any; limit?: number } = {}
  ): Promise<Document[]> {
    return this.getConnected(vertexId, relationship || '*', {
      direction: 'inbound',
      ...options,
    });
  }

  /**
   * Create edge between two vertices (OGM relationship)
   */
  async createRelationship(
    fromId: string,
    toId: string,
    edgeCollection: string,
    data: any = {}
  ): Promise<any> {
    const edgeData = {
      _from: fromId,
      _to: toId,
      ...data,
    };

    const edgeCollectionObj = this.database.collection(edgeCollection);
    return await edgeCollectionObj.save(edgeData);
  }

  /**
   * Delete relationship (edge)
   */
  async deleteRelationship(
    edgeCollection: string,
    filter: { _from?: string; _to?: string; [key: string]: any }
  ): Promise<void> {
    const query = `
      FOR edge IN @@edgeCollection
      ${this.buildFilter(filter)}
      REMOVE edge IN @@edgeCollection
    `;

    await this.database.query(query, {
      '@edgeCollection': edgeCollection,
    });
  }

  /**
   * Get path between two vertices
   */
  async getPath(
    fromId: string,
    toId: string,
    options: {
      maxDepth?: number;
      direction?: 'outbound' | 'inbound' | 'any';
      edgeFilter?: string;
    } = {}
  ): Promise<{ vertices: T[]; edges: any[] }> {
    const maxDepth = options.maxDepth || 10;
    const direction = options.direction || 'any';

    const query = `
      FOR v, e, p IN ${maxDepth} ${direction}
      SHORTEST_PATH
      @from TO @to
      GRAPH @graphName
      ${options.edgeFilter ? `FILTER ${options.edgeFilter}` : ''}
      RETURN { vertices: p.vertices, edges: p.edges }
    `;

    const result = await this.database.query(query, {
      from: fromId,
      to: toId,
      graphName: this.graphName,
    });

    const paths = await result.all();
    if (paths.length === 0) {
      return { vertices: [], edges: [] };
    }

    return paths[0];
  }

  /**
   * Count relationships
   */
  async countRelationships(
    vertexId: string,
    direction: 'outbound' | 'inbound' | 'any' = 'any'
  ): Promise<number> {
    const query = `
      FOR v, e IN 1 ${direction}
      @startVertex
      GRAPH @graphName
      COLLECT WITH COUNT INTO count
      RETURN count
    `;

    const result = await this.database.query(query, {
      startVertex: vertexId,
      graphName: this.graphName,
    });

    const count = await result.all();
    return count[0] || 0;
  }

  /**
   * Helper to build AQL filter
   */
  private buildFilter(filter: any): string {
    if (!filter || typeof filter !== 'object') {
      return '';
    }

    const conditions: string[] = [];
    for (const [key, value] of Object.entries(filter)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === 'string') {
        conditions.push(`v.${key} == "${value}"`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        conditions.push(`v.${key} == ${value}`);
      } else if (Array.isArray(value)) {
        conditions.push(`v.${key} IN [${value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`);
      }
    }

    return conditions.length > 0 ? `FILTER ${conditions.join(' AND ')}` : '';
  }

  /**
   * Create document instance
   */
  private createDocument(data: any): Document {
    const doc = new Document(data, this.schema, this.database, this.collectionName, this);
    return doc;
  }
}

/**
 * Create a graph model (OGM pattern)
 */
export function graphModel<T = any>(
  database: Database,
  graphName: string,
  collectionName: string,
  schema: Schema
): GraphModel<T> {
  return new GraphModel<T>(database, graphName, collectionName, schema);
}

