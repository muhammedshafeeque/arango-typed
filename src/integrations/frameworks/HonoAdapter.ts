// Hono types - optional peer dependency
export interface HonoContext {
  req: {
    method: string;
    url: string;
    headers: any;
    param?(): Record<string, string>;
    json?(): Promise<any>;
  };
  status?(code: number): HonoContext;
  json?(data: any): any;
  text?(data: string): any;
  header?(name: string, value: string): void;
  [key: string]: any;
}

export interface HonoNext {
  (): Promise<void>;
}

export interface HonoMiddlewareHandler {
  (c: HonoContext, next: HonoNext): Promise<void> | void;
}

import { UniversalAdapter, AdapterOptions, FrameworkContext, FrameworkResponse } from '../core/Adapter';

/**
 * Hono framework integration
 */
export class HonoAdapter {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  /**
   * Hono middleware
   */
  middleware(): HonoMiddlewareHandler {
    return async (c: HonoContext, next: HonoNext) => {
      const req = c.req;
      let url: URL;
      try {
        url = new URL(req.url);
      } catch {
        url = new URL(`http://localhost${req.url}`);
      }

      // Convert headers to record
      const headers: Record<string, string> = {};
      try {
        if (req.headers) {
          if (typeof (req.headers as any).get === 'function') {
            // Headers API
            (req.headers as any).forEach((value: string, key: string) => {
              headers[key] = value;
            });
          } else if (typeof (req.headers as any).entries === 'function') {
            // Iterable headers
            for (const [key, value] of (req.headers as any).entries()) {
              headers[key] = value;
            }
          } else {
            // Plain object
            Object.assign(headers, req.headers);
          }
        }
      } catch {
        // Headers not available in this format
      }

      // Get body if available
      let body = null;
      try {
        if (req.json && typeof req.json === 'function') {
          body = await req.json().catch(() => null);
        }
      } catch {
        // Body parsing failed
      }

      const responseWrapper: FrameworkResponse = {
        status: (code: number) => {
          if (c.status) c.status(code);
          return responseWrapper;
        },
        json: (data: any) => {
          if (c.json) {
            c.json(data);
          }
          return responseWrapper;
        },
        send: (data: any) => {
          if (typeof data === 'string' && c.text) {
            c.text(data);
          } else if (c.json) {
            c.json(data);
          }
          return responseWrapper;
        },
        setHeader: (name: string, value: string) => {
          if (c.header) c.header(name, value);
        },
      };

      const context: FrameworkContext = {
        request: {
          method: req.method,
          url: req.url,
          path: url.pathname,
          headers,
          query: Object.fromEntries(url.searchParams.entries()),
          params: (req.param && typeof req.param === 'function') ? req.param() : {},
          body,
        },
        response: responseWrapper,
        context: c,
      };

      this.adapter.attach(context);

      // Attach to Hono context (Hono uses Context object)
      if (context.arango) {
        (c as any).arango = context.arango;
      }
      if (context.arangoRequestId) {
        (c as any).arangoRequestId = context.arangoRequestId;
      }

      await next();
    };
  }

  /**
   * Error handler for Hono
   */
  errorHandler(): HonoMiddlewareHandler {
    return async (c: HonoContext, next: HonoNext) => {
      try {
        await next();
      } catch (error: any) {
        const responseWrapper: FrameworkResponse = {
          status: (code: number) => {
            if (c.status) c.status(code);
            return responseWrapper;
          },
          json: (data: any) => {
            if (c.json) c.json(data);
            return responseWrapper;
          },
          send: (data: any) => {
            if (c.json) c.json(data);
            return responseWrapper;
          },
          setHeader: (name: string, value: string) => {
            if (c.header) c.header(name, value);
          },
        };

        const context: FrameworkContext = {
          request: c.req as any,
          response: responseWrapper,
        };

        this.adapter.errorHandler()(error, context);
      }
    };
  }
}

/**
 * Create Hono adapter
 */
export function createHonoAdapter(options: AdapterOptions = {}) {
  return new HonoAdapter(options);
}
