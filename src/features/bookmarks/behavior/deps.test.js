import { describe, it, expect, afterEach, vi } from 'vitest';
import { initBookmarks, persistAfterBookmarkAction, refreshBookmarkGrid } from './deps.js';

afterEach(() => {
  // Reset to the no-op defaults so tests never leak injected spies.
  initBookmarks({ persist: () => {}, rerender: () => {} });
});

describe('bookmarks behavior deps', () => {
  it('no-op defaults do not throw', () => {
    initBookmarks({ persist: () => {}, rerender: () => {} });
    expect(() => persistAfterBookmarkAction()).not.toThrow();
  });

  it('injects persist and rerender callbacks', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    const deps = initBookmarks({ persist, rerender });

    expect(deps.persist).toBe(persist);
    expect(deps.rerender).toBe(rerender);
  });

  it('merges partial injection without clobbering the other callback', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    initBookmarks({ persist, rerender });

    const next = initBookmarks({ rerender });
    expect(next.persist).toBe(persist);
    expect(next.rerender).toBe(rerender);
  });

  it('persistAfterBookmarkAction invokes only the injected persist hook', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    initBookmarks({ persist, rerender });

    persistAfterBookmarkAction();

    expect(persist).toHaveBeenCalledExactlyOnceWith();
    expect(rerender).not.toHaveBeenCalled();
  });

  it('refreshBookmarkGrid invokes only the injected rerender hook', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    initBookmarks({ persist, rerender });
    refreshBookmarkGrid();
    expect(rerender).toHaveBeenCalledExactlyOnceWith();
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('queue toggle calls persist and rerender hooks', () => {
  it('invokes both persist and rerender hooks', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    initBookmarks({ persist, rerender });

    // Simulate what card.js does on queue toggle
    persistAfterBookmarkAction();
    refreshBookmarkGrid();

    expect(persist).toHaveBeenCalledExactlyOnceWith();
    expect(rerender).toHaveBeenCalledExactlyOnceWith();
  });
});
