import { Database } from 'arangojs';

export interface BulkWriteOptions {
  ordered?: boolean;
  writeConcern?: number;
}

export interface BulkOperation {
  type: 'insert' | 'update' | 'replace' | 'remove' | 'upsert';
  collection: string;
  data?: any;
  filter?: Record<string, any>;
  update?: Record<string, any>;
}

export class BulkOperations {
  private database: Database;
  private operations: BulkOperation[] = [];

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Add insert operation
   */
  insert(collection: string, documents: any[]): this {
    for (const doc of documents) {
      this.operations.push({
        type: 'insert',
        collection,
        data: doc,
      });
    }
    return this;
  }

  /**
   * Add update operation
   */
  update(collection: string, filter: Record<string, any>, update: Record<string, any>): this {
    this.operations.push({
      type: 'update',
      collection,
      filter,
      update,
    });
    return this;
  }

  /**
   * Add replace operation
   */
  replace(collection: string, filter: Record<string, any>, replacement: any): this {
    this.operations.push({
      type: 'replace',
      collection,
      filter,
      data: replacement,
    });
    return this;
  }

  /**
   * Add remove operation
   */
  remove(collection: string, filter: Record<string, any>): this {
    this.operations.push({
      type: 'remove',
      collection,
      filter,
    });
    return this;
  }

  /**
   * Add upsert operation
   */
  upsert(collection: string, filter: Record<string, any>, data: any): this {
    this.operations.push({
      type: 'upsert',
      collection,
      filter,
      data,
    });
    return this;
  }

  /**
   * Execute all operations
   */
  async execute(options: BulkWriteOptions = {}): Promise<BulkOperationResult[]> {
    const { ordered = true } = options;
    const results: BulkOperationResult[] = [];

    if (ordered) {
      // Execute sequentially
      for (const op of this.operations) {
        try {
          const result = await this.executeOperation(op);
          results.push({ success: true, operation: op, result });
        } catch (error: any) {
          results.push({ success: false, operation: op, error: error.message });
          if (ordered) break; // Stop on first error if ordered
        }
      }
    } else {
      // Execute in parallel
      const promises = this.operations.map(async (op) => {
        try {
          const result = await this.executeOperation(op);
          return { success: true, operation: op, result };
        } catch (error: any) {
          return { success: false, operation: op, error: error.message };
        }
      });
      const opResults = await Promise.all(promises);
      results.push(...opResults);
    }

    this.operations = []; // Clear operations after execution
    return results;
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(op: BulkOperation): Promise<any> {
    const collection = this.database.collection(op.collection);

    switch (op.type) {
      case 'insert':
        if (Array.isArray(op.data)) {
          return await collection.saveAll(op.data);
        }
        return await collection.save(op.data);

      case 'update':
        // Build AQL update query
        const updateQuery = this.buildUpdateQuery(op);
        const cursor = await this.database.query(updateQuery.query, updateQuery.bindVars);
        return await cursor.all();

      case 'replace':
        const replaceQuery = this.buildReplaceQuery(op);
        const replaceCursor = await this.database.query(replaceQuery.query, replaceQuery.bindVars);
        return await replaceCursor.all();

      case 'remove':
        const removeQuery = this.buildRemoveQuery(op);
        const removeCursor = await this.database.query(removeQuery.query, removeQuery.bindVars);
        return await removeCursor.all();

      case 'upsert':
        // Use INSERT ... UPDATE pattern
        const upsertQuery = this.buildUpsertQuery(op);
        const upsertCursor = await this.database.query(upsertQuery.query, upsertQuery.bindVars);
        return await upsertCursor.all();

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  private buildUpdateQuery(op: BulkOperation): { query: string; bindVars: Record<string, any> } {
    const filterParts: string[] = [];
    const bindVars: Record<string, any> = { ...op.update };
    let varCounter = 0;

    for (const [key, value] of Object.entries(op.filter || {})) {
      const varName = `filter${varCounter++}`;
      bindVars[varName] = value;
      filterParts.push(`doc.${key} == @${varName}`);
    }

    const updateParts: string[] = [];
    for (const [key, value] of Object.entries(op.update || {})) {
      const varName = `update${varCounter++}`;
      bindVars[varName] = value;
      updateParts.push(`${key}: @${varName}`);
    }

    const query = `
      FOR doc IN @@collection
      FILTER ${filterParts.join(' AND ')}
      UPDATE doc WITH { ${updateParts.join(', ')} } IN @@collection
      RETURN NEW
    `;

    bindVars['@collection'] = op.collection;

    return { query, bindVars };
  }

  private buildReplaceQuery(op: BulkOperation): { query: string; bindVars: Record<string, any> } {
    const filterParts: string[] = [];
    const bindVars: Record<string, any> = { replacement: op.data };
    let varCounter = 0;

    for (const [key, value] of Object.entries(op.filter || {})) {
      const varName = `filter${varCounter++}`;
      bindVars[varName] = value;
      filterParts.push(`doc.${key} == @${varName}`);
    }

    const query = `
      FOR doc IN @@collection
      FILTER ${filterParts.join(' AND ')}
      REPLACE doc WITH @replacement IN @@collection
      RETURN NEW
    `;

    bindVars['@collection'] = op.collection;

    return { query, bindVars };
  }

  private buildRemoveQuery(op: BulkOperation): { query: string; bindVars: Record<string, any> } {
    const filterParts: string[] = [];
    const bindVars: Record<string, any> = {};
    let varCounter = 0;

    for (const [key, value] of Object.entries(op.filter || {})) {
      const varName = `filter${varCounter++}`;
      bindVars[varName] = value;
      filterParts.push(`doc.${key} == @${varName}`);
    }

    const query = `
      FOR doc IN @@collection
      FILTER ${filterParts.join(' AND ')}
      REMOVE doc IN @@collection
      RETURN OLD
    `;

    bindVars['@collection'] = op.collection;

    return { query, bindVars };
  }

  private buildUpsertQuery(op: BulkOperation): { query: string; bindVars: Record<string, any> } {
    const filterParts: string[] = [];
    const bindVars: Record<string, any> = { ...op.data };
    let varCounter = 0;

    for (const [key, value] of Object.entries(op.filter || {})) {
      const varName = `filter${varCounter++}`;
      bindVars[varName] = value;
      filterParts.push(`doc.${key} == @${varName}`);
    }

    const insertData = { ...op.data };
    const updateData = { ...op.data };

    const query = `
      UPSERT { ${Object.keys(op.filter || {}).map((k, i) => `${k}: @filter${i}`).join(', ')} }
      INSERT @insertData
      UPDATE @updateData IN @@collection
      RETURN NEW
    `;

    bindVars.insertData = insertData;
    bindVars.updateData = updateData;
    bindVars['@collection'] = op.collection;

    return { query, bindVars };
  }

  /**
   * Clear all operations
   */
  clear(): this {
    this.operations = [];
    return this;
  }

  /**
   * Get operation count
   */
  count(): number {
    return this.operations.length;
  }
}

export interface BulkOperationResult {
  success: boolean;
  operation: BulkOperation;
  result?: any;
  error?: string;
}

