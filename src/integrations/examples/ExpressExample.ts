/**
 * Example: Express.js + ArangoDB + LangChain Integration
 * 
 * This shows how to set up a complete RAG/MCP system with Express
 */

// Express types - optional peer dependency
interface ExpressRequest {
  body: any;
  [key: string]: any;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(data: any): ExpressResponse;
  send(data: any): ExpressResponse;
  [key: string]: any;
}

import { connect } from '../../connection/Connection';
import { Schema } from '../../schema/Schema';
import { model } from '../../model/Model';
import { arangoMiddleware, createArangoRoutes, arangoRequestId, arangoProfiler } from '../express';
import { ArangoLangChainStore } from '../langchain/LangChainStore';
import { ArangoRAG } from '../langchain/RAG';
import { ArangoMCP } from '../langchain/MCP';
import { CacheManager } from '../../cache/CacheManager';
import { Profiler } from '../../observability/Profiler';
import { Logger } from '../../observability/Logger';

async function setupApp() {
  // 1. Connect to ArangoDB
  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'mydb',
    auth: {
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASS || '',
    },
  });

  const { getDatabase } = await import('../../connection/Connection');
  const db = getDatabase();

  // 2. Define schemas and models
  const documentSchema = new Schema({
    text: { type: 'String', required: true },
    embedding: { type: 'Array', required: true },
    metadata: { type: 'Object' },
    createdAt: { type: 'Date', default: () => new Date() },
  });

  const DocumentModel = model('documents', documentSchema);

  // 3. Set up LangChain integration (optional)
  let embeddings: any;
  let vectorStore: ArangoLangChainStore | null = null;
  let rag: ArangoRAG | null = null;
  let mcp: ArangoMCP | null = null;

  try {
    const { OpenAIEmbeddings } = require('@langchain/openai');
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    vectorStore = new ArangoLangChainStore(embeddings, {
      database: db,
      collectionName: 'documents',
      model: DocumentModel,
    });

    rag = new ArangoRAG(embeddings, db, {
      collectionName: 'documents',
      topK: 5,
    });

    mcp = new ArangoMCP(db, 'knowledge_graph');
  } catch (error) {
    console.warn('LangChain not available - install @langchain/openai to use RAG features');
  }

  // 4. Set up utilities
  const cache = new CacheManager({ ttl: 3600000, maxSize: 1000 });
  const profiler = new Profiler({ slowQueryThreshold: 1000 });
  const logger = new Logger({ level: 1 }); // INFO level

  // 5. Create Express app (if available)
  let expressApp: any;
  try {
    const express = require('express');
    expressApp = express();
    expressApp.use(express.json());
  } catch {
    // Express not available, create minimal app
    expressApp = {
      use: () => {},
      post: () => {},
      get: () => {},
      listen: () => {},
    };
  }

  // 6. Add ArangoDB middleware
  expressApp.use(arangoRequestId);
  expressApp.use(arangoProfiler);
  expressApp.use(arangoMiddleware({
    database: db,
    cache,
    profiler,
    logger,
    autoAttach: true,
  }));

  // 7. Create routes
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

  expressApp.use(routes);

  // 8. Custom RAG endpoint
  expressApp.post('/api/chat', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!rag) {
        res.status(503).json({ error: 'RAG not available' });
        return;
      }

      const { query, useGraph } = req.body;

      // Get context from RAG
      const context = await rag.retrieve(query);

      // Optionally get graph context
      let graphContext;
      if (useGraph && mcp) {
        graphContext = await mcp.getContext({
          query,
          graphTraversal: true,
        });
      }

      // Here you would call your LLM with the context
      // const response = await llm.generate([...context, { role: 'user', content: query }]);

      res.json({
        query,
        context: context.map(doc => doc.pageContent),
        graphContext: graphContext?.graphContext,
        // response: response.text,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 9. Document ingestion endpoint
  expressApp.post('/api/documents', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!vectorStore) {
        res.status(503).json({ error: 'Vector store not available' });
        return;
      }

      const { texts, metadata } = req.body;

      const docs = texts.map((text: string, i: number) => ({
        pageContent: text,
        metadata: Array.isArray(metadata) ? metadata[i] : metadata,
      }));

      await vectorStore.addDocuments(docs);
      res.json({ success: true, count: docs.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return expressApp;
}

// Usage:
// const app = await setupApp();
// app.listen(3000, () => console.log('Server running on port 3000'));

export { setupApp };

