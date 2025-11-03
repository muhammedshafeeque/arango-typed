import { Relationship } from './Relationship';
import { Document } from '../model/Document';

export class HasOne<T = any, U = any> extends Relationship<T, U> {
  /**
   * Get related document (one-to-one)
   */
  async getRelated(document: Document): Promise<Document | null> {
    const localValue = (document as any)[this.options.localField];
    if (!localValue) return null;

    const query: Record<string, any> = {};
    query[this.options.foreignField] = localValue;

    const result = await this.relatedModel.findOne(query);
    return result as Document | null;
  }

  /**
   * Associate document
   */
  async associate(document: Document, related: Document): Promise<void> {
    if (Array.isArray(related)) {
      throw new Error('HasOne relationship expects a single document, not an array');
    }

    const localValue = (document as any)[this.options.localField];
    (related as any)[this.options.foreignField] = localValue;
    await related.save();
  }

  /**
   * Disassociate document
   */
  async disassociate(document: Document, related?: Document): Promise<void> {
    if (related) {
      (related as any)[this.options.foreignField] = null;
      await related.save();
    } else {
      const relatedDoc = await this.getRelated(document);
      if (relatedDoc) {
        (relatedDoc as any)[this.options.foreignField] = null;
        await relatedDoc.save();
      }
    }
  }
}

