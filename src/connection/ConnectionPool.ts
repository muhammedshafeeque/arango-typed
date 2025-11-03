import { Database } from 'arangojs';
import { Connection } from './Connection';

export interface PoolOptions {
  min?: number;
  max?: number;
  idleTimeout?: number;
  acquireTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class ConnectionPool {
  private connections: Connection[] = [];
  private available: Connection[] = [];
  private inUse: Set<Connection> = new Set();
  private options: Required<PoolOptions>;
  private createConnection: () => Connection;

  constructor(
    createConnection: () => Connection,
    options: PoolOptions = {}
  ) {
    this.createConnection = createConnection;
    this.options = {
      min: options.min || 2,
      max: options.max || 10,
      idleTimeout: options.idleTimeout || 30000,
      acquireTimeout: options.acquireTimeout || 60000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  /**
   * Initialize pool with minimum connections
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.options.min; i++) {
      const conn = await this.createNewConnection();
      this.available.push(conn);
    }
  }

  /**
   * Get a connection from the pool
   */
  async acquire(): Promise<Connection> {
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > this.options.acquireTimeout) {
        throw new Error('Connection pool timeout: unable to acquire connection');
      }

      // Try to get available connection
      let connection = this.available.pop();
      
      if (!connection) {
        // Try to create new connection if under max
        if (this.connections.length < this.options.max) {
          connection = await this.createNewConnection();
        } else {
          // Wait and retry
          await this.sleep(100);
          continue;
        }
      }

      // Check if connection is still valid
      if (connection && connection.isConnected()) {
        this.inUse.add(connection);
        return connection;
      } else {
        // Connection is dead, remove it
        this.removeConnection(connection!);
      }
    }
  }

  /**
   * Release connection back to pool
   */
  release(connection: Connection): void {
    if (this.inUse.has(connection)) {
      this.inUse.delete(connection);
      
      if (connection.isConnected()) {
        this.available.push(connection);
      } else {
        this.removeConnection(connection);
      }
    }
  }

  /**
   * Create a new connection
   */
  private async createNewConnection(): Promise<Connection> {
    const conn = this.createConnection();
    await conn.connect();
    this.connections.push(conn);
    return conn;
  }

  /**
   * Remove connection from pool
   */
  private removeConnection(connection: Connection): void {
    const index = this.connections.indexOf(connection);
    if (index > -1) {
      this.connections.splice(index, 1);
    }
    this.inUse.delete(connection);
    const availableIndex = this.available.indexOf(connection);
    if (availableIndex > -1) {
      this.available.splice(availableIndex, 1);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    max: number;
  } {
    return {
      total: this.connections.length,
      available: this.available.length,
      inUse: this.inUse.size,
      max: this.options.max,
    };
  }

  /**
   * Close all connections in pool
   */
  async close(): Promise<void> {
    await Promise.all(this.connections.map((conn) => conn.disconnect()));
    this.connections = [];
    this.available = [];
    this.inUse.clear();
  }

  /**
   * Execute function with connection from pool
   */
  async withConnection<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      return await fn(connection.getDatabase());
    } finally {
      this.release(connection);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

