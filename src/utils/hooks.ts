import { HookType, HookCallback } from '../types';

export type HookPhase = 'pre' | 'post';

export interface RegisteredHook {
  type: HookType;
  phase: HookPhase;
  callback: HookCallback;
  parallel?: boolean;
}

export class HookRegistry {
  private hooks: RegisteredHook[] = [];

  /**
   * Register a hook
   */
  register(type: HookType, phase: HookPhase, callback: HookCallback, options?: { parallel?: boolean }): void {
    this.hooks.push({
      type,
      phase,
      callback,
      parallel: options?.parallel ?? false,
    });
  }

  /**
   * Register a pre-hook
   */
  pre(type: HookType, callback: HookCallback): void {
    this.register(type, 'pre', callback);
  }

  /**
   * Register a post-hook
   */
  post(type: HookType, callback: HookCallback): void {
    this.register(type, 'post', callback);
  }

  /**
   * Execute hooks for a given type and phase
   */
  async execute(type: HookType, phase: HookPhase, doc: any): Promise<void> {
    const relevantHooks = this.hooks.filter(
      (hook) => hook.type === type && hook.phase === phase
    );

    const parallelHooks = relevantHooks.filter((h) => h.parallel);
    const sequentialHooks = relevantHooks.filter((h) => !h.parallel);

    // Execute parallel hooks first (if any)
    if (parallelHooks.length > 0) {
      await Promise.all(parallelHooks.map((hook) => hook.callback(doc)));
    }

    // Execute sequential hooks
    for (const hook of sequentialHooks) {
      await hook.callback(doc);
    }
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks = [];
  }

  /**
   * Remove hooks for a specific type
   */
  remove(type: HookType): void {
    this.hooks = this.hooks.filter((hook) => hook.type !== type);
  }

  /**
   * Check if a hook exists for a given type and phase
   */
  has(type: HookType, phase: HookPhase): boolean {
    return this.hooks.some((hook) => hook.type === type && hook.phase === phase);
  }
}

