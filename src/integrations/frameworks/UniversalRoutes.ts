import { Database } from 'arangojs';
import { Model } from '../../model/Model';
import { VectorSearch } from '../../vector/VectorSearch';
import { ArangoMCP } from '../langchain/MCP';
import { ArangoRAG } from '../langchain/RAG';
import { FrameworkContext } from '../core/Adapter';

export interface UniversalRoutesOptions {
  database: Database;
  models?: Record<string, Model<any>>;
  vectorSearch?: VectorSearch;
  mcp?: ArangoMCP;
  rag?: ArangoRAG;
  prefix?: string;
}

/**
 * Framework-agnostic route handlers
 * Works with any framework
 */
export class UniversalRoutes {
  private options: UniversalRoutesOptions;

  constructor(options: UniversalRoutesOptions) {
    this.options = options;
  }

  /**
   * Health check handler
   */
  async health(context: FrameworkContext): Promise<void> {
    try {
      await this.options.database.version();
      context.response.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
      });
    } catch (error: any) {
      context.response.status(503).json({
        status: 'unhealthy',
        error: error.message,
      });
    }
  }

  /**
   * List documents handler
   */
  async listDocuments(
    context: FrameworkContext,
    modelName: string
  ): Promise<void> {
    try {
      const model = this.options.models?.[modelName];
      if (!model) {
        context.response.status(404).json({ error: 'Model not found' });
        return;
      }

      const query = context.request.query || {};
      const results = await model.find(query as Record<string, any>).all();
      context.response.status(200).json({ data: results, count: results.length });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * Get single document handler
   */
  async getDocument(
    context: FrameworkContext,
    modelName: string,
    id: string
  ): Promise<void> {
    try {
      const model = this.options.models?.[modelName];
      if (!model) {
        context.response.status(404).json({ error: 'Model not found' });
        return;
      }

      const doc = await model.findById(id);
      if (!doc) {
        context.response.status(404).json({ error: 'Document not found' });
        return;
      }

      context.response.status(200).json({ data: doc });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * Create document handler
   */
  async createDocument(
    context: FrameworkContext,
    modelName: string
  ): Promise<void> {
    try {
      const model = this.options.models?.[modelName];
      if (!model) {
        context.response.status(404).json({ error: 'Model not found' });
        return;
      }

      const doc = await model.create(context.request.body);
      context.response.status(201).json({ data: doc });
    } catch (error: any) {
      context.response.status(400).json({ error: error.message });
    }
  }

  /**
   * Update document handler
   */
  async updateDocument(
    context: FrameworkContext,
    modelName: string,
    id: string
  ): Promise<void> {
    try {
      const model = this.options.models?.[modelName];
      if (!model) {
        context.response.status(404).json({ error: 'Model not found' });
        return;
      }

      const doc = await model.findById(id);
      if (!doc) {
        context.response.status(404).json({ error: 'Document not found' });
        return;
      }

      await (doc as any).update(context.request.body);
      context.response.status(200).json({ data: doc });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete document handler
   */
  async deleteDocument(
    context: FrameworkContext,
    modelName: string,
    id: string
  ): Promise<void> {
    try {
      const model = this.options.models?.[modelName];
      if (!model) {
        context.response.status(404).json({ error: 'Model not found' });
        return;
      }

      const doc = await model.findById(id);
      if (!doc) {
        context.response.status(404).json({ error: 'Document not found' });
        return;
      }

      await (doc as any).remove();
      context.response.status(200).json({ success: true });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * Vector search handler
   */
  async vectorSearch(context: FrameworkContext): Promise<void> {
    try {
      if (!this.options.vectorSearch) {
        context.response.status(503).json({ error: 'Vector search not available' });
        return;
      }

      const { collection, queryVector, options: searchOptions } = context.request.body;
      const results = await this.options.vectorSearch.similaritySearch(
        collection,
        queryVector,
        searchOptions || {}
      );

      context.response.status(200).json({ data: results });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * RAG retrieve handler
   */
  async ragRetrieve(context: FrameworkContext): Promise<void> {
    try {
      if (!this.options.rag) {
        context.response.status(503).json({ error: 'RAG not available' });
        return;
      }

      const { query, filter, topK } = context.request.body;
      const docs = await this.options.rag.retrieve(query, filter, topK);
      context.response.status(200).json({ documents: docs });
    } catch (error: any) {
      context.response.status(500).json({ error: error.message });
    }
  }

  /**
   * Get route configuration for any framework
   */
  getRouteConfig() {
    const prefix = this.options.prefix || '/api/arango';
    const routes: Array<{
      method: string;
      path: string;
      handler: string;
      params?: string[];
    }> = [
      { method: 'GET', path: `${prefix}/health`, handler: 'health' },
    ];

    // Model routes
    if (this.options.models) {
      Object.keys(this.options.models).forEach((name) => {
        routes.push(
          { method: 'GET', path: `${prefix}/models/${name}`, handler: 'listDocuments', params: [name] },
          { method: 'GET', path: `${prefix}/models/${name}/:id`, handler: 'getDocument', params: [name, ':id'] },
          { method: 'POST', path: `${prefix}/models/${name}`, handler: 'createDocument', params: [name] },
          { method: 'PUT', path: `${prefix}/models/${name}/:id`, handler: 'updateDocument', params: [name, ':id'] },
          { method: 'DELETE', path: `${prefix}/models/${name}/:id`, handler: 'deleteDocument', params: [name, ':id'] },
        );
      });
    }

    // Vector search routes
    if (this.options.vectorSearch) {
      routes.push(
        { method: 'POST', path: `${prefix}/vector/search`, handler: 'vectorSearch' },
      );
    }

    // RAG routes
    if (this.options.rag) {
      routes.push(
        { method: 'POST', path: `${prefix}/rag/retrieve`, handler: 'ragRetrieve' },
      );
    }

    return routes;
  }
}

