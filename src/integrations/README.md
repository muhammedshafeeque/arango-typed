# ArangoDB Framework Integrations

This package provides **universal framework support** for any JavaScript/TypeScript framework, ensuring smooth communication between ArangoDB, LangChain.js (RAG/MCP), and your chosen framework.

## 🎯 Universal Architecture

The integration uses a **framework-agnostic core** that works with any framework:

```typescript
import { UniversalAdapter } from 'arango-typed';

const adapter = new UniversalAdapter({
  database: db,
  cache,
  profiler,
  logger,
});

// Works with ANY framework
adapter.attach(context);
```

## 🚀 Supported Frameworks

### Express.js
```typescript
import express from 'express';
import { arangoMiddleware } from 'arangoos';

const app = express();
app.use(arangoMiddleware({ database: db }));
```

### Fastify
```typescript
import { FastifyAdapter } from 'arangoos/integrations/frameworks';

const adapter = new FastifyAdapter({ database: db });
await fastify.register(adapter.plugin.bind(adapter));
```

### Koa
```typescript
import { KoaAdapter } from 'arangoos/integrations/frameworks';

const adapter = new KoaAdapter({ database: db });
app.use(adapter.middleware());
```

### Next.js
```typescript
import { NextJSAdapter } from 'arangoos/integrations/frameworks';

const adapter = new NextJSAdapter({ database: db });
export default adapter.handler(async (req, res) => {
  const users = await req.arango.query('users').all();
  res.json(users);
});
```

### Hono
```typescript
import { HonoAdapter } from 'arangoos/integrations/frameworks';

const adapter = new HonoAdapter({ database: db });
app.use('*', adapter.middleware());
```

### NestJS
```typescript
import { NestJSAdapter } from 'arangoos/integrations/frameworks';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(new NestJSAdapter({ database: db })).forRoutes('*');
  }
}
```

### Any Custom Framework
```typescript
import { UniversalAdapter } from 'arangoos/integrations/frameworks';

const adapter = new UniversalAdapter({ database: db });

// In your framework middleware
function myMiddleware(req, res, next) {
  const context = {
    request: { method, url, path, headers, query, body },
    response: { status, json, send, setHeader },
    next,
  };
  
  adapter.attach(context);
  req.arango = context.arango;
  next();
}
```

## 🔗 Universal Routes

Generate routes that work with any framework:

```typescript
import { UniversalRoutes } from 'arangoos/integrations/frameworks';

const routes = new UniversalRoutes({
  database: db,
  models: { users: UserModel, posts: PostModel },
  vectorSearch,
  rag,
  mcp,
});

// Get route configuration
const routeConfig = routes.getRouteConfig();

// Apply to your framework
routeConfig.forEach(route => {
  app[route.method.toLowerCase()](route.path, async (req, res) => {
    const context = { request: req, response: res };
    await routes[route.handler](context, ...route.params || []);
  });
});
```

## 🎨 Complete Integration Example

```typescript
import { connect } from 'arangoos';
import { UniversalAdapter, UniversalRoutes } from 'arangoos/integrations/frameworks';
import { ArangoRAG, ArangoMCP } from 'arangoos/integrations/langchain';

// 1. Connect
await connect({ url: 'http://localhost:8529', databaseName: 'myapp' });

// 2. Set up adapters
const adapter = new UniversalAdapter({
  database: getDatabase(),
  cache: new CacheManager(),
  logger: new Logger(),
});

// 3. Set up RAG/MCP
const rag = new ArangoRAG(embeddings, db, { collectionName: 'documents' });
const mcp = new ArangoMCP(db, 'knowledge_graph');

// 4. Create universal routes
const routes = new UniversalRoutes({
  database: db,
  models: { documents: DocumentModel },
  rag,
  mcp,
});

// 5. Use with your framework
app.use(adapter.middleware());
app.use('/api/arango', routes.getRouteConfig());
```

## ✨ Features

- **Framework Agnostic**: Works with any JS/TS framework
- **Type Safe**: Full TypeScript support
- **Auto-Attach**: Automatically attaches ArangoDB to requests
- **Error Handling**: Built-in error handling for all frameworks
- **Request Tracing**: Auto-generated request IDs
- **Performance**: Built-in profiling and caching
- **RAG/MCP Ready**: Smooth integration with LangChain

## 📦 Peer Dependencies

- `@langchain/core` (optional) - For RAG/MCP features
- `express` (optional) - For Express integration
- `fastify` (optional) - For Fastify integration
- `koa` (optional) - For Koa integration
- `@nestjs/common` (optional) - For NestJS integration
- `next` (optional) - For Next.js integration
- `hono` (optional) - For Hono integration

All are optional peer dependencies - install only what you need!
