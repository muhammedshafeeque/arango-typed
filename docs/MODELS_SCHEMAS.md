# Models & Schemas

This guide covers how to define schemas and work with models in Arango Typed with Mongoose-like API and performance optimizations.

## Table of Contents

- [Schema Definition](#schema-definition)
- [Mongoose-like Shorthand](#mongoose-like-shorthand)
- [Field Types](#field-types)
- [Validation](#validation)
- [Model Operations](#model-operations)
- [Performance](#performance)
- [Related Documentation](#related-documentation)

## Schema Definition

**Arango Typed** supports multiple schema definition formats:

### Basic Schema

```typescript
import { Schema } from 'arango-typed';

const userSchema = new Schema({
  name: String,
  email: String,
  age: Number,
  active: Boolean
});
```

## Mongoose-like Shorthand

**Arango Typed** supports Mongoose-style schema definitions:

```typescript
// Mongoose-like shorthand (Recommended)
const userSchema = new Schema({
  name: String,                    // Simple type
  email: String,                   // Simple type
  age: Number,                     // Simple type
  active: Boolean,                 // Simple type
  createdAt: Date                 // Simple type
});

// Mix of shorthand and options
const userSchema = new Schema({
  name: String,                    // Shorthand
  email: {                         // Full definition
    type: String,
    required: true,
    unique: true
  },
  age: { type: Number, min: 0, max: 150 },  // Mixed
  active: Boolean,                  // Shorthand
  createdAt: { type: Date, default: () => new Date() }
});

// All supported shorthand types:
const schema = new Schema({
  name: String,      // 'String'
  age: Number,       // 'Number'
  active: Boolean,   // 'Boolean'
  date: Date,        // 'Date'
  tags: Array,       // 'Array'
  meta: Object       // 'Object'
});
```

### Schema with Options

```typescript
const userSchema = new Schema({
  name: {
    type: 'String',
    required: true,
    trim: true,
    minLength: 2,
    maxLength: 50
  },
  email: {
    type: 'String',
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Invalid email format'
    }
  },
  age: {
    type: 'Number',
    min: 0,
    max: 150
  },
  createdAt: {
    type: 'Date',
    default: () => new Date()
  }
});
```

## Field Types

### String

```typescript
{
  type: 'String',
  required: true,
  trim: true,
  lowercase: true,
  uppercase: true,
  enum: ['option1', 'option2'],
  minLength: 1,
  maxLength: 100
}
```

### Number

```typescript
{
  type: 'Number',
  required: true,
  min: 0,
  max: 100,
  default: 0
}
```

### Boolean

```typescript
{
  type: 'Boolean',
  default: false
}
```

### Date

```typescript
{
  type: 'Date',
  default: () => new Date()
}
```

### Array

```typescript
{
  type: 'Array',
  of: 'String', // Array of strings
  default: []
}
```

### Object

```typescript
{
  type: 'Object',
  schema: {
    street: String,
    city: String,
    zip: Number
  }
}
```

### Mixed (Any)

```typescript
{
  type: 'Mixed'
}
```

## Indexes

### Primary Index

Automatically created on `_key`.

### Unique Index

```typescript
const schema = new Schema({
  email: {
    type: 'String',
    unique: true // Creates unique index
  }
});
```

### TTL Index

```typescript
const schema = new Schema({
  expiresAt: {
    type: 'Date',
    ttl: true // Documents expire based on this field
  }
});
```

### Geo Index

```typescript
const schema = new Schema({
  location: {
    type: 'Array',
    geo: true // Creates geo index for [latitude, longitude]
  }
});
```

### Fulltext Index

```typescript
const schema = new Schema({
  content: {
    type: 'String',
    fulltext: true // Creates fulltext index
  }
});
```

## Virtual Fields

```typescript
const schema = new Schema({
  firstName: String,
  lastName: String
});

schema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Usage
const user = await User.create({ firstName: 'John', lastName: 'Doe' });
console.log(user.fullName); // "John Doe"
```

## Model Creation

```typescript
import { model } from 'arango-typed';

const User = model('users', userSchema);
```

## CRUD Operations

### Create

```typescript
// Single document
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Multiple documents
const users = await User.createMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);
```

### Read

```typescript
// Find all
const users = await User.find().all();

// Find with conditions
const activeUsers = await User.find({ active: true }).all();

// Find one
const user = await User.findOne({ email: 'john@example.com' });

// Find by ID
const user = await User.findById('users/123');

// Count
const count = await User.count({ active: true });
```

### Update

```typescript
// Update instance
await user.update({ age: 31 });

// Update many
await User.updateMany(
  { active: false },
  { $set: { active: true } }
);

// Find and update
const user = await User.findOneAndUpdate(
  { email: 'john@example.com' },
  { age: 31 }
);
```

### Delete

```typescript
// Delete instance
await user.remove();

// Delete one (Mongoose-like)
await User.deleteOne({ email: 'john@example.com' });

// Delete many
await User.deleteMany({ active: false });

// Find and delete
const user = await User.findOneAndDelete({ email: 'john@example.com' });
```

### Mongoose-like Methods

**New Methods** (Mongoose-inspired):

```typescript
// Update one document
await User.updateOne(
  { email: 'john@example.com' },
  { name: 'Jane Doe' },
  { upsert: true } // Optional: create if not exists
);

// Delete one document
await User.deleteOne({ email: 'john@example.com' });
```

These methods return the number of affected documents (0 or 1).

## Instance Methods

```typescript
const schema = new Schema({
  name: String,
  email: String
});

schema.methods.getDisplayName = function() {
  return `${this.name} <${this.email}>`;
};

// Usage
const user = await User.create({ name: 'John', email: 'john@example.com' });
console.log(user.getDisplayName()); // "John <john@example.com>"
```

## Static Methods

```typescript
schema.statics.findByEmail = function(email: string) {
  return this.findOne({ email });
};

// Usage
const user = await User.findByEmail('john@example.com');
```

## Hooks

See [Hooks Documentation](./HOOKS.md) for detailed information.

```typescript
schema.pre('save', async function() {
  // Before saving
});

schema.post('save', function() {
  // After saving
});
```

## Validation

### Synchronous Validation (Fast)

**Performance Feature:** Validators are compiled once and cached for faster validation.

```typescript
// Synchronous validation (faster, no async validators)
schema.validateSync(data);

// Automatic in Model.create() when possible
const user = await User.create(data); // Uses validateSync internally
```

**Benefits:**
- ⚡ Faster validation (compiled and cached)
- 💾 Reduced memory allocation
- 🚀 Significant speedup for repeated validations

### Asynchronous Validation

```typescript
// Async validation (supports async custom validators)
await schema.validate(data);
```

### Built-in Validators

- `required` - Field is required
- `min` / `max` - Number range
- `minLength` / `maxLength` - String length
- `enum` - Value must be in array
- `match` - String must match regex

### Custom Validators

```typescript
{
  email: {
    type: 'String',
    validate: {
      validator: (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Invalid email format'
    }
  }
}
```

**See:** [Performance](./PERFORMANCE.md) for validation optimization details.

## Performance

### Compiled Validators

Validators are automatically compiled and cached:

```typescript
// First call - compiles validator
schema.validateSync({ name: 'John' });

// Subsequent calls - uses cached validator (fast!)
schema.validateSync({ name: 'Jane' });
```

### Direct DB Access

When hooks aren't needed, **Arango Typed** automatically uses direct database access for better performance:

```typescript
// No hooks defined - uses direct DB access (fast!)
const user = await User.create({ name: 'John' });

// Hooks defined - uses Document wrapper (slightly slower)
schema.pre('save', async function() { /* ... */ });
const user = await User.create({ name: 'John' });
```

**See:** [Performance](./PERFORMANCE.md) for optimization details.

## Multi-tenancy

Enable automatic tenant filtering:

```typescript
const User = model('users', userSchema, {
  tenantEnabled: true,
  tenantField: 'tenantId'
});

// All operations automatically filter by tenant
await User.find({}); // Only returns documents for current tenant
```

**See:** [Multi-tenancy](./MULTI_TENANCY.md) for complete guide.

## TypeScript Types

For better type safety:

```typescript
interface UserDoc {
  name: string;
  email: string;
  age: number;
  active: boolean;
  createdAt: Date;
}

const User = model<UserDoc>('users', userSchema);

// Now fully typed!
const user: UserDoc = await User.findById('123');
```

## Related Documentation

- **[Connection Management](./CONNECTION.md)** - Database connections
- **[Queries](./QUERIES.md)** - Query operations
- **[Multi-tenancy](./MULTI_TENANCY.md)** - Automatic tenant filtering
- **[Performance](./PERFORMANCE.md)** - Performance optimizations
- **[Express Integration](./EXPRESS.md)** - Express.js integration

