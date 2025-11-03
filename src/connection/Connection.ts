import { Database } from 'arangojs';
import { ConnectionError } from '../errors/ArangoError';
import { ConnectionOptions } from '../types';

// Connection cache for reuse (performance optimization)
const connectionCache = new Map<string, Database>();

export interface SimplifiedConnectionOptions {
  url?: string;
  database?: string;
  databaseName?: string; // Backward compatibility
  username?: string;
  password?: string;
  auth?: {
    username: string;
    password: string;
  };
  agent?: any;
  arangoVersion?: number;
  autoCreateDatabase?: boolean;
}

export class Connection {
  private database: Database | null = null;
  private options: ConnectionOptions;
  private connected: boolean = false;
  private connectionKey: string;

  constructor(options: ConnectionOptions) {
    this.options = options;
    // Generate cache key for connection reuse
    const url = Array.isArray(options.url) ? options.url[0] : options.url;
    const db = options.databaseName || '';
    const user = options.auth?.username || '';
    this.connectionKey = `${url}|${db}|${user}`;
  }

  /**
   * Connect to ArangoDB
   * Optimized with connection caching for reuse
   */
  async connect(): Promise<Database> {
    if (this.connected && this.database) {
      return this.database;
    }

    // Check cache first (performance optimization)
    const cached = connectionCache.get(this.connectionKey);
    if (cached) {
      try {
        // Verify cached connection is still valid
        await cached.version();
        this.database = cached;
        this.connected = true;
        return this.database;
      } catch {
        // Cached connection invalid, create new one
        connectionCache.delete(this.connectionKey);
      }
    }

    try {
      const config: any = {
        url: this.options.url,
      };

      if (this.options.auth) {
        config.auth = this.options.auth;
      }

      if (this.options.agent) {
        config.agent = this.options.agent;
      }

      if (this.options.arangoVersion) {
        config.arangoVersion = this.options.arangoVersion;
      }

      this.database = new Database(config);

      if (this.options.databaseName) {
        this.database = this.database.database(this.options.databaseName);
      }

      // Test connection
      await this.database.version();

      // Cache the connection for reuse
      connectionCache.set(this.connectionKey, this.database);

      this.connected = true;
      return this.database;
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      const dbName = this.options.databaseName;
      const wantAutoCreate = this.options.autoCreateDatabase !== false; // default true
      const canAutoCreate = !!dbName && wantAutoCreate;

      // Auto-create database if not found, then retry
      if (canAutoCreate && (msg.includes('database not found') || msg.includes('not found'))) {
        try {
          const base = new Database({
            url: this.options.url,
            auth: this.options.auth,
            agent: this.options.agent,
            arangoVersion: this.options.arangoVersion,
          } as any);

          // Create database if it doesn't exist
          await base.createDatabase(dbName as string);

          // Now get handle to the new database and verify
          this.database = base.database(dbName as string);
          await this.database.version();

          connectionCache.set(this.connectionKey, this.database);
          this.connected = true;
          return this.database;
        } catch (createErr: any) {
          throw new ConnectionError(
            `Failed to connect to ArangoDB: ${error.message || 'Unknown error'} (auto-create failed: ${createErr?.message || createErr})`
          );
        }
      }

      throw new ConnectionError(
        `Failed to connect to ArangoDB: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): Database {
    if (!this.database || !this.connected) {
      throw new ConnectionError('Not connected to ArangoDB. Call connect() first.');
    }
    return this.database;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from ArangoDB
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.database = null;
  }

  /**
   * Set the default database for this connection
   */
  useDatabase(databaseName: string): Database {
    if (!this.database) {
      throw new ConnectionError('Not connected to ArangoDB. Call connect() first.');
    }
    this.database = this.database.database(databaseName);
    return this.database;
  }
}

// Default connection instance
let defaultConnection: Connection | null = null;

/**
 * Create a default connection
 * Mongoose-like API: Supports both string and object formats
 * 
 * @example
 * // String format (Mongoose-like)
 * await connect('http://localhost:8529/myapp', { username: 'root', password: '' })
 * 
 * @example
 * // Object format (simplified)
 * await connect({ url: 'http://localhost:8529', database: 'myapp', username: 'root', password: '' })
 * 
 * @example
 * // Full options (backward compatible)
 * await connect({ url: 'http://localhost:8529', databaseName: 'myapp', auth: { username: 'root', password: '' } })
 */
export function connect(
  uriOrOptions: string | ConnectionOptions | SimplifiedConnectionOptions,
  options?: { username?: string; password?: string }
): Promise<Database> {
  let connectionOptions: ConnectionOptions;

  // Handle Mongoose-like string format: connect('url/database', { username, password })
  if (typeof uriOrOptions === 'string') {
    // Parse URI format: http://host:port/database
    const urlMatch = uriOrOptions.match(/^(https?:\/\/[^\/]+)(?:\/(.+))?$/);
    if (!urlMatch) {
      throw new ConnectionError('Invalid connection URI format');
    }

    const url = urlMatch[1];
    const databaseName = urlMatch[2] || undefined;

    connectionOptions = {
      url,
      databaseName,
      auth: options?.username && options?.password
        ? { username: options.username, password: options.password }
        : undefined,
    };
  } else {
    // Handle object format - simplify options
    const opts = uriOrOptions as SimplifiedConnectionOptions;
    
    // Support both 'database' and 'databaseName' (backward compatibility)
    const databaseName = opts.database || opts.databaseName;

    // Support both simplified auth and nested auth object
    let auth: { username: string; password: string } | undefined;
    if (opts.username && opts.password) {
      auth = { username: opts.username, password: opts.password };
    } else if (opts.auth) {
      auth = opts.auth;
    }

    connectionOptions = {
      url: opts.url || 'http://localhost:8529',
      databaseName,
      auth,
      agent: opts.agent,
      arangoVersion: opts.arangoVersion,
      autoCreateDatabase: opts.autoCreateDatabase,
    };
  }

  defaultConnection = new Connection(connectionOptions);
  return defaultConnection.connect();
}

/**
 * Get the default connection
 */
export function getConnection(): Connection {
  if (!defaultConnection) {
    throw new ConnectionError('No default connection. Call connect() first.');
  }
  return defaultConnection;
}

/**
 * Get the default database
 */
export function getDatabase(): Database {
  return getConnection().getDatabase();
}

/**
 * Get graph manager for default connection
 */
export function getGraphManager(): import('../graph/Graph').GraphManager {
  const { GraphManager } = require('../graph/Graph');
  return new GraphManager(getDatabase());
}

/**
 * Get vector search for default connection
 */
export function getVectorSearch(): import('../vector/VectorSearch').VectorSearch {
  const { VectorSearch } = require('../vector/VectorSearch');
  return new VectorSearch(getDatabase());
}

/**
 * Get transaction manager for default connection
 */
export function getTransactionManager(): import('../transaction/Transaction').TransactionManager {
  const { TransactionManager } = require('../transaction/Transaction');
  return new TransactionManager(getDatabase());
}

/**
 * Get search manager for default connection
 */
export function getSearchManager(): import('../search/Search').SearchManager {
  const { SearchManager } = require('../search/Search');
  return new SearchManager(getDatabase());
}

/**
 * Get geo query manager for default connection
 */
export function getGeoQuery(): import('../geo/GeoQuery').GeoQuery {
  const { GeoQuery } = require('../geo/GeoQuery');
  return new GeoQuery(getDatabase());
}

/**
 * Get bulk operations manager for default connection
 */
export function getBulkOperations(): import('../bulk/BulkOperations').BulkOperations {
  const { BulkOperations } = require('../bulk/BulkOperations');
  return new BulkOperations(getDatabase());
}

