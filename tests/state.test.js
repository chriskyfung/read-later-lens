import { describe, it, expect, beforeEach } from 'vitest';
import {
  bookmarks,
  sourceFiles,
  activeFolder,
  selectedIds,
  SQL,
  setBookmarks,
  setSourceFiles,
  setActiveFolder,
  setSelectedIds,
  setSQL,
  mergeBookmarks,
  removeSourceFile,
  isTrashed,
  trashBookmarks,
  restoreBookmarks,
  purgeBookmarks,
} from '../src/core/state.js';

const mk = (id, sourceId = 'f1') => ({ id: String(id), source_file_id: sourceId });

beforeEach(() => {
  setBookmarks([]);
  setSourceFiles(new Map());
  setActiveFolder('ALL');
  setSelectedIds(new Set());
  setSQL(null);
});

describe('state bindings', () => {
  it('exposes live bindings through the setters', () => {
    setBookmarks([mk(1)]);
    expect(bookmarks).toHaveLength(1);
    setSourceFiles(new Map([['f1', { id: 'f1', name: 'f.csv', type: 'csv' }]]));
    expect(sourceFiles.size).toBe(1);
    setSQL({ Database: () => {} });
    expect(SQL).not.toBeNull();
  });

  it('keeps mutating the same selectedIds Set instance', () => {
    const ref = selectedIds;
    ref.add('x');
    expect(selectedIds.has('x')).toBe(true);
  });
});

describe('mergeBookmarks', () => {
  it('merges on id and lets incoming records win', () => {
    setBookmarks([
      { id: '1', title: 'old' },
      { id: '2', title: 'two' },
    ]);
    mergeBookmarks([{ id: '1', title: 'new' }]);
    expect(bookmarks).toHaveLength(2);
    expect(bookmarks.find((b) => b.id === '1').title).toBe('new');
  });
});

describe('removeSourceFile', () => {
  it('drops the source, its bookmarks and resets the active folder', () => {
    setSourceFiles(
      new Map([
        ['f1', { id: 'f1' }],
        ['f2', { id: 'f2' }],
      ]),
    );
    setBookmarks([mk(1, 'f1'), mk(2, 'f2')]);
    setActiveFolder('f1');
    removeSourceFile('f1');
    expect(sourceFiles.has('f1')).toBe(false);
    expect(bookmarks.map((b) => b.id)).toEqual(['2']);
    expect(activeFolder).toBe('ALL');
  });
});

describe('trash transitions', () => {
  it('stamps deleted_at on the requested ids only and reports trashed state', () => {
    setBookmarks([mk(1), mk(2)]);

    trashBookmarks(['1']);

    expect(isTrashed(bookmarks[0])).toBe(true);
    expect(bookmarks[0].deleted_at).toBeTruthy();
    expect(isTrashed(bookmarks[1])).toBe(false);
    expect(bookmarks[1].deleted_at).toBeUndefined();
  });

  it('keeps the original stamp when a batch overlaps the trash', () => {
    const first = '2026-01-01T00:00:00.000Z';
    setBookmarks([mk(1, 'f1'), { ...mk(2, 'f1'), deleted_at: first }]);

    trashBookmarks(['1', '2']);

    expect(bookmarks[0].deleted_at).toBeTruthy();
    expect(bookmarks[1].deleted_at).toBe(first);
  });

  it('restores trashed ids by clearing the stamp', () => {
    setBookmarks([{ ...mk(1), deleted_at: '2026-01-01T00:00:00.000Z' }, mk(2)]);

    restoreBookmarks(['1', '2']);

    expect(bookmarks[0].deleted_at).toBeNull();
    expect(isTrashed(bookmarks[0])).toBe(false);
    // A live record is untouched by a restore.
    expect(bookmarks[1].deleted_at).toBeUndefined();
  });

  it('purges records permanently, trashed or not', () => {
    setBookmarks([mk(1), { ...mk(2), deleted_at: '2026-01-01T00:00:00.000Z' }]);

    purgeBookmarks(['1', '2']);

    expect(bookmarks).toEqual([]);
  });
});

describe('mergeBookmarks over the trash', () => {
  it('lets a fresh import replace (resurrect) a trashed record', () => {
    setBookmarks([{ id: 'dup', title: 'deleted', deleted_at: '2026-01-01T00:00:00.000Z' }]);

    mergeBookmarks([{ id: 'dup', title: 'imported' }]);

    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe('imported');
    expect(isTrashed(bookmarks[0])).toBe(false);
  });
});
