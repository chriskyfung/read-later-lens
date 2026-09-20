import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, deleteDB } from 'idb';
import { saveState, loadState, getStorageUsage, closeDb } from '../src/core/store.js';
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
            fileHandle: { name: 'f.csv' },
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

  it('does not persist File handles (monolith parity, avoids blob duplication)', async () => {
    setSourceFiles(
      new Map([
        [
          'f1',
          {
            id: 'f1',
            name: 'f.csv',
            type: 'csv',
            originalData: 'x',
            fileHandle: { name: 'f.csv' },
          },
        ],
      ]),
    );
    await saveState();
    setSourceFiles(new Map());
    await loadState();
    expect(sourceFiles.get('f1').fileHandle).toBeUndefined();
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
