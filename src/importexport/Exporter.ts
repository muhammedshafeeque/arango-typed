import { Database } from 'arangojs';
import * as fs from 'fs';

export interface ExportOptions {
  format?: 'json' | 'csv';
  collections?: string[];
  includeSchema?: boolean;
}

export class Exporter {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Export collection to file
   */
  async exportCollection(
    collectionName: string,
    filePath: string,
    options: ExportOptions = {}
  ): Promise<void> {
    const format = options.format || 'json';
    
    const cursor = await this.database.query(
      `FOR doc IN ${collectionName} RETURN doc`
    );
    
    const data = await cursor.all();

    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csv = this.toCSV(data);
      fs.writeFileSync(filePath, csv);
    }
  }

  /**
   * Export multiple collections
   */
  async exportCollections(
    collections: string[],
    outputDir: string,
    options: ExportOptions = {}
  ): Promise<void> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const collection of collections) {
      const filePath = `${outputDir}/${collection}.${options.format || 'json'}`;
      await this.exportCollection(collection, filePath, options);
    }
  }

  /**
   * Convert data to CSV
   */
  private toCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/"/g, '""');
      }).map((v) => `"${v}"`).join(',')
    );

    return [
      headers.map((h) => `"${h}"`).join(','),
      ...rows,
    ].join('\n');
  }
}

