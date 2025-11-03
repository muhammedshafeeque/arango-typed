import { Database } from 'arangojs';
import { Schema } from '../schema/Schema';
import { Document } from './Document';
import { Query } from '../query/Query';
import { LeanQuery } from '../query/LeanQuery';
import { ArangoDocument, ModelOptions } from '../types';
import { DocumentNotFoundError } from '../errors/ArangoError';
import { getDatabase } from '../connection/Connection';
import { Relation, PopulateOptions } from '../relations/Relation';
import { AggregationQuery } from '../query/Aggregation';
import { TenantContext } from '../tenancy/TenantContext';

export class Model<T = any> {
  public schema: Schema;
  public collectionName: string;
  public connection: Database;
  private tenantEnabled: boolean;
  private tenantField: string;

  constructor(schema: Schema, collectionName: string, options?: ModelOptions) {
    this.schema = schema;
    this.collectionName = collectionName || this.inferCollectionName();
    this.connection = options?.connection || getDatabase();
    this.tenantEnabled = options?.tenantEnabled ?? false;
    this.tenantField = options?.tenantField || 'tenantId';

    // Ensure collection exists (lazy initialization)
    this.ensureCollection();
  }

  /**
   * Infer collection name from model name (if available)
   */
  private inferCollectionName(): string {
    // This would be set when model is created with a name
    return 'documents';
  }

  /**
   * Ensure collection exists
   */
  private async ensureCollection(): Promise<void> {
    try {
      const collection = this.connection.collection(this.collectionName);
      const exists = await collection.exists();
      
      if (!exists) {
        await collection.create();
        
        // Create indexes
        for (const indexDef of this.schema.indexes) {
          try {
            if (indexDef.type === 'persistent') {
              await collection.ensureIndex({
                type: 'persistent',
                fields: indexDef.fields,
                unique: indexDef.unique,
                sparse: indexDef.sparse,
              });
            } else if (indexDef.type === 'ttl') {
              await collection.ensureIndex({
                type: 'ttl',
                fields: indexDef.fields,
                expireAfter: indexDef.expireAfter,
              } as any);
            } else if (indexDef.type === 'geo') {
              await collection.ensureIndex({
                type: 'geo',
                fields: indexDef.fields,
              } as any);
            } else if (indexDef.type === 'fulltext') {
              await collection.ensureIndex({
                type: 'fulltext',
                fields: indexDef.fields,
              } as any);
            }
          } catch (error: any) {
            // Index might already exist or creation failed - log but don't fail
            console.warn(`Failed to create index: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      // Collection creation might fail - this is handled lazily
      console.warn(`Collection check failed: ${error.message}`);
    }
  }

  /**
   * Add tenant filter to query/data
   */
  private addTenantFilter(query?: Record<string, any>): Record<string, any> | undefined {
    if (!this.tenantEnabled) {
      return query;
    }

    const tenantId = TenantContext.get();
    if (!tenantId) {
      return query;
    }

    const result = query ? { ...query } : {};
    result[this.tenantField] = tenantId;
    return result;
  }

  /**
   * Inject tenant ID into document data
   */
  private injectTenantId(data: Partial<T>): Partial<T> {
    if (!this.tenantEnabled) {
      return data;
    }

    const tenantId = TenantContext.get();
    if (!tenantId) {
      return data;
    }

    return { ...data, [this.tenantField]: tenantId } as Partial<T>;
  }

  /**
   * Create a new document
   * Optimized for performance: direct DB access for single inserts, batch for arrays
   * Automatically injects tenantId if tenantEnabled is true
   */
  async create(data: Partial<T> | Partial<T>[]): Promise<(T & ArangoDocument) | (T & ArangoDocument)[]> {
    await this.ensureCollection();

    if (Array.isArray(data)) {
      // Inject tenant ID into each document
      const dataWithTenant = data.map(d => this.injectTenantId(d));
      // Batch operation: Use bulk insert for better performance
      const collection = this.connection.collection(this.collectionName);
      const validatedData = dataWithTenant.map((doc) => {
        // Apply defaults and setters
        const withDefaults = this.schema.applyDefaults(doc || {});
        const withSetters = this.schema.applySetters(withDefaults);
        // Validate each document
        this.schema.validateSync(withSetters);
        return withSetters;
      });

      // Use bulk insert (faster than individual saves)
      // Note: import() returns a summary, not individual results
      // We'll need to query back to get the documents, or use save() for each
      // For now, use individual saves but batch them
      const savedDocs = await Promise.all(
        validatedData.map(async (doc) => {
          const result = await collection.save(doc);
          const docWithId = { ...doc, ...result };
          return new Document(docWithId, this.schema, this.connection, this.collectionName);
        })
      );
      
      const documents = savedDocs;
      
      return documents as unknown as (T & ArangoDocument)[];
    } else {
      // Single document: Optimize by using direct DB access when hooks/validation allow
      // Inject tenant ID first
      const dataWithTenant = this.injectTenantId(data);
      const withDefaults = this.schema.applyDefaults(dataWithTenant || {});
      const withSetters = this.schema.applySetters(withDefaults);
      
      // Check if we can skip Document wrapper (no hooks/validation needed)
      const hasPreSaveHooks = this.schema.hooks.has('save', 'pre');
      const hasPostSaveHooks = this.schema.hooks.has('save', 'post');
      
      if (!hasPreSaveHooks && !hasPostSaveHooks) {
        // Direct DB insert for maximum performance
        const collection = this.connection.collection(this.collectionName);
        this.schema.validateSync(withSetters);
        const result = await collection.save(withSetters);
        const docWithId = { ...withSetters, ...result };
        const document = new Document(docWithId, this.schema, this.connection, this.collectionName);
        return document as unknown as T & ArangoDocument;
      } else {
        // Use Document wrapper for hooks
        const document = new Document(withSetters, this.schema, this.connection, this.collectionName);
        await document.save();
        return document as unknown as T & ArangoDocument;
      }
    }
  }

  /**
   * Find documents
   * Automatically filters by tenant if tenantEnabled is true
   */
  find(query?: Record<string, any>): Query<T & ArangoDocument> {
    const tenantQuery = this.addTenantFilter(query);
    return new Query<T & ArangoDocument>(this.connection, this.collectionName, tenantQuery ? { where: tenantQuery } : undefined);
  }

  /**
   * Find documents with lean queries (returns plain objects)
   */
  findLean(query?: Record<string, any>): LeanQuery<T & ArangoDocument> {
    return new LeanQuery<T & ArangoDocument>(this.connection, this.collectionName, query ? { where: query, lean: true } : { lean: true });
  }

  /**
   * Find one document
   * Automatically filters by tenant if tenantEnabled is true
   */
  async findOne(query?: Record<string, any>): Promise<(T & ArangoDocument) | null> {
    const tenantQuery = this.addTenantFilter(query);
    const result = await new Query<T & ArangoDocument>(this.connection, this.collectionName, tenantQuery ? { where: tenantQuery } : undefined)
      .limit(1)
      .first();
    return result;
  }

  /**
   * Find document by ID
   * Automatically filters by tenant if tenantEnabled is true
   */
  async findById(id: string): Promise<(T & ArangoDocument) | null> {
    try {
      const collection = this.connection.collection(this.collectionName);
      const doc = await collection.document(id);
      if (!doc) {
        return null;
      }

      // Check tenant if enabled
      if (this.tenantEnabled) {
        const tenantId = TenantContext.get();
        if (tenantId && doc[this.tenantField] !== tenantId) {
          return null; // Document belongs to different tenant
        }
      }

      const document = new Document(doc, this.schema, this.connection, this.collectionName);
      return document as unknown as T & ArangoDocument;
    } catch (error: any) {
      if (error.errorNum === 1202) {
        // Document not found
        return null;
      }
      throw new DocumentNotFoundError(`Failed to find document by ID: ${error.message}`);
    }
  }

  /**
   * Find one and update
   * Automatically filters by tenant if tenantEnabled is true
   */
  async findOneAndUpdate(
    query: Record<string, any>,
    update: Partial<T>,
    options: { new?: boolean } = {}
  ): Promise<(T & ArangoDocument) | null> {
    const tenantQuery = this.addTenantFilter(query);
    const doc = await this.findOne(tenantQuery || query);
    if (!doc) {
      return null;
    }

    const document = doc as unknown as Document;
    await document.update(update);
    
    return options.new !== false ? document as unknown as T & ArangoDocument : doc;
  }

  /**
   * Find one and delete
   * Automatically filters by tenant if tenantEnabled is true
   */
  async findOneAndDelete(query: Record<string, any>): Promise<(T & ArangoDocument) | null> {
    const tenantQuery = this.addTenantFilter(query);
    const doc = await this.findOne(tenantQuery || query);
    if (!doc) {
      return null;
    }

    const document = doc as unknown as Document;
    await document.remove();
    
    return document as unknown as T & ArangoDocument;
  }

  /**
   * Delete one document (Mongoose-like)
   * Automatically filters by tenant if tenantEnabled is true
   */
  async deleteOne(query: Record<string, any>): Promise<number> {
    try {
      const tenantQuery = this.addTenantFilter(query);
      const doc = await this.findOne(tenantQuery || query);
      if (!doc) {
        return 0;
      }

      const document = doc as unknown as Document;
      await document.remove();
      return 1;
    } catch (error: any) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Update one document (Mongoose-like)
   * Automatically filters by tenant if tenantEnabled is true
   */
  async updateOne(
    query: Record<string, any>,
    update: Partial<T>,
    options: { upsert?: boolean } = {}
  ): Promise<number> {
    try {
      const tenantQuery = this.addTenantFilter(query);
      const doc = await this.findOne(tenantQuery || query);
      if (!doc) {
        if (options.upsert) {
          // Create new document if upsert is true
          await this.create({ ...query, ...update } as Partial<T>);
          return 1;
        }
        return 0;
      }

      const document = doc as unknown as Document;
      await document.update(update);
      return 1;
    } catch (error: any) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Delete many documents
   * Automatically filters by tenant if tenantEnabled is true
   */
  async deleteMany(query?: Record<string, any>): Promise<number> {
    try {
      const tenantQuery = this.addTenantFilter(query);
      const queryBuilder = new Query(this.connection, this.collectionName, tenantQuery ? { where: tenantQuery } : undefined);
      const { query: aqlQuery, bindVars } = queryBuilder.buildAQL();

      // Replace the RETURN clause with REMOVE and RETURN OLD
      const parts = aqlQuery.split('\n');
      const returnIndex = parts.findIndex((p) => p.trim().startsWith('RETURN'));
      if (returnIndex !== -1) {
        parts[returnIndex] = 'REMOVE doc IN @@collection RETURN OLD';
      } else {
        parts.push('REMOVE doc IN @@collection RETURN OLD');
      }
      
      const removeQuery = parts.join('\n');
      const cursor = await this.connection.query(removeQuery, bindVars);
      const results = await cursor.all();
      return results.length;
    } catch (error: any) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Count documents
   * Automatically filters by tenant if tenantEnabled is true
   */
  async count(query?: Record<string, any>): Promise<number> {
    const tenantQuery = this.addTenantFilter(query);
    return await new Query(this.connection, this.collectionName, tenantQuery ? { where: tenantQuery } : undefined).count();
  }

  /**
   * Create a new document instance without saving
   */
  new(data?: Partial<T>): T & ArangoDocument {
    return new Document(data || {}, this.schema, this.connection, this.collectionName) as unknown as T & ArangoDocument;
  }

  /**
   * Populate relations
   */
  async populate(
    docs: (T & ArangoDocument) | (T & ArangoDocument)[],
    populateOpts: PopulateOptions | PopulateOptions[]
  ): Promise<any> {
    return Relation.populate(docs, populateOpts);
  }

  /**
   * Create aggregation query
   */
  aggregate(options?: any): AggregationQuery {
    return new AggregationQuery(this.connection, this.collectionName, options);
  }

  /**
   * Execute raw AQL query
   */
  async executeAQL(query: string, bindVars: Record<string, any> = {}): Promise<any[]> {
    const cursor = await this.connection.query(query, bindVars);
    return await cursor.all();
  }

  /**
   * Find with populate
   */
  async findPopulate(
    query?: Record<string, any>,
    populate?: PopulateOptions | PopulateOptions[]
  ): Promise<(T & ArangoDocument)[]> {
    const docs = await this.find(query).all();
    if (populate) {
      return await this.populate(docs, populate);
    }
    return docs;
  }

  /**
   * Find one with populate
   */
  async findOnePopulate(
    query?: Record<string, any>,
    populate?: PopulateOptions | PopulateOptions[]
  ): Promise<(T & ArangoDocument) | null> {
    const doc = await this.findOne(query);
    if (!doc) return null;
    if (populate) {
      return await this.populate(doc, populate);
    }
    return doc;
  }
}

/**
 * Create a model from a schema
 */
export function model<T = any>(
  name: string,
  schema: Schema,
  options?: ModelOptions
): Model<T> {
  return new Model<T>(schema, name, options);
}

