import { CacheManager, CacheOptions } from './CacheManager';

export class MemoryCache extends CacheManager {
  constructor(options: CacheOptions = {}) {
    super(options);
  }
}


