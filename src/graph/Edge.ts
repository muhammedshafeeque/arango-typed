import { Database } from 'arangojs';
import { Document } from '../model/Document';
import { Schema } from '../schema/Schema';
import { ArangoDocument } from '../types';

export interface EdgeDefinition {
  from: string[];
  to: string[];
}

export class Edge extends Document {
  _from?: string;
  _to?: string;
  [key: string]: any;

  constructor(
    data: Partial<ArangoDocument & { _from?: string; _to?: string }>,
    schema: Schema,
    database: Database,
    collectionName: string
  ) {
    super(data, schema, database, collectionName);
    this._from = data._from;
    this._to = data._to;
  }

  /**
   * Get the source vertex
   */
  async getFrom(): Promise<Document | null> {
    if (!this._from) return null;
    
    try {
      const collectionName = this._from.split('/')[0];
      const collection = (this as any).database.collection(collectionName);
      const doc = await collection.document(this._from);
      return new Document(doc, (this as any).schema, (this as any).database, collectionName);
    } catch {
      return null;
    }
  }

  /**
   * Get the target vertex
   */
  async getTo(): Promise<Document | null> {
    if (!this._to) return null;
    
    try {
      const collectionName = this._to.split('/')[0];
      const collection = (this as any).database.collection(collectionName);
      const doc = await collection.document(this._to);
      return new Document(doc, (this as any).schema, (this as any).database, collectionName);
    } catch {
      return null;
    }
  }

  /**
   * Convert to object including _from and _to
   */
  toObject(): Record<string, any> {
    const obj = super.toObject();
    if (this._from) obj._from = this._from;
    if (this._to) obj._to = this._to;
    return obj;
  }
}

