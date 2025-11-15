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
import { AuditContext } from '../audit/AuditContext';
import { AuditLog, AuditEntry } from '../versioning/AuditLog';

export class Model<T = any> {
  public schema: Schema;
  public collectionName: string;
  public connection: Database;
  private tenantEnabled: boolean;
  private tenantField: string;
  private softDeleteEnabled: boolean;
  private auditEnabled: boolean;
  private auditFields: {
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
    deletedBy: string;
    deletedAt: string;
  };
  private auditLog: AuditLog | null = null;

  constructor(schema: Schema, collectionName: string, options?: ModelOptions) {
    this.schema = schema;
    this.collectionName = collectionName || this.inferCollectionName();
    this.connection = options?.connection || getDatabase();
    this.tenantEnabled = options?.tenantEnabled ?? false;
    this.tenantField = options?.tenantField || 'tenantId';
    this.softDeleteEnabled = options?.softDeleteEnabled ?? false;
    this.auditEnabled = options?.auditEnabled ?? false;
    
    // Set audit field names
    const defaultFields = {
      createdBy: 'createdBy',
      createdAt: 'createdAt',
      updatedBy: 'updatedBy',
      updatedAt: 'updatedAt',
      deletedBy: 'deletedBy',
      deletedAt: 'deletedAt'
    };
    this.auditFields = { ...defaultFields, ...(options?.auditFields || {}) };
    
    // Initialize audit log if enabled
    if (this.auditEnabled) {
      this.auditLog = new AuditLog(this.connection, options?.auditLogCollection);
    }

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
   * Inject audit fields for creation
   */
  private injectAuditFieldsForCreate(data: Partial<T>): Partial<T> {
    if (!this.auditEnabled) {
      return data;
    }

    const userId = AuditContext.get();
    const now = new Date();
    const result = { ...data } as any;

    if (userId) {
      result[this.auditFields.createdBy] = userId;
    }
    result[this.auditFields.createdAt] = now;
    result[this.auditFields.updatedBy] = userId || null;
    result[this.auditFields.updatedAt] = now;

    return result as Partial<T>;
  }

  /**
   * Inject audit fields for update
   */
  private injectAuditFieldsForUpdate(data: Partial<T>): Partial<T> {
    if (!this.auditEnabled) {
      return data;
    }

    const userId = AuditContext.get();
    const now = new Date();
    const result = { ...data } as any;

    if (userId) {
      result[this.auditFields.updatedBy] = userId;
    }
    result[this.auditFields.updatedAt] = now;

    return result as Partial<T>;
  }

  /**
   * Log audit entry
   */
  async logAudit(action: 'create' | 'update' | 'delete', documentId: string, documentKey: string | undefined, before?: any, after?: any): Promise<void> {
    if (!this.auditEnabled || !this.auditLog) {
      return;
    }

    const userId = AuditContext.get();
    const metadata = AuditContext.getMetadata();

    await this.auditLog.log({
      action,
      collection: this.collectionName,
      documentId,
      documentKey,
      userId: userId || undefined,
      changes: before || after ? { before, after } : undefined,
      metadata: metadata || undefined,
    });
  }

  /**
   * Create a new document
   * Optimized for performance: direct DB access for single inserts, batch for arrays
   * Automatically injects tenantId if tenantEnabled is true
   */
  async create(data: Partial<T> | Partial<T>[]): Promise<(T & ArangoDocument) | (T & ArangoDocument)[]> {
    await this.ensureCollection();

    if (Array.isArray(data)) {
      // Inject tenant ID and audit fields into each document
      const dataWithTenant = data.map(d => this.injectTenantId(d));
      const dataWithAudit = dataWithTenant.map(d => this.injectAuditFieldsForCreate(d));
      // Batch operation: Use bulk insert for better performance
      const collection = this.connection.collection(this.collectionName);
      const validatedData = dataWithAudit.map((doc) => {
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
          const document = new Document(docWithId, this.schema, this.connection, this.collectionName, this);
          
          // Log audit entry
          await this.logAudit('create', result._id, result._key, undefined, docWithId);
          
          return document;
        })
      );
      
      const documents = savedDocs;
      
      return documents as unknown as (T & ArangoDocument)[];
    } else {
      // Single document: Optimize by using direct DB access when hooks/validation allow
      // Inject tenant ID and audit fields first
      const dataWithTenant = this.injectTenantId(data);
      const dataWithAudit = this.injectAuditFieldsForCreate(dataWithTenant);
      const withDefaults = this.schema.applyDefaults(dataWithAudit || {});
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
        const document = new Document(docWithId, this.schema, this.connection, this.collectionName, this);
        
        // Log audit entry
        await this.logAudit('create', result._id, result._key, undefined, docWithId);
        
        return document as unknown as T & ArangoDocument;
      } else {
        // Use Document wrapper for hooks
        const document = new Document(withSetters, this.schema, this.connection, this.collectionName, this);
        await document.save();
        
        // Log audit entry
        if (document._id) {
          await this.logAudit('create', document._id, document._key, undefined, document.toObject());
        }
        
        return document as unknown as T & ArangoDocument;
      }
    }
  }

  /**
   * Find documents
   * Automatically filters by tenant if tenantEnabled is true
   * Automatically excludes soft-deleted documents if softDeleteEnabled is true
   */
  find(query?: Record<string, any>): Query<T & ArangoDocument> {
    const tenantQuery = this.addTenantFilter(query);
    return new Query<T & ArangoDocument>(this.connection, this.collectionName, {
      ...(tenantQuery ? { where: tenantQuery } : {}),
      softDeleteEnabled: this.softDeleteEnabled
    });
  }

  /**
   * Find documents with lean queries (returns plain objects)
   */
  findLean(query?: Record<string, any>): LeanQuery<T & ArangoDocument> {
    const tenantQuery = this.addTenantFilter(query);
    return new LeanQuery<T & ArangoDocument>(this.connection, this.collectionName, tenantQuery ? { where: tenantQuery, lean: true, softDeleteEnabled: this.softDeleteEnabled } : { lean: true, softDeleteEnabled: this.softDeleteEnabled });
  }

  /**
   * Find one document
   * Automatically filters by tenant if tenantEnabled is true
   * Automatically excludes soft-deleted documents if softDeleteEnabled is true
   */
  async findOne(query?: Record<string, any>): Promise<(T & ArangoDocument) | null> {
    const tenantQuery = this.addTenantFilter(query);
    const result = await new Query<T & ArangoDocument>(this.connection, this.collectionName, {
      ...(tenantQuery ? { where: tenantQuery } : {}),
      softDeleteEnabled: this.softDeleteEnabled
    })
      .limit(1)
      .first();
    return result;
  }

  /**
   * Find document by ID
   * Automatically filters by tenant if tenantEnabled is true
   * Automatically excludes soft-deleted documents if softDeleteEnabled is true
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

      // Check soft delete if enabled
      if (this.softDeleteEnabled && doc.isDeleted === true) {
        return null; // Document is soft-deleted
      }

      const document = new Document(doc, this.schema, this.connection, this.collectionName, this);
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
    
    // Audit logging is handled in Document.save()
    
    return options.new !== false ? document as unknown as T & ArangoDocument : doc;
  }

  /**
   * Find one and delete
   * Automatically filters by tenant if tenantEnabled is true
   * Performs soft delete if softDeleteEnabled is true
   */
  async findOneAndDelete(query: Record<string, any>): Promise<(T & ArangoDocument) | null> {
    const tenantQuery = this.addTenantFilter(query);
    const doc = await this.findOne(tenantQuery || query);
    if (!doc) {
      return null;
    }

    const document = doc as unknown as Document;
    if (this.softDeleteEnabled) {
      await document.softDelete();
    } else {
      await document.remove();
    }
    
    return document as unknown as T & ArangoDocument;
  }

  /**
   * Delete one document (Mongoose-like)
   * Automatically filters by tenant if tenantEnabled is true
   * Performs soft delete if softDeleteEnabled is true
   */
  async deleteOne(query: Record<string, any>): Promise<number> {
    try {
      const tenantQuery = this.addTenantFilter(query);
      const doc = await this.findOne(tenantQuery || query);
      if (!doc) {
        return 0;
      }

      const document = doc as unknown as Document;
      if (this.softDeleteEnabled) {
        await document.softDelete();
      } else {
        await document.remove();
      }
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
      // Inject audit fields for update
      const updateWithAudit = this.injectAuditFieldsForUpdate(update);
      await document.update(updateWithAudit);
      // Audit logging is handled in Document.save()
      return 1;
    } catch (error: any) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Delete many documents
   * Automatically filters by tenant if tenantEnabled is true
   * Performs soft delete if softDeleteEnabled is true
   */
  async deleteMany(query?: Record<string, any>): Promise<number> {
    try {
      const tenantQuery = this.addTenantFilter(query);
      
      if (this.softDeleteEnabled) {
        // Soft delete: update isDeleted and deletedAt
        const queryBuilder = new Query(this.connection, this.collectionName, {
          ...(tenantQuery ? { where: tenantQuery } : {}),
          softDeleteEnabled: this.softDeleteEnabled
        });
        const { query: aqlQuery, bindVars } = queryBuilder.buildAQL();

        // Add deletedAt to bindVars
        const now = new Date();
        bindVars.deletedAt = now;

        // Replace the RETURN clause with UPDATE and RETURN OLD
        const parts = aqlQuery.split('\n');
        const returnIndex = parts.findIndex((p) => p.trim().startsWith('RETURN'));
        if (returnIndex !== -1) {
          parts[returnIndex] = 'UPDATE doc WITH { isDeleted: true, deletedAt: @deletedAt } IN @@collection RETURN OLD';
        } else {
          parts.push('UPDATE doc WITH { isDeleted: true, deletedAt: @deletedAt } IN @@collection RETURN OLD');
        }
        
        const updateQuery = parts.join('\n');
        const cursor = await this.connection.query(updateQuery, bindVars);
        const results = await cursor.all();
        return results.length;
      } else {
        // Hard delete
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
      }
    } catch (error: any) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Count documents
   * Automatically filters by tenant if tenantEnabled is true
   * Automatically excludes soft-deleted documents if softDeleteEnabled is true
   */
  async count(query?: Record<string, any>): Promise<number> {
    const tenantQuery = this.addTenantFilter(query);
    return await new Query(this.connection, this.collectionName, {
      ...(tenantQuery ? { where: tenantQuery } : {}),
      softDeleteEnabled: this.softDeleteEnabled
    }).count();
  }

  /**
   * Create a new document instance without saving
   */
  new(data?: Partial<T>): T & ArangoDocument {
    return new Document(data || {}, this.schema, this.connection, this.collectionName, this) as unknown as T & ArangoDocument;
  }

  /**
   * Find documents including soft-deleted ones
   */
  findWithDeleted(query?: Record<string, any>): Query<T & ArangoDocument> {
    const tenantQuery = this.addTenantFilter(query);
    return new Query<T & ArangoDocument>(this.connection, this.collectionName, {
      ...(tenantQuery ? { where: tenantQuery } : {}),
      softDeleteEnabled: this.softDeleteEnabled,
      includeDeleted: true
    });
  }

  /**
   * Find only soft-deleted documents
   */
  findDeleted(query?: Record<string, any>): Query<T & ArangoDocument> {
    const tenantQuery = this.addTenantFilter(query);
    return new Query<T & ArangoDocument>(this.connection, this.collectionName, {
      ...(tenantQuery ? { where: tenantQuery } : {}),
      softDeleteEnabled: this.softDeleteEnabled,
      onlyDeleted: true
    });
  }

  /**
   * Restore a soft-deleted document
   */
  async restore(id: string): Promise<(T & ArangoDocument) | null> {
    if (!this.softDeleteEnabled) {
      throw new Error('Soft delete is not enabled for this model');
    }

    try {
      const collection = this.connection.collection(this.collectionName);
      const doc = await collection.document(id);
      if (!doc || doc.isDeleted !== true) {
        return null;
      }

      // Check tenant if enabled
      if (this.tenantEnabled) {
        const tenantId = TenantContext.get();
        if (tenantId && doc[this.tenantField] !== tenantId) {
          return null; // Document belongs to different tenant
        }
      }

      // Restore the document
      await collection.update(id, { isDeleted: false, deletedAt: null });
      const restoredDoc = await collection.document(id);
      const document = new Document(restoredDoc, this.schema, this.connection, this.collectionName, this);
      return document as unknown as T & ArangoDocument;
    } catch (error: any) {
      if (error.errorNum === 1202) {
        return null;
      }
      throw new DocumentNotFoundError(`Failed to restore document: ${error.message}`);
    }
  }

  /**
   * Permanently delete a document (hard delete)
   */
  async hardDelete(id: string): Promise<boolean> {
    try {
      const collection = this.connection.collection(this.collectionName);
      const doc = await collection.document(id);
      if (!doc) {
        return false;
      }

      // Check tenant if enabled
      if (this.tenantEnabled) {
        const tenantId = TenantContext.get();
        if (tenantId && doc[this.tenantField] !== tenantId) {
          return false; // Document belongs to different tenant
        }
      }

      // Log audit entry before deletion
      if (this.auditEnabled && this.auditLog) {
        await this.logAudit('delete', id, doc._key, doc, undefined);
      }

      await collection.remove(id);
      return true;
    } catch (error: any) {
      if (error.errorNum === 1202) {
        return false;
      }
      throw new DocumentNotFoundError(`Failed to hard delete document: ${error.message}`);
    }
  }

  /**
   * Get audit logs for a document
   */
  async getAuditLogs(documentId: string, limit?: number): Promise<AuditEntry[]> {
    if (!this.auditEnabled || !this.auditLog) {
      throw new Error('Audit is not enabled for this model');
    }
    return await this.auditLog.getLogs(documentId, limit);
  }

  /**
   * Get audit logs by user
   */
  async getAuditLogsByUser(userId: string, limit?: number): Promise<AuditEntry[]> {
    if (!this.auditEnabled || !this.auditLog) {
      throw new Error('Audit is not enabled for this model');
    }
    return await this.auditLog.getLogsByUser(userId, limit);
  }

  /**
   * Get audit logs by action
   */
  async getAuditLogsByAction(action: 'create' | 'update' | 'delete', limit?: number): Promise<AuditEntry[]> {
    if (!this.auditEnabled || !this.auditLog) {
      throw new Error('Audit is not enabled for this model');
    }
    return await this.auditLog.getLogsByAction(action, limit);
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

