import { describe, it, expect, afterEach, vi } from 'vitest';
import { initReadingQueue, getReadingQueueDeps, persistAfterQueueAction } from './deps.js';

afterEach(() => {
  // Reset to the no-op defaults so tests never leak injected spies.
  initReadingQueue({ persist: () => {} });
});

describe('readingQueue behavior deps', () => {
  it('no-op defaults do not throw', () => {
    initReadingQueue({ persist: () => {} });
    expect(() => persistAfterQueueAction()).not.toThrow();
  });

  it('injects persist callback', () => {
    const persist = vi.fn();
    const deps = initReadingQueue({ persist });

    expect(deps.persist).toBe(persist);
    expect(getReadingQueueDeps().persist).toBe(persist);
  });

  it('persistAfterQueueAction invokes only the injected persist hook', () => {
    const persist = vi.fn();
    initReadingQueue({ persist });

    persistAfterQueueAction();

    expect(persist).toHaveBeenCalledExactlyOnceWith();
  });
});
