import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB, deleteDB } from 'idb';
import { saveState, loadState, isStateFresh, getStorageUsage, closeDb } from '../src/core/store.js';
import { bookmarks, sourceFiles, setBookmarks, setSourceFiles } from '../src/core/state.js';

const DB_NAME = 'ReadLaterLensDB';

const bookmark = (id) => ({
  id: String(id),
  title: `T${id}`,
  url: `https://e${id}.com`,
  article_preview: `P${id}`,
  content: `P${id}`,
  source_file_id: 'f1',
  source_file_name: 'f.csv',
  detected_language: 'en',
  tags: [],
});

beforeEach(async () => {
  await closeDb();
  await deleteDB(DB_NAME);
  setBookmarks([]);
  setSourceFiles(new Map());
});

describe('store (IndexedDB)', () => {
  it('reports false when nothing has been cached yet', async () => {
    expect(await loadState()).toBe(false);
  });

  it('round-trips bookmarks and source metadata', async () => {
    setBookmarks([bookmark(1), bookmark(2)]);
    setSourceFiles(
      new Map([
        [
          'f1',
          {
            id: 'f1',
            name: 'f.csv',
            type: 'csv',
            originalData: 'a,b\n1,2',
          },
        ],
      ]),
    );
    await saveState();

    setBookmarks([]);
    setSourceFiles(new Map());
    expect(await loadState()).toBe(true);
    expect(bookmarks.map((b) => b.id)).toEqual(['1', '2']);
    expect(sourceFiles.get('f1').name).toBe('f.csv');
    expect(sourceFiles.get('f1').originalData).toBe('a,b\n1,2');
  });

  it('keeps SQLite payloads in memory only', async () => {
    setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'a.db', type: 'db', originalData: new Uint8Array([1, 2, 3]) }],
        ['f2', { id: 'f2', name: 'b.sqlite', type: 'sqlite', originalData: new Uint8Array([4]) }],
        ['f3', { id: 'f3', name: 'c.json', type: 'json', originalData: '{}' }],
      ]),
    );
    await saveState();
    setSourceFiles(new Map());
    await loadState();
    expect(sourceFiles.get('f1').originalData).toBeNull();
    expect(sourceFiles.get('f2').originalData).toBeNull();
    expect(sourceFiles.get('f3').originalData).toBe('{}');
  });

  it('persists the observed SQLite schema so a reload keeps the original shape', async () => {
    // Unlike the payload above, the table layout is a name plus a column list —
    // cheap enough to cache, and the only way save-back stays faithful after a
    // reload (the raw buffer is memory-only).
    const schema = { table: 'articles', columns: ['id', 'title', 'url', 'preview'] };
    setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'a.db', type: 'db', originalData: null, sqliteSchema: schema }],
        // A source cached by a version that predates this field.
        ['f2', { id: 'f2', name: 'b.db', type: 'db', originalData: null }],
        ['f3', { id: 'f3', name: 'c.csv', type: 'csv', originalData: 'x' }],
      ]),
    );
    await saveState();
    setSourceFiles(new Map());
    await loadState();

    expect(sourceFiles.get('f1').sqliteSchema).toEqual(schema);
    expect(sourceFiles.get('f2').sqliteSchema).toBeNull();
    expect(sourceFiles.get('f3').sqliteSchema).toBeNull();
  });

  it('persists the observed CSV header row so a reload keeps the source layout', async () => {
    // A header row is a handful of short strings, so it is cheap to cache and is
    // the only way a per-source CSV export stays faithful after a reload.
    const csvColumns = ['id', 'title', 'url', 'preview'];
    setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'a.csv', type: 'csv', originalData: 'x', csvColumns }],
        // A source cached by a version that predates this field.
        ['f2', { id: 'f2', name: 'b.csv', type: 'csv', originalData: 'x' }],
        ['f3', { id: 'f3', name: 'c.json', type: 'json', originalData: '{}', csvColumns: null }],
      ]),
    );
    await saveState();
    setSourceFiles(new Map());
    await loadState();

    expect(sourceFiles.get('f1').csvColumns).toEqual(csvColumns);
    expect(sourceFiles.get('f2').csvColumns).toBeNull();
    expect(sourceFiles.get('f3').csvColumns).toBeNull();
  });

  it('persists the observed CSV dialect so a reload keeps it', async () => {
    // Two short strings: without them a `;`-delimited or LF source silently
    // returns as comma + CRLF after a reload, having to be re-parsed to guess.
    const csvDialect = { delimiter: ';', linebreak: '\n' };
    setSourceFiles(
      new Map([
        ['f1', { id: 'f1', name: 'a.csv', type: 'csv', originalData: 'x', csvDialect }],
        // A source cached by a version that predates this field. The assertion
        // below covers the WRITE path, not the read: `saveState` is where the
        // `?? null` normalisation happens, so a legacy row is repaired on its
        // way out. `loadState` copies rows verbatim, and a cache read before any
        // re-save leaves the key `undefined` — which `csvUnparseConfig` also
        // falls back from. `csvColumns` behaves the same way, unchanged here.
        ['f2', { id: 'f2', name: 'b.csv', type: 'csv', originalData: 'x' }],
        ['f3', { id: 'f3', name: 'c.json', type: 'json', originalData: '{}', csvDialect: null }],
      ]),
    );
    await saveState();
    setSourceFiles(new Map());
    await loadState();

    expect(sourceFiles.get('f1').csvDialect).toEqual(csvDialect);
    expect(sourceFiles.get('f2').csvDialect).toBeNull();
    expect(sourceFiles.get('f3').csvDialect).toBeNull();
  });
  it('reports true once the working set is written', async () => {
    setBookmarks([bookmark(1)]);

    expect(await saveState()).toEqual({ persisted: true, conflict: false });
  });

  it('reports false (and never rejects) when the write fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realIndexedDB = globalThis.indexedDB;
    try {
      // Dropping the global makes getDb() throw inside saveState(): the failure
      // must surface as `false` (the importer turns it into a toast) instead of
      // escaping as an unhandled rejection.
      await closeDb();
      globalThis.indexedDB = undefined;
      setBookmarks([bookmark(1)]);

      await expect(saveState()).resolves.toEqual({ persisted: false, conflict: false });
      expect(warn).toHaveBeenCalledWith('IndexedDB save failed:', expect.anything());
    } finally {
      globalThis.indexedDB = realIndexedDB;
      warn.mockRestore();
    }
  });

  it('exposes a storage usage estimate', async () => {
    const { usageKB, limitMB } = await getStorageUsage();
    expect(limitMB).toBe(50);
    expect(typeof usageKB).toBe('number');
  });
});

describe('legacy DB migration (InstapaperBookmarkManagerDB → ReadLaterLensDB)', () => {
  const LEGACY_DB_NAME = 'InstapaperBookmarkManagerDB';

  beforeEach(async () => {
    await closeDb();
    await deleteDB(DB_NAME);
    await deleteDB(LEGACY_DB_NAME);
    setBookmarks([]);
    setSourceFiles(new Map());
  });

  /**
   * Seed a legacy-format database the way the pre-rebrand app wrote it:
   * a `app_state` object store keyed by `key` holding the `bookmarks` and
   * `sources` rows.
   */
  async function seedLegacyDb({ bookmarks: bm, sources: src }) {
    const db = await openDB(LEGACY_DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('app_state')) {
          d.createObjectStore('app_state', { keyPath: 'key' });
        }
      },
    });
    if (bm) await db.put('app_state', { key: 'bookmarks', data: bm });
    if (src) await db.put('app_state', { key: 'sources', data: src });
    db.close();
  }

  it('migrates a seeded legacy working set into the new DB and removes the legacy DB', async () => {
    await seedLegacyDb({
      bookmarks: [bookmark(1), bookmark(2)],
      sources: [{ id: 'f1', name: 'f.csv', type: 'csv', originalData: 'a,b' }],
    });

    expect(await loadState()).toBe(true);
    expect(bookmarks.map((b) => b.id)).toEqual(['1', '2']);
    expect(sourceFiles.get('f1').name).toBe('f.csv');
    expect(sourceFiles.get('f1').originalData).toBe('a,b');

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(LEGACY_DB_NAME);
    expect(names).toContain(DB_NAME);
  });

  it('does not re-migrate when the new DB already holds data (idempotency)', async () => {
    await seedLegacyDb({ bookmarks: [bookmark(1)], sources: [] });
    expect(await loadState()).toBe(true);

    // Re-create a legacy DB with DIFFERENT data after the first migration —
    // it must never overwrite the newer state already written to the new DB.
    await seedLegacyDb({ bookmarks: [bookmark(9)], sources: [] });
    expect(await loadState()).toBe(true);
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
  });

  it('returns false without error on a fresh install (no legacy DB)', async () => {
    expect(await loadState()).toBe(false);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(LEGACY_DB_NAME);
  });
});

describe('cross-tab conflict detection', () => {
  beforeEach(async () => {
    await closeDb();
    await deleteDB(DB_NAME);
    setBookmarks([]);
    setSourceFiles(new Map());
  });

  /**
   * Touch the shared rows without going through this tab's module state.
   *
   * IndexedDB is per-origin, so a real second tab would have its own
   * `knownRev`; the only way to reproduce that here is to write the storage
   * behind `saveState()`'s back — which is exactly what the other tab does.
   */
  async function asOtherTab(rows) {
    const db = await openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('app_state')) {
          d.createObjectStore('app_state', { keyPath: 'key' });
        }
      },
    });
    for (const row of rows) await db.put('app_state', row);
    db.close();
  }

  async function readRow(key) {
    const db = await openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('app_state')) {
          d.createObjectStore('app_state', { keyPath: 'key' });
        }
      },
    });
    const row = await db.get('app_state', key);
    db.close();
    return row;
  }

  it('refuses to overwrite a cache another tab has written', async () => {
    setBookmarks([bookmark(1)]);
    await expect(saveState()).resolves.toEqual({ persisted: true, conflict: false });

    // The other tab lands a wholly different working set plus a fresh revision
    // — the same three rows saveState() writes on this tab's behalf.
    await asOtherTab([
      { key: 'bookmarks', data: [bookmark(9)] },
      { key: 'rev', data: globalThis.crypto.randomUUID() },
    ]);

    setBookmarks([bookmark(2)]); // this tab's now-stale view
    await expect(saveState()).resolves.toEqual({ persisted: false, conflict: true });

    // The other tab's import survives — nothing was clobbered.
    expect((await readRow('bookmarks')).data.map((b) => b.id)).toEqual(['9']);
  });

  it('keeps writing while it holds the only baseline', async () => {
    setBookmarks([bookmark(1)]);
    await expect(saveState()).resolves.toEqual({ persisted: true, conflict: false });

    setBookmarks([bookmark(1), bookmark(2)]);
    await expect(saveState()).resolves.toEqual({ persisted: true, conflict: false });

    expect((await readRow('bookmarks')).data).toHaveLength(2);
  });

  it('writes a first revision for a cache saved before revisions existed', async () => {
    await asOtherTab([
      { key: 'bookmarks', data: [bookmark(1)] },
      { key: 'sources', data: [] },
      // deliberately no `rev` row — a pre-revision install
    ]);

    expect(await loadState()).toBe(true);
    setBookmarks([bookmark(1), bookmark(2)]);
    await expect(saveState()).resolves.toEqual({ persisted: true, conflict: false });
    expect((await readRow('rev')).data).toEqual(expect.any(String));
  });

  it('reports the view stale the moment another tab writes', async () => {
    setBookmarks([bookmark(1)]);
    await saveState();
    expect(await isStateFresh()).toBe(true);

    await asOtherTab([{ key: 'rev', data: globalThis.crypto.randomUUID() }]);
    expect(await isStateFresh()).toBe(false);
  });

  it('leaves every row untouched when a later row cannot be written', async () => {
    setBookmarks([bookmark(1)]);
    setSourceFiles(new Map([['f1', { id: 'f1', name: 'f.csv', type: 'csv', originalData: 'a' }]]));
    await saveState();

    // `name` is a function, so the `sources` row cannot be structured-cloned.
    // It is queued AFTER `bookmarks`: without one aborting transaction the
    // first row commits anyway and the cache ends up describing folders that
    // are no longer in it.
    setBookmarks([bookmark(2)]);
    setSourceFiles(new Map([['f1', { id: 'f1', name: () => {}, type: 'csv', originalData: 'a' }]]));

    await expect(saveState()).resolves.toEqual({ persisted: false, conflict: false });
    expect((await readRow('bookmarks')).data.map((b) => b.id)).toEqual(['1']);
  });
});
