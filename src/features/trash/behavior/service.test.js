// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { setupTrash } from 'tests/features/trash/harness.js';
import { findTrashedBookmark } from './service.js';
import {
  setBookmarks,
  bookmarks,
  trashBookmarks,
  restoreBookmarks,
  purgeBookmarks,
  isTrashed,
} from '@/core/state';

const OLDER_TS = '2026-01-01T00:00:00.000Z';

const mk = (id, extras = {}) => ({ id: String(id), title: `t${id}`, ...extras });

describe('findTrashedBookmark (service)', () => {
  beforeEach(() => {
    setBookmarks([]);
    setupTrash({ fresh: true });
  });

  it('finds a trashed record and agrees with isTrashed semantics', () => {
    setBookmarks([mk('1', { deleted_at: OLDER_TS })]);
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
    const scan = (id) => bookmarks.find((b) => b.id === id && b.deleted_at);

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
