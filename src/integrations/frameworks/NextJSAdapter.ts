// Next.js types - optional peer dependency
export interface NextApiRequest {
  method?: string;
  url?: string;
  query: Record<string, string | string[]>;
  body: any;
  headers: Record<string, string | string[]>;
  [key: string]: any;
}

export interface NextApiResponse {
  status(code: number): NextApiResponse;
  json(data: any): NextApiResponse;
  send(data: any): NextApiResponse;
  setHeader(name: string, value: string): void;
  [key: string]: any;
}

import { UniversalAdapter, AdapterOptions, FrameworkContext } from '../core/Adapter';

/**
 * Next.js API route integration
 */
export class NextJSAdapter {
  private adapter: UniversalAdapter;

  constructor(options: AdapterOptions = {}) {
    this.adapter = new UniversalAdapter(options);
  }

  /**
   * Next.js API route wrapper
   */
  handler(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const context = {
        request: {
          method: req.method,
          url: req.url,
          path: req.url?.split('?')[0] || '/',
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
      };

      this.adapter.attach(context as FrameworkContext);

      // Attach to Next.js request
      (req as any).arango = (context as FrameworkContext).arango;
      (req as any).arangoRequestId = (context as FrameworkContext).arangoRequestId;

      try {
        await handler(req, res);
      } catch (error: any) {
        this.adapter.errorHandler()(error, context);
      }
    };
  }

  /**
   * Create middleware for Next.js
   */
  middleware() {
    return async (req: NextApiRequest, res: NextApiResponse, next?: () => void) => {
      const context = {
        request: {
          method: req.method,
          url: req.url,
          path: req.url?.split('?')[0] || '/',
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

      this.adapter.attach(context as FrameworkContext);

      (req as any).arango = (context as FrameworkContext).arango;
      (req as any).arangoRequestId = (context as FrameworkContext).arangoRequestId;

      if (next) {
        next();
      }
    };
  }
}

/**
 * Create Next.js adapter
 */
export function createNextJSAdapter(options: AdapterOptions = {}) {
  return new NextJSAdapter(options);
}

