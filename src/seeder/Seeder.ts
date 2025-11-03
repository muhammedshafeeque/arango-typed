import { Database } from 'arangojs';
import * as fs from 'fs';
import * as path from 'path';

export interface SeedData {
  collection: string;
  data: any[];
}

export interface SeedFile {
  name: string;
  data: SeedData[];
  dependencies?: string[];
}

export class Seeder {
  private database: Database;
  private seedsDir: string;

  constructor(database: Database, seedsDir: string = 'seeds') {
    this.database = database;
    this.seedsDir = seedsDir;
  }

  /**
   * Seed database from file
   */
  async seed(seedFile: string, options: { force?: boolean } = {}): Promise<void> {
    const filePath = path.join(this.seedsDir, seedFile);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Seed file not found: ${filePath}`);
    }

    // Check if already executed
    if (!options.force && await this.isExecuted(seedFile)) {
      console.log(`Seed "${seedFile}" already executed, skipping...`);
      return;
    }

    // Load seed file
    const content = fs.readFileSync(filePath, 'utf-8');
    const seedFileData: SeedFile = JSON.parse(content);

    // Check dependencies
    if (seedFileData.dependencies) {
      for (const dep of seedFileData.dependencies) {
        if (!(await this.isExecuted(dep))) {
          throw new Error(`Dependency "${dep}" not executed. Run it first.`);
        }
      }
    }

    // Execute seed data
    for (const seedData of seedFileData.data) {
      await this.insertSeedData(seedData);
    }

    // Mark as executed
    await this.markExecuted(seedFile);
    console.log(`✓ Seed "${seedFile}" executed successfully`);
  }

  /**
   * Seed all files in seeds directory
   */
  async seedAll(options: { force?: boolean } = {}): Promise<void> {
    if (!fs.existsSync(this.seedsDir)) {
      console.warn(`Seeds directory not found: ${this.seedsDir}`);
      return;
    }

    const files = fs.readdirSync(this.seedsDir)
      .filter((file) => file.endsWith('.json'))
      .sort();

    for (const file of files) {
      await this.seed(file, options);
    }
  }

  /**
   * Rollback seed
   */
  async rollback(seedFile: string): Promise<void> {
    // Implementation would depend on seed structure
    // For now, just remove execution record
    await this.removeExecution(seedFile);
    console.log(`✓ Seed "${seedFile}" rolled back`);
  }

  /**
   * Insert seed data into collection
   */
  private async insertSeedData(seedData: SeedData): Promise<void> {
    const collection = this.database.collection(seedData.collection);
    const exists = await collection.exists();

    if (!exists) {
      await collection.create();
    }

    // Insert documents
    if (seedData.data.length > 0) {
      await collection.import(seedData.data);
    }
  }

  /**
   * Check if seed is executed
   */
  private async isExecuted(seedFile: string): Promise<boolean> {
    await this.ensureExecutionCollection();
    
    const cursor = await this.database.query(
      'FOR s IN _seeds FILTER s.name == @name RETURN s',
      { name: seedFile }
    );

    const results = await cursor.all();
    return results.length > 0;
  }

  /**
   * Mark seed as executed
   */
  private async markExecuted(seedFile: string): Promise<void> {
    await this.ensureExecutionCollection();
    
    const collection = this.database.collection('_seeds');
    await collection.save({
      name: seedFile,
      executedAt: new Date(),
    });
  }

  /**
   * Remove execution record
   */
  private async removeExecution(seedFile: string): Promise<void> {
    await this.ensureExecutionCollection();
    
    const cursor = await this.database.query(
      'FOR s IN _seeds FILTER s.name == @name RETURN s._key',
      { name: seedFile }
    );

    const results = await cursor.all();
    if (results.length > 0) {
      const collection = this.database.collection('_seeds');
      await collection.remove(results[0]);
    }
  }

  /**
   * Ensure execution collection exists
   */
  private async ensureExecutionCollection(): Promise<void> {
    const collection = this.database.collection('_seeds');
    const exists = await collection.exists();

    if (!exists) {
      await collection.create();
      
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['name'],
        unique: true,
      });
    }
  }
}

