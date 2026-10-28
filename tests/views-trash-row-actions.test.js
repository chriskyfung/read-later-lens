/* global MouseEvent */
// @vitest-environment jsdom

/**
 * End-to-end coverage for the trash modal's row actions.
 *
 * The stub suite in views-trash.test.js fakes `closest()` + dataset, so it
 * proves the handlers but not the wiring between markup and delegation: a
 * markup regression (the bare, valueless `data-restore-bookmark` attribute
 * that made both row actions no-ops after the modal migration) slips straight
 * through it. This file renders the REAL row markup into a REAL DOM and
 * clicks the REAL buttons.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTrashListeners, renderTrashView, initTrash } from '../src/views/trash';
import { setBookmarks, bookmarks, selectedIds, setSelectedIds } from '../src/core/state';

// Only the row wiring is under test; the cross-tab gate must stay transparent.
vi.mock('../src/core/store', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => true,
}));

const OLDER = '2026-01-01T00:00:00.000Z';

const trashed = (id, title) => ({
  id,
  title,
  article_preview: `${title} preview`,
  source_file_name: 'instapaper.csv',
  deleted_at: OLDER,
});

let persistFn;

beforeEach(() => {
  // Fresh nodes per test so each listener binds exactly once.
  document.body.innerHTML =
    '<div id="trashList" class="space-y-3"></div>' +
    '<div id="trashEmptyState" class="hidden"></div>' +
    '<div id="trashSummary"></div>';
  setBookmarks([trashed('1', 'Apple'), trashed('2', 'Banana')]);
  setSelectedIds(new Set(['2']));
  persistFn = vi.fn(async () => {});
  initTrash({ persist: persistFn, render: vi.fn() });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  renderTrashView();
  registerTrashListeners();
});

describe('trash row actions (real markup, real click)', () => {
  it('還原 restores exactly the clicked bookmark', async () => {
    const btn = document.querySelector('[data-restore-bookmark="1"]');
    expect(btn).not.toBeNull();

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(bookmarks.find((b) => b.id === '1').deleted_at).toBeNull());
    // The other trashed row is untouched, the record persists and the
    // restored id leaves the selection.
    expect(bookmarks.find((b) => b.id === '2').deleted_at).toBe(OLDER);
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
