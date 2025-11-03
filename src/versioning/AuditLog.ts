import { Database } from 'arangojs';

export interface AuditEntry {
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

export class AuditLog {
  private database: Database;
  private collectionName: string;

  constructor(database: Database, collectionName: string = '_audit') {
    this.database = database;
    this.collectionName = collectionName;
  }

  /**
   * Log an action
   */
  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    await this.ensureCollection();

    const collection = this.database.collection(this.collectionName);
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date(),
    };

    await collection.save(auditEntry);
  }

  /**
   * Get audit logs for document
   */
  async getLogs(documentId: string, limit?: number): Promise<AuditEntry[]> {
    await this.ensureCollection();

    const query = `
      FOR log IN ${this.collectionName}
      FILTER log.documentId == @documentId
      SORT log.timestamp DESC
      LIMIT @limit
      RETURN log
    `;

    const cursor = await this.database.query(query, {
      documentId,
      limit: limit || 100,
    });

    return await cursor.all();
  }

  /**
   * Get audit logs for user
   */
  async getLogsByUser(userId: string, limit?: number): Promise<AuditEntry[]> {
    await this.ensureCollection();

    const query = `
      FOR log IN ${this.collectionName}
      FILTER log.userId == @userId
      SORT log.timestamp DESC
      LIMIT @limit
      RETURN log
    `;

    const cursor = await this.database.query(query, {
      userId,
      limit: limit || 100,
    });

    return await cursor.all();
  }

  /**
   * Get audit logs by action
   */
  async getLogsByAction(action: string, limit?: number): Promise<AuditEntry[]> {
    await this.ensureCollection();

    const query = `
      FOR log IN ${this.collectionName}
      FILTER log.action == @action
      SORT log.timestamp DESC
      LIMIT @limit
      RETURN log
    `;

    const cursor = await this.database.query(query, {
      action,
      limit: limit || 100,
    });

    return await cursor.all();
  }

  /**
   * Ensure audit collection exists
   */
  async ensureCollection(): Promise<void> {
    const collection = this.database.collection(this.collectionName);
    const exists = await collection.exists();
    
    if (!exists) {
      await collection.create();
      
      // Create indexes
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['documentId'],
      });
      
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['userId'],
      });
      
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['action'],
      });
      
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['timestamp'],
      });
    }
  }
}


