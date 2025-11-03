/**
 * TypeScript declaration merging for framework request/response objects
 * Provides type safety for arango-typed framework integrations
 */

import { Database } from 'arangojs';
import { CacheManager } from '../cache/CacheManager';
import { Profiler } from '../observability/Profiler';
import { Logger } from '../observability/Logger';

/**
 * Base interface for ArangoDB context attached to framework requests
 */
export interface ArangoContext {
  database: Database;
  cache?: CacheManager;
  profiler?: Profiler;
  logger?: Logger;
}

/**
 * Declare module augmentations for Express (optional peer dependency)
 * Note: These augmentations only apply if @types/express is installed
 */
declare global {
  namespace Express {
    interface Request {
      arango?: ArangoContext;
      arangoRequestId?: string;
    }
  }
}

/**
 * Declare module augmentations for Fastify (optional peer dependency)
 * Note: These augmentations only apply if fastify types are available
 * Using global namespace to avoid module resolution errors when fastify isn't installed
 */
declare global {
  namespace Fastify {
    interface FastifyRequest {
      arango?: ArangoContext;
      arangoRequestId?: string;
    }
  }
}

/**
 * Type guards for framework requests
 */
export function hasArangoContext(obj: any): obj is { arango: ArangoContext } {
  return obj && typeof obj === 'object' && obj.arango !== undefined;
}

export function hasArangoRequestId(obj: any): obj is { arangoRequestId: string } {
  return obj && typeof obj === 'object' && typeof obj.arangoRequestId === 'string';
}

/**
 * Safely get Arango context from a request object
 */
export function getArangoContext<T extends { arango?: ArangoContext }>(
  request: T
): ArangoContext | undefined {
  return request.arango;
}

/**
 * Safely set Arango context on a request object
 */
export function setArangoContext<T extends { arango?: ArangoContext }>(
  request: T,
  context: ArangoContext
): void {
  request.arango = context;
}

