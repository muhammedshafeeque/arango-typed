import * as fs from 'fs';
import * as path from 'path';

export interface MigrationTemplate {
  name: string;
  version: string;
  description?: string;
}

export class MigrationGenerator {
  private migrationsDir: string;

  constructor(migrationsDir: string = 'migrations') {
    this.migrationsDir = migrationsDir;
  }

  /**
   * Generate a new migration file
   */
  async generate(name: string, description?: string): Promise<string> {
    const version = this.generateVersion();
    const fileName = `${version}_${this.sanitizeName(name)}.ts`;
    const filePath = path.join(this.migrationsDir, fileName);

    // Ensure directory exists
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const template = this.getMigrationTemplate(name, version, description);
    fs.writeFileSync(filePath, template);

    return filePath;
  }

  /**
   * Generate version string (timestamp-based)
   */
  private generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Sanitize name for filename
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Get migration template
   */
  private getMigrationTemplate(name: string, version: string, description?: string): string {
    const className = this.toPascalCase(name);
    
    return `import { Migration } from 'arango-typed';
import { Database } from 'arangojs';

export class ${className} extends Migration {
  name = '${name}';
  version = '${version}';
  description = ${description ? `'${description}'` : 'undefined'};

  async up(db: Database): Promise<void> {
    // Implement migration logic here
    // Example:
    // const collection = db.collection('users');
    // await collection.ensureIndex({ type: 'persistent', fields: ['email'], unique: true });
  }

  async down(db: Database): Promise<void> {
    // Implement rollback logic here
    // Example:
    // const collection = db.collection('users');
    // const index = await collection.index('email');
    // if (index) await collection.dropIndex(index.id);
  }
}
`;
  }

  /**
   * Convert name to PascalCase
   */
  private toPascalCase(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}


