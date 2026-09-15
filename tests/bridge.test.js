import { describe, it, expect, beforeAll } from 'vitest';

// main.js publishes the module bridge that index.html's classic script consumes.
beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../src/main.js');
});

describe('main.js bridge (window.IBM)', () => {
  it('exposes every dependency the inline script uses', () => {
    const ibm = globalThis.window.IBM;
    expect(ibm).toBeTruthy();
    for (const key of [
      'state',
      'getFilteredBookmarks',
      'getFilteredBookmarksTop',
      'saveState',
      'loadState',
      'getStorageUsage',
      'normalizeFields',
      'normalizeTags',
      'makeReaderUrl',
    ]) {
      expect(ibm[key], key).toBeDefined();
    }
  });

  it('exposes the state facade setters used by index.html', () => {
    const { state } = globalThis.window.IBM;
    for (const fn of [
      'setBookmarks',
      'setSourceFiles',
      'setActiveFolder',
      'setActiveLang',
      'setActiveTag',
      'setActiveTab',
      'setSearchQuery',
      'setSortBy',
      'setSelectedIds',
      'setSQL',
    ]) {
      expect(typeof state[fn], fn).toBe('function');
    }
  });
});
