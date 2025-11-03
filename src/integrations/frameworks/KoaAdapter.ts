// Koa types - optional peer dependency
export interface KoaContext {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, any>;
  params?: Record<string, string>;
  request: {
    body: any;
  };
  status: number;
  body: any;
  set(name: string, value: string): void;
  [key: string]: any;
}

export interface KoaNext {
  (): Promise<void>;
}

export interface KoaMiddleware {
  (ctx: KoaContext, next: KoaNext): Promise<void> | void;
}

import { UniversalAdapter, AdapterOptions, FrameworkContext, FrameworkResponse } from '../core/Adapter';

/**
 * Koa.js integration
 */
export class KoaAdapter {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  /**
   * Koa middleware
   */
  middleware(): KoaMiddleware {
    return async (ctx: KoaContext, next: KoaNext) => {
      const responseWrapper: FrameworkResponse = {
        status: (code: number) => {
          ctx.status = code;
          return responseWrapper;
        },
        json: (data: any) => {
          ctx.body = data;
          return responseWrapper;
        },
        send: (data: any) => {
          ctx.body = data;
          return responseWrapper;
        },
        setHeader: (name: string, value: string) => {
          ctx.set(name, value);
        },
      };

      const context = {
        request: {
          method: ctx.method,
          url: ctx.url,
          path: ctx.path,
          headers: ctx.headers,
          query: ctx.query,
          params: ctx.params,
          body: ctx.request.body,
        },
        response: responseWrapper,
        ctx,
      };

      this.adapter.attach(context);

      // Attach to Koa context (Koa doesn't have official type augmentation)
      // attach() mutates context to add arango and arangoRequestId
      const contextWithArango = context as FrameworkContext & { arango?: any; arangoRequestId?: string };
      if (contextWithArango.arango) {
        (ctx as any).arango = contextWithArango.arango;
      }
      if (contextWithArango.arangoRequestId) {
        (ctx as any).arangoRequestId = contextWithArango.arangoRequestId;
      }

      await next();
    };
  }

  /**
   * Error handler for Koa
   */
  errorHandler(): KoaMiddleware {
    return async (ctx: KoaContext, next: KoaNext) => {
      try {
        await next();
      } catch (error: any) {
        const responseWrapper: FrameworkResponse = {
          status: (code: number) => {
            ctx.status = code;
            return responseWrapper;
          },
          json: (data: any) => {
            ctx.body = data;
            return responseWrapper;
          },
          send: (data: any) => {
            ctx.body = data;
            return responseWrapper;
          },
          setHeader: (name: string, value: string) => {
            ctx.set(name, value);
          },
        };

        const context: FrameworkContext = {
          request: ctx.request as any,
          response: responseWrapper,
        };

        this.adapter.errorHandler()(error, context);
      }
    };
  }
}

/**
 * Create Koa adapter
 */
export function createKoaAdapter(options: AdapterOptions = {}) {
  return new KoaAdapter(options);
}
