import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  initBookmarks,
  getBookmarksDeps,
  persistAfterBookmarkAction,
  refreshBookmarkGrid,
} from './deps.js';

afterEach(() => {
  // Reset to the no-op defaults so tests never leak injected spies.
  initBookmarks({ persist: () => {}, rerender: () => {} });
});

describe('bookmarks behavior deps', () => {
  it('defaults to no-op persist and rerender before any injection', () => {
    initBookmarks({ persist: () => {}, rerender: () => {} });
    expect(() => persistAfterBookmarkAction()).not.toThrow();
  });

  it('injects persist and rerender callbacks', () => {
    const persist = vi.fn();
    const rerender = vi.fn();
    const deps = initBookmarks({ persist, rerender });

    expect(deps.persist).toBe(persist);
    expect(deps.rerender).toBe(rerender);
    expect(getBookmarksDeps().persist).toBe(persist);
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
    initBookmarks({ persist: persist, rerender });
    refreshBookmarkGrid();
    expect(rerender).toHaveBeenCalledExactlyOnceWith();
    expect(persist).not.toHaveBeenCalled();
  });
});
