import { Relationship, RelationshipOptions } from './Relationship';
import { Document } from '../model/Document';
import { Database } from 'arangojs';
import { Model } from '../model/Model';

export interface BelongsToManyOptions {
  through?: string; // Junction/edge collection name
  localKey?: string; // For document collections (backward compat)
  foreignKey?: string; // For document collections (backward compat)
  useGraph?: boolean; // Use graph edges instead of junction table (default: false for backward compat)
  graphName?: string; // Graph name (required if useGraph is true)
  direction?: 'outbound' | 'inbound' | 'any'; // Direction for graph edges (default: 'outbound')
}

export class BelongsToMany<T = any, U = any> extends Relationship<T, U> {
  private junctionCollection?: string;
  private localKey: string;
  private foreignKey: string;
  private useGraph: boolean;
  private graphName?: string;
  private direction: 'outbound' | 'inbound' | 'any';

  constructor(
    model: Model<T>,
    relatedModel: Model<U>,
    options: RelationshipOptions & BelongsToManyOptions = {}
  ) {
    super(model, relatedModel, options);
    this.junctionCollection = options.through;
    this.useGraph = options.useGraph ?? false; // Default to false for backward compatibility
    this.graphName = options.graphName;
    this.direction = options.direction || 'outbound';
    this.localKey = options.localKey || `${this.model.collectionName}_id`;
    this.foreignKey = options.foreignKey || `${this.relatedModel.collectionName}_id`;

    // Validate graph options
    if (this.useGraph && !this.graphName) {
      throw new Error('graphName is required when useGraph is true');
    }
  }

  /**
   * Get related documents (many-to-many)
   */
  async getRelated(document: Document): Promise<Document[]> {
    if (!this.junctionCollection) {
      throw new Error('Junction/edge collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).connection as Database;
    const documentId = (document as any)._id;

    if (this.useGraph && this.graphName) {
      // Use graph edges (better approach for ArangoDB)
      // Query using the edge collection directly (not through GRAPH for better control)
      const aql = `
        FOR v, e IN 1 ${this.direction.toUpperCase()} @documentId
        @@edgeCollection
        FILTER v._id LIKE @relatedCollectionPattern
        RETURN v
      `;

      const cursor = await db.query(aql, {
        documentId,
        '@edgeCollection': this.junctionCollection,
        relatedCollectionPattern: `${this.relatedModel.collectionName}/%`
      });

      const results = await cursor.all();
      return results.map((data: any) => {
        return this.relatedModel.new(data);
      }) as unknown as Document[];
    } else {
      // Use junction collection (backward compatibility)
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
  }

  /**
   * Associate documents
   */
  async associate(document: Document, related: Document | Document[]): Promise<void> {
    if (!this.junctionCollection) {
      throw new Error('Junction/edge collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).connection as Database || (this.model as any).database as Database;
    const documentId = (document as any)._id;
    const relatedArray = Array.isArray(related) ? related : [related];

    if (this.useGraph) {
      // Use graph edges
      const edgeCollection = db.collection(this.junctionCollection);
      
      for (const doc of relatedArray) {
        const relatedId = (doc as any)._id;
        
        // Check if edge already exists
        const existing = await db.query(
          `FOR e IN ${this.junctionCollection}
           FILTER e._from == @documentId AND e._to == @relatedId
           RETURN e`,
          { documentId, relatedId }
        );

        if ((await existing.all()).length === 0) {
          // Create edge
          await edgeCollection.save({
            _from: documentId,
            _to: relatedId
          });
        }
      }
    } else {
      // Use junction collection (backward compatibility)
      const collection = db.collection(this.junctionCollection);
      
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
  }

  /**
   * Disassociate documents
   */
  async disassociate(document: Document, related?: Document | Document[]): Promise<void> {
    if (!this.junctionCollection) {
      throw new Error('Junction/edge collection not specified for BelongsToMany relationship');
    }

    const db = (this.model as any).connection as Database || (this.model as any).database as Database;
    const documentId = (document as any)._id;

    if (this.useGraph) {
      // Use graph edges
      if (related) {
        const relatedArray = Array.isArray(related) ? related : [related];
        for (const doc of relatedArray) {
          const relatedId = (doc as any)._id;
          await db.query(
            `FOR e IN ${this.junctionCollection}
             FILTER e._from == @documentId AND e._to == @relatedId
             REMOVE e IN ${this.junctionCollection}`,
            { documentId, relatedId }
          );
        }
      } else {
        // Disassociate all
        await db.query(
          `FOR e IN ${this.junctionCollection}
           FILTER e._from == @documentId
           REMOVE e IN ${this.junctionCollection}`,
          { documentId }
        );
      }
    } else {
      // Use junction collection (backward compatibility)
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
}

