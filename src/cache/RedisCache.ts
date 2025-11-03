import { CacheManager, CacheOptions } from './CacheManager';

export interface RedisCacheOptions extends CacheOptions {
  redis?: any; // Redis client instance
  keyPrefix?: string;
}

export class RedisCache extends CacheManager {
  private redis?: any;
  private keyPrefix: string;

  constructor(options: RedisCacheOptions = {}) {
    super(options);
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix || 'arango-typed:';
  }

  /**
   * Override get to use Redis
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) {
      return super.get<T>(key);
    }

    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      try {
        const parsed = JSON.parse(value);
        return parsed as T;
      } catch (parseError) {
        // Invalid JSON - return null and let fallback handle it
        return null;
      }
    } catch (error) {
      // Fallback to memory cache on error
      return super.get<T>(key);
    }
  }

  /**
   * Override set to use Redis
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.redis) {
      return super.set(key, value, ttl);
    }

    try {
      const fullKey = this.keyPrefix + key;
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(fullKey, Math.floor(ttl / 1000), serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
    } catch (error) {
      // Fallback to memory cache on error
      await super.set(key, value, ttl);
    }
  }

  /**
   * Override delete to use Redis
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(this.keyPrefix + key);
      } catch (error) {
        // Continue to memory cache deletion
      }
    }
    await super.delete(key);
  }

  /**
   * Override clear to use Redis
   */
  async clear(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(this.keyPrefix + '*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        // Continue to memory cache clear
      }
    }
    await super.clear();
  }
}


