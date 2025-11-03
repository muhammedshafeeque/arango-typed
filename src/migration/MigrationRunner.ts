import { Database } from 'arangojs';
import { Migration } from './Migration';
import { MigrationStore } from './MigrationStore';

export interface MigrationRunnerOptions {
  direction?: 'up' | 'down';
  toVersion?: string;
  dryRun?: boolean;
}

export class MigrationRunner {
  private database: Database;
  private store: MigrationStore;
  private migrations: Migration[];

  constructor(database: Database, migrations: Migration[], store?: MigrationStore) {
    this.database = database;
    this.migrations = migrations.sort((a, b) => a.version.localeCompare(b.version));
    this.store = store || new MigrationStore(database);
  }

  /**
   * Run all pending migrations
   */
  async up(options: MigrationRunnerOptions = {}): Promise<void> {
    const { dryRun = false } = options;
    const executed = await this.store.getExecutedMigrations();
    const executedVersions = new Set(executed.map((m) => m.version));
    
    const pending = this.migrations.filter((m) => !executedVersions.has(m.version));

    for (const migration of pending) {
      if (options.toVersion && migration.version > options.toVersion) {
        break;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would execute migration: ${migration.name} (${migration.version})`);
        continue;
      }

      try {
        console.log(`Running migration: ${migration.name} (${migration.version})`);
        await migration.up(this.database);
        await this.store.markExecuted(migration);
        console.log(`✓ Migration ${migration.version} completed`);
      } catch (error: any) {
        console.error(`✗ Migration ${migration.version} failed:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Rollback migrations
   */
  async down(options: MigrationRunnerOptions = {}): Promise<void> {
    const { dryRun = false } = options;
    const executed = await this.store.getExecutedMigrations();
    executed.sort((a, b) => b.version.localeCompare(a.version));

    const rollbackList = options.toVersion
      ? executed.filter((m) => m.version >= options.toVersion!)
      : executed.slice(0, 1); // Rollback last migration by default

    for (const record of rollbackList) {
      const migration = this.migrations.find((m) => m.version === record.version);
      
      if (!migration) {
        console.warn(`Migration ${record.version} not found in migration list`);
        continue;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would rollback migration: ${migration.name} (${migration.version})`);
        continue;
      }

      try {
        console.log(`Rolling back migration: ${migration.name} (${migration.version})`);
        await migration.down(this.database);
        await this.store.removeMigration(migration);
        console.log(`✓ Migration ${migration.version} rolled back`);
      } catch (error: any) {
        console.error(`✗ Rollback ${migration.version} failed:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<{
    executed: string[];
    pending: string[];
    total: number;
  }> {
    const executed = await this.store.getExecutedMigrations();
    const executedVersions = new Set(executed.map((m) => m.version));
    
    const pending = this.migrations
      .filter((m) => !executedVersions.has(m.version))
      .map((m) => `${m.version} - ${m.name}`);

    const executedList = executed.map((m) => `${m.version} - ${m.name}`);

    return {
      executed: executedList,
      pending,
      total: this.migrations.length,
    };
  }

  /**
   * Reset all migrations (dangerous!)
   */
  async reset(): Promise<void> {
    const executed = await this.store.getExecutedMigrations();
    executed.sort((a, b) => b.version.localeCompare(a.version));

    for (const record of executed) {
      const migration = this.migrations.find((m) => m.version === record.version);
      if (migration) {
        await migration.down(this.database);
        await this.store.removeMigration(migration);
      }
    }
  }
}

