import { ArangoDocument } from '../types';
import { Schema } from '../schema/Schema';
import { Database } from 'arangojs';
import { isNewDocument } from '../utils/helpers';
import { DocumentNotFoundError } from '../errors/ArangoError';
import { Model } from './Model';

export class Document implements ArangoDocument {
  _id?: string;
  _key?: string;
  _rev?: string;
  [key: string]: any;

  private schema: Schema;
  private database: Database;
  private collectionName: string;
  private isNew: boolean;
  private modifiedFields: Set<string> = new Set();
  private model?: Model<any>;

  constructor(
    data: Partial<ArangoDocument>,
    schema: Schema,
    database: Database,
    collectionName: string,
    model?: Model<any>
  ) {
    this.schema = schema;
    this.database = database;
    this.collectionName = collectionName;
    this.model = model;
    this.isNew = isNewDocument(data as ArangoDocument);

    // Apply defaults
    const withDefaults = schema.applyDefaults(data || {});

    // Apply setters
    const withSetters = schema.applySetters(withDefaults);

    // Copy properties
    Object.assign(this, withSetters);

    // Store original data for dirty checking
    if (!this.isNew && this._key) {
      // Load existing document to compare
      this.markClean();
    }
  }

  /**
   * Mark all fields as clean
   */
  markClean(): void {
    this.modifiedFields.clear();
  }

  /**
   * Check if document is new
   */
  isNewDoc(): boolean {
    return this.isNew;
  }

  /**
   * Check if document is modified
   */
  isModified(path?: string): boolean {
    if (path) {
      return this.modifiedFields.has(path);
    }
    return this.modifiedFields.size > 0;
  }

  /**
   * Mark a field as modified
   */
  markModified(path: string): void {
    this.modifiedFields.add(path);
  }

  /**
   * Get modified fields
   */
  getModifiedPaths(): string[] {
    return Array.from(this.modifiedFields);
  }

  /**
   * Save the document
   */
  async save(options: { validateBeforeSave?: boolean } = {}): Promise<this> {
    const { validateBeforeSave = true } = options;

    // Execute pre-save hooks
    await this.schema.hooks.execute('save', 'pre', this);

    // Validate if needed
    if (validateBeforeSave) {
      await this.schema.hooks.execute('validate', 'pre', this);
      await this.schema.validate(this.toObject());
      await this.schema.hooks.execute('validate', 'post', this);
    }

    // Prepare data (exclude internal fields temporarily)
    const data = this.toObject();
    delete data._id;
    delete data._key;
    delete data._rev;

    // Apply getters
    const finalData = this.schema.applyGetters(data);

    try {
      const collection = this.database.collection(this.collectionName);

      if (this.isNew) {
        // Insert new document
        const meta = await collection.save(finalData, { returnNew: true });
        this._id = meta._id;
        this._key = meta._key;
        this._rev = meta._rev;
        this.isNew = false;
      } else {
        // Update existing document
        if (!this._key) {
          throw new Error('Cannot save: document has no _key');
        }
        const meta = await collection.update(this._key, finalData, { returnNew: true });
        this._rev = meta._rev;
        if (meta.new) {
          Object.assign(this, meta.new);
        }
      }

      this.markClean();

      // Execute post-save hooks
      await this.schema.hooks.execute('save', 'post', this);

      return this;
    } catch (error: any) {
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  /**
   * Remove the document
   * Performs soft delete if soft delete is enabled on the model, otherwise hard delete
   */
  async remove(): Promise<void> {
    if (this.isNew) {
      throw new Error('Cannot remove: document is new');
    }

    if (!this._key) {
      throw new Error('Cannot remove: document has no _key');
    }

    // Check if soft delete is enabled
    const softDeleteEnabled = (this.model as any)?.softDeleteEnabled ?? false;
    
    if (softDeleteEnabled) {
      await this.softDelete();
    } else {
      await this.hardDelete();
    }
  }

  /**
   * Soft delete the document (sets isDeleted: true and deletedAt: Date)
   */
  async softDelete(): Promise<void> {
    if (this.isNew) {
      throw new Error('Cannot soft delete: document is new');
    }

    if (!this._key) {
      throw new Error('Cannot soft delete: document has no _key');
    }

    // Execute pre-remove hooks (reuse remove hooks for soft delete)
    await this.schema.hooks.execute('remove', 'pre', this);

    try {
      const collection = this.database.collection(this.collectionName);
      const now = new Date();
      await collection.update(this._key, { isDeleted: true, deletedAt: now });

      // Update local document
      this.isDeleted = true;
      this.deletedAt = now;

      // Execute post-remove hooks
      await this.schema.hooks.execute('remove', 'post', this);
    } catch (error: any) {
      throw new DocumentNotFoundError(`Failed to soft delete document: ${error.message}`);
    }
  }

  /**
   * Permanently delete the document (hard delete)
   */
  async hardDelete(): Promise<void> {
    if (this.isNew) {
      throw new Error('Cannot remove: document is new');
    }

    if (!this._key) {
      throw new Error('Cannot remove: document has no _key');
    }

    // Execute pre-remove hooks
    await this.schema.hooks.execute('remove', 'pre', this);

    try {
      const collection = this.database.collection(this.collectionName);
      await collection.remove(this._key);

      // Execute post-remove hooks
      await this.schema.hooks.execute('remove', 'post', this);

      // Mark as deleted
      this._id = undefined;
      this._key = undefined;
      this._rev = undefined;
    } catch (error: any) {
      throw new DocumentNotFoundError(`Failed to remove document: ${error.message}`);
    }
  }

  /**
   * Restore a soft-deleted document
   */
  async restore(): Promise<void> {
    if (this.isNew) {
      throw new Error('Cannot restore: document is new');
    }

    if (!this._key) {
      throw new Error('Cannot restore: document has no _key');
    }

    if (this.isDeleted !== true) {
      throw new Error('Cannot restore: document is not soft-deleted');
    }

    try {
      const collection = this.database.collection(this.collectionName);
      await collection.update(this._key, { isDeleted: false, deletedAt: null });

      // Update local document
      this.isDeleted = false;
      this.deletedAt = undefined;
    } catch (error: any) {
      throw new DocumentNotFoundError(`Failed to restore document: ${error.message}`);
    }
  }

  /**
   * Update the document
   */
  async update(update: Partial<this>, options: { validate?: boolean } = {}): Promise<this> {
    const { validate = true } = options;

    // Merge updates
    Object.assign(this, update);

    // Mark fields as modified
    for (const key of Object.keys(update)) {
      if (key !== '_id' && key !== '_key' && key !== '_rev') {
        this.markModified(key);
      }
    }

    // Save
    return this.save({ validateBeforeSave: validate });
  }

  /**
   * Convert document to plain object
   */
  toObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const key in this) {
      if (
        !['schema', 'database', 'collectionName', 'isNew', 'modifiedFields'].includes(key) &&
        typeof (this as any)[key] !== 'function'
      ) {
        obj[key] = (this as any)[key];
      }
    }
    return obj;
  }

  /**
   * Convert document to JSON
   */
  toJSON(): Record<string, any> {
    return this.toObject();
  }
}

