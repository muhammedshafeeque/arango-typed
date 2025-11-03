import { Database } from 'arangojs';
import * as fs from 'fs';

export interface ImportOptions {
  format?: 'json' | 'csv';
  overwrite?: boolean;
  validate?: boolean;
}

export class Importer {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Import data from file to collection
   */
  async importFile(
    filePath: string,
    collectionName: string,
    options: ImportOptions = {}
  ): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const format = options.format || this.detectFormat(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    let data: any[];

    if (format === 'json') {
      data = JSON.parse(content);
    } else if (format === 'csv') {
      data = this.fromCSV(content);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    // Validate if requested
    if (options.validate) {
      this.validateData(data);
    }

    // Import to collection
    await this.importData(collectionName, data, options.overwrite);
  }

  /**
   * Import data array
   */
  async importData(
    collectionName: string,
    data: any[],
    overwrite: boolean = false
  ): Promise<void> {
    const collection = this.database.collection(collectionName);
    const exists = await collection.exists();

    if (!exists) {
      await collection.create();
    }

    if (overwrite) {
      // Clear collection first
      await collection.truncate();
    }

    // Import in batches
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await collection.import(batch);
    }
  }

  /**
   * Detect file format
   */
  private detectFormat(filePath: string): 'json' | 'csv' {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext === 'csv' ? 'csv' : 'json';
  }

  /**
   * Parse CSV to array of objects
   */
  private fromCSV(content: string): any[] {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0]
      .split(',')
      .map((h) => h.replace(/^"|"$/g, '').trim());

    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  /**
   * Validate imported data
   */
  private validateData(data: any[]): void {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    // Basic validation - in production, you'd validate against schema
    for (const item of data) {
      if (typeof item !== 'object' || item === null) {
        throw new Error('All items must be objects');
      }
    }
  }
}


