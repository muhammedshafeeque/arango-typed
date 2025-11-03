/**
 * Examples for various JavaScript/TypeScript frameworks
 * Shows how to use ArangoDB with any framework
 */

import { connect, getDatabase } from '../../connection/Connection';
import { Schema } from '../../schema/Schema';
import { model } from '../../model/Model';
import { UniversalAdapter, UniversalRoutes } from '../frameworks';
import { CacheManager } from '../../cache/CacheManager';
import { Profiler } from '../../observability/Profiler';
import { Logger, LogLevel } from '../../observability/Logger';

// ============================================
// Example 1: Express.js
// ============================================
export async function expressExample() {
  const express = require('express');
  const app = express();

  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const adapter = new UniversalAdapter({
    database: db,
    cache: new CacheManager(),
    profiler: new Profiler(),
    logger: new Logger({ level: LogLevel.INFO }),
  });

  app.use((req: any, res: any, next: any) => {
    const context = {
      request: req,
      response: res,
      next,
    };
    adapter.attach(context);
    next();
  });

  return app;
}

// ============================================
// Example 2: Fastify
// ============================================
export async function fastifyExample() {
  const fastify = require('fastify')();
  const { FastifyAdapter } = require('../frameworks');

  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const adapter = new FastifyAdapter({
    database: db,
    logger: new Logger({ level: LogLevel.INFO }),
  });

  await fastify.register(adapter.plugin.bind(adapter));

  fastify.get('/users', async (request: any, reply: any) => {
    const users = await request.arango.query('users').all();
    return reply.send(users);
  });

  return fastify;
}

// ============================================
// Example 3: Koa
// ============================================
export async function koaExample() {
  const Koa = require('koa');
  const Router = require('@koa/router');
  const app = new Koa();
  const router = new Router();

  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const { KoaAdapter } = require('../frameworks');
  const adapter = new KoaAdapter({
    database: db,
  });

  app.use(adapter.middleware());

  router.get('/users', async (ctx: any) => {
    const users = await ctx.arango.query('users').all();
    ctx.body = users;
  });

  app.use(router.routes());
  return app;
}

// ============================================
// Example 4: Next.js API Routes
// ============================================
export async function nextjsExample() {
  const { NextJSAdapter } = require('../frameworks');

  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const adapter = new NextJSAdapter({
    database: db,
  });

  // In pages/api/users.ts or app/api/users/route.ts
  const handler = adapter.handler(async (req: any, res: any) => {
    const users = await req.arango.query('users').all();
    res.json(users);
  });

  return handler;
}

// ============================================
// Example 5: Hono
// ============================================
export async function honoExample() {
  const { Hono } = require('hono');
  const { HonoAdapter } = require('../frameworks');
  const app = new Hono();

  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const adapter = new HonoAdapter({
    database: db,
  });

  app.use('*', adapter.middleware());

  app.get('/users', async (c: any) => {
    const users = await c.arango.query('users').all();
    return c.json(users);
  });

  return app;
}

// ============================================
// Example 6: NestJS
// ============================================
export function nestjsExample() {
  // In app.module.ts
  return `
  import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
  import { NestJSAdapter } from 'arango-typed/integrations/frameworks';
  import { connect } from 'arango-typed';

  @Module({})
  export class AppModule implements NestModule {
    async configure(consumer: MiddlewareConsumer) {
      await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
      
      const adapter = new NestJSAdapter({
        database: getDatabase(),
      });
      
      consumer.apply(adapter).forRoutes('*');
    }
  }
  `;
}

// ============================================
// Example 7: Universal Routes (Works with any framework)
// ============================================
export async function universalRoutesExample() {
  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const documentSchema = new Schema({
    text: { type: 'String', required: true },
    embedding: { type: 'Array', required: true },
  });

  const DocumentModel = model('documents', documentSchema);

  const routes = new UniversalRoutes({
    database: db,
    models: {
      documents: DocumentModel,
    },
    prefix: '/api/arango',
  });

  // Get route configuration
  const routeConfig = routes.getRouteConfig();

  // Use with any framework
  // routeConfig.forEach(route => {
  //   app[route.method.toLowerCase()](route.path, async (req, res) => {
  //     const context = { request: req, response: res };
  //     await routes[route.handler](context, ...route.params || []);
  //   });
  // });

  return { routes, routeConfig };
}

// ============================================
// Example 8: Custom Framework Integration
// ============================================
export async function customFrameworkExample() {
  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'myapp',
    auth: { username: process.env.ARANGO_USER || 'root', password: process.env.ARANGO_PASS || '' },
  });
  const db = getDatabase();

  const adapter = new UniversalAdapter({
    database: db,
  });

  // For any custom framework
  function myCustomFrameworkMiddleware(req: any, res: any, next: any) {
    const context = {
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body,
      },
      response: {
        status: (code: number) => {
          res.status(code);
          return res;
        },
        json: (data: any) => res.json(data),
        send: (data: any) => res.send(data),
        setHeader: (name: string, value: string) => res.setHeader(name, value),
      },
      next,
    };

    adapter.attach(context);

    // Attach to your framework's request object
    req.arango = (context as any).arango;
    req.arangoRequestId = (context as any).arangoRequestId;

    next();
  }

  return myCustomFrameworkMiddleware;
}

// Examples exported individually above

