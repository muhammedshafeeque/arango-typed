# Arango Typed

> **ArangoDB ORM for TypeScript — Mongoose-like API, multi-tenancy, vector search, and OGM (graphs). Express-friendly and production-ready.**

[![npm version](https://img.shields.io/npm/v/arango-typed.svg)](https://www.npmjs.com/package/arango-typed)
[![npm downloads](https://img.shields.io/npm/dw/arango-typed.svg)](https://www.npmjs.com/package/arango-typed)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/stars/muhammedshafeeque/arango-typed?style=social)](https://github.com/muhammedshafeeque/arango-typed)

**Arango Typed** is a comprehensive, type-safe **ORM/ODM/OGM** (Object Relational/Document/Graph Mapper) for ArangoDB that provides:

- ✅ **Full TypeScript Support** - Type-safe from database to API
- ✅ **Express-friendly** - Designed for Express.js with Mongoose-like API, works great with any Node.js framework
- ✅ **Complete ORM/ODM/OGM Features** - Models, schemas, validations, hooks, relations, migrations, and awesome Object Graph Mapper with relationships, traversals, path queries, and graph algorithms
- ✅ **Graph Database Native** - First-class support for edges, vertices, relationships, and graph patterns
- ✅ **Vector Search & AI** - Built-in support for embeddings, RAG, and LangChain integration
- ✅ **Performance & Observability** - Caching, profiling, metrics, and query optimization

---

## 🚀 Quick Start

### Installation

```bash
npm install arango-typed arangojs
```

### Basic Usage

```typescript
import { connect, Schema, model } from 'arango-typed';

// Connect to ArangoDB (Mongoose-like API)
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

// Define Schema (Mongoose-like shorthand)
const userSchema = new Schema({
  name: String,                          // Simple shorthand
  email: { type: String, required: true, unique: true }, // With options
  age: Number,
  createdAt: { type: Date, default: () => new Date() }
});

// Create Model
const User = model('users', userSchema);

// Use the Model
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

console.log(user.name); // TypeScript knows this is a string!
```

### Multi-tenancy with Express

```typescript
import express from 'express';
import { tenantMiddleware } from 'arango-typed/integrations/express';

const app = express();

// Extract tenant from header
app.use(tenantMiddleware({ extractFrom: 'header' }));

// Enable multi-tenancy on model
const User = model('users', userSchema, { tenantEnabled: true });

// Automatically filtered by tenant!
app.get('/users', async (req, res) => {
  const users = await User.find({}); // Only current tenant's users
  res.json(users);
});
```

**See:** [Multi-tenancy Documentation](./docs/MULTI_TENANCY.md) for complete guide.

---

## 📚 Documentation

**📖 [Full HTML Documentation](https://muhammedshafeeque.github.io/arango-typed/)** - Beautiful, interactive documentation with examples and guides

### Core Features

- **[Getting Started](./docs/GETTING_STARTED.md)** - Installation and basic setup
- **[Models & Schemas](./docs/MODELS_SCHEMAS.md)** - Define and use data models
- **[Queries](./docs/QUERIES.md)** - Query builder and AQL generation
- **[Relations](./docs/RELATIONS.md)** - Relationships and population
- **[OGM (Object Graph Mapper)](./docs/OGM.md)** - **Awesome graph models with relationship access** ⭐
- **[Graph Database](./docs/GRAPH.md)** - Advanced edges, traversals, and graph algorithms
- **[Migrations](./docs/MIGRATIONS.md)** - Database migrations
- **[Hooks & Middleware](./docs/HOOKS.md)** - Lifecycle hooks and middleware

### Advanced Features

- **[Connection Management](./docs/CONNECTION.md)** - Mongoose-like connection API with caching ⭐
- **[Multi-tenancy](./docs/MULTI_TENANCY.md)** - Automatic tenant filtering and Express middleware ⭐
- **[Performance](./docs/PERFORMANCE.md)** - Query caching, compiled validators, and optimizations ⭐
- **[Vector Search](./docs/VECTOR_SEARCH.md)** - Embeddings and similarity search
- **[Caching](./docs/CACHING.md)** - Query result caching
- **[Observability](./docs/OBSERVABILITY.md)** - Profiling, logging, and metrics

### Integrations

- **[Express.js](./docs/EXPRESS.md)** - Express middleware, routes, and multi-tenancy
- **[LangChain Integration](./docs/LANGCHAIN.md)** - RAG and MCP support

### API Reference

- **[API Documentation](./docs/API.md)** - Complete API reference

---

## ✨ Key Features

### Type-Safe Development

```typescript
interface UserDoc {
  name: string;
  email: string;
  age: number;
}

const User = model<UserDoc>('users', userSchema);

// TypeScript knows the structure!
const user: UserDoc = await User.findById('123');
console.log(user.name); // ✅ Type-safe
```

### Express-friendly Integration

Designed to work seamlessly with Express.js:

```typescript
import express from 'express';
import { arangoMiddleware, tenantMiddleware } from 'arango-typed/integrations/express';

const app = express();

// ArangoDB middleware
app.use(arangoMiddleware({ database: db }));

// Multi-tenancy middleware
app.use(tenantMiddleware({ extractFrom: 'header' }));

// Works great with any Node.js framework too!
```

### Awesome OGM (Object Graph Mapper) Support

```typescript
import { GraphModel, graphModel, Graph, Edge } from 'arango-typed';

// Create a graph model (OGM pattern)
const UserGraph = graphModel(db, 'social_network', 'users', userSchema);

// OGM: Get connected vertices (like Neo4j OGM)
const friends = await UserGraph.getOutbound('users/alice', 'friends');
const followers = await UserGraph.getInbound('users/alice', 'follows');

// OGM: Create relationships
await UserGraph.createRelationship(
  'users/alice',
  'users/bob',
  'friends',
  { since: new Date(), weight: 1.0 }
);

// OGM: Get path between vertices
const path = await UserGraph.getPath('users/alice', 'users/charlie');

// Advanced: Graph traversals
const graph = new Graph(db, 'social_network');
const network = await graph.traverse({
  startVertex: 'users/alice',
  direction: 'outbound',
  depth: 3
});
```

### Vector Search & AI

```typescript
import { VectorSearch, ArangoRAG } from 'arango-typed';

// Vector similarity search
const results = await vectorSearch.similaritySearch(
  'documents',
  queryVector,
  { topK: 5 }
);

// RAG (Retrieval Augmented Generation)
const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents'
});
const context = await rag.retrieve(query);
```

### Complete ORM/ODM/OGM Features

A unified package combining document, relational, and graph capabilities:

- ✅ **Schema & Models** - Schema definition with validation, Model classes with CRUD operations
- ✅ **Query Builder** - Chainable AQL query builder with automatic caching
- ✅ **Relationships** - HasOne, HasMany, BelongsTo, BelongsToMany, Polymorphic relations
- ✅ **Graph Models (OGM)** - Graph models with relationship access (getOutbound, getInbound, getConnected)
- ✅ **Graph Operations** - Native edge/vertex management, graph traversals (BFS/DFS, depth control)
- ✅ **Path Queries** - Shortest path, all paths, k-shortest paths
- ✅ **Graph Algorithms** - PageRank, centrality, community detection
- ✅ **Hooks & Middleware** - Pre/post save, validate, init hooks
- ✅ **Virtual Fields** - Computed properties and virtual fields
- ✅ **Indexes** - Primary, unique, TTL, geo, fulltext indexes
- ✅ **Transactions** - ACID transactions and bulk operations
- ✅ **Migrations** - Up/down migrations with version control
- ✅ **Plugins** - Extensible plugins system
- ✅ **Performance** - Lean queries, query caching, compiled validators

---

## 🎯 Use Cases

- **Full-Stack Applications** - Type-safe database access for Node.js/TypeScript apps
- **Graph Applications** - Social networks, recommendation systems, knowledge graphs (with awesome OGM support!)
- **AI/ML Applications** - RAG systems, vector search, embedding storage
- **Knowledge Graphs** - Complex relationships with OGM patterns
- **Recommendation Systems** - Graph-based recommendations with path queries
- **Social Networks** - Friend networks, follows, connections with native graph support
- **Microservices** - Multi-tenant applications with connection pooling
- **API Development** - REST APIs with automatic CRUD routes
- **Real-time Applications** - Change streams and live queries

---

## 📦 Installation

```bash
# Core package
npm install arango-typed arangojs



---

## 🔧 Configuration

**Mongoose-like Connection API:**

```typescript
import { connect } from 'arango-typed';

// Method 1: String format (Recommended)
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

// Method 2: Object format
await connect({
  url: 'http://localhost:8529',
  database: 'myapp',
  username: 'root',
  password: ''
});

// Method 3: Full options (backward compatible)
await connect({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'myapp',
  auth: {
    username: process.env.ARANGO_USER || 'root',
    password: process.env.ARANGO_PASS || ''
  }
});
```

**Connections are automatically cached for performance!**

**See:** [Connection Management](./docs/CONNECTION.md) for detailed documentation.

---

## 📖 Examples

### Express.js Integration

```typescript
import express from 'express';
import { connect, model, Schema } from 'arango-typed';
import { arangoMiddleware, createArangoRoutes } from 'arango-typed';

await connect({ /* config */ });
const db = getDatabase();

const User = model('users', new Schema({
  name: String,
  email: String
}));

const app = express();
app.use(arangoMiddleware({ database: db }));
app.use(createArangoRoutes({
  database: db,
  models: { users: User }
}));

app.listen(3000);
```

### Graph Database

```typescript
import { Graph, Edge } from 'arango-typed';

// Create a graph
const graph = await Graph.create('social_network', {
  edges: [{
    collection: 'friends',
    from: ['users'],
    to: ['users']
  }]
});

// Add edges
await Edge.create('friends', {
  _from: 'users/alice',
  _to: 'users/bob',
  weight: 1.0
});

// Traverse graph
const path = await graph.shortestPath(
  'users/alice',
  'users/charlie'
);
```

### Vector Search

```typescript
import { VectorSearch } from 'arango-typed';

const vectorSearch = new VectorSearch(db);

// Store document with embedding
await vectorSearch.store('documents', {
  text: 'Hello world',
  embedding: [0.1, 0.2, 0.3, ...]
});

// Similarity search
const results = await vectorSearch.similaritySearch(
  'documents',
  queryVector,
  { topK: 5, scoreThreshold: 0.7 }
);
```

---



## 📄 License

MIT © [Muhammed shafeeque P](https://github.com/muhammedshafeeque)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

---

## 📞 Support

- **Documentation**: [Full Documentation](./docs/)
- **Issues**: [GitHub Issues](https://github.com/muhammedshafeeque/arango-typed/issues)
- **Discussions**: [GitHub Discussions](https://github.com/muhammedshafeeque/arango-typed/discussions)

---

## ⭐ Features Overview

| Feature | Status | Description |
|---------|--------|-------------|
| TypeScript | ✅ | Full type safety |
| ORM/ODM | ✅ | Mongoose-inspired API |
| **OGM** | ✅ | **Object Graph Mapper with relationship access** |
| Models & Schemas | ✅ | Document and graph models |
| Query Builder | ✅ | Chainable AQL builder |
| Relationships | ✅ | HasOne, HasMany, BelongsTo, etc. |
| Graph Support | ✅ | Edges, traversals, algorithms, path queries |
| Vector Search | ✅ | Embeddings and similarity |
| Migrations | ✅ | Up/down migrations |
| Caching | ✅ | In-memory and Redis |
| Observability | ✅ | Profiling, metrics, logging |
| Express Integration | ✅ | Express-friendly with middleware |
| LangChain | ✅ | RAG and MCP integration |

---

**Made with ❤️ for the ArangoDB community**
# arango-typed
