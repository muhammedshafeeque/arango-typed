import { Database } from 'arangojs';

export interface MigrationMetadata {
  name: string;
  version: string;
  timestamp: Date;
  description?: string;
}

export abstract class Migration {
  abstract name: string;
  abstract version: string;
  description?: string;

  /**
   * Run migration (up)
   */
  abstract up(db: Database): Promise<void>;

  /**
   * Rollback migration (down)
   */
  abstract down(db: Database): Promise<void>;

  /**
   * Get migration metadata
   */
  getMetadata(): MigrationMetadata {
    return {
      name: this.name,
      version: this.version,
      timestamp: new Date(),
      description: this.description,
    };
  }
}


