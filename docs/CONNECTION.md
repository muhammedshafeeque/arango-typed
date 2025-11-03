# Connection Management

This guide covers connecting to ArangoDB using **Arango Typed** with Mongoose-like API and performance optimizations.

## Table of Contents

- [Quick Start](#quick-start)
- [Connection Methods](#connection-methods)
- [Mongoose-like API](#mongoose-like-api)
- [Connection Caching](#connection-caching)
- [Connection Options](#connection-options)
- [Multiple Connections](#multiple-connections)
- [Performance Tips](#performance-tips)
- [Related Documentation](#related-documentation)

## Quick Start

The simplest way to connect:

```typescript
import { connect, getDatabase } from 'arango-typed';

// Mongoose-like string format
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

// Or object format
await connect({
  url: 'http://localhost:8529',
  database: 'myapp',
  username: 'root',
  password: ''
});

const db = getDatabase();
```

## Connection Methods

### Method 1: Mongoose-like String Format

```typescript
// Format: 'http://host:port/database'
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});
```

**Benefits:**
- ✅ Familiar to Mongoose users
- ✅ Concise and readable
- ✅ Database name in URL

### Method 2: Simplified Object Format

```typescript
await connect({
  url: 'http://localhost:8529',
  database: 'myapp',        // or databaseName (backward compatible)
  username: 'root',
  password: ''
});
```

**Benefits:**
- ✅ Clean and explicit
- ✅ Easy to use with environment variables
- ✅ Supports all connection options

### Method 3: Full Options (Backward Compatible)

```typescript
await connect({
  url: 'http://localhost:8529',
  databaseName: 'myapp',    // Supports both 'database' and 'databaseName'
  auth: {
    username: 'root',
    password: ''
  },
  agent: customAgent,       // Optional: custom HTTP agent
  arangoVersion: 30800      // Optional: ArangoDB version
});
```

## Mongoose-like API

**Arango Typed** provides a Mongoose-inspired connection API for familiarity:

```typescript
// Mongoose-style string connection
await connect('mongodb://localhost:8529/myapp', { username: 'root', password: '' });

// Works with ArangoDB URLs too
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });
```

**URL Format:**
- `http://host:port/database` - Database included in URL
- `http://host:port` - Database specified separately

## Connection Caching

**Performance Feature:** Connections are automatically cached and reused for better performance.

### How It Works

```typescript
// First call - creates and caches connection
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });

// Subsequent calls - reuses cached connection
await connect('http://localhost:8529/myapp', { username: 'root', password: '' });

// Different credentials - creates new connection
await connect('http://localhost:8529/myapp', { username: 'admin', password: 'secret' });
```

**Cache Key:** Based on `url + database + username`

**Benefits:**
- ⚡ Faster subsequent connections
- 💾 Reduced memory usage
- 🔄 Automatic connection validation
- 🗑️ Stale connections automatically cleaned

### Cache Behavior

```typescript
// Connection is cached by these parameters:
// - URL (host + port)
// - Database name
// - Username

// Same parameters = cached connection
const db1 = await connect('http://localhost:8529/myapp', { username: 'root', password: '' });
const db2 = await connect('http://localhost:8529/myapp', { username: 'root', password: '' });
// db1 and db2 use the same cached connection

// Different username = new connection
const db3 = await connect('http://localhost:8529/myapp', { username: 'admin', password: '' });
// db3 uses a new connection
```

### Manual Cache Management

```typescript
import { Connection, getConnection } from 'arango-typed';

// Create connection explicitly
const connection = new Connection({
  url: 'http://localhost:8529',
  databaseName: 'myapp',
  auth: { username: 'root', password: '' }
});

// Connect (will be cached)
await connection.connect();

// Get cached connection
const cached = getConnection();
```

## Connection Options

### Basic Options

```typescript
interface ConnectionOptions {
  url: string | string[];           // ArangoDB URL(s) - supports cluster
  databaseName?: string;              // Database name
  database?: string;                  // Alias for databaseName (simplified API)
  auth?: {
    username: string;
    password: string;
  };
  username?: string;                  // Simplified: top-level username
  password?: string;                  // Simplified: top-level password
  agent?: any;                        // Custom HTTP agent
  arangoVersion?: number;             // ArangoDB version (e.g., 30800)
}
```

### Cluster Support

```typescript
// Multiple URLs for cluster
await connect({
  url: [
    'http://coordinator1:8529',
    'http://coordinator2:8529',
    'http://coordinator3:8529'
  ],
  databaseName: 'myapp',
  auth: { username: 'root', password: '' }
});
```

### Custom HTTP Agent

```typescript
import https from 'https';

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

await connect({
  url: 'https://secure-arango.example.com',
  databaseName: 'myapp',
  auth: { username: 'root', password: '' },
  agent
});
```

## Multiple Connections

For multi-tenant or multi-database applications:

```typescript
import { Connection } from 'arango-typed';

// Connection 1
const conn1 = new Connection({
  url: 'http://localhost:8529',
  databaseName: 'app1',
  auth: { username: 'root', password: '' }
});

// Connection 2
const conn2 = new Connection({
  url: 'http://localhost:8529',
  databaseName: 'app2',
  auth: { username: 'root', password: '' }
});

// Use different connections
const db1 = await conn1.connect();
const db2 = await conn2.connect();

// Models can use specific connections
const User = model('users', userSchema, { connection: db1 });
const Product = model('products', productSchema, { connection: db2 });
```

## Performance Tips

### 1. Reuse Connections

```typescript
// ✅ Good: Reuse connection
const db = getDatabase();
const User = model('users', userSchema, { connection: db });

// ❌ Avoid: Creating new connections for each request
// Don't do: await connect(...) in every request handler
```

### 2. Connection Pooling

Connections are automatically pooled and cached:

```typescript
// First connection
await connect({ /* config */ });

// Subsequent calls reuse cached connection
await connect({ /* same config */ }); // Cached!
```

### 3. Environment Variables

```typescript
// Use environment variables for configuration
await connect({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  database: process.env.ARANGO_DB || 'myapp',
  username: process.env.ARANGO_USER || 'root',
  password: process.env.ARANGO_PASS || ''
});
```

### 4. Connection Health Checks

```typescript
import { getConnection } from 'arango-typed';

const connection = getConnection();

// Check if connected
if (connection.isConnected()) {
  const db = connection.getDatabase();
  // Use database
}
```

## Error Handling

```typescript
import { ConnectionError } from 'arango-typed';

try {
  await connect({ /* config */ });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
    // Handle connection error
  }
}
```

## Connection Lifecycle

```typescript
import { Connection } from 'arango-typed';

const connection = new Connection({
  url: 'http://localhost:8529',
  databaseName: 'myapp',
  auth: { username: 'root', password: '' }
});

// Connect
await connection.connect();

// Use connection
const db = connection.getDatabase();

// Disconnect (clears cache)
await connection.disconnect();
```

## Examples

### Express.js Application

```typescript
import express from 'express';
import { connect, getDatabase } from 'arango-typed';

// Connect once at startup
await connect({
  url: process.env.ARANGO_URL,
  database: process.env.ARANGO_DB,
  username: process.env.ARANGO_USER,
  password: process.env.ARANGO_PASS
});

const app = express();

// Use in routes
app.get('/users', async (req, res) => {
  const db = getDatabase();
  // Use database...
});
```

### Express.js Application

```typescript
import express from 'express';
import { connect, getDatabase } from 'arango-typed';

// Connect once at startup
await connect({
  url: process.env.ARANGO_URL,
  database: process.env.ARANGO_DB,
  username: process.env.ARANGO_USER,
  password: process.env.ARANGO_PASS
});

const app = express();

// Use in routes
app.get('/users', async (req, res) => {
  const db = getDatabase();
  // Use database...
});
```

### TypeScript with Type Safety

```typescript
import { connect, getDatabase, Database } from 'arango-typed';

await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

const db: Database = getDatabase();
// TypeScript knows db is a Database instance
```

## Related Documentation

- **[Getting Started](./GETTING_STARTED.md)** - Installation and basic setup
- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Using models with connections
- **[Express Integration](./EXPRESS.md)** - Express middleware and connection setup
- **[Multi-tenancy](./MULTI_TENANCY.md)** - Multi-tenant connection strategies
- **[Performance](./PERFORMANCE.md)** - Connection performance optimization

## API Reference

### `connect(uriOrOptions, options?)`

Create a default connection.

**Parameters:**
- `uriOrOptions`: `string | ConnectionOptions | SimplifiedConnectionOptions`
  - String format: `'http://host:port/database'`
  - Object format: Connection options object
- `options?`: `{ username?: string; password?: string }` (only used with string format)

**Returns:** `Promise<Database>`

### `getConnection()`

Get the default connection instance.

**Returns:** `Connection`

**Throws:** `ConnectionError` if no connection exists

### `getDatabase()`

Get the default database instance.

**Returns:** `Database`

**Throws:** `ConnectionError` if no connection exists

### `Connection` Class

```typescript
class Connection {
  constructor(options: ConnectionOptions)
  async connect(): Promise<Database>
  getDatabase(): Database
  isConnected(): boolean
  async disconnect(): Promise<void>
  useDatabase(databaseName: string): Database
}
```

---

**Next:** Learn about [Models & Schemas](./MODELS_SCHEMAS.md) or [Queries](./QUERIES.md)

