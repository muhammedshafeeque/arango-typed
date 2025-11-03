# API Reference

Complete API documentation for Arango Typed.

## Connection

### `connect(options: ConnectionOptions): Promise<void>`

Connect to ArangoDB.

**Options:**
- `url: string` - ArangoDB server URL
- `databaseName: string` - Database name
- `auth: { username: string, password: string }` - Authentication
- `poolSize?: number` - Connection pool size
- `retryStrategy?: RetryStrategyOptions` - Retry configuration
- `circuitBreaker?: CircuitBreakerOptions` - Circuit breaker config

### `getDatabase(): Database`

Get the current database instance.

## Schema

### `Schema(definition: SchemaDefinition)`

Create a new schema.

**Field Types:**
- `String`, `Number`, `Boolean`, `Date`, `Array`, `Object`, `Mixed`

**Field Options:**
- `required: boolean`
- `default: any | Function`
- `unique: boolean`
- `index: boolean`
- `validate: { validator: Function, message: string }`

**Index Types:**
- `ttl: boolean` - TTL index
- `geo: boolean` - Geo index
- `fulltext: boolean` - Fulltext index

## Model

### `model<T>(name: string, schema: Schema): Model<T>`

Create a model.

### `Model.create(data: Partial<T>): Promise<Document<T>>`

Create a document.

### `Model.findById(id: string): Promise<Document<T> | null>`

Find document by ID.

### `Model.find(filter?: Filter): Query<T>`

Find documents.

### `Model.findOne(filter?: Filter): Promise<Document<T> | null>`

Find one document.

### `Model.count(filter?: Filter): Promise<number>`

Count documents.

## Query

### `Query.find(filter?: Filter): Query`

Filter documents.

### `Query.sort(fields: Record<string, 1 | -1>): Query`

Sort results.

### `Query.limit(n: number): Query`

Limit results.

### `Query.skip(n: number): Query`

Skip results.

### `Query.select(fields: string[]): Query`

Select fields.

### `Query.lean(): Query`

Return plain objects.

### `Query.all(): Promise<T[]>`

Execute and get all results.

### `Query.first(): Promise<T | null>`

Get first result.

## Relations

### `Model.hasOne(name: string, Model: Model, options: RelationshipOptions)`

Define hasOne relationship.

### `Model.hasMany(name: string, Model: Model, options: RelationshipOptions)`

Define hasMany relationship.

### `Model.belongsTo(name: string, Model: Model, options: RelationshipOptions)`

Define belongsTo relationship.

### `Document.populate(path: string | string[]): Promise<Document>`

Populate relationships.

## Graph

### `Graph.create(name: string, definition: GraphDefinition): Promise<Graph>`

Create a graph.

### `Graph.traverse(options: TraversalOptions): Promise<TraversalResult>`

Traverse graph.

### `Graph.shortestPath(from: string, to: string): Promise<Path>`

Find shortest path.

### `Edge.create(collection: string, data: EdgeData): Promise<Edge>`

Create an edge.

## Vector Search

### `VectorSearch.similaritySearch(collection: string, vector: number[], options: SearchOptions): Promise<SearchResult[]>`

Perform similarity search.

### `VectorSearch.store(collection: string, document: Document): Promise<void>`

Store document with embedding.

## Migrations

### `MigrationGenerator.generate(name: string): Promise<string>`

Generate migration file.

### `MigrationRunner.up(options?: { toVersion?: string }): Promise<void>`

Run migrations.

### `MigrationRunner.down(options?: { toVersion?: string }): Promise<void>`

Rollback migrations.

## Caching

### `CacheManager.get(key: string): Promise<T | null>`

Get cached value.

### `CacheManager.set(key: string, value: T, ttl?: number): Promise<void>`

Set cached value.

### `CacheManager.delete(key: string): Promise<void>`

Delete cached value.

## Observability

### `Profiler.profile(query: string, fn: Function): Promise<T>`

Profile query execution.

### `Logger.info(message: string, ...args: any[]): void`

Log info message.

### `Logger.error(message: string, error?: Error): void`

Log error.

### `Metrics.increment(name: string, labels?: Record<string, string>): void`

Increment metric.

