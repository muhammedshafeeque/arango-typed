import { HookType } from '../types';

export type MiddlewareFunction = (next: () => Promise<void>) => Promise<void>;

export class MiddlewareRegistry {
  private middlewares: Map<HookType, MiddlewareFunction[]> = new Map();

  /**
   * Register middleware for a hook type
   */
  use(type: HookType, fn: MiddlewareFunction): void {
    if (!this.middlewares.has(type)) {
      this.middlewares.set(type, []);
    }
    this.middlewares.get(type)!.push(fn);
  }

  /**
   * Execute middleware chain
   */
  async execute(type: HookType): Promise<void> {
    const middlewares = this.middlewares.get(type) || [];
    
    const run = async (index: number): Promise<void> => {
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index];
      await middleware(() => run(index + 1));
    };

    await run(0);
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.clear();
  }

  /**
   * Remove middlewares for a specific type
   */
  remove(type: HookType): void {
    this.middlewares.delete(type);
  }
}

