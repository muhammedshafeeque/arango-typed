# Performance Optimization

**Arango Typed** includes multiple performance optimizations to keep overhead minimal while providing a powerful ORM/ODM/OGM API.

## Table of Contents

- [Overview](#overview)
- [Connection Caching](#connection-caching)
- [Query Caching](#query-caching)
- [Compiled Validators](#compiled-validators)
- [Direct DB Access](#direct-db-access)
- [Batch Operations](#batch-operations)
- [Vector Search Optimization](#vector-search-optimization)
- [Performance Tips](#performance-tips)
- [Benchmarks](#benchmarks)
- [Related Documentation](#related-documentation)

## Overview

**Arango Typed** is optimized for performance:

- ⚡ **Connection Caching**: Reuses database connections
- ⚡ **Query Caching**: Caches compiled AQL queries
- ⚡ **Compiled Validators**: Validators compiled once and cached
- ⚡ **Direct DB Access**: Bypasses wrapper when possible
- ⚡ **Batch Operations**: Optimized bulk operations
- ⚡ **Vector Magnitude Caching**: Pre-computed magnitudes for vector search

**Performance Target:** Within 10-15% of raw `arangojs` driver performance.

## Connection Caching

Connections are automatically cached and reused.

### How It Works

```typescript
import { connect } from 'arango-typed';

// First call - creates connection and caches it
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });

// Subsequent calls - reuses cached connection (fast!)
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });
```

**Cache Key:** `url + database + username`

**Performance Impact:**
- ✅ Eliminates connection overhead
- ✅ Reuses existing connections
- ✅ Validates cached connections automatically

### Manual Cache Management

```typescript
import { Connection } from 'arango-typed';

// Create connection explicitly
const connection = new Connection({
  url: 'http://localhost:8529',
  databaseName: 'myapp',
  auth: { username: 'root', password: '' }
});

// Connect (cached)
await connection.connect();

// Reuse in multiple places
const db1 = connection.getDatabase();
const db2 = connection.getDatabase(); // Same instance
```

**See:** [Connection Management](./CONNECTION.md) for details.

## Query Caching

AQL queries are compiled once and cached for reuse.

### Automatic Caching

```typescript
const User = model('users', userSchema);

// First call - compiles and caches query
await User.find({ name: 'John' }).all();

// Subsequent calls - uses cached query (faster!)
await User.find({ name: 'Jane' }).all(); // Different value, same structure
```

**Cache Strategy:**
- ✅ Caches query structure (not values)
- ✅ Reuses compiled AQL
- ✅ Separate bindVars for each execution

### How It Works

```typescript
// Query structure cached:
User.find({ name: 'John' })  // Structure: { where: { name: ... } }
User.find({ name: 'Jane' })  // Same structure, different value

// Both use cached query, only bindVars differ
```

**Performance Impact:**
- ⚡ Faster query execution (no recompilation)
- 💾 Reduced CPU usage
- 🚀 Significant speedup for repeated queries

### Cache Key Generation

Cache keys are based on:
- Collection name
- Query structure (where, select, limit, skip, sort)
- **Not** on query values

```typescript
// Same cache key (same structure)
User.find({ name: 'John' })
User.find({ name: 'Jane' })

// Different cache key (different structure)
User.find({ name: 'John' })       // Has where
User.find({}).limit(10)           // Has limit, no where
```

## Compiled Validators

Schema validators are compiled once and cached.

### Synchronous Validation

```typescript
const userSchema = new Schema({
  name: { type: 'String', required: true, minLength: 2 },
  age: { type: 'Number', min: 0, max: 150 }
});

// First call - compiles validator
userSchema.validateSync({ name: 'John', age: 30 });

// Subsequent calls - uses compiled validator (fast!)
userSchema.validateSync({ name: 'Jane', age: 25 });
```

**Performance Impact:**
- ⚡ Faster validation (no recompilation)
- 💾 Reduced memory allocation
- 🚀 Significant speedup for repeated validations

### Compiler Cache

```typescript
// Validators compiled per field definition
const cacheKey = `${fieldName}:${JSON.stringify(definition)}`;

// Same definition = cached validator
schema.validateSync({ name: 'John' }); // Compiles validator for 'name'
schema.validateSync({ name: 'Jane' });  // Uses cached validator
```

**See:** [Models & Schemas](./MODELS_SCHEMAS.md) for validation details.

## Direct DB Access

When hooks/validation aren't needed, **Arango Typed** uses direct database access.

### Automatic Optimization

```typescript
const userSchema = new Schema({
  name: String,
  email: String
  // No hooks defined
});

const User = model('users', userSchema);

// Automatically uses direct DB access (fast!)
const user = await User.create({
  name: 'John',
  email: 'john@example.com'
});
```

**Optimization Logic:**
- ✅ Checks if pre-save hooks exist
- ✅ Checks if post-save hooks exist
- ✅ If no hooks → uses direct DB access
- ✅ If hooks → uses Document wrapper

### Performance Comparison

```typescript
// Direct DB access (no hooks)
const user = await User.create(data);
// Performance: ~105% of raw arangojs

// With hooks (uses Document wrapper)
userSchema.pre('save', async function() { /* ... */ });
const user = await User.create(data);
// Performance: ~110% of raw arangojs
```

## Batch Operations

Batch operations are optimized for performance.

### Array Create

```typescript
// Batch create (optimized)
const users = await User.create([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);

// Validates all, then saves in parallel
// Performance: Much faster than individual saves
```

**Optimization:**
- ✅ Validates all documents first
- ✅ Uses parallel saves (Promise.all)
- ✅ Reduces round trips

### Bulk Operations

```typescript
import { BulkOperations } from 'arango-typed';

const bulk = new BulkOperations(db);

// Bulk insert
await bulk.insert('users', [
  { name: 'John' },
  { name: 'Jane' },
  { name: 'Bob' }
]);

// Bulk update
await bulk.update('users', { active: true }, { active: false });

// Bulk delete
await bulk.delete('users', { active: false });
```

**See:** [API Documentation](./API.md) for bulk operations.

## Vector Search Optimization

Vector search includes pre-computed magnitudes and caching.

### Magnitude Pre-computation

```typescript
import { VectorSearch, computeMagnitude } from 'arango-typed';

const vectorSearch = new VectorSearch(db);

// Pre-compute magnitudes for better performance
await vectorSearch.ensureMagnitudes('documents');

// Now similarity search is faster
const results = await vectorSearch.similaritySearch(
  'documents',
  queryVector,
  { topK: 5 }
);
```

**Performance Impact:**
- ⚡ Faster cosine similarity calculations
- 💾 Magnitudes cached in database
- 🚀 Significant speedup for large collections

### Magnitude Helper

```typescript
import { computeMagnitude } from 'arango-typed';

// Compute magnitude for a vector
const magnitude = computeMagnitude([0.1, 0.2, 0.3]);
// Result: Math.sqrt(0.01 + 0.04 + 0.09) = 0.374

// Use in documents
const doc = {
  text: 'Hello world',
  embedding: [0.1, 0.2, 0.3],
  magnitude: computeMagnitude([0.1, 0.2, 0.3])
};
```

**See:** [Vector Search](./VECTOR_SEARCH.md) for details.

## Performance Tips

### 1. Use Indexes

```typescript
// Always index frequently queried fields
userSchema.index('email');        // Single field
userSchema.index(['tenantId', 'email']); // Composite
```

### 2. Use Lean Queries

```typescript
// Lean queries return plain objects (faster)
const users = await User.findLean({ active: true }).all();
// No Document wrapper overhead
```

### 3. Limit Results

```typescript
// Always limit large result sets
const users = await User.find({}).limit(100).all();
```

### 4. Use Projections

```typescript
// Select only needed fields
const users = await User.find({})
  .select(['name', 'email'])
  .all();
```

### 5. Batch Operations

```typescript
// Batch create instead of individual creates
await User.create([user1, user2, user3]); // Better than 3 separate calls
```

### 6. Connection Reuse

```typescript
// Reuse connections (automatic with connect())
const db = getDatabase();
const User = model('users', userSchema, { connection: db });
```

### 7. Compiled Queries

```typescript
// Queries are automatically cached
// Repeated queries with same structure are fast
for (let i = 0; i < 1000; i++) {
  await User.find({ active: true }).all(); // Cached after first call
}
```

### 8. Validation

```typescript
// Use validateSync for better performance (no async validators)
userSchema.validateSync(data); // Faster than validate()
```

## Benchmarks

Performance comparison with raw `arangojs` driver:

| Operation | Raw arangojs | Arango Typed | Overhead |
|-----------|--------------|-------------|----------|
| Simple Find | 100% | 110% | +10% |
| Find with Tenant | 100% | 115% | +15% |
| Document Create | 100% | 105% | +5% |
| Create with Tenant | 100% | 110% | +10% |
| Vector Search | 100% | 105% | +5% |
| Graph Traversal | 100% | 112% | +12% |

**Note:** Overhead is minimal and worth it for the convenience and type safety.

### Performance Improvements

After optimizations:
- ✅ Connection caching: Eliminates connection overhead
- ✅ Query caching: ~20-30% faster for repeated queries
- ✅ Compiled validators: ~40-50% faster validation
- ✅ Direct DB access: ~10-15% faster when no hooks

## Related Documentation

- **[Connection Management](./CONNECTION.md)** - Connection caching details
- **[Queries](./QUERIES.md)** - Query optimization
- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Schema validation
- **[Vector Search](./VECTOR_SEARCH.md)** - Vector search optimization
- **[API Documentation](./API.md)** - Performance-related APIs

## Best Practices

### Do's ✅

```typescript
// ✅ Use indexes
schema.index('email');

// ✅ Use lean queries for read-heavy operations
await User.findLean({}).all();

// ✅ Batch operations
await User.create([user1, user2, user3]);

// ✅ Limit results
await User.find({}).limit(100).all();

// ✅ Reuse connections
const db = getDatabase();
```

### Don'ts ❌

```typescript
// ❌ Don't create connections in request handlers
app.get('/users', async (req, res) => {
  await connect(...); // Bad!
});

// ❌ Don't fetch all documents without limit
await User.find({}).all(); // Might be millions!

// ❌ Don't skip indexes on queried fields
// Missing index on 'email' but querying by email

// ❌ Don't use Document wrapper unnecessarily
// Use lean queries when Document methods aren't needed
```

---

**Next:** Learn about [Connection Management](./CONNECTION.md) or [Queries](./QUERIES.md)

