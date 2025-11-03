import { Relationship, RelationshipOptions } from './Relationship';
import { Document } from '../model/Document';
import { Database } from 'arangojs';

export interface BelongsToManyOptions {
  through?: string; // Junction collection name
  localKey?: string;
  foreignKey?: string;
}

export class BelongsToMany<T = any, U = any> extends Relationship<T, U> {
  private junctionCollection?: string;
  private localKey: string;
  private foreignKey: string;

  constructor(
    model: Model<T>,
    relatedModel: Model<U>,
    options: RelationshipOptions & BelongsToManyOptions = {}
  ) {
    super(model, relatedModel, options);
    this.junctionCollection = options.through;
    this.localKey = options.localKey || `${this.model.collectionName}_id`;
    this.foreignKey = options.foreignKey || `${this.relatedModel.collectionName}_id`;
  }

  /**
   * Get related documents (many-to-many)
   */
  async getRelated(document: Document): Promise<Document[]> {
    if (!this.junctionCollection) {
      throw new Error('Junction collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).connection as Database;
    const documentId = (document as any)._id;

    const aql = `
      FOR junction IN ${this.junctionCollection}
      FILTER junction.${this.localKey} == @documentId
      FOR related IN ${this.relatedModel.collectionName}
      FILTER related._id == junction.${this.foreignKey}
      RETURN related
    `;

    const cursor = await db.query(aql, { documentId });
    const results = await cursor.all();
    
    return results.map((data: any) => {
      return this.relatedModel.new(data);
    }) as unknown as Document[];
  }

  /**
   * Associate documents
   */
  async associate(document: Document, related: Document | Document[]): Promise<void> {
    if (!this.junctionCollection) {
      throw new Error('Junction collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).database as Database;
    const collection = db.collection(this.junctionCollection);
    const documentId = (document as any)._id;
    const relatedArray = Array.isArray(related) ? related : [related];

    for (const doc of relatedArray) {
      const relatedId = (doc as any)._id;
      
      // Check if association already exists
      const existing = await db.query(
        `FOR j IN ${this.junctionCollection}
         FILTER j.${this.localKey} == @documentId AND j.${this.foreignKey} == @relatedId
         RETURN j`,
        { documentId, relatedId }
      );

      if ((await existing.all()).length === 0) {
        await collection.save({
          [this.localKey]: documentId,
          [this.foreignKey]: relatedId,
        });
      }
    }
  }

  /**
   * Disassociate documents
   */
  async disassociate(document: Document, related?: Document | Document[]): Promise<void> {
    if (!this.junctionCollection) {
      throw new Error('Junction collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).database as Database;
    const documentId = (document as any)._id;

    if (related) {
      const relatedArray = Array.isArray(related) ? related : [related];
      for (const doc of relatedArray) {
        const relatedId = (doc as any)._id;
        await db.query(
          `FOR j IN ${this.junctionCollection}
           FILTER j.${this.localKey} == @documentId AND j.${this.foreignKey} == @relatedId
           REMOVE j IN ${this.junctionCollection}`,
          { documentId, relatedId }
        );
      }
    } else {
      // Disassociate all
      await db.query(
        `FOR j IN ${this.junctionCollection}
         FILTER j.${this.localKey} == @documentId
         REMOVE j IN ${this.junctionCollection}`,
        { documentId }
      );
    }
  }
}

// Fix: Add missing import
import { Model } from '../model/Model';

