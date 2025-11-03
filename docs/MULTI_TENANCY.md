# Multi-Tenancy Support

**Arango Typed** provides production-ready multi-tenancy support with automatic tenant filtering and Express middleware integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Automatic Tenant Filtering](#automatic-tenant-filtering)
- [Express Middleware](#express-middleware)
- [Tenant Context](#tenant-context)
- [Model Configuration](#model-configuration)
- [Isolation Strategies](#isolation-strategies)
- [Advanced Usage](#advanced-usage)
- [Performance Considerations](#performance-considerations)
- [Related Documentation](#related-documentation)

## Overview

Multi-tenancy in **Arango Typed** allows you to:

- ✅ **Automatic Filtering**: All queries automatically filter by tenant
- ✅ **Automatic Injection**: Tenant ID automatically injected on create
- ✅ **Express Integration**: Automatic tenant extraction from headers/query/JWT
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Performance**: Optimized for minimal overhead

## Quick Start

### 1. Enable Multi-tenancy on Model

```typescript
import { Schema, model } from 'arango-typed';

const userSchema = new Schema({
  name: String,
  email: String,
  tenantId: String  // Tenant field (optional: defaults to 'tenantId')
});

// Enable multi-tenancy
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'tenantId'  // Optional: defaults to 'tenantId'
});
```

### 2. Setup Express Middleware

```typescript
import express from 'express';
import { tenantMiddleware } from 'arango-typed/integrations/express';

const app = express();

// Extract tenant from header (default: 'x-tenant-id')
app.use(tenantMiddleware({ 
  extractFrom: 'header',
  headerName: 'x-tenant-id'
}));
```

### 3. Use in Routes

```typescript
app.get('/users', async (req, res) => {
  // Automatically filtered by tenant!
  const users = await User.find({});
  res.json(users);
});

app.post('/users', async (req, res) => {
  // Tenant ID automatically injected!
  const user = await User.create({
    name: req.body.name,
    email: req.body.email
    // tenantId is automatically added from TenantContext
  });
  res.json(user);
});
```

## Automatic Tenant Filtering

When `tenantEnabled: true`, all Model operations automatically filter by tenant:

### Find Operations

```typescript
// Automatically filters by tenant
const users = await User.find({ name: 'John' }).all();
// Only returns users for current tenant

// findOne also filtered
const user = await User.findOne({ email: 'john@example.com' });
// Only finds user if belongs to current tenant

// findById also filtered
const user = await User.findById('users/123');
// Returns null if document belongs to different tenant
```

### Create Operations

```typescript
// Tenant ID automatically injected
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
  // tenantId automatically added from TenantContext
});
```

### Update Operations

```typescript
// Automatically filters by tenant
await User.updateOne(
  { email: 'john@example.com' },
  { name: 'Jane Doe' }
);
// Only updates if document belongs to current tenant

// findOneAndUpdate also filtered
await User.findOneAndUpdate(
  { email: 'john@example.com' },
  { name: 'Jane Doe' }
);
```

### Delete Operations

```typescript
// Automatically filters by tenant
await User.deleteOne({ email: 'john@example.com' });
// Only deletes if document belongs to current tenant

// deleteMany also filtered
await User.deleteMany({ active: false });
// Only deletes documents for current tenant
```

### Count Operations

```typescript
// Automatically filters by tenant
const count = await User.count({ active: true });
// Only counts documents for current tenant
```

## Express Middleware

The `tenantMiddleware` automatically extracts tenant ID from various sources:

### From Header (Default)

```typescript
app.use(tenantMiddleware({ 
  extractFrom: 'header',
  headerName: 'x-tenant-id'  // Default
}));
```

**Usage:**
```bash
curl -H "x-tenant-id: tenant-123" http://localhost:3000/users
```

### From Query Parameter

```typescript
app.use(tenantMiddleware({ 
  extractFrom: 'query',
  queryParam: 'tenant'  // Default
}));
```

**Usage:**
```bash
curl http://localhost:3000/users?tenant=tenant-123
```

### From Route Parameter

```typescript
app.use('/api/:tenantId', tenantMiddleware({ 
  extractFrom: 'params',
  paramName: 'tenantId'
}));
```

**Usage:**
```bash
curl http://localhost:3000/api/tenant-123/users
```

### From JWT Token

```typescript
app.use(tenantMiddleware({ 
  extractFrom: 'jwt',
  field: 'tenantId',      // Field name in JWT payload
  jwtPath: 'user.tenantId' // Or nested path
}));
```

**Requires:** JWT middleware to set `req.user` or `req.auth`

```typescript
// Example with express-jwt
import jwt from 'express-jwt';

app.use(jwt({ secret: 'secret' })); // Sets req.user
app.use(tenantMiddleware({ 
  extractFrom: 'jwt',
  field: 'tenantId'
}));
```

### Custom Extractor

```typescript
app.use(tenantMiddleware({ 
  extractFrom: 'custom',
  customExtractor: (req) => {
    // Custom logic to extract tenant ID
    return req.headers['x-custom-tenant-id'] || null;
  }
}));
```

### Required Tenant

```typescript
app.use(tenantMiddleware({ 
  extractFrom: 'header',
  required: true  // Throws error if tenant not found
}));

// If tenant not found, returns 400 error:
// "Tenant ID is required but not found. Expected in header"
```

## Tenant Context

Tenant context is managed automatically by the middleware, but can be used manually:

### Manual Context Management

```typescript
import { TenantContext } from 'arango-typed';

// Set tenant
TenantContext.set('tenant-123');

// Get current tenant
const tenantId = TenantContext.get(); // 'tenant-123'

// Clear tenant
TenantContext.clear();

// Run with tenant context
await TenantContext.run('tenant-123', async () => {
  const users = await User.find({}); // Auto-filtered
  return users;
});
```

### Nested Contexts

```typescript
// Supports nested tenant contexts
TenantContext.set('tenant-1');
// ... some operations

TenantContext.set('tenant-2'); // Stack: ['tenant-1', 'tenant-2']
// ... operations use tenant-2

TenantContext.clear(); // Back to tenant-1
TenantContext.clear(); // No tenant
```

## Model Configuration

### Enable Multi-tenancy

```typescript
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'tenantId'  // Optional: field name for tenant ID
});
```

### Custom Tenant Field

```typescript
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'organizationId'  // Use custom field name
});
```

### Without Multi-tenancy

```typescript
// Regular model (no tenant filtering)
const User = model('users', userSchema);

// Or explicitly disabled
const User = model('users', userSchema, {
  tenantEnabled: false
});
```

## Isolation Strategies

### Collection-Level Isolation (Default)

Documents are isolated by `tenantId` field in the same collection:

```typescript
// All tenants share same collection
// Documents filtered by tenantId field
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'tenantId'
});

// Collection: users
// Document: { _id: 'users/1', name: 'John', tenantId: 'tenant-1' }
// Document: { _id: 'users/2', name: 'Jane', tenantId: 'tenant-2' }
```

**Benefits:**
- ✅ Simple to implement
- ✅ Efficient queries with indexes
- ✅ Easy to manage

**Setup Index:**
```typescript
userSchema.index('tenantId'); // Recommended for performance
```

### Database-Level Isolation (Future)

Isolate tenants in separate databases:

```typescript
import { TenantManager } from 'arango-typed';

const tenantManager = new TenantManager(db, {
  isolationMode: 'database',
  tenantField: 'tenantId'
});

// Get tenant-specific database
const tenantDb = await tenantManager.getTenantDatabase('tenant-123');
```

**Note:** Database-level isolation requires ArangoDB admin API and is more complex to implement.

## Advanced Usage

### Multiple Tenant Fields

```typescript
// Schema with multiple tenant fields
const userSchema = new Schema({
  organizationId: String,
  workspaceId: String,
  userId: String
});

// Filter by organization only
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'organizationId'
});
```

### Tenant Validation

```typescript
userSchema.pre('save', function(next) {
  if (this.tenantId && !TenantContext.get()) {
    throw new Error('Tenant context required');
  }
  next();
});
```

### Tenant-Specific Models

```typescript
// Create tenant-specific model instance
function getTenantModel(tenantId: string) {
  TenantContext.set(tenantId);
  return model('users', userSchema, {
    tenantEnabled: true,
    connection: getDatabase()
  });
}

// Use
const tenantUserModel = getTenantModel('tenant-123');
const users = await tenantUserModel.find({}).all();
```

### Batch Operations

```typescript
// Create multiple documents - all get same tenant ID
const users = await User.create([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' }
]);
// Both get tenantId from TenantContext
```

### Query Without Tenant Filter

```typescript
// If you need to query across tenants (admin operations)
// Use a model without tenantEnabled
const AdminUser = model('users', userSchema, {
  tenantEnabled: false
});

// Or temporarily clear tenant context
TenantContext.clear();
const allUsers = await User.find({}).all();
```

## Performance Considerations

### Indexes

**Always index the tenant field for performance:**

```typescript
const userSchema = new Schema({
  tenantId: String,
  name: String,
  email: String
});

// Single field index
userSchema.index('tenantId');

// Composite index (tenant + query field)
userSchema.index(['tenantId', 'email']); // For queries like: { tenantId: 'X', email: 'Y' }
```

### Query Performance

```typescript
// ✅ Good: Indexed tenant field
userSchema.index('tenantId');
await User.find({ tenantId: 'tenant-123', name: 'John' });

// ✅ Better: Composite index
userSchema.index(['tenantId', 'name']);
await User.find({ tenantId: 'tenant-123', name: 'John' });
```

### Caching

Tenant-aware caching (if using cache):

```typescript
import { CacheManager } from 'arango-typed';

const cache = new CacheManager({
  strategy: 'memory',
  ttl: 3600
});

// Cache keys should include tenant ID
const cacheKey = `users:${tenantId}:${userId}`;
```

## Examples

### Complete Express Setup

```typescript
import express from 'express';
import { connect, Schema, model } from 'arango-typed';
import { tenantMiddleware } from 'arango-typed/integrations/express';

// Connect
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });

// Schema
const userSchema = new Schema({
  name: String,
  email: String,
  tenantId: String
});
userSchema.index('tenantId'); // Important!

// Model with tenant enabled
const User = model('users', userSchema, { tenantEnabled: true });

// Express app
const app = express();
app.use(express.json());

// Tenant middleware (extracts from header)
app.use(tenantMiddleware({ extractFrom: 'header' }));

// Routes
app.get('/users', async (req, res) => {
  const users = await User.find({}).all(); // Auto-filtered!
  res.json(users);
});

app.post('/users', async (req, res) => {
  const user = await User.create(req.body); // Auto-tenant-injected!
  res.json(user);
});

app.listen(3000);
```

### Manual Tenant Context

```typescript
import { TenantContext } from 'arango-typed';
import { User } from './models/User';

// Set tenant context manually
await TenantContext.run('tenant-123', async () => {
  if (req.method === 'GET') {
    const users = await User.find({}).all(); // Auto-filtered
    return res.json(users);
  }
  
  if (req.method === 'POST') {
    const user = await User.create(req.body); // Auto-tenant-injected
    return res.json(user);
  }
});
```

## Related Documentation

- **[Connection Management](./CONNECTION.md)** - Database connections
- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Model configuration
- **[Queries](./QUERIES.md)** - Query operations with tenant filtering
- **[Express Integration](./EXPRESS.md)** - Express middleware setup
- **[Performance](./PERFORMANCE.md)** - Performance optimization with tenants

## API Reference

### `tenantMiddleware(options?)`

Express middleware for tenant extraction.

**Options:**
```typescript
interface TenantMiddlewareOptions {
  extractFrom?: 'header' | 'query' | 'params' | 'jwt' | 'custom';
  field?: string;              // Default: 'tenantId'
  headerName?: string;          // Default: 'x-tenant-id'
  queryParam?: string;          // Default: 'tenant'
  paramName?: string;          // Default: 'tenantId'
  jwtPath?: string;            // Nested path in JWT (e.g., 'user.tenantId')
  customExtractor?: (req) => string | null;
  required?: boolean;           // Default: false
}
```

### `TenantContext`

Static class for managing tenant context.

```typescript
class TenantContext {
  static set(tenantId: string): void
  static get(): string | null
  static clear(): void
  static async run<T>(tenantId: string, fn: () => Promise<T>): Promise<T>
}
```

### Model Options

```typescript
interface ModelOptions {
  tenantEnabled?: boolean;      // Enable multi-tenancy
  tenantField?: string;         // Field name (default: 'tenantId')
}
```

---

**Next:** Learn about [Express Integration](./EXPRESS.md) or [Performance Optimization](./PERFORMANCE.md)

