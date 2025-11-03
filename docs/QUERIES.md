# Queries

Arango Typed provides a powerful query builder for creating and executing AQL queries with automatic caching and performance optimizations.

## Table of Contents

- [Basic Queries](#basic-queries)
- [Query Operators](#query-operators)
- [Query Builder](#query-builder)
- [Query Caching](#query-caching)
- [Advanced Queries](#advanced-queries)
- [Related Documentation](#related-documentation)

## Basic Queries

### Find All

```typescript
const users = await User.find().all();
```

### Find with Conditions

```typescript
const activeUsers = await User.find({ active: true }).all();

const adultUsers = await User.find({ 
  age: { $gte: 18 } 
}).all();
```

## Query Operators

### Comparison Operators

```typescript
// Greater than
User.find({ age: { $gt: 18 } })

// Greater than or equal
User.find({ age: { $gte: 18 } })

// Less than
User.find({ age: { $lt: 65 } })

// Less than or equal
User.find({ age: { $lte: 65 } })

// Not equal
User.find({ status: { $ne: 'deleted' } })

// In array
User.find({ status: { $in: ['active', 'pending'] } })

// Not in array
User.find({ status: { $nin: ['deleted', 'archived'] } })
```

### Logical Operators

```typescript
// AND
User.find({ 
  age: { $gte: 18 },
  active: true 
})

// OR
User.find({
  $or: [
    { age: { $lt: 18 } },
    { age: { $gt: 65 } }
  ]
})

// NOT
User.find({
  $not: { active: false }
})

// NOR
User.find({
  $nor: [
    { active: false },
    { deleted: true }
  ]
})
```

### Array Operators

```typescript
// Contains all
User.find({ 
  tags: { $all: ['admin', 'user'] }
})

// Contains any
User.find({ 
  tags: { $any: ['admin', 'moderator'] }
})

// Array length
User.find({ 
  tags: { $size: 3 }
})
```

### String Operators

```typescript
// Contains
User.find({ 
  name: { $contains: 'John' }
})

// Starts with
User.find({ 
  email: { $startsWith: 'john' }
})

// Ends with
User.find({ 
  email: { $endsWith: '@example.com' }
})

// Regex
User.find({ 
  email: { $regex: /^john/i }
})
```

## Query Builder

### Chainable Queries

```typescript
const query = User.find({ active: true })
  .sort({ createdAt: -1 })
  .limit(10)
  .skip(0)
  .select(['name', 'email']);

const results = await query.all();
```

## Query Caching

**Performance Feature:** Queries are automatically compiled and cached for reuse.

### How It Works

```typescript
// First call - compiles and caches query
await User.find({ name: 'John' }).all();

// Subsequent calls - uses cached query (faster!)
await User.find({ name: 'Jane' }).all(); // Same structure, different value
```

**Cache Strategy:**
- ✅ Caches query structure (not values)
- ✅ Reuses compiled AQL
- ✅ Separate bindVars for each execution

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
User.find({ name: 'John' })  // Structure: { where: { name: ... } }
User.find({ name: 'Jane' })  // Same structure, different value

// Different cache key (different structure)
User.find({ name: 'John' })       // Has where
User.find({}).limit(10)           // Has limit, no where
```

**See:** [Performance](./PERFORMANCE.md) for more optimization details.

### Sorting

```typescript
// Single field
User.find().sort({ createdAt: -1 }) // -1 = desc, 1 = asc

// Multiple fields
User.find().sort({ 
  active: -1,  // Sort by active first (descending)
  createdAt: 1 // Then by createdAt (ascending)
})
```

### Limiting & Skipping

```typescript
// Limit
User.find().limit(10)

// Skip
User.find().skip(20)

// Pagination
User.find()
  .skip((page - 1) * pageSize)
  .limit(pageSize)
```

### Projection (Select Fields)

```typescript
// Select specific fields
User.find().select(['name', 'email'])

// Exclude fields
User.find().select(['-password', '-token'])
```

## Aggregation

```typescript
import { Query } from 'arango-typed';

const query = new Query(db, 'users');

const result = await query
  .aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
  .all();
```

## Lean Queries

For better performance, use lean queries (returns plain objects):

```typescript
const users = await User.find().lean().all();
// Returns plain objects, not Document instances
```

## Count Queries

```typescript
const count = await User.count({ active: true });
```

## Raw AQL Queries

For complex queries, use raw AQL:

```typescript
const result = await db.query(`
  FOR user IN users
    FILTER user.age >= 18
    RETURN user
`).then(cursor => cursor.all());
```

## Subqueries

```typescript
import { Subquery } from 'arango-typed';

const subquery = new Subquery(db, 'users')
  .find({ active: true })
  .select(['_id']);

const result = await Post.find({
  userId: { $in: subquery }
}).all();
```

## Joins

```typescript
import { JoinQuery } from 'arango-typed';

const joinQuery = new JoinQuery(db)
  .from('users')
  .join('posts', 'users._id', 'posts.userId')
  .select(['users.name', 'posts.title']);

const results = await joinQuery.all();
```

## Advanced Examples

### Complex Filtering

```typescript
const users = await User.find({
  $and: [
    { age: { $gte: 18, $lte: 65 } },
    { 
      $or: [
        { role: 'admin' },
        { active: true, verified: true }
      ]
    },
    { email: { $regex: /@example\.com$/ } }
  ]
}).sort({ createdAt: -1 }).limit(10).all();
```

### Aggregation Pipeline

```typescript
const stats = await User.find()
  .aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgAge: { $avg: '$age' }
      }
    },
    { $sort: { count: -1 } }
  ])
  .all();
```

## Related Documentation

- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Model operations and queries
- **[Performance](./PERFORMANCE.md)** - Query performance optimization
- **[Multi-tenancy](./MULTI_TENANCY.md)** - Tenant-aware queries
- **[Connection Management](./CONNECTION.md)** - Database connections

