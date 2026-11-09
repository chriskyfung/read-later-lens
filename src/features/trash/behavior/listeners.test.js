// @vitest-environment jsdom
/* global MouseEvent */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTrashListeners } from './listeners.js';
import { renderTrashView } from './view.js';
import { initTrash } from '../index.js';
import { setBookmarks, bookmarks, setSelectedIds, selectedIds } from '@/core/state';

const OLDER_TS = '2026-01-01T00:00:00.000Z';

// Module-level persistFn (like original flat test file)
let persistFn;

const trashed = (id, title, deletedAt = OLDER_TS) => ({
  id,
  title,
  article_preview: `${title} preview`,
  source_file_name: 'instapaper.csv',
  deleted_at: deletedAt,
});

describe('trash row actions (real markup, real click)', () => {
  // Fresh nodes per test so each listener binds exactly once.
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setBookmarks([trashed('1', 'Apple'), trashed('2', 'Banana')]);
    setSelectedIds(new Set(['2']));
    persistFn = vi.fn(async () => {}); // assigned in beforeEach
    initTrash({ persist: persistFn, render: vi.fn() });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    registerTrashListeners();
    renderTrashView();
  });

  it('還原 restores exactly the clicked bookmark', async () => {
    const btn = document.querySelector('[data-restore-bookmark="1"]');
    expect(btn).not.toBeNull();

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(bookmarks.find((b) => b.id === '1').deleted_at).toBeNull());
    // The other trashed row is untouched, the record persists and the
    // restored id leaves the selection.
    expect(bookmarks.find((b) => b.id === '2').deleted_at).toBe(OLDER_TS);
    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(selectedIds.has('1')).toBe(false);
  });

  it('永久刪除 prompts with the bookmark title and purges exactly that row', async () => {
    const btn = document.querySelector('[data-purge-bookmark="2"]');
    expect(btn).not.toBeNull();

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(bookmarks).toHaveLength(1));
    expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    expect(globalThis.confirm.mock.calls[0][0]).toContain('Banana');
    expect(bookmarks.map((b) => b.id)).toEqual(['1']);
  });

  it('clicks that hit neither action button are ignored', async () => {
    document.getElementById('trashList').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bookmarks).toHaveLength(2);
    expect(persistFn).not.toHaveBeenCalled();
    expect(globalThis.confirm).not.toHaveBeenCalled();
  });
});
