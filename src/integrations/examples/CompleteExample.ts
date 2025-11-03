/**
 * Complete Example: Express.js + ArangoDB + LangChain.js Integration
 * 
 * This demonstrates a fully integrated RAG/MCP system with smooth communication
 */

import { connect, getDatabase } from '../../connection/Connection';
import { Schema } from '../../schema/Schema';
import { model } from '../../model/Model';
import { 
  arangoMiddleware, 
  arangoErrorHandler, 
  arangoRequestId, 
  arangoProfiler,
  createArangoRoutes 
} from '../express';
import { 
  ArangoLangChainStore, 
  ArangoRAG, 
  ArangoMCP 
} from '../langchain';
import { CacheManager } from '../../cache/CacheManager';
import { Profiler } from '../../observability/Profiler';
import { Logger, LogLevel } from '../../observability/Logger';

/**
 * Complete setup example
 */
export async function setupCompleteIntegration(config: {
  arangoUrl?: string;
  arangoDb?: string;
  arangoUser?: string;
  arangoPass?: string;
  openAIApiKey?: string;
  graphName?: string;
}): Promise<any> {
  // 1. Connect to ArangoDB
  await connect({
    url: config.arangoUrl || process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: config.arangoDb || process.env.ARANGO_DB || 'rag_db',
    auth: {
      username: config.arangoUser || process.env.ARANGO_USER || 'root',
      password: config.arangoPass || process.env.ARANGO_PASS || '',
    },
  });

  const db = getDatabase();

  // 2. Define schemas
  const documentSchema = new Schema({
    text: { type: 'String', required: true },
    embedding: { type: 'Array', required: true },
    metadata: { type: 'Object' },
    source: { type: 'String' },
    createdAt: { type: 'Date', default: () => new Date() },
  });

  const DocumentModel = model('documents', documentSchema);

  // 3. Set up utilities
  const cache = new CacheManager({ ttl: 3600000, maxSize: 1000 });
  const profiler = new Profiler({ slowQueryThreshold: 1000 });
  const logger = new Logger({ level: LogLevel.INFO });

  // 4. Set up LangChain integration (if available)
  let vectorStore: ArangoLangChainStore | null = null;
  let rag: ArangoRAG | null = null;
  let mcp: ArangoMCP | null = null;

  try {
    // Try to use LangChain (optional peer dependency)
    const { OpenAIEmbeddings } = require('@langchain/openai');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openAIApiKey || process.env.OPENAI_API_KEY,
    });

    vectorStore = new ArangoLangChainStore(embeddings, {
      database: db,
      collectionName: 'documents',
      model: DocumentModel,
    });

    rag = new ArangoRAG(embeddings, db, {
      collectionName: 'documents',
      topK: 5,
      scoreThreshold: 0.7,
    });

    mcp = new ArangoMCP(db, config.graphName);
  } catch (error) {
    logger.warn('LangChain not available, continuing without it');
  }

  // 5. Create Express app (if express is available)
  let app: any;
  try {
    const express = require('express');
    app = express();
    app.use(express.json());
  } catch {
    // Express not available, create minimal app
    app = {
      use: () => {},
      listen: () => {},
      post: () => {},
      get: () => {},
    };
  }

  // 6. Add ArangoDB middleware (works even without LangChain)
  app.use(arangoRequestId);
  app.use(arangoProfiler);
  app.use(arangoMiddleware({
    database: db,
    cache,
    profiler,
    logger,
    autoAttach: true,
  }));

  // 7. Create automatic routes
  const routes = createArangoRoutes({
    database: db,
    models: {
      documents: DocumentModel,
    },
    vectorSearch: vectorStore?.vectorSearch,
    mcp: mcp || undefined,
    rag: rag || undefined,
    prefix: '/api/arango',
  });

  app.use(routes);

  // 8. Custom RAG chat endpoint
  app.post('/api/chat', async (req: any, res: any) => {
    try {
      const body = req.body as any;
      const { query, useGraph, useHybrid } = body || {};

      if (!rag) {
        return res.status(503).json({ error: 'RAG not available' });
      }

      // Get context from RAG
      let context;
      if (useHybrid && body.keywords) {
        context = await rag.hybridRetrieve(query, body.keywords);
      } else {
        context = await rag.retrieve(query);
      }

      // Optionally get graph context
      let graphContext;
      if (useGraph && mcp) {
        graphContext = await mcp.getContext({
          query,
          graphTraversal: true,
        });
      }

      // Here you would call your LLM
      // const response = await llm.generate([...context, { role: 'user', content: query }]);

      const responseData = {
        query,
        context: context.map((doc: any) => doc.pageContent),
        contextCount: context.length,
        graphContext: graphContext?.graphContext,
        timestamp: new Date(),
        // response: response.text,
      };
      if (res.json) {
        res.json(responseData);
      } else if (res.send) {
        res.send(JSON.stringify(responseData));
      }
    } catch (error: any) {
      (req as any).arango?.logger?.error(`Chat error: ${error.message}`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // 9. Document ingestion endpoint
  app.post('/api/documents', async (req: any, res: any) => {
    try {
      const body = req.body as any;
      const { texts, metadata } = body || {};

      if (!vectorStore) {
        return res.status(503).json({ error: 'Vector store not available' });
      }

      const docs = texts.map((text: string, i: number) => ({
        pageContent: text,
        metadata: Array.isArray(metadata) ? metadata[i] : metadata || {},
      }));

      await vectorStore.addDocuments(docs);
      
      const responseData = { 
        success: true, 
        count: docs.length,
        message: 'Documents stored with embeddings',
      };
      if (res.json) {
        res.json(responseData);
      } else if (res.send) {
        res.send(JSON.stringify(responseData));
      }
    } catch (error: any) {
      if (res.status && res.json) {
        res.status(500).json({ error: error.message });
      } else if (res.send) {
        res.send(JSON.stringify({ error: error.message }));
      }
    }
  });

  // 10. MCP context endpoint (for LLM integration)
  app.post('/api/mcp/query', async (req: any, res: any) => {
    try {
      if (!mcp) {
        if (res.status && res.json) {
          return res.status(503).json({ error: 'MCP not available' });
        } else if (res.send) {
          return res.send(JSON.stringify({ error: 'MCP not available' }));
        }
        return;
      }

      const body = req.body as any;
      const { query, embeddings, metadata, graphTraversal } = body || {};
      
      const context = await mcp.getContext({
        query,
        embeddings,
        metadata,
        graphTraversal: graphTraversal || false,
      });

      if (res.json) {
        res.json(context);
      } else if (res.send) {
        res.send(JSON.stringify(context));
      }
    } catch (error: any) {
      if (res.status && res.json) {
        res.status(500).json({ error: error.message });
      } else if (res.send) {
        res.send(JSON.stringify({ error: error.message }));
      }
    }
  });

  // 11. Error handler
  app.use(arangoErrorHandler);

  return app;
}

/**
 * Quick start helper
 */
export async function quickStart(port: number = 3000) {
  const app = await setupCompleteIntegration({});
  
  if (app && app.listen && typeof app.listen === 'function') {
    app.listen(port, () => {
      console.log(`🚀 ArangoDB + Express + LangChain server running on port ${port}`);
      console.log(`📊 API: http://localhost:${port}/api/arango`);
      console.log(`💬 Chat: http://localhost:${port}/api/chat`);
    });
  }

  return app;
}

