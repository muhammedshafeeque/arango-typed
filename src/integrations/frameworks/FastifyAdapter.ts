import { setArangoContext, ArangoContext } from '../../types/FrameworkAugments';

// Fastify types - optional peer dependency
export interface FastifyRequest {
  method: string;
  url: string;
  routerPath?: string;
  headers: Record<string, string | string[]>;
  query: Record<string, any>;
  params: Record<string, string>;
  body?: any;
  arango?: ArangoContext;
  arangoRequestId?: string;
  [key: string]: any;
}

export interface FastifyReply {
  code(statusCode: number): FastifyReply;
  send(data: any): FastifyReply;
  header(name: string, value: string): FastifyReply;
  [key: string]: any;
}

export interface FastifyInstance {
  decorateRequest(name: string, value: any): void;
  addHook(name: string, handler: Function): void;
  [key: string]: any;
}

import { UniversalAdapter, AdapterOptions, FrameworkContext, FrameworkResponse } from '../core/Adapter';

/**
 * Fastify.js integration
 */
export class FastifyAdapter {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  /**
   * Register Fastify plugin
   */
  plugin(fastify: FastifyInstance, _options: any, done: () => void) {
    // Decorate request with arango
    try {
      fastify.decorateRequest('arango', null);
      fastify.decorateRequest('arangoRequestId', null);
    } catch {
      // Already decorated
    }

    // Add hook
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const responseWrapper: FrameworkResponse = {
        status: (code: number) => {
          reply.code(code);
          return responseWrapper;
        },
        json: (data: any) => {
          reply.send(data);
          return responseWrapper;
        },
        send: (data: any) => {
          reply.send(data);
          return responseWrapper;
        },
        setHeader: (name: string, value: string) => {
          reply.header(name, value);
        },
      };

      const context: FrameworkContext = {
        request: {
          method: request.method,
          url: request.url,
          path: request.routerPath || request.url.split('?')[0],
          headers: request.headers,
          query: request.query as Record<string, any>,
          params: request.params as Record<string, string>,
          body: request.body,
        },
        response: responseWrapper,
      };

      this.adapter.attach(context);

      // Attach to Fastify request using type-safe helpers
      if (context.arango) {
        setArangoContext(request, context.arango);
      }
      if (context.arangoRequestId) {
        request.arangoRequestId = context.arangoRequestId;
      }
    });

    done();
  }

  /**
   * Error handler for Fastify
   */
  errorHandler(
    error: any,
    _request: FastifyRequest,
    reply: FastifyReply
  ) {
    const responseWrapper: FrameworkResponse = {
      status: (code: number) => {
        reply.code(code);
        return responseWrapper;
      },
      json: (data: any) => {
        reply.send(data);
        return responseWrapper;
      },
      send: (data: any) => {
        reply.send(data);
        return responseWrapper;
      },
      setHeader: (name: string, value: string) => {
        reply.header(name, value);
      },
    };

    const context: FrameworkContext = {
      request: {} as any,
      response: responseWrapper,
    };

    this.adapter.errorHandler()(error, context);
  }
}

/**
 * Create Fastify adapter
 */
export function createFastifyAdapter(options: AdapterOptions = {}) {
  return new FastifyAdapter(options);
}
