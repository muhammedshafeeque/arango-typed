import { Relationship } from './Relationship';
import { Document } from '../model/Document';

export class HasMany<T = any, U = any> extends Relationship<T, U> {
  /**
   * Get related documents (one-to-many)
   */
  async getRelated(document: Document): Promise<Document[]> {
    const localValue = (document as any)[this.options.localField];
    if (!localValue) return [];

    const query: Record<string, any> = {};
    query[this.options.foreignField] = localValue;

    const results = await this.relatedModel.find(query);
    return await results.all() as unknown as Document[];
  }

  /**
   * Associate documents
   */
  async associate(document: Document, related: Document | Document[]): Promise<void> {
    const localValue = (document as any)[this.options.localField];
    const relatedArray = Array.isArray(related) ? related : [related];

    for (const doc of relatedArray) {
      (doc as any)[this.options.foreignField] = localValue;
      await doc.save();
    }
  }

  /**
   * Disassociate documents
   */
  async disassociate(document: Document, related?: Document | Document[]): Promise<void> {
    if (related) {
      const relatedArray = Array.isArray(related) ? related : [related];
      for (const doc of relatedArray) {
        (doc as any)[this.options.foreignField] = null;
        await doc.save();
      }
    } else {
      // Disassociate all
      const relatedDocs = await this.getRelated(document);
      for (const doc of relatedDocs) {
        (doc as any)[this.options.foreignField] = null;
        await doc.save();
      }
    }
  }
}

