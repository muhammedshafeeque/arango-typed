# Framework Integration

Arango Typed works with **any** JavaScript/TypeScript framework through universal adapters.

## Universal Adapter

```typescript
import { UniversalAdapter } from 'arango-typed/integrations/frameworks';

const adapter = new UniversalAdapter({
  database: db,
  cache: new CacheManager(),
  profiler: new Profiler(),
  logger: new Logger()
});

// Works with any framework
function middleware(req, res, next) {
  const context = {
    request: req,
    response: res,
    next
  };
  adapter.attach(context);
  req.arango = context.arango;
  next();
}
```

## Express.js

```typescript
import express from 'express';
import { arangoMiddleware, createArangoRoutes } from 'arango-typed';

const app = express();

app.use(arangoMiddleware({ database: db }));

const routes = createArangoRoutes({
  database: db,
  models: { users: UserModel }
});

app.use('/api/arango', routes);
```

## Fastify

```typescript
import { FastifyAdapter } from 'arango-typed/integrations/frameworks';

const adapter = new FastifyAdapter({ database: db });
await fastify.register(adapter.plugin.bind(adapter));

fastify.get('/users', async (request, reply) => {
  const users = await request.arango.query('users').all();
  return reply.send(users);
});
```

## Koa

```typescript
import { KoaAdapter } from 'arango-typed/integrations/frameworks';

const adapter = new KoaAdapter({ database: db });
app.use(adapter.middleware());

router.get('/users', async (ctx) => {
  const users = await ctx.arango.query('users').all();
  ctx.body = users;
});
```

## Next.js

```typescript
import { NextJSAdapter } from 'arango-typed/integrations/frameworks';

const adapter = new NextJSAdapter({ database: db });

export default adapter.handler(async (req, res) => {
  const users = await req.arango.query('users').all();
  res.json(users);
});
```

## NestJS

```typescript
import { NestJSAdapter } from 'arango-typed/integrations/frameworks';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(new NestJSAdapter({ database: db }))
      .forRoutes('*');
  }
}
```

## Hono

```typescript
import { HonoAdapter } from 'arango-typed/integrations/frameworks';

const adapter = new HonoAdapter({ database: db });
app.use('*', adapter.middleware());

app.get('/users', async (c) => {
  const users = await c.arango.query('users').all();
  return c.json(users);
});
```

## Universal Routes

Generate routes that work with any framework:

```typescript
import { UniversalRoutes } from 'arango-typed/integrations/frameworks';

const routes = new UniversalRoutes({
  database: db,
  models: { users: UserModel },
  vectorSearch,
  rag,
  mcp
});

const routeConfig = routes.getRouteConfig();

// Apply to your framework
routeConfig.forEach(route => {
  app[route.method.toLowerCase()](route.path, async (req, res) => {
    const context = { request: req, response: res };
    await routes[route.handler](context, ...route.params || []);
  });
});
```

See [Integration Guide](../INTEGRATION_GUIDE.md) for complete examples.

