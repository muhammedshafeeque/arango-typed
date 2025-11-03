# Migrations

Arango Typed includes a migration system for managing database schema changes.

## Generating Migrations

```bash
# Using CLI
npx arango-typed migrate:create create_users_collection

# Or programmatically
import { MigrationGenerator } from 'arango-typed';

const generator = new MigrationGenerator('migrations');
await generator.generate('create_users_collection');
```

## Migration Structure

```typescript
import { Migration } from 'arango-typed';
import { Database } from 'arangojs';

export class CreateUsersCollection extends Migration {
  name = 'create_users_collection';
  version = '20240101120000';

  async up(db: Database): Promise<void> {
    // Create collection
    const collection = await db.createCollection('users', {
      type: 2 // Document collection
    });

    // Create indexes
    await collection.ensureIndex({
      type: 'persistent',
      fields: ['email'],
      unique: true
    });
  }

  async down(db: Database): Promise<void> {
    // Rollback: drop collection
    await db.collection('users').drop();
  }
}
```

## Running Migrations

```typescript
import { MigrationRunner } from 'arango-typed';

const runner = new MigrationRunner(db, 'migrations');

// Run all pending migrations
await runner.up();

// Run migrations up to specific version
await runner.up({ toVersion: '20240101120000' });

// Rollback last migration
await runner.down();

// Rollback to specific version
await runner.down({ toVersion: '20240101000000' });
```

## Migration Status

```typescript
const status = await runner.getStatus();
console.log(status.executed); // Array of executed migrations
console.log(status.pending);  // Array of pending migrations
```

## CLI Commands

```bash
# Create migration
npx arango-typed migrate:create <name>

# Run migrations
npx arango-typed migrate:up

# Rollback migrations
npx arango-typed migrate:down

# Check status
npx arango-typed migrate:status
```

