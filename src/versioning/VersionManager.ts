import { Document } from '../model/Document';
import { Database } from 'arangojs';

export interface VersionOptions {
  collectionName?: string;
  maxVersions?: number;
}

export class VersionManager {
  private database: Database;
  private collectionName: string;
  private maxVersions: number;

  constructor(database: Database, options: VersionOptions = {}) {
    this.database = database;
    this.collectionName = options.collectionName || '_versions';
    this.maxVersions = options.maxVersions || 10;
  }

  /**
   * Save version of document
   */
  async saveVersion(document: Document, metadata?: Record<string, any>): Promise<void> {
    const collection = this.database.collection(this.collectionName);
    const docId = document._id || document._key;
    if (!docId) {
      throw new Error('Document must have _id or _key');
    }
    
    const version = {
      documentId: docId,
      documentRev: document._rev,
      version: Date.now(),
      data: { ...(document as any) },
      metadata: metadata || {},
      createdAt: new Date(),
    };

    await collection.save(version);

    // Clean up old versions
    await this.cleanupVersions(docId);
  }

  /**
   * Get versions of document
   */
  async getVersions(documentId: string): Promise<any[]> {
    const cursor = await this.database.query(
      `FOR v IN ${this.collectionName}
       FILTER v.documentId == @documentId
       SORT v.version DESC
       RETURN v`,
      { documentId }
    );

    return await cursor.all();
  }

  /**
   * Get specific version
   */
  async getVersion(documentId: string, version: number): Promise<any | null> {
    const cursor = await this.database.query(
      `FOR v IN ${this.collectionName}
       FILTER v.documentId == @documentId AND v.version == @version
       RETURN v`,
      { documentId, version }
    );

    const results = await cursor.all();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Restore document to specific version
   */
  async restoreVersion(document: Document, version: number): Promise<void> {
    const docId = document._id || document._key;
    if (!docId) {
      throw new Error('Document must have _id or _key');
    }
    const versionData = await this.getVersion(docId, version);
    
    if (!versionData) {
      throw new Error(`Version ${version} not found`);
    }

    // Restore data
    Object.assign(document, versionData.data);
    await (document as any).save();
  }

  /**
   * Compare versions
   */
  async compareVersions(documentId: string, version1: number, version2: number): Promise<{
    diff: Record<string, { old: any; new: any }>;
  }> {
    const [v1, v2] = await Promise.all([
      this.getVersion(documentId, version1),
      this.getVersion(documentId, version2),
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const diff: Record<string, { old: any; new: any }> = {};

    const allKeys = new Set([...Object.keys(v1.data), ...Object.keys(v2.data)]);

    for (const key of allKeys) {
      if (JSON.stringify(v1.data[key]) !== JSON.stringify(v2.data[key])) {
        diff[key] = {
          old: v1.data[key],
          new: v2.data[key],
        };
      }
    }

    return { diff };
  }

  /**
   * Clean up old versions
   */
  private async cleanupVersions(documentId: string): Promise<void> {
    const versions = await this.getVersions(documentId);
    
    if (versions.length > this.maxVersions) {
      const toDelete = versions.slice(this.maxVersions);
      const collection = this.database.collection(this.collectionName);
      
      for (const version of toDelete) {
        await collection.remove(version._key);
      }
    }
  }

  /**
   * Ensure version collection exists
   */
  async ensureCollection(): Promise<void> {
    const collection = this.database.collection(this.collectionName);
    const exists = await collection.exists();
    
    if (!exists) {
      await collection.create();
      
      // Create index on documentId
      await collection.ensureIndex({
        type: 'persistent',
        fields: ['documentId'],
      });
    }
  }
}

