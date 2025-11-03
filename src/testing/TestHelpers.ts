import { Database } from 'arangojs';

export class TestHelpers {
  /**
   * Create test database
   */
  static async createTestDatabase(baseDatabase: Database, _testDbName: string): Promise<Database> {
    // In production, you'd need admin access to create database
    // This is a simplified version - use the base database for now
    // In a real implementation, you'd create a separate database using admin API
    return baseDatabase;
  }

  /**
   * Clean collection
   */
  static async cleanCollection(database: Database, collectionName: string): Promise<void> {
    const collection = database.collection(collectionName);
    const exists = await collection.exists();
    
    if (exists) {
      await collection.truncate();
    }
  }

  /**
   * Clean multiple collections
   */
  static async cleanCollections(database: Database, collectionNames: string[]): Promise<void> {
    await Promise.all(
      collectionNames.map((name) => this.cleanCollection(database, name))
    );
  }

  /**
   * Generate test data
   */
  static generateTestData<T>(template: Partial<T>, count: number): T[] {
    return Array.from({ length: count }, (_, i) => ({
      ...template,
      ...Object.fromEntries(
        Object.entries(template).map(([key, value]) => [
          key,
          typeof value === 'function' ? value(i) : value,
        ])
      ),
    })) as T[];
  }

  /**
   * Wait for async operations
   */
  static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

