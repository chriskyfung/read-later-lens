// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  restoreBookmark,
  purgeBookmark,
  confirmPurgeBookmark,
  emptyTrash,
  confirmEmptyTrash,
} from './actions.js';
import { initTrash } from '../index.js';
import { setBookmarks, bookmarks, selectedIds } from '@/core/state';

const OLDER_TS = '2026-01-01T00:00:00.000Z';

const trashed = (id, title, deletedAt = OLDER_TS) => ({
  id,
  title,
  article_preview: `${title} preview`,
  source_file_name: 'instapaper.csv',
  deleted_at: deletedAt,
});

const live = (id, title) => ({ id, title, article_preview: `${title} preview` });

// Module-level persistFn and gate (like original flat test file)
let persistFn;
const gate = vi.hoisted(() => ({ fresh: true }));

// Persistence mock — every trash test uses this pattern.
vi.mock('@/core/persistence', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => gate.fresh,
}));

beforeEach(() => {
  persistFn = vi.fn(async () => {});
  gate.fresh = true;
  initTrash({ persist: persistFn, render: vi.fn() });
});

describe('restoreBookmark', () => {
  it('refuses when stale gate is down', async () => {
    setBookmarks([trashed('1', 'Older', OLDER_TS)]);
    gate.fresh = false;
    const result = await restoreBookmark('1');
    expect(result).toBe(false);
    expect(bookmarks[0].deleted_at).toBe(OLDER_TS);
  });

  it('restores a bookmark from trash', async () => {
    setBookmarks([trashed('1', 'Older')]);
    const result = await restoreBookmark('1');
    expect(result).toBe(true);
    expect(bookmarks[0].deleted_at).toBeNull();
    expect(persistFn).toHaveBeenCalledTimes(1);
  });
});

describe('purgeBookmark', () => {
  it('permanently removes a bookmark from trash', async () => {
    setBookmarks([trashed('1', 'Older')]);
    const result = await purgeBookmark('1');
    expect(result).toBe(true);
    expect(bookmarks).toHaveLength(0);
    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it('refuses when stale gate is down', async () => {
    setBookmarks([trashed('1', 'Older', OLDER_TS)]);
    gate.fresh = false;
    const result = await purgeBookmark('1');
    expect(result).toBe(false);
    expect(bookmarks).toHaveLength(1);
  });
});

describe('confirmPurgeBookmark', () => {
  it('confirms and purges the bookmark', async () => {
    globalThis.confirm = vi.fn(() => true);
    setBookmarks([trashed('1', 'Older')]);
    const result = await confirmPurgeBookmark('1');
    expect(result).toBe(true);
    expect(bookmarks).toHaveLength(0);
  });

  it('rejects when user declines', async () => {
    globalThis.confirm = vi.fn(() => false);
    setBookmarks([trashed('1', 'Older')]);
    const result = await confirmPurgeBookmark('1');
    expect(result).toBe(false);
    expect(bookmarks).toHaveLength(1);
  });

  it('never prompts once the tab is stale', async () => {
    globalThis.confirm = vi.fn(() => true);
    setBookmarks([trashed('1', 'Older', OLDER_TS)]);
    gate.fresh = false;
    const result = await confirmPurgeBookmark('1');
    expect(result).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(bookmarks).toHaveLength(1);
    expect(persistFn).not.toHaveBeenCalled();
  });
});

describe('emptyTrash', () => {
  it('empties the trash when there are items', async () => {
    setBookmarks([trashed('1', 'Older'), trashed('2', 'Newer')]);
    const result = await emptyTrash();
    expect(result).toBe(true);
    expect(bookmarks).toHaveLength(0);
    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it('returns false when trash is already empty', async () => {
    setBookmarks([live('1', 'Active')]);
    const result = await emptyTrash();
    expect(result).toBe(false);
  });

  it('purges every trashed record and keeps the live ones', async () => {
    setBookmarks([trashed('1', 'Older'), trashed('2', 'Newer'), live('3', 'Active')]);
    const result = await emptyTrash();
    expect(result).toBe(true);
    expect(bookmarks).toHaveLength(1); // only live one remains
    expect(selectedIds.has('1')).toBe(false);
    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the trash is already empty', async () => {
    setBookmarks([live('1', 'Active')]);
    const result = await emptyTrash();
    expect(result).toBe(false);
    expect(bookmarks).toHaveLength(1);
  });
});

describe('confirmEmptyTrash', () => {
  it('empties the trash after the confirm is accepted', async () => {
    setBookmarks([trashed('1', 'Older')]);
    const result = await confirmEmptyTrash();
    expect(result).toBe(true);
    expect(bookmarks).toHaveLength(0);
  });

  it('keeps the trash when the confirm is declined', async () => {
    globalThis.confirm = vi.fn(() => false);
    setBookmarks([trashed('1', 'Older')]);
    const result = await confirmEmptyTrash();
    expect(result).toBe(false);
    expect(bookmarks).toHaveLength(1);
  });

  it('never prompts once the tab is stale', async () => {
    globalThis.confirm = vi.fn(() => true);
    setBookmarks([trashed('1', 'Older', OLDER_TS)]);
    gate.fresh = false;
    const result = await confirmEmptyTrash();
    expect(result).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(bookmarks).toHaveLength(1);
  });
});
