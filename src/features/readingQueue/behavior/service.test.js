import { describe, it, expect, beforeEach } from 'vitest';
import { setBookmarks, setReadingQueue } from '@/core/state';
import { getQueueLength, isInQueue, getQueueIndex, getQueuedBookmarks } from './service.js';

beforeEach(() => {
  setBookmarks([]);
  setReadingQueue([]);
});

describe('getQueueLength', () => {
  it('returns 0 for an empty queue', () => {
    expect(getQueueLength()).toBe(0);
  });

  it('returns the number of visible queued items', () => {
    setBookmarks([
      { id: 'b1', title: 'A', deleted_at: null },
      { id: 'b2', title: 'B', deleted_at: null },
      { id: 'b3', title: 'C', deleted_at: null },
    ]);
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(getQueueLength()).toBe(3);
    expect(getQueueLength()).toBe(getQueuedBookmarks().length);
  });

  it('excludes trashed bookmarks', () => {
    setBookmarks([
      { id: 'b1', title: 'A', deleted_at: null },
      { id: 'b2', title: 'B', deleted_at: '2026-01-01T00:00:00.000Z' },
      { id: 'b3', title: 'C', deleted_at: null },
    ]);
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(getQueueLength()).toBe(2);
    expect(getQueueLength()).toBe(getQueuedBookmarks().length);
  });

  it('excludes bookmark IDs not present in the bookmarks array (purged)', () => {
    setBookmarks([
      { id: 'b1', title: 'A', deleted_at: null },
      { id: 'b2', title: 'B', deleted_at: null },
    ]);
    setReadingQueue(['b1', 'b2', 'purged-id']);
    expect(getQueueLength()).toBe(2);
    expect(getQueueLength()).toBe(getQueuedBookmarks().length);
  });
});

describe('isInQueue', () => {
  it('returns false for an empty queue', () => {
    expect(isInQueue('b1')).toBe(false);
  });

  it('returns true when the id is queued', () => {
    setReadingQueue(['b1', 'b2']);
    expect(isInQueue('b1')).toBe(true);
    expect(isInQueue('b2')).toBe(true);
    expect(isInQueue('b3')).toBe(false);
  });
});

describe('getQueueIndex', () => {
  it('returns -1 when not queued', () => {
    expect(getQueueIndex('b1')).toBe(-1);
  });

  it('returns the zero-based position', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(getQueueIndex('b1')).toBe(0);
    expect(getQueueIndex('b2')).toBe(1);
    expect(getQueueIndex('b3')).toBe(2);
  });
});

describe('getQueuedBookmarks', () => {
  it('returns an empty array when nothing is queued', () => {
    setBookmarks([{ id: '1', title: 'A', deleted_at: null }]);
    expect(getQueuedBookmarks()).toEqual([]);
  });

  it('returns queued bookmarks in queue order', () => {
    setBookmarks([
      { id: '1', title: 'First', deleted_at: null },
      { id: '2', title: 'Second', deleted_at: null },
      { id: '3', title: 'Third', deleted_at: null },
    ]);
    setReadingQueue(['3', '1']);
    const result = getQueuedBookmarks();
    expect(result.map((b) => b.id)).toEqual(['3', '1']);
  });

  it('skips trashed bookmarks', () => {
    setBookmarks([
      { id: '1', title: 'First', deleted_at: null },
      { id: '2', title: 'Second', deleted_at: '2026-01-01T00:00:00.000Z' },
      { id: '3', title: 'Third', deleted_at: null },
    ]);
    setReadingQueue(['1', '2', '3']);
    const result = getQueuedBookmarks();
    expect(result.map((b) => b.id)).toEqual(['1', '3']);
  });

  it('ignores bookmark ids not present in the bookmarks array', () => {
    setBookmarks([{ id: '1', title: 'Only one', deleted_at: null }]);
    setReadingQueue(['1', 'missing-id']);
    const result = getQueuedBookmarks();
    expect(result.map((b) => b.id)).toEqual(['1']);
  });
});
