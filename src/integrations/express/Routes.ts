import { Database } from 'arangojs';
import { Model } from '../../model/Model';
import { VectorSearch } from '../../vector/VectorSearch';
import { ArangoMCP } from '../langchain/MCP';
import { ArangoRAG } from '../langchain/RAG';

// Express types - optional peer dependency
export interface ExpressRequest {
  query: Record<string, any>;
  body: Record<string, any>;
  params: Record<string, string>;
}

export interface ExpressResponse {
  json(data: any): ExpressResponse;
  status(code: number): ExpressResponse;
  setHeader(name: string, value: string): void;
}

export interface ExpressNextFunction {
  (): void;
}

export interface ExpressRouter {
  get(path: string, handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void> | void): void;
  post(path: string, handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void> | void): void;
  put(path: string, handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void> | void): void;
  delete(path: string, handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void> | void): void;
  use(handler: any): void;
}

export interface ArangoRoutesOptions {
  database: Database;
  models?: Record<string, Model<any>>;
  vectorSearch?: VectorSearch;
  mcp?: ArangoMCP;
  rag?: ArangoRAG;
  prefix?: string;
  routerFactory?: () => ExpressRouter;
}

/**
 * Create Express routes for ArangoDB operations
 * Works with Express.js Router
 */
export function createArangoRoutes(options: ArangoRoutesOptions): ExpressRouter | any {
  // Try to use Express Router if available, otherwise return route config
  let router: ExpressRouter;
  
  try {
    // Try to require express
    const express = require('express');
    router = express.Router();
  } catch {
    // Express not installed, return route config object
    return createRouteConfig(options);
  }

  const prefix = options.prefix || '/api/arango';

  // Health check
  router.get(`${prefix}/health`, async (_req: ExpressRequest, res: ExpressResponse) => {
    try {
      await options.database.version();
      res.json({ status: 'healthy', timestamp: new Date() });
    } catch (error: any) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });

  // Model CRUD routes
  if (options.models) {
    Object.entries(options.models).forEach(([name, model]) => {
      const modelPrefix = `${prefix}/models/${name}`;

      // GET /models/:name - List all documents
      router.get(modelPrefix, async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const query = req.query;
          const results = await model.find(query as Record<string, any>).all();
          res.json({ data: results, count: results.length });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // GET /models/:name/:id - Get single document
      router.get(`${modelPrefix}/:id`, async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const doc = await model.findById(req.params.id);
          if (!doc) {
            res.status(404).json({ error: 'Document not found' });
            return;
          }
          res.json({ data: doc });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // POST /models/:name - Create document
      router.post(modelPrefix, async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const doc = await model.create(req.body);
          res.status(201).json({ data: doc });
        } catch (error: any) {
          res.status(400).json({ error: error.message });
        }
      });

      // PUT /models/:name/:id - Update document
      router.put(`${modelPrefix}/:id`, async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const doc = await model.findById(req.params.id);
          if (!doc) {
            res.status(404).json({ error: 'Document not found' });
            return;
          }
          await (doc as any).update(req.body);
          res.json({ data: doc });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // DELETE /models/:name/:id - Delete document
      router.delete(`${modelPrefix}/:id`, async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const doc = await model.findById(req.params.id);
          if (!doc) {
            res.status(404).json({ error: 'Document not found' });
            return;
          }
          await (doc as any).remove();
          res.json({ success: true });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });
    });
  }

  // Vector search routes
  if (options.vectorSearch) {
    const vs = options.vectorSearch;
    // POST /vector/search - Vector similarity search
    router.post(`${prefix}/vector/search`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { collection, queryVector, options: searchOptions } = req.body;
        const results = await vs.similaritySearch(
          collection,
          queryVector,
          searchOptions || {}
        );
        res.json({ data: results });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // POST /vector/hybrid - Hybrid search (vector + keyword)
    router.post(`${prefix}/vector/hybrid`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { collection, queryVector, keywords, options: searchOptions } = req.body;
        const results = await vs.hybridSearch(
          collection,
          queryVector,
          keywords,
          searchOptions || {}
        );
        res.json({ data: results });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // MCP routes
  if (options.mcp) {
    // POST /mcp/context - Get context for LLM
    router.post(`${prefix}/mcp/context`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { query, embeddings, metadata, graphTraversal } = req.body;
        const context = await options.mcp!.getContext({
          query: query || '',
          embeddings,
          metadata,
          graphTraversal,
        });
        res.json(context);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // POST /mcp/context/store - Store context
    router.post(`${prefix}/mcp/context/store`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { collection, text, embeddings, metadata } = req.body;
        const id = await options.mcp!.storeContext(collection, text, embeddings, metadata);
        res.json({ id });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // RAG routes
  if (options.rag) {
    // POST /rag/retrieve - Retrieve documents for RAG
    router.post(`${prefix}/rag/retrieve`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { query, filter, topK } = req.body;
        const docs = await options.rag!.retrieve(query, filter, topK);
        res.json({ documents: docs });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // POST /rag/hybrid - Hybrid retrieval
    router.post(`${prefix}/rag/hybrid`, async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { query, keywords, filter, topK } = req.body;
        const docs = await options.rag!.hybridRetrieve(query, keywords, filter, topK);
        res.json({ documents: docs });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  return router;
}

/**
 * Create route configuration (when Express is not available)
 */
function createRouteConfig(options: ArangoRoutesOptions): any {
  return {
    prefix: options.prefix || '/api/arango',
    routes: [
      { method: 'GET', path: '/health', handler: 'healthCheck' },
      ...(options.models ? Object.keys(options.models).map(name => [
        { method: 'GET', path: `/models/${name}`, handler: `list${name}` },
        { method: 'GET', path: `/models/${name}/:id`, handler: `get${name}` },
        { method: 'POST', path: `/models/${name}`, handler: `create${name}` },
        { method: 'PUT', path: `/models/${name}/:id`, handler: `update${name}` },
        { method: 'DELETE', path: `/models/${name}/:id`, handler: `delete${name}` },
      ]).flat() : []),
      ...(options.vectorSearch ? [
        { method: 'POST', path: '/vector/search', handler: 'vectorSearch' },
        { method: 'POST', path: '/vector/hybrid', handler: 'vectorHybrid' },
      ] : []),
      ...(options.mcp ? [
        { method: 'POST', path: '/mcp/context', handler: 'mcpContext' },
        { method: 'POST', path: '/mcp/context/store', handler: 'mcpStoreContext' },
      ] : []),
      ...(options.rag ? [
        { method: 'POST', path: '/rag/retrieve', handler: 'ragRetrieve' },
        { method: 'POST', path: '/rag/hybrid', handler: 'ragHybrid' },
      ] : []),
    ],
  };
}
