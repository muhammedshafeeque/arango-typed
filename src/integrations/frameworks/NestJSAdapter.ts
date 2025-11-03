// NestJS and Express types - optional peer dependencies
export interface NestMiddleware {
  use(req: any, res: any, next: any): void;
}

export interface ExceptionFilter {
  catch(exception: any, host: any): void;
}

export interface ArgumentsHost {
  switchToHttp(): {
    getRequest(): any;
    getResponse(): any;
  };
}

export function Injectable(): (target: any) => any {
  return (target: any) => target;
}

export function Catch(..._exceptions: any[]): (target: any) => any {
  return (target: any) => target;
}

import { UniversalAdapter, AdapterOptions, FrameworkContext } from '../core/Adapter';

/**
 * NestJS integration
 */
export class NestJSAdapter implements NestMiddleware {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  use(req: any, res: any, next: any) {
    const context = {
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        headers: req.headers,
        query: req.query,
        params: req.params,
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
    };

    this.adapter.attach(context as FrameworkContext);

    // Attach to Express request (NestJS uses Express under the hood)
    (req as any).arango = (context as FrameworkContext).arango;
    (req as any).arangoRequestId = (context as FrameworkContext).arangoRequestId;

    next();
  }
}

/**
 * NestJS exception filter for ArangoDB errors
 */
export class ArangoExceptionFilter implements ExceptionFilter {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const context = {
      request: request as any,
      response: {
        status: (code: number) => {
          response.status(code);
          return response;
        },
        json: (data: any) => response.json(data),
        send: (data: any) => response.send(data),
        setHeader: (name: string, value: string) => response.setHeader(name, value),
      },
    };

    this.adapter.errorHandler()(exception, context as FrameworkContext);
  }
}

/**
 * Create NestJS adapter
 */
export function createNestJSAdapter(options: AdapterOptions = {}) {
  return new NestJSAdapter(options);
}

