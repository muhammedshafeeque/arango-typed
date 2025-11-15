# Audit Functionality

**Arango Typed** provides comprehensive audit functionality to track all changes to your documents, including who made the changes and when.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Audit Context](#audit-context)
- [Model Configuration](#model-configuration)
- [Automatic Audit Fields](#automatic-audit-fields)
- [Audit Logging](#audit-logging)
- [Retrieving Audit Logs](#retrieving-audit-logs)
- [Integration with Other Features](#integration-with-other-features)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Related Documentation](#related-documentation)

## Overview

Audit functionality in **Arango Typed** allows you to:

- ✅ **Automatic Tracking**: Automatically track who created, updated, or deleted documents
- ✅ **Timestamp Tracking**: Automatic timestamps for all operations
- ✅ **Change History**: Complete audit log with before/after states
- ✅ **User Context**: Easy user context management
- ✅ **Query Audit Logs**: Query audit logs by document, user, or action
- ✅ **Multi-tenancy Support**: Works seamlessly with multi-tenancy
- ✅ **Soft Delete Support**: Tracks deletion with soft delete

## Quick Start

### 1. Enable Audit on Model

```typescript
import { Schema, model } from 'arango-typed';

const userSchema = new Schema({
  name: String,
  email: String
});

// Enable audit
const User = model('users', userSchema, {
  auditEnabled: true
});
```

### 2. Set User Context

```typescript
import { AuditContext } from 'arango-typed';

// Set current user
AuditContext.set('user123', { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' });
```

### 3. Use the Model

```typescript
// Create - automatically adds createdBy, createdAt, updatedBy, updatedAt
const user = await User.create({ name: 'John', email: 'john@example.com' });
// user.createdBy = 'user123'
// user.createdAt = Date
// user.updatedBy = 'user123'
// user.updatedAt = Date

// Update - automatically updates updatedBy, updatedAt and logs changes
await user.update({ name: 'Jane' });
// user.updatedBy = 'user123'
// user.updatedAt = Date

// Get audit logs
const logs = await User.getAuditLogs(user._id);
```

## Audit Context

The `AuditContext` manages the current user context for audit logging.

### Setting User Context

```typescript
import { AuditContext } from 'arango-typed';

// Set current user
AuditContext.set('user123');

// Set user with metadata
AuditContext.set('user123', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  requestId: 'req-123'
});
```

### Getting Current User

```typescript
const userId = AuditContext.get(); // Returns 'user123' or null
const metadata = AuditContext.getMetadata(); // Returns metadata object or null
```

### Clearing Context

```typescript
AuditContext.clear(); // Clear user context
```

### Running with Context

```typescript
// Run a function with specific user context
await AuditContext.run('user123', async () => {
  const user = await User.create({ name: 'John' });
  // user.createdBy = 'user123'
  return user;
});
```

### Express Integration

```typescript
import express from 'express';
import { AuditContext } from 'arango-typed';

const app = express();

// Middleware to set audit context from request
app.use((req, res, next) => {
  const userId = req.user?.id || req.headers['x-user-id'];
  if (userId) {
    AuditContext.set(userId, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });
  }
  next();
});

app.post('/users', async (req, res) => {
  // Audit context is automatically set
  const user = await User.create(req.body);
  res.json(user);
});
```

## Model Configuration

### Enable Audit

```typescript
const User = model('users', userSchema, {
  auditEnabled: true
});
```

### Custom Audit Field Names

```typescript
const User = model('users', userSchema, {
  auditEnabled: true,
  auditFields: {
    createdBy: 'createdBy',
    createdAt: 'createdAt',
    updatedBy: 'lastModifiedBy',
    updatedAt: 'lastModifiedAt',
    deletedBy: 'deletedBy',
    deletedAt: 'deletedAt'
  }
});
```

### Custom Audit Log Collection

```typescript
const User = model('users', userSchema, {
  auditEnabled: true,
  auditLogCollection: 'user_audit_logs' // Default: '_audit'
});
```

## Automatic Audit Fields

When audit is enabled, documents automatically get the following fields:

### Creation Fields

- `createdBy` - User ID who created the document
- `createdAt` - Timestamp when document was created
- `updatedBy` - User ID who last updated (set on creation)
- `updatedAt` - Timestamp of last update (set on creation)

### Update Fields

- `updatedBy` - User ID who last updated the document
- `updatedAt` - Timestamp of last update

### Deletion Fields (with Soft Delete)

- `deletedBy` - User ID who deleted the document
- `deletedAt` - Timestamp when document was deleted

### Example

```typescript
// Create document
const user = await User.create({ name: 'John' });
console.log(user.createdBy); // 'user123'
console.log(user.createdAt); // Date object
console.log(user.updatedBy); // 'user123'
console.log(user.updatedAt); // Date object

// Update document
await user.update({ name: 'Jane' });
console.log(user.updatedBy); // 'user123' (or new user if context changed)
console.log(user.updatedAt); // New Date object

// Soft delete (if enabled)
await user.remove();
console.log(user.deletedBy); // 'user123'
console.log(user.deletedAt); // Date object
```

## Audit Logging

All operations are automatically logged to the audit log collection:

### Create Operations

```typescript
const user = await User.create({ name: 'John' });
// Logs: { action: 'create', documentId: 'users/123', after: {...}, userId: 'user123' }
```

### Update Operations

```typescript
const before = user.toObject();
await user.update({ name: 'Jane' });
// Logs: { action: 'update', documentId: 'users/123', before: {...}, after: {...}, userId: 'user123' }
```

### Delete Operations

```typescript
await user.remove();
// Logs: { action: 'delete', documentId: 'users/123', before: {...}, userId: 'user123' }
```

## Retrieving Audit Logs

### Get Audit Logs for a Document

```typescript
// Get all audit logs for a document
const logs = await User.getAuditLogs('users/123');

// Get limited number of logs
const recentLogs = await User.getAuditLogs('users/123', 10);
```

### Get Audit Logs by User

```typescript
// Get all audit logs for a user
const userLogs = await User.getAuditLogsByUser('user123');

// Get limited number of logs
const recentUserLogs = await User.getAuditLogsByUser('user123', 50);
```

### Get Audit Logs by Action

```typescript
// Get all create operations
const createLogs = await User.getAuditLogsByAction('create');

// Get all update operations
const updateLogs = await User.getAuditLogsByAction('update');

// Get all delete operations
const deleteLogs = await User.getAuditLogsByAction('delete');

// With limit
const recentDeletes = await User.getAuditLogsByAction('delete', 20);
```

### Audit Log Entry Structure

```typescript
interface AuditEntry {
  action: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  documentKey?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

## Integration with Other Features

### Multi-tenancy

Audit works seamlessly with multi-tenancy:

```typescript
const User = model('users', userSchema, {
  tenantEnabled: true,
  auditEnabled: true
});

// Audit logs include tenant information in metadata
AuditContext.set('user123', { tenantId: 'tenant-1' });
const user = await User.create({ name: 'John' });
```

### Soft Delete

Audit tracks soft deletes:

```typescript
const User = model('users', userSchema, {
  softDeleteEnabled: true,
  auditEnabled: true
});

const user = await User.create({ name: 'John' });
await user.remove(); // Soft delete

// Audit log includes deletion
const logs = await User.getAuditLogs(user._id);
// logs includes: { action: 'delete', before: {...}, after: {...} }
```

## Advanced Usage

### Custom Audit Metadata

```typescript
// Set metadata with user context
AuditContext.set('user123', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  requestId: 'req-123',
  feature: 'user-management'
});

// Metadata is included in audit logs
const user = await User.create({ name: 'John' });
const logs = await User.getAuditLogs(user._id);
// logs[0].metadata = { ip: '192.168.1.1', ... }
```

### Manual Audit Logging

```typescript
// Manually log an audit entry
await User.logAudit('update', 'users/123', '123', beforeState, afterState);
```

### Query Audit Logs Directly

```typescript
import { AuditLog } from 'arango-typed';
import { getDatabase } from 'arango-typed';

const db = getDatabase();
const auditLog = new AuditLog(db, '_audit');

// Get logs for document
const logs = await auditLog.getLogs('users/123');

// Get logs by user
const userLogs = await auditLog.getLogsByUser('user123');

// Get logs by action
const createLogs = await auditLog.getLogsByAction('create');
```

## Best Practices

### 1. Always Set User Context

```typescript
// In Express middleware
app.use((req, res, next) => {
  const userId = req.user?.id;
  if (userId) {
    AuditContext.set(userId, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }
  next();
});
```

### 2. Use Indexes on Audit Collection

The audit log collection automatically creates indexes on:
- `documentId`
- `userId`
- `action`
- `timestamp`

### 3. Regular Cleanup

```typescript
// Clean up old audit logs periodically
const oldDate = new Date();
oldDate.setMonth(oldDate.getMonth() - 6); // 6 months ago

const query = `
  FOR log IN _audit
  FILTER log.timestamp < @oldDate
  REMOVE log IN _audit
`;

await db.query(query, { oldDate });
```

### 4. Monitor Audit Log Size

```typescript
// Check audit log collection size
const auditCollection = db.collection('_audit');
const count = await auditCollection.count();
console.log(`Audit logs: ${count}`);
```

## Related Documentation

- **[Models & Schemas](./MODELS_SCHEMAS.md)** - Model configuration
- **[Multi-tenancy](./MULTI_TENANCY.md)** - Multi-tenancy support
- **[Soft Delete](./MODELS_SCHEMAS.md#soft-delete)** - Soft delete functionality
- **[Express Integration](./EXPRESS.md)** - Express.js integration

## API Reference

### `AuditContext`

Static class for managing audit context.

```typescript
class AuditContext {
  static set(userId: string | null, metadata?: Record<string, any>): void
  static get(): string | null
  static getMetadata(): Record<string, any> | null
  static clear(): void
  static async run<T>(userId: string | null, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T>
}
```

### Model Options

```typescript
interface ModelOptions {
  auditEnabled?: boolean;
  auditFields?: {
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
    deletedBy?: string;
    deletedAt?: string;
  };
  auditLogCollection?: string;
}
```

### Model Methods

```typescript
// Get audit logs for a document
async getAuditLogs(documentId: string, limit?: number): Promise<AuditEntry[]>

// Get audit logs by user
async getAuditLogsByUser(userId: string, limit?: number): Promise<AuditEntry[]>

// Get audit logs by action
async getAuditLogsByAction(action: 'create' | 'update' | 'delete', limit?: number): Promise<AuditEntry[]>
```

---

**Next:** Learn about [Multi-tenancy](./MULTI_TENANCY.md) or [Soft Delete](./MODELS_SCHEMAS.md#soft-delete)

