import { Model } from '../model/Model';
import { Document } from '../model/Document';
import { ArangoDocument } from '../types';

export interface RelationOptions {
  localField?: string;
  foreignField?: string;
  justOne?: boolean;
  select?: string[];
  match?: Record<string, any>;
  options?: Record<string, any>;
}

export interface PopulateOptions {
  path: string;
  select?: string[];
  match?: Record<string, any>;
  model?: string | Model<any>;
  options?: RelationOptions;
}

export class Relation {
  /**
   * Populate a single field
   */
  static async populateOne<T = any>(
    doc: Document,
    field: string,
    model: Model<T>,
    options: RelationOptions = {}
  ): Promise<T & ArangoDocument | null> {
    const localField = options.localField || field;
    const select = options.select;

    const foreignId = (doc as any)[localField];
    if (!foreignId) return null;

    let query = model.findById(foreignId);
    
    if (select && select.length > 0) {
      // Apply select after getting the document
      // This is a simplified version
    }

    return query;
  }

  /**
   * Populate multiple documents
   */
  static async populateMany<T = any>(
    docs: (Document | ArangoDocument)[],
    field: string,
    model: Model<T>,
    options: RelationOptions = {}
  ): Promise<((T & ArangoDocument) | null)[]> {
    const localField = options.localField || field;
    const justOne = options.justOne || false;

    const foreignIds = docs
      .map((doc) => {
        const value = (doc as any)[localField];
        if (Array.isArray(value)) return value;
        return value ? [value] : [];
      })
      .flat()
      .filter((id) => id != null);

    if (foreignIds.length === 0) {
      return docs.map(() => null);
    }

    // Remove duplicates
    const uniqueIds = [...new Set(foreignIds)];

    // Fetch all related documents
    const relatedDocs = await Promise.all(
      uniqueIds.map((id) => model.findById(id))
    );

    const docMap = new Map(
      relatedDocs
        .filter((doc) => doc != null)
        .map((doc) => [doc!._id || doc!._key, doc!])
    );

    // Map back to original documents
    return docs.map((doc) => {
      const value = (doc as any)[localField];
      if (justOne) {
        const id = Array.isArray(value) ? value[0] : value;
        return id ? docMap.get(id) || null : null;
      } else {
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        return ids
          .map((id: string) => docMap.get(id))
          .filter((doc: any) => doc != null)[0] || null;
      }
    });
  }

  /**
   * Populate documents with relations
   */
  static async populate(
    docs: (Document | ArangoDocument) | (Document | ArangoDocument)[],
    populateOpts: PopulateOptions | PopulateOptions[]
  ): Promise<any> {
    const docArray = Array.isArray(docs) ? docs : [docs];
    const optsArray = Array.isArray(populateOpts) ? populateOpts : [populateOpts];

    let result = [...docArray];

    for (const opt of optsArray) {
      if (typeof opt.model === 'string') {
        throw new Error('String model reference not yet supported. Use Model instance.');
      }

      if (!opt.model) {
        throw new Error('Model is required for population');
      }

      const localField = opt.options?.localField || opt.path;
      const justOne = opt.options?.justOne || false;

      // Get all foreign IDs
      const foreignIds = result
        .map((doc: any) => {
          const value = doc[localField];
          if (Array.isArray(value)) return value;
          return value ? [value] : [];
        })
        .flat()
        .filter((id: any) => id != null);

      if (foreignIds.length === 0) continue;

      const uniqueIds = [...new Set(foreignIds)];

      // Build query to fetch related documents
      const match = opt.match || opt.options?.match;
      let query = opt.model.find(match || {});

      // Apply select if specified
      if (opt.select && opt.select.length > 0) {
        query = query.select(opt.select);
      }

      // Fetch documents where _id or _key matches
      const relatedDocs: any[] = [];
      for (const id of uniqueIds) {
        const doc = await opt.model.findById(id);
        if (doc) relatedDocs.push(doc);
      }

      const docMap = new Map(
        relatedDocs.map((doc: any) => [doc._id || doc._key, doc])
      );

      // Populate the field
      result = result.map((doc: any) => {
        const value = doc[localField];
        if (justOne) {
          const id = Array.isArray(value) ? value[0] : value;
          if (id && docMap.has(id)) {
            doc[opt.path] = docMap.get(id);
          }
        } else {
          const ids = Array.isArray(value) ? value : value ? [value] : [];
          doc[opt.path] = ids
            .map((id: string) => docMap.get(id))
            .filter((doc: any) => doc != null);
        }
        return doc;
      });
    }

    return Array.isArray(docs) ? result : result[0];
  }
}

