import { CacheStrategy } from './CacheStrategy';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'lfu';
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt?: number;
  createdAt: number;
}

export class CacheManager {
  private strategy: CacheStrategy;
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 3600000, // 1 hour default
      maxSize: options.maxSize || 1000,
      strategy: options.strategy || 'lru',
    };
    
    this.strategy = new CacheStrategy(this.options);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.strategy.get<CacheEntry<T>>(key);
    
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.strategy.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl 
      ? Date.now() + ttl 
      : this.options.ttl 
        ? Date.now() + this.options.ttl 
        : undefined;

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt,
      createdAt: Date.now(),
    };

    this.strategy.set(key, entry);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.strategy.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.strategy.clear();
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.strategy.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.strategy.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
  } {
    return this.strategy.getStats();
  }

  /**
   * Generate cache key from query
   */
  generateKey(collection: string, query: Record<string, any>): string {
    const queryStr = JSON.stringify(query);
    return `cache:${collection}:${this.hash(queryStr)}`;
  }

  /**
   * Hash string to create cache key
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

