import { Database } from 'arangojs';
import { getDatabase, Connection } from '../../connection/Connection';
import { CacheManager } from '../../cache/CacheManager';
import { Profiler } from '../../observability/Profiler';
import { Logger } from '../../observability/Logger';
import { TenantContext } from '../../tenancy/TenantContext';

// Express types - optional peer dependency
export interface ExpressRequest {
  [key: string]: any;
}

export interface ExpressResponse {
  [key: string]: any;
  status(code: number): ExpressResponse;
  json(data: any): ExpressResponse;
  setHeader(name: string, value: string): void;
  on(event: string, handler: () => void): void;
}

export interface ExpressNextFunction {
  (error?: any): void;
}

export interface ArangoExpressOptions {
  connection?: Connection;
  database?: Database;
  cache?: CacheManager;
  profiler?: Profiler;
  logger?: Logger;
  autoAttach?: boolean;
}

/**
 * Express middleware to attach ArangoDB connection and utilities to requests
 */
export function arangoMiddleware(options: ArangoExpressOptions = {}) {
  return (req: ExpressRequest, _res: ExpressResponse, next: ExpressNextFunction): void => {
    // Attach database connection
    if (options.database) {
      req.arango = {
        db: options.database,
        cache: options.cache,
        profiler: options.profiler,
        logger: options.logger,
      };
    } else if (options.connection) {
      req.arango = {
        db: options.connection.getDatabase(),
        connection: options.connection,
        cache: options.cache,
        profiler: options.profiler,
        logger: options.logger,
      };
    } else {
      // Use default connection
      req.arango = {
        db: getDatabase(),
        cache: options.cache,
        profiler: options.profiler,
        logger: options.logger,
      };
    }

    // Auto-attach helper methods if enabled
    if (options.autoAttach !== false) {
      attachHelpers(req);
    }

    next();
  };
}

/**
 * Attach helper methods to request object
 */
function attachHelpers(req: ExpressRequest): void {
  const arango = req.arango;

  // Model helper
  arango.model = function(modelName: string) {
    // This would return a Model instance
    // Implementation would depend on model registry
    return arango.models?.[modelName];
  };

  // Query helper
  arango.query = function(collectionName: string) {
    const { Query } = require('../../query/Query');
    return new Query(arango.db, collectionName);
  };

  // Vector search helper
  arango.vectorSearch = function() {
    const { VectorSearch } = require('../../vector/VectorSearch');
    return new VectorSearch(arango.db);
  };

  // Graph helper
  arango.graph = function(_graphName: string) {
    const { GraphManager } = require('../../graph/Graph');
    return new GraphManager(arango.db);
  };
}

/**
 * Error handler middleware for ArangoDB errors
 */
export function arangoErrorHandler(
  error: any,
  _req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
): void {
  try {
    const { ArangoError, ValidationError, ConnectionError, QueryError } = require('../../errors/ArangoError');

    if (error instanceof ArangoError) {
      const statusCode = error instanceof ValidationError ? 400 :
                        error instanceof ConnectionError ? 503 :
                        error instanceof QueryError ? 400 : 500;

      res.status(statusCode).json({
        error: {
          name: error.name,
          message: error.message,
          ...(error instanceof QueryError && { query: (error as any).query }),
        },
      });
      return;
    }
  } catch {
    // Error classes not available, continue to next handler
  }
  
  next(error);
}

/**
 * Request ID middleware for tracing
 */
export function arangoRequestId(req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void {
  const requestId = (req.headers?.['x-request-id'] as string) || 
                    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.arangoRequestId = requestId;
  if (res.setHeader) {
    res.setHeader('X-Request-Id', requestId);
  }

  // Attach to logger if available
  if (req.arango?.logger) {
    const pathInfo = req.path ? `path: ${req.path}` : '';
    req.arango.logger.info(`Request started: ${requestId} ${pathInfo}`);
  }

  next();
}

/**
 * Profiling middleware
 */
export function arangoProfiler(req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void {
  const arango = req.arango;
  
  if (!arango?.profiler) {
    return next();
  }

  const startTime = Date.now();

  if (res.on) {
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      // Log profiling info via logger if available
      if (arango.logger) {
        arango.logger.info(`Request completed: ${req.method} ${req.path} - ${duration}ms`);
      }
      // Profiler is for query profiling, not HTTP requests
      // You could extend it or use a separate HTTP profiler
    });
  }

  next();
}

/**
 * Tenant extraction options
 */
export interface TenantMiddlewareOptions {
  extractFrom?: 'header' | 'query' | 'params' | 'jwt' | 'custom';
  field?: string;
  headerName?: string;
  queryParam?: string;
  paramName?: string;
  jwtPath?: string;
  customExtractor?: (req: ExpressRequest) => string | null;
  required?: boolean;
}

/**
 * Tenant middleware - automatically extracts tenant ID and sets TenantContext
 * This enables automatic tenant filtering in Models when tenantEnabled is true
 */
export function tenantMiddleware(options: TenantMiddlewareOptions = {}) {
  const {
    extractFrom = 'header',
    field = 'tenantId',
    headerName = 'x-tenant-id',
    queryParam = 'tenant',
    paramName = 'tenantId',
    jwtPath,
    customExtractor,
    required = false,
  } = options;

  return (req: ExpressRequest, _res: ExpressResponse, next: ExpressNextFunction): void => {
    let tenantId: string | null = null;

    try {
      // Extract tenant ID based on configuration
      if (extractFrom === 'header') {
        tenantId = (req.headers?.[headerName.toLowerCase()] as string) || null;
      } else if (extractFrom === 'query') {
        tenantId = (req.query?.[queryParam] as string) || null;
      } else if (extractFrom === 'params') {
        tenantId = (req.params?.[paramName] as string) || null;
      } else if (extractFrom === 'jwt') {
        // Extract from JWT token (req.user or req.auth is typically set by auth middleware)
        const user = (req as any).user || (req as any).auth;
        if (user && jwtPath) {
          const parts = jwtPath.split('.');
          let value: any = user;
          for (const part of parts) {
            value = value?.[part];
          }
          tenantId = value || null;
        } else if (user && user[field]) {
          tenantId = user[field];
        }
      } else if (extractFrom === 'custom' && customExtractor) {
        tenantId = customExtractor(req);
      }

      // Set tenant context
      if (tenantId) {
        TenantContext.set(tenantId);
      } else if (required) {
        // Throw error if tenant is required but not found
        const error = new Error(`Tenant ID is required but not found. Expected in ${extractFrom}`);
        (error as any).status = 400;
        return next(error);
      }

      // Clean up tenant context after request (attach cleanup to response)
      if (_res.on) {
        _res.on('finish', () => {
          TenantContext.clear();
        });
      } else {
        // Fallback: clear on next tick if response.on is not available
        process.nextTick(() => {
          TenantContext.clear();
        });
      }

      next();
    } catch (error) {
      // Clear tenant context on error
      TenantContext.clear();
      next(error);
    }
  };
}
