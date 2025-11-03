# Express.js Integration

Complete guide for using Arango Typed with Express.js, including multi-tenancy support and middleware.

## Installation

```bash
npm install arango-typed express
```

## Basic Setup

```typescript
import express from 'express';
import { connect, getDatabase } from 'arango-typed';
import { arangoMiddleware, createArangoRoutes } from 'arango-typed';

// Connect to ArangoDB
await connect({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'myapp',
  auth: {
    username: process.env.ARANGO_USER || 'root',
    password: process.env.ARANGO_PASS || ''
  }
});

const db = getDatabase();

// Create Express app
const app = express();
app.use(express.json());

// Add ArangoDB middleware
app.use(arangoMiddleware({
  database: db,
  autoAttach: true
}));

// Your routes now have req.arango available
app.get('/users', async (req, res) => {
  const users = await req.arango.query('users').all();
  res.json(users);
});

app.listen(3000);
```

## Middleware

### arangoMiddleware

Attaches ArangoDB to requests:

```typescript
import { arangoMiddleware } from 'arango-typed/integrations/express';

app.use(arangoMiddleware({
  database: db,
  cache: new CacheManager(),
  profiler: new Profiler(),
  logger: new Logger(),
  autoAttach: true
}));
```

### tenantMiddleware

**Multi-tenancy Support:** Automatically extracts tenant ID and enables automatic tenant filtering.

```typescript
import { tenantMiddleware } from 'arango-typed/integrations/express';

// Extract tenant from header (default)
app.use(tenantMiddleware({ 
  extractFrom: 'header',
  headerName: 'x-tenant-id'  // Default
}));

// Extract from query parameter
app.use(tenantMiddleware({ 
  extractFrom: 'query',
  queryParam: 'tenant'
}));

// Extract from route parameter
app.use('/api/:tenantId', tenantMiddleware({ 
  extractFrom: 'params',
  paramName: 'tenantId'
}));

// Extract from JWT token
app.use(tenantMiddleware({ 
  extractFrom: 'jwt',
  field: 'tenantId'
}));

// Custom extractor
app.use(tenantMiddleware({ 
  extractFrom: 'custom',
  customExtractor: (req) => req.headers['x-custom-tenant-id'] || null
}));
```

**Usage with Tenant-aware Models:**

```typescript
import { Schema, model } from 'arango-typed';

// Enable multi-tenancy on model
const User = model('users', userSchema, { tenantEnabled: true });

app.use(tenantMiddleware({ extractFrom: 'header' }));

app.get('/users', async (req, res) => {
  // Automatically filtered by tenant!
  const users = await User.find({}).all();
  res.json(users);
});
```

**See:** [Multi-tenancy](./MULTI_TENANCY.md) for complete guide.

### arangoRequestId

Adds request ID to requests:

```typescript
import { arangoRequestId } from 'arango-typed';
app.use(arangoRequestId);
```

### arangoProfiler

Profiles requests:

```typescript
import { arangoProfiler } from 'arango-typed';
app.use(arangoProfiler);
```

### arangoErrorHandler

Handles ArangoDB errors:

```typescript
import { arangoErrorHandler } from 'arango-typed';
app.use(arangoErrorHandler);
```

## Automatic Routes

Generate CRUD routes automatically:

```typescript
import { createArangoRoutes } from 'arango-typed';

const User = model('users', userSchema);
const Post = model('posts', postSchema);

const routes = createArangoRoutes({
  database: db,
  models: {
    users: User,
    posts: Post
  },
  prefix: '/api/arango'
});

app.use(routes);

// Available routes:
// GET    /api/arango/models/users
// GET    /api/arango/models/users/:id
// POST   /api/arango/models/users
// PUT    /api/arango/models/users/:id
// DELETE /api/arango/models/users/:id
```

## RAG Integration

```typescript
import { ArangoRAG } from 'arango-typed/integrations/langchain';

const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 5
});

app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  
  const context = await rag.retrieve(query);
  
  res.json({
    query,
    context: context.map(doc => doc.pageContent),
    count: context.length
  });
});
```

## Complete Example

### Basic Express Setup

```typescript
import express from 'express';
import { connect, Schema, model } from 'arango-typed';
import { 
  arangoMiddleware, 
  tenantMiddleware,
  arangoRequestId,
  arangoErrorHandler 
} from 'arango-typed/integrations/express';

// Connect (Mongoose-like API)
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

// Schema
const userSchema = new Schema({
  name: String,
  email: String,
  tenantId: String
});
userSchema.index('tenantId'); // Important for multi-tenancy!

// Model with tenant enabled
const User = model('users', userSchema, { tenantEnabled: true });

// Express app
const app = express();
app.use(express.json());

// Middleware
app.use(arangoRequestId);              // Request ID
app.use(tenantMiddleware({ extractFrom: 'header' })); // Tenant extraction
app.use(arangoMiddleware({ database: getDatabase() })); // ArangoDB
app.use(arangoErrorHandler);           // Error handling

// Routes
app.get('/users', async (req, res) => {
  const users = await User.find({}).all(); // Auto-filtered by tenant!
  res.json(users);
});

app.post('/users', async (req, res) => {
  const user = await User.create(req.body); // Auto-tenant-injected!
  res.json(user);
});

app.listen(3000);
```

See [LangChain Integration](./LANGCHAIN.md) for RAG and MCP integration with Express.js.

## Related Documentation

- **[Multi-tenancy](./MULTI_TENANCY.md)** - Complete multi-tenancy guide
- **[Connection Management](./CONNECTION.md)** - Database connections
- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Model configuration
- **[Queries](./QUERIES.md)** - Query operations
- **[Performance](./PERFORMANCE.md)** - Performance optimization

