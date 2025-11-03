import { HookRegistry } from '../../src/utils/hooks';

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it('should register and execute pre hooks', async () => {
    const preSaveHook = jest.fn();

    registry.pre('save', preSaveHook);

    const doc = { name: 'Test' };
    await registry.execute('save', 'pre', doc);

    expect(preSaveHook).toHaveBeenCalledWith(doc);
  });

  it('should register and execute post hooks', async () => {
    const postSaveHook = jest.fn();

    registry.post('save', postSaveHook);

    const doc = { name: 'Test' };
    await registry.execute('save', 'post', doc);

    expect(postSaveHook).toHaveBeenCalledWith(doc);
  });

  it('should execute multiple hooks in sequence', async () => {
    const callOrder: number[] = [];
    const hook1 = jest.fn(() => {
      callOrder.push(1);
    });
    const hook2 = jest.fn(() => {
      callOrder.push(2);
    });

    registry.pre('save', hook1);
    registry.pre('save', hook2);

    const doc = { name: 'Test' };
    await registry.execute('save', 'pre', doc);

    expect(hook1).toHaveBeenCalled();
    expect(hook2).toHaveBeenCalled();
    expect(callOrder).toEqual([1, 2]);
  });

  it('should execute parallel hooks simultaneously', async () => {
    const hook1 = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10)));
    const hook2 = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10)));

    registry.register('save', 'pre', hook1, { parallel: true });
    registry.register('save', 'pre', hook2, { parallel: true });

    const start = Date.now();
    await registry.execute('save', 'pre', {});
    const duration = Date.now() - start;

    // Both hooks should execute in parallel, so total time should be ~10ms (parallel), not ~20ms (sequential)
    // Allow some margin for timing variance (25ms should be safe even with system delays)
    expect(duration).toBeLessThan(25);
    // Also verify that both hooks were called
    expect(hook1).toHaveBeenCalled();
    expect(hook2).toHaveBeenCalled();
  });

  it('should clear all hooks', () => {
    registry.pre('save', jest.fn());
    registry.pre('remove', jest.fn());

    expect((registry as any).hooks.length).toBe(2);

    registry.clear();

    expect((registry as any).hooks.length).toBe(0);
  });

  it('should remove hooks by type', () => {
    registry.pre('save', jest.fn());
    registry.pre('remove', jest.fn());
    registry.post('save', jest.fn());

    expect((registry as any).hooks.length).toBe(3);

    registry.remove('save');

    expect((registry as any).hooks.length).toBe(1);
    expect((registry as any).hooks[0].type).toBe('remove');
  });
});

