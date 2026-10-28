import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBookmarks,
  mergeBookmarks,
  removeSourceFile,
  trashBookmarks,
  restoreBookmarks,
  purgeBookmarks,
  toggleFavorite,
  getBookmarkById,
  bookmarks,
  isTrashed,
} from '../src/core/state';
import { findTrashedBookmark } from '../src/views/trash/service.js';

const mk = (id, extras = {}) => ({ id: String(id), title: `t${id}`, ...extras });

beforeEach(() => {
  setBookmarks([]);
  removeSourceFile('none'); // no-op; keeps sourceFiles consistent with state.test.js pattern
});

/**
 * The trash service relies on the O(1) id index kept in sync by every mutator.
 * These cases pin that invariant so the index-based lookup never drifts from
 * the array (which the old linear-scan would have masked).
 */
describe('bookmark index parity (basis for O(1) trash lookup)', () => {
  it('getBookmarkById matches array lookup after setBookmarks', () => {
    setBookmarks([mk('1'), mk('2'), mk('3')]);
    for (const b of bookmarks) {
      expect(getBookmarkById(b.id)).toBe(b);
    }
    expect(getBookmarkById('missing')).toBeUndefined();
  });

  it('stays in sync through merge → trash → restore → purge cycles', () => {
    setBookmarks([mk('1'), mk('2')]);
    mergeBookmarks([mk('3'), mk('1', { title: 'merged' })]);
    for (const b of bookmarks) expect(getBookmarkById(b.id)).toBe(b);

    trashBookmarks(['1', '3']);
    for (const b of bookmarks) expect(getBookmarkById(b.id)).toBe(b);

    restoreBookmarks(['1']);
    for (const b of bookmarks) expect(getBookmarkById(b.id)).toBe(b);

    purgeBookmarks(['3']);
    for (const b of bookmarks) expect(getBookmarkById(b.id)).toBe(b);
    expect(getBookmarkById('3')).toBeUndefined();
  });

  it('toggleFavorite mutates in place without breaking index identity', () => {
    setBookmarks([mk('1'), mk('2')]);
    toggleFavorite('1');
    expect(getBookmarkById('1')).toBe(bookmarks.find((b) => b.id === '1'));
    expect(getBookmarkById('1').is_favorite).toBe(true);
  });
});

describe('findTrashedBookmark (service)', () => {
  it('finds a trashed record and agrees with isTrashed semantics', () => {
    setBookmarks([mk('1', { deleted_at: '2026-01-01T00:00:00.000Z' })]);
    const found = findTrashedBookmark('1');
    expect(found).toBe(bookmarks[0]);
    expect(isTrashed(found)).toBe(true);
  });

  it('returns undefined for live records, missing ids, and falsy deleted_at', () => {
    setBookmarks([mk('1'), mk('2', { deleted_at: null }), mk('3', { deleted_at: '' })]);
    expect(findTrashedBookmark('1')).toBeUndefined();
    expect(findTrashedBookmark('2')).toBeUndefined();
    expect(findTrashedBookmark('3')).toBeUndefined();
    expect(findTrashedBookmark('missing')).toBeUndefined();
  });

  it('agrees with the array scan across a full mutation cycle', () => {
    setBookmarks([mk('1'), mk('2'), mk('3')]);
    const scan = (id) => stateBookmarks().find((b) => b.id === id && b.deleted_at);

    trashBookmarks(['1', '2']);
    expect(findTrashedBookmark('1')).toBe(scan('1'));
    expect(findTrashedBookmark('2')).toBe(scan('2'));
    expect(findTrashedBookmark('3')).toBeUndefined();

    restoreBookmarks(['2']);
    expect(findTrashedBookmark('2')).toBeUndefined();
    expect(findTrashedBookmark('1')).toBe(scan('1'));

    purgeBookmarks(['1']);
    expect(findTrashedBookmark('1')).toBeUndefined();
  });
});

/** The live `bookmarks` binding, re-read after each mutator replaces the array. */
function stateBookmarks() {
  return bookmarks;
}
