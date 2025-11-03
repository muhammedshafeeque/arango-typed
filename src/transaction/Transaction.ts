import { Database } from 'arangojs';

export interface TransactionOptions {
  read?: string[];
  write?: string[];
  exclusive?: string[];
  waitForSync?: boolean;
  lockTimeout?: number;
}

export class TransactionManager {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Execute a transaction
   */
  async execute<T>(
    action: string | ((trx: any) => T | Promise<T>),
    options: TransactionOptions = {}
  ): Promise<T> {
    const collections: { read?: string[]; write?: string[]; exclusive?: string[] } = {};

    if (options.read) collections.read = options.read;
    if (options.write) collections.write = options.write;
    if (options.exclusive) collections.exclusive = options.exclusive;

    const transaction = await this.database.beginTransaction(
      collections,
      {
        waitForSync: options.waitForSync || false,
        lockTimeout: options.lockTimeout || 10,
      }
    );

    try {
      let result: T;

      if (typeof action === 'function') {
        // Execute function with transaction context
        result = await action(transaction);
      } else {
        // Execute AQL action string using transaction
        const cursor = await (transaction as any).query(action, {});
        result = await cursor.all() as T;
      }

      await transaction.commit();
      return result;
    } catch (error: any) {
      await transaction.abort();
      throw error;
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async executeBatch<T>(
    operations: Array<(trx: any) => Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.execute(async (trx: any) => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation(trx);
        results.push(result);
      }
      return results;
    }, options);
  }
}

