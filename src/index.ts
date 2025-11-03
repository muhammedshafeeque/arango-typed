// Connection
export { 
  Connection, 
  connect, 
  getConnection, 
  getDatabase,
  getGraphManager,
  getVectorSearch,
  getTransactionManager,
  getSearchManager,
  getGeoQuery,
  getBulkOperations,
} from './connection/Connection';
export type { ConnectionOptions } from './types';

// Schema
export { Schema } from './schema/Schema';
export { SchemaType } from './schema/SchemaTypes';
export type { SchemaDefinition, SchemaFieldDefinition, IndexDefinition, VirtualFieldDefinition } from './types/schemas';

// Model
export { Model, model } from './model/Model';
export { Document } from './model/Document';

// Query
export { Query } from './query/Query';
export { QueryBuilder } from './query/QueryBuilder';
export type { QueryOptions } from './query/QueryBuilder';

// Errors
export {
  ArangoError,
  ValidationError,
  ConnectionError,
  QueryError,
  DocumentNotFoundError,
  VectorSearchError,
} from './errors/ArangoError';

// Types
export type {
  ArangoDocument,
  ModelStatic,
  HookType,
  HookCallback,
  ModelOptions,
} from './types';

export type {
  InferSchemaType,
  InferModelType,
} from './types/inference';

// Framework Type Augmentations
export type {
  ArangoContext,
} from './types/FrameworkAugments';
export {
  hasArangoContext,
  hasArangoRequestId,
  getArangoContext,
  setArangoContext,
} from './types/FrameworkAugments';

// Utils
export { HookRegistry } from './utils/hooks';
export { validateDocument, validateField } from './utils/validator';
export type { ValidationResult } from './utils/validator';

// Graph / OGM
export { GraphManager } from './graph/Graph';
export { Edge } from './graph/Edge';
export { GraphTraversal } from './graph/Traversal';
export { GraphModel, graphModel } from './graph/GraphModel';
export type { GraphOptions } from './graph/Graph';
export type { EdgeDefinition } from './graph/Graph';
export type { TraversalOptions } from './graph/Traversal';
export type { GraphRelationshipOptions } from './graph/GraphModel';

// Relations
export { Relation } from './relations/Relation';
export type { RelationOptions, PopulateOptions } from './relations/Relation';

// Vector Search
export { VectorSearch } from './vector/VectorSearch';
export type { VectorSearchOptions, EmbeddingOptions } from './vector/VectorSearch';

// Transactions
export { TransactionManager } from './transaction/Transaction';
export type { TransactionOptions } from './transaction/Transaction';

// Aggregation
export { AggregationQuery } from './query/Aggregation';
export type { AggregationOptions } from './query/Aggregation';

// AQL Builder
export { AQLBuilder, aql } from './query/AQL';
export type { AQLOptions } from './query/AQL';

// Search
export { SearchManager } from './search/Search';
export type { SearchOptions, SearchResult } from './search/Search';

// Geo Queries
export { GeoQuery } from './geo/GeoQuery';
export type { GeoPoint, GeoOptions } from './geo/GeoQuery';

// Bulk Operations
export { BulkOperations } from './bulk/BulkOperations';
export type { BulkWriteOptions, BulkOperation, BulkOperationResult } from './bulk/BulkOperations';

// Middleware
export { MiddlewareRegistry } from './middleware/Middleware';
export type { MiddlewareFunction } from './middleware/Middleware';

// Plugins
export { PluginRegistry, plugins } from './plugin/Plugin';
export type { Plugin, PluginFunction } from './plugin/Plugin';

// Migrations
export { Migration } from './migration/Migration';
export { MigrationRunner } from './migration/MigrationRunner';
export { MigrationStore } from './migration/MigrationStore';
export { MigrationGenerator } from './migration/MigrationGenerator';
export type { MigrationMetadata } from './migration/Migration';
export type { MigrationRunnerOptions } from './migration/MigrationRunner';

// Connection Pooling
export { ConnectionPool } from './connection/ConnectionPool';
export { RetryStrategy } from './connection/RetryStrategy';
export { CircuitBreaker, CircuitState } from './connection/CircuitBreaker';
export { HealthCheck } from './connection/HealthCheck';
export type { PoolOptions } from './connection/ConnectionPool';
export type { RetryOptions } from './connection/RetryStrategy';
export type { CircuitBreakerOptions } from './connection/CircuitBreaker';
export type { HealthCheckOptions, HealthCheckResult } from './connection/HealthCheck';

// Caching
export { CacheManager } from './cache/CacheManager';
export { MemoryCache } from './cache/MemoryCache';
export { RedisCache } from './cache/RedisCache';
export type { CacheOptions, CacheEntry } from './cache/CacheManager';

// Observability
export { Profiler } from './observability/Profiler';
export { Logger, LogLevel } from './observability/Logger';
export { Metrics } from './observability/Metrics';
export { SlowQueryLogger } from './observability/SlowQueryLogger';
export type { QueryProfile, ProfilerOptions } from './observability/Profiler';
export type { LogEntry, LoggerOptions } from './observability/Logger';
export type { Metric } from './observability/Metrics';

// Advanced Relationships
export { Relationship } from './relations/Relationship';
export { HasOne } from './relations/HasOne';
export { HasMany } from './relations/HasMany';
export { BelongsTo } from './relations/BelongsTo';
export { BelongsToMany } from './relations/BelongsToMany';
export type { RelationshipOptions } from './relations/Relationship';
export type { BelongsToManyOptions } from './relations/BelongsToMany';

// Query Operators
export { Operators } from './query/Operators';
export type { OperatorMap } from './query/Operators';

// Pagination
export { Paginator } from './pagination/Paginator';
export { CursorPagination } from './pagination/CursorPagination';
export type { PaginationResult, PaginationOptions } from './pagination/Paginator';
export type { CursorPaginationResult, CursorPaginationOptions } from './pagination/CursorPagination';

// Schema Discriminators
export { Discriminator } from './schema/Discriminator';
export type { DiscriminatorOptions } from './schema/Discriminator';

// Versioning & Audit
export { VersionManager } from './versioning/VersionManager';
export { AuditLog } from './versioning/AuditLog';
export type { VersionOptions } from './versioning/VersionManager';
export type { AuditEntry } from './versioning/AuditLog';

// Change Streams
export { ChangeStream } from './streams/ChangeStream';
export type { ChangeEvent } from './streams/ChangeStream';

// Seeding
export { Seeder } from './seeder/Seeder';
export type { SeedData, SeedFile } from './seeder/Seeder';

// Performance
export { Optimizer } from './performance/Optimizer';
export { IndexHint } from './performance/IndexHint';
export { StreamingQuery } from './performance/StreamingQuery';
export type { QueryPlan, OptimizationSuggestion } from './performance/Optimizer';
export type { StreamOptions } from './performance/StreamingQuery';

// Multi-tenancy
export { TenantManager } from './tenancy/TenantManager';
export { TenantContext } from './tenancy/TenantContext';
export type { TenantOptions } from './tenancy/TenantManager';

// Import/Export
export { Exporter } from './importexport/Exporter';
export { Importer } from './importexport/Importer';
export type { ExportOptions } from './importexport/Exporter';
export type { ImportOptions } from './importexport/Importer';

// Testing
export { TestHelpers } from './testing/TestHelpers';

// CLI
export { migrate } from './cli/migrate';

// ODM Features - Lean Queries
export { LeanQuery } from './query/LeanQuery';
export type { LeanQueryOptions } from './query/LeanQuery';

// ORM Features - Joins & Subqueries
export { JoinQuery } from './query/JoinQuery';
export { Subquery } from './query/Subquery';
export type { JoinOptions, JoinQueryOptions } from './query/JoinQuery';
export type { SubqueryOptions } from './query/Subquery';

// ODM Features - Subdocuments
export { Subdocument } from './model/Subdocument';

// ORM Features - Polymorphic Relations
export { PolymorphicRelation } from './relations/Polymorphic';
export type { PolymorphicOptions } from './relations/Polymorphic';

// OGM Features - Path Queries & Algorithms
export { PathQueries } from './graph/PathQueries';
export { GraphAlgorithms } from './graph/GraphAlgorithms';
export type { ShortestPathOptions, AllPathsOptions } from './graph/PathQueries';
export type { GraphStatistics } from './graph/GraphAlgorithms';

// LangChain.js Integration
export {
  ArangoLangChainStore,
  ArangoRAG,
  ArangoMCP,
} from './integrations/langchain';
export type {
  LangChainStoreOptions,
  RAGOptions,
  MCPContext,
  MCPResponse,
} from './integrations/langchain';

// Express.js Integration
export {
  arangoMiddleware,
  arangoErrorHandler,
  arangoRequestId,
  arangoProfiler,
  createArangoRoutes,
} from './integrations/express';
export type {
  ArangoExpressOptions,
  ArangoRoutesOptions,
} from './integrations/express';

// Universal Framework Support
export {
  UniversalAdapter,
  FastifyAdapter,
  KoaAdapter,
  NestJSAdapter,
  NextJSAdapter,
  HonoAdapter,
  UniversalRoutes,
  createFastifyAdapter,
  createKoaAdapter,
  createNestJSAdapter,
  createNextJSAdapter,
  createHonoAdapter,
} from './integrations/frameworks';
export type {
  FrameworkRequest,
  FrameworkResponse,
  FrameworkContext,
  AdapterOptions,
  UniversalRoutesOptions,
} from './integrations/frameworks';

