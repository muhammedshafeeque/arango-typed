import { Database } from 'arangojs';
import { Migration } from './Migration';

export interface MigrationRecord {
  _key?: string;
  _id?: string;
  name: string;
  version: string;
  timestamp: Date;
  description?: string;
  executedAt: Date;
}

export class MigrationStore {
  private database: Database;
  private collectionName: string = '_migrations';

  constructor(database: Database, collectionName?: string) {
    this.database = database;
    if (collectionName) {
      this.collectionName = collectionName;
    }
  }

  /**
   * Ensure migrations collection exists
   */
  async ensureCollection(): Promise<void> {
    const collection = this.database.collection(this.collectionName);
    const exists = await collection.exists();
    
    if (!exists) {
      await collection.create();
      
      // Create index on version for fast lookups
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['version'],
        unique: true,
      });
    }
  }

  /**
   * Get all executed migrations
   */
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureCollection();
    
    const cursor = await this.database.query(
      `FOR m IN ${this.collectionName} SORT m.version ASC RETURN m`
    );
    
    return await cursor.all();
  }

  /**
   * Check if migration is executed
   */
  async isExecuted(migration: Migration): Promise<boolean> {
    await this.ensureCollection();
    
    try {
      const cursor = await this.database.query(
        `FOR m IN ${this.collectionName} FILTER m.version == @version RETURN m`,
        { version: migration.version }
      );
      const results = await cursor.all();
      return results.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Mark migration as executed
   */
  async markExecuted(migration: Migration): Promise<void> {
    await this.ensureCollection();
    const collection = this.database.collection(this.collectionName);
    const metadata = migration.getMetadata();
    
    await collection.save({
      ...metadata,
      executedAt: new Date(),
    });
  }

  /**
   * Remove migration record (for rollback)
   */
  async removeMigration(migration: Migration): Promise<void> {
    await this.ensureCollection();
    
    const cursor = await this.database.query(
      `FOR m IN ${this.collectionName} FILTER m.version == @version RETURN m._key`,
      { version: migration.version }
    );
    
    const results = await cursor.all();
    if (results.length > 0) {
      const collection = this.database.collection(this.collectionName);
      await collection.remove(results[0]);
    }
  }

  /**
   * Get last executed migration
   */
  async getLastMigration(): Promise<MigrationRecord | null> {
    const migrations = await this.getExecutedMigrations();
    return migrations.length > 0 ? migrations[migrations.length - 1] : null;
  }
}

