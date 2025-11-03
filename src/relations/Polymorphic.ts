import { Model } from '../model/Model';
import { Document } from '../model/Document';

export interface PolymorphicOptions {
  typeField?: string;
  idField?: string;
  models: Record<string, Model<any>>;
}

/**
 * Polymorphic associations - one field can reference multiple model types (ORM feature)
 */
export class PolymorphicRelation {
  private options: Required<PolymorphicOptions>;

  constructor(_database: any, options: PolymorphicOptions) {
    this.options = {
      typeField: options.typeField || '_type',
      idField: options.idField || '_id',
      models: options.models,
    };
  }

  /**
   * Get polymorphic related document
   */
  async getRelated(document: Document): Promise<Document | null> {
    const type = (document as any)[this.options.typeField];
    const id = (document as any)[this.options.idField];

    if (!type || !id) {
      return null;
    }

    const model = this.options.models[type];
    if (!model) {
      throw new Error(`Model type "${type}" not found in polymorphic relation`);
    }

    return await model.findById(id) as Document | null;
  }

  /**
   * Associate polymorphic document
   */
  async associate(document: Document, related: Document, relatedType: string): Promise<void> {
    const model = this.options.models[relatedType];
    if (!model) {
      throw new Error(`Model type "${relatedType}" not found in polymorphic relation`);
    }

    // Ensure related document is saved
    if ((related as any).isNewDoc && (related as any).isNewDoc()) {
      await (related as any).save();
    }

    (document as any)[this.options.typeField] = relatedType;
    (document as any)[this.options.idField] = (related as any)._id || (related as any)._key;
    await (document as any).save();
  }

  /**
   * Get all possible types
   */
  getTypes(): string[] {
    return Object.keys(this.options.models);
  }

  /**
   * Register a new model type
   */
  registerType(type: string, model: Model<any>): void {
    this.options.models[type] = model;
  }
}

