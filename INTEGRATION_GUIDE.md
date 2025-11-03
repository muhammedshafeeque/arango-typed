# Universal Framework Integration Guide

This library supports **any JavaScript/TypeScript framework** with smooth, awesome communication between ArangoDB, LangChain.js (RAG/MCP), and your chosen framework.

## 🎯 Core Philosophy

The integration uses a **universal adapter pattern** that:
- Works with **any framework** (Express, Fastify, Koa, NestJS, Next.js, Hono, or custom)
- Provides **seamless** communication between components
- Supports **optional peer dependencies** (install only what you need)
- Maintains **type safety** throughout

## 🚀 Quick Start

### Universal Approach (Works with Any Framework)

```typescript
import { UniversalAdapter, UniversalRoutes } from 'arango-typed';
import { connect, getDatabase } from 'arango-typed';
import { ArangoRAG, ArangoMCP } from 'arango-typed';

// 1. Connect to ArangoDB
await connect({ url: 'http://localhost:8529', databaseName: 'myapp' });
const db = getDatabase();

// 2. Create universal adapter
const adapter = new UniversalAdapter({
  database: db,
  cache: new CacheManager(),
  profiler: new Profiler(),
  logger: new Logger(),
});

// 3. Set up RAG/MCP (optional)
const rag = new ArangoRAG(embeddings, db, { collectionName: 'documents' });
const mcp = new ArangoMCP(db, 'knowledge_graph');

// 4. Use in your framework
function middleware(req, res, next) {
  const context = { request: req, response: res, next };
  adapter.attach(context);
  req.arango = context.arango; // Now available!
  next();
}
```

## 📚 Framework-Specific Examples

### Express.js
```typescript
import express from 'express';
import { arangoMiddleware } from 'arangoos';

const app = express();
app.use(arangoMiddleware({ database: db }));
```

### Fastify
```typescript
import { FastifyAdapter } from 'arangoos';
const adapter = new FastifyAdapter({ database: db });
await fastify.register(adapter.plugin.bind(adapter));
```

### Koa
```typescript
import { KoaAdapter } from 'arangoos';
const adapter = new KoaAdapter({ database: db });
app.use(adapter.middleware());
```

### Next.js
```typescript
import { NextJSAdapter } from 'arangoos';
const adapter = new NextJSAdapter({ database: db });
export default adapter.handler(async (req, res) => {
  const users = await req.arango.query('users').all();
  res.json(users);
});
```

### Hono
```typescript
import { HonoAdapter } from 'arangoos';
const adapter = new HonoAdapter({ database: db });
app.use('*', adapter.middleware());
```

### NestJS
```typescript
import { NestJSAdapter } from 'arangoos';
consumer.apply(new NestJSAdapter({ database: db })).forRoutes('*');
```

## 🔗 Complete RAG/MCP Integration

### With Express + LangChain

```typescript
import { connect } from 'arangoos';
import { ArangoRAG, ArangoMCP } from 'arangoos';
import { arangoMiddleware, createArangoRoutes } from 'arangoos';
import express from 'express';

await connect({ /* config */ });
const db = getDatabase();

// Set up RAG
const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 5,
});

// Set up MCP
const mcp = new ArangoMCP(db, 'knowledge_graph');

// Create app
const app = express();
app.use(arangoMiddleware({ database: db }));
app.use(createArangoRoutes({
  database: db,
  rag,
  mcp,
}));

// Custom chat endpoint
app.post('/api/chat', async (req, res) => {
  const context = await rag.retrieve(req.body.query);
  const graphContext = await mcp.getContext({
    query: req.body.query,
    graphTraversal: true,
  });
  
  res.json({ context, graphContext });
});
```

## ✨ Features

1. **Universal Compatibility**: Works with any JS/TS framework
2. **Type Safe**: Full TypeScript support
3. **Auto-Attach**: Database automatically attached to requests
4. **Error Handling**: Built-in error conversion
5. **Request Tracing**: Auto-generated request IDs
6. **Performance**: Built-in profiling and caching
7. **RAG Ready**: Seamless LangChain integration
8. **MCP Support**: Model Context Protocol for LLMs

## 🎨 Universal Routes

Generate routes that work with any framework:

```typescript
import { UniversalRoutes } from 'arangoos';

const routes = new UniversalRoutes({
  database: db,
  models: { users: UserModel, posts: PostModel },
  vectorSearch,
  rag,
  mcp,
});

// Get route configuration
const config = routes.getRouteConfig();
// Apply to your framework's router
```

## 💡 Custom Framework Integration

```typescript
import { UniversalAdapter } from 'arangoos';

const adapter = new UniversalAdapter({ database: db });

// For any custom framework
function myMiddleware(req, res, next) {
  adapter.attach({
    request: { method, url, path, headers, query, body },
    response: { status, json, send, setHeader },
    next,
  });
  
  // Use req.arango in your handlers
  req.arango.query('collection').all();
}
```

The combination is **awesome** because:
- ✅ One adapter works everywhere
- ✅ Smooth communication between all components
- ✅ Type-safe from database to API
- ✅ No framework lock-in
- ✅ Easy to extend


