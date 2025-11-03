import { Database } from 'arangojs';
import { VectorSearch } from '../../vector/VectorSearch';
import { PathQueries } from '../../graph/PathQueries';
import { GraphAlgorithms } from '../../graph/GraphAlgorithms';

export interface MCPContext {
  query: string;
  embeddings?: number[];
  metadata?: Record<string, any>;
  graphTraversal?: boolean;
}

export interface MCPResponse {
  documents: any[];
  graphContext?: {
    paths?: any[];
    neighbors?: any[];
    statistics?: any;
  };
  metadata: Record<string, any>;
}

/**
 * Model Context Protocol (MCP) implementation for ArangoDB
 * Provides unified interface for LLMs to interact with ArangoDB
 */
export class ArangoMCP {
  private database: Database;
  private vectorSearch: VectorSearch;
  private pathQueries?: PathQueries;
  private graphAlgorithms?: GraphAlgorithms;

  constructor(
    database: Database,
    graphName?: string
  ) {
    this.database = database;
    this.vectorSearch = new VectorSearch(database);

    if (graphName) {
      this.pathQueries = new PathQueries(database, graphName);
      this.graphAlgorithms = new GraphAlgorithms(database, graphName);
    }
  }

  /**
   * Get context for a query (combines vector search + graph if applicable)
   */
  async getContext(context: MCPContext): Promise<MCPResponse> {
    const response: MCPResponse = {
      documents: [],
      metadata: {},
    };

    // Vector search if embeddings provided
    if (context.embeddings && context.embeddings.length > 0) {
      const vectorResults = await this.vectorSearch.similaritySearch(
        'context_collection', // Would be configurable
        context.embeddings,
        {
          limit: 5,
          filter: context.metadata,
        }
      );

      response.documents = vectorResults;
      response.metadata.vectorSearchCount = vectorResults.length;
    }

    // Graph context if enabled
    if (context.graphTraversal && this.pathQueries && this.graphAlgorithms) {
      const graphContext: any = {};

      // Get graph statistics
      const stats = await this.graphAlgorithms.getStatistics();
      graphContext.statistics = stats;

      // If query mentions relationships, try to find paths
      if (this.isGraphQuery(context.query)) {
        // This would parse the query to extract graph queries
        // For now, simplified version
        graphContext.hasGraphQuery = true;
      }

      response.graphContext = graphContext;
    }

    return response;
  }

  /**
   * Store context for future retrieval
   */
  async storeContext(
    collectionName: string,
    text: string,
    embeddings: number[],
    metadata?: Record<string, any>
  ): Promise<string> {
    const collection = this.database.collection(collectionName);
    
    const doc = {
      text,
      embedding: embeddings,
      ...metadata,
      createdAt: new Date(),
    };

    const result = await collection.save(doc);
    return result._id || result._key || '';
  }

  /**
   * Update context with additional information
   */
  async updateContext(
    collectionName: string,
    documentId: string,
    updates: Record<string, any>
  ): Promise<void> {
    const collection = this.database.collection(collectionName);
    await collection.update(documentId, updates);
  }

  /**
   * Delete context
   */
  async deleteContext(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    const collection = this.database.collection(collectionName);
    await collection.remove(documentId);
  }

  /**
   * Batch store contexts
   */
  async storeContexts(
    collectionName: string,
    contexts: Array<{
      text: string;
      embeddings: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<string[]> {
    const collection = this.database.collection(collectionName);
    const docs = contexts.map(ctx => ({
      text: ctx.text,
      embedding: ctx.embeddings,
      ...ctx.metadata,
      createdAt: new Date(),
    }));

    await collection.import(docs);
    
    // Return IDs (simplified - would need to fetch after insert)
    return contexts.map((_, i) => `doc_${i}`);
  }

  /**
   * Check if query seems to be a graph query
   */
  private isGraphQuery(query: string): boolean {
    const graphKeywords = ['path', 'relationship', 'connected', 'neighbor', 'traverse', 'route'];
    const lowerQuery = query.toLowerCase();
    return graphKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Get context with graph path information
   */
  async getContextWithPaths(
    startVertex: string,
    endVertex?: string,
    maxDepth: number = 3
  ): Promise<MCPResponse> {
    if (!this.pathQueries) {
      throw new Error('Graph not initialized. Provide graphName in constructor.');
    }

    const response: MCPResponse = {
      documents: [],
      graphContext: {},
      metadata: {},
    };

    if (endVertex) {
      // Get shortest path
      const path = await this.pathQueries.shortestPath(startVertex, endVertex);
      response.graphContext!.paths = path ? [path] : [];
    } else {
      // Get all paths from start vertex
      const stats = await this.graphAlgorithms!.getStatistics();
      response.graphContext!.statistics = stats;

      const neighbors = await this.graphAlgorithms!.getNeighbors(startVertex, {
        depth: maxDepth,
      });
      response.graphContext!.neighbors = neighbors;
    }

    return response;
  }
}

