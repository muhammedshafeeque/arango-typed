import { Relationship } from './Relationship';
import { Document } from '../model/Document';

export class BelongsTo<T = any, U = any> extends Relationship<T, U> {
  /**
   * Get related document (many-to-one)
   */
  async getRelated(document: Document): Promise<Document | null> {
    const foreignValue = (document as any)[this.options.foreignField];
    if (!foreignValue) return null;

    const result = await this.relatedModel.findById(foreignValue);
    return result as Document | null;
  }

  /**
   * Associate document
   */
  async associate(document: Document, related: Document): Promise<void> {
    if (Array.isArray(related)) {
      throw new Error('BelongsTo relationship expects a single document, not an array');
    }

    const localValue = (related as any)[this.options.localField];
    (document as any)[this.options.foreignField] = localValue;
    await document.save();
  }

  /**
   * Disassociate document
   */
  async disassociate(document: Document): Promise<void> {
    (document as any)[this.options.foreignField] = null;
    await document.save();
  }
}

