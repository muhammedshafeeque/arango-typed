import { Model } from '../model/Model';
import { Document } from '../model/Document';

export interface RelationshipOptions {
  localField?: string;
  foreignField?: string;
  cascade?: boolean;
  eager?: boolean;
}

export abstract class Relationship<T = any, U = any> {
  protected model: Model<T>;
  protected relatedModel: Model<U>;
  protected options: Required<RelationshipOptions>;

  constructor(
    model: Model<T>,
    relatedModel: Model<U>,
    options: RelationshipOptions = {}
  ) {
    this.model = model;
    this.relatedModel = relatedModel;
    this.options = {
      localField: options.localField || '_id',
      foreignField: options.foreignField || '_id',
      cascade: options.cascade || false,
      eager: options.eager || false,
    };
  }

  /**
   * Get related documents
   */
  abstract getRelated(document: Document): Promise<Document | Document[] | null>;

  /**
   * Associate documents
   */
  abstract associate(document: Document, related: Document | Document[]): Promise<void>;

  /**
   * Disassociate documents
   */
  abstract disassociate(document: Document, related?: Document | Document[]): Promise<void>;

  /**
   * Handle cascade delete
   */
  async handleCascadeDelete(document: Document): Promise<void> {
    if (this.options.cascade) {
      const related = await this.getRelated(document);
      if (Array.isArray(related)) {
        await Promise.all(related.map((doc) => doc.delete()));
      } else if (related) {
        await related.delete();
      }
    }
  }
}

