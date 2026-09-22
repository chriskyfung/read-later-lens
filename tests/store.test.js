import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { deleteDB } from 'idb';
import { saveState, loadState, getStorageUsage, closeDb } from '../src/core/store.js';
import { bookmarks, sourceFiles, setBookmarks, setSourceFiles } from '../src/core/state.js';

const DB_NAME = 'InstapaperBookmarkManagerDB';

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
