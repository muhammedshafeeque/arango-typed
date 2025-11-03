import { CacheEntry } from './CacheManager';

export class CacheStrategy {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private strategy: 'lru' | 'fifo' | 'lfu';
  private accessCount: Map<string, number> = new Map();
  private accessOrder: string[] = [];
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: { maxSize: number; strategy: string }) {
    this.maxSize = options.maxSize;
    this.strategy = options.strategy as 'lru' | 'fifo' | 'lfu';
  }

  /**
   * Get entry from cache
   */
  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    this.hits++;
    
    // Update access tracking based on strategy
    if (this.strategy === 'lru') {
      this.updateLRU(key);
    } else if (this.strategy === 'lfu') {
      this.updateLFU(key);
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Set entry in cache
   */
  set(key: string, entry: CacheEntry<any>): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    this.cache.set(key, entry);
    
    // Update access tracking
    if (this.strategy === 'lru') {
      this.updateLRU(key);
    } else if (this.strategy === 'lfu') {
      this.accessCount.set(key, 1);
    } else if (this.strategy === 'fifo') {
      if (!this.accessOrder.includes(key)) {
        this.accessOrder.push(key);
      }
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.accessCount.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.accessCount.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict entry based on strategy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string | null = null;

    if (this.strategy === 'lru') {
      // Remove least recently used (first in order)
      keyToEvict = this.accessOrder[0];
    } else if (this.strategy === 'fifo') {
      // Remove first in (first in order)
      keyToEvict = this.accessOrder[0];
    } else if (this.strategy === 'lfu') {
      // Remove least frequently used
      let minCount = Infinity;
      for (const [key, count] of this.accessCount.entries()) {
        if (count < minCount) {
          minCount = count;
          keyToEvict = key;
        }
      }
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
    }
  }

  /**
   * Update LRU access order
   */
  private updateLRU(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Update LFU access count
   */
  private updateLFU(key: string): void {
    const count = this.accessCount.get(key) || 0;
    this.accessCount.set(key, count + 1);
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
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
    };
  }
}


