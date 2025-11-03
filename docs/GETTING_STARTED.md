# Getting Started

Welcome to **Arango Typed**! This guide will help you get started with the library.

## Installation

```bash
npm install arango-typed arangojs
```

## Prerequisites

- Node.js >= 16.0.0
- TypeScript >= 5.0.0 (recommended)
- ArangoDB server running (local or remote)

## Quick Start

### 1. Connect to ArangoDB

**Arango Typed** supports multiple connection formats (Mongoose-like API):

```typescript
import { connect, getDatabase } from 'arango-typed';

// Method 1: Mongoose-like string format (Recommended)
await connect('http://localhost:8529/myapp', { 
  username: 'root', 
  password: '' 
});

// Method 2: Simplified object format
await connect({
  url: 'http://localhost:8529',
  database: 'myapp',
  username: 'root',
  password: ''
});

// Method 3: Full options (backward compatible)
await connect({
  url: 'http://localhost:8529',
  databaseName: 'myapp',
  auth: {
    username: 'root',
    password: ''
  }
});

const db = getDatabase();
```

**Note:** Connections are automatically cached for performance. See [Connection Management](./CONNECTION.md) for details.

### 2. Define a Schema

**Arango Typed** supports Mongoose-like schema definitions:

```typescript
import { Schema } from 'arango-typed';

// Method 1: Mongoose-like shorthand (Recommended)
const userSchema = new Schema({
  name: String,                    // Simple shorthand
  email: { type: String, required: true, unique: true },  // With options
  age: Number,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() }
});

// Method 2: Full definition (backward compatible)
const userSchema = new Schema({
  name: { type: 'String', required: true },
  email: { type: 'String', required: true, unique: true },
  age: { type: 'Number', min: 0, max: 150 },
  active: { type: 'Boolean', default: true },
  createdAt: { type: 'Date', default: () => new Date() }
});
```

**See:** [Models & Schemas](./MODELS_SCHEMAS.md) for detailed schema options.

### 3. Create a Model

```typescript
import { model } from 'arango-typed';

const User = model('users', userSchema);
```

### 4. Use the Model

```typescript
// Create a document
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Find documents
const users = await User.find({ age: { $gte: 18 } }).all();

// Find by ID
const foundUser = await User.findById(user._id);

// Update
await user.update({ age: 31 });

// Delete
await user.remove();
```

## TypeScript Support

Arango Typed is fully typed. Define interfaces for better type safety:

```typescript
interface UserDoc {
  name: string;
  email: string;
  age: number;
  active: boolean;
  createdAt: Date;
}

const User = model<UserDoc>('users', userSchema);

// Now TypeScript knows the structure!
const user: UserDoc = await User.findById('123');
console.log(user.name); // ✅ Type-safe
```

## Next Steps

- **[Connection Management](./CONNECTION.md)** - Detailed connection setup and Mongoose-like API
- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Learn about schema definitions and Mongoose-like shorthand
- **[Queries](./QUERIES.md)** - Build complex queries with automatic caching
- **[Multi-tenancy](./MULTI_TENANCY.md)** - Automatic tenant filtering and Express middleware
- **[Performance](./PERFORMANCE.md)** - Performance optimizations and best practices
- **[Express Integration](./EXPRESS.md)** - Express.js middleware and routes

## Configuration Options

```typescript
await connect({
  url: 'http://localhost:8529',
  databaseName: 'myapp',
  auth: {
    username: 'root',
    password: ''
  },
  // Optional: Connection pooling
  poolSize: 10,
  // Optional: Retry strategy
  retryStrategy: {
    maxRetries: 3,
    retryDelay: 1000
  },
  // Optional: Circuit breaker
  circuitBreaker: {
    threshold: 5,
    timeout: 5000
  }
});
```

## Environment Variables

Use environment variables for configuration:

```typescript
await connect({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'myapp',
  auth: {
    username: process.env.ARANGO_USER || 'root',
    password: process.env.ARANGO_PASS || ''
  }
});
```

## Common Issues

### Connection Errors

```typescript
try {
  await connect({ /* config */ });
} catch (error) {
  console.error('Failed to connect:', error);
  // Check: Is ArangoDB running? Are credentials correct?
}
```

### Type Errors

Make sure TypeScript is properly configured:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Examples

Examples are provided throughout the documentation:
- [Express Integration](./EXPRESS.md) - Express.js setup and usage
- [LangChain Integration](./LANGCHAIN.md) - RAG and MCP setup
- [Multi-tenancy](./MULTI_TENANCY.md) - Multi-tenant application examples

