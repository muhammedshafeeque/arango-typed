import { Database } from 'arangojs';
import { Connection } from '../../connection/Connection';
import { CacheManager } from '../../cache/CacheManager';
import { Profiler } from '../../observability/Profiler';
import { Logger } from '../../observability/Logger';

/**
 * Framework-agnostic adapter interface
 * Works with any JavaScript/TypeScript framework
 */
export interface FrameworkRequest {
  method?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, any>;
  body?: any;
  params?: Record<string, string>;
  [key: string]: any;
}

export interface FrameworkResponse {
  status(code: number): FrameworkResponse;
  json(data: any): FrameworkResponse;
  send(data: any): FrameworkResponse;
  setHeader(name: string, value: string): void;
  [key: string]: any;
}

export interface FrameworkNext {
  (error?: any): void;
}

export interface FrameworkContext {
  request: FrameworkRequest;
  response: FrameworkResponse;
  next?: FrameworkNext;
  [key: string]: any;
}

export interface AdapterOptions {
  connection?: Connection;
  database?: Database;
  cache?: CacheManager;
  profiler?: Profiler;
  logger?: Logger;
  autoAttach?: boolean;
}

/**
 * Universal adapter that works with any framework
 */
export class UniversalAdapter {
  private options: Required<Omit<AdapterOptions, 'connection' | 'database' | 'cache' | 'profiler' | 'logger'>> & {
    connection?: Connection;
    database?: Database;
    cache?: CacheManager;
    profiler?: Profiler;
    logger?: Logger;
  };

  constructor(options: AdapterOptions = {}) {
    this.options = {
      ...options,
      autoAttach: options.autoAttach !== false,
    };
  }

  /**
   * Attach ArangoDB to any request context
   */
  attach(context: FrameworkContext): void {
    const { getDatabase } = require('../../connection/Connection');
    
    const arango = {
      db: this.options.database || 
          (this.options.connection ? this.options.connection.getDatabase() : getDatabase()),
      connection: this.options.connection,
      cache: this.options.cache,
      profiler: this.options.profiler,
      logger: this.options.logger,
    };

    // Attach to context
    context.arango = arango;
    context.request.arango = arango;

    if (this.options.autoAttach) {
      this.attachHelpers(arango, context);
    }

    // Add request ID
    const requestId = this.getRequestId(context.request);
    context.request.arangoRequestId = requestId;
    context.arangoRequestId = requestId;

    if (context.response?.setHeader) {
      context.response.setHeader('X-Request-Id', requestId);
    }
  }

  /**
   * Get or generate request ID
   */
  private getRequestId(req: FrameworkRequest): string {
    const headerValue = req.headers?.['x-request-id'];
    if (headerValue) {
      return Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Attach helper methods
   */
  private attachHelpers(arango: any, _context: FrameworkContext): void {
    const { Query } = require('../../query/Query');
    const { VectorSearch } = require('../../vector/VectorSearch');
    const { GraphManager } = require('../../graph/Graph');

    arango.query = (collectionName: string) => {
      return new Query(arango.db, collectionName);
    };

    arango.vectorSearch = () => {
      return new VectorSearch(arango.db);
    };

    arango.graph = (_graphName: string) => {
      return new GraphManager(arango.db);
    };

    arango.model = (modelName: string) => {
      return arango.models?.[modelName];
    };
  }

  /**
   * Create middleware for any framework
   */
  middleware() {
    return (context: FrameworkContext, next?: FrameworkNext) => {
      this.attach(context);

      // Log request if logger available
      if (this.options.logger && context.request.path) {
        this.options.logger.info(
          `${context.request.method || 'REQUEST'} ${context.request.path}`
        );
      }

      // Profile request if profiler available
      if (this.options.profiler) {
        const startTime = Date.now();
        
        // Handle response finish
        if (context.response) {
          const originalJson = context.response.json;
          const originalSend = context.response.send;

          context.response.json = function(data: any) {
            if (originalJson) return originalJson.call(this, data);
            if (originalSend) return originalSend.call(this, JSON.stringify(data));
            return this;
          };

          context.response.send = function(data: any) {
            const duration = Date.now() - startTime;
            if (context.arango?.logger) {
              context.arango.logger.info(
                `${context.request.method} ${context.request.path} - ${duration}ms`
              );
            }
            if (originalSend) return originalSend.call(this, data);
            return this;
          };
        }
      }

      if (next) {
        next();
      }
    };
  }

  /**
   * Error handler for any framework
   */
  errorHandler() {
    return (error: any, context: FrameworkContext, next?: FrameworkNext) => {
      try {
        const { ArangoError, ValidationError, ConnectionError, QueryError } = 
          require('../../errors/ArangoError');

        if (error instanceof ArangoError) {
          const statusCode = error instanceof ValidationError ? 400 :
                           error instanceof ConnectionError ? 503 :
                           error instanceof QueryError ? 400 : 500;

          if (context.response) {
            context.response.status(statusCode).json({
              error: {
                name: error.name,
                message: error.message,
                ...(error instanceof QueryError && { query: (error as any).query }),
              },
            });
            return;
          }
        }
      } catch {
        // Error classes not available
      }

      if (next) {
        next(error);
      }
    };
  }
}

