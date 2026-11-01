/* @vitest-environment jsdom */
// Pins the single-row repaint path: a restore/purge must remove only the
// mutated row (untouched siblings keep node identity) and refresh summary +
// banner; any drift must fall back to the full rebuild so the screen never
// disagrees with state.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTrashView, patchTrashRow, captureDomRowCount } from '../src/views/trash/view.js';
import { initTrash, restoreBookmark, purgeBookmark } from '../src/views/trash';
import { setBookmarks, bookmarks, setSelectedIds } from '../src/core/state';

// The patch path is under test; the cross-tab gate must stay transparent.
vi.mock('../src/core/persistence', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => true,
}));

const OLDER = '2026-01-01T00:00:00.000Z';
const NEWER = '2026-02-01T00:00:00.000Z';
const trashed = (id, title, deletedAt = OLDER) => ({
  id,
  title,
  article_preview: `${title} preview`,
  source_file_name: 'instapaper.csv',
  deleted_at: deletedAt,
});

beforeEach(() => {
  document.body.innerHTML =
    '<div id="trashList" class="space-y-3"></div>' +
    '<div id="trashEmptyState" class="hidden"></div>' +
    '<div id="trashSummary"></div>' +
    '<div id="toastNotification" class="translate-y-20 opacity-0">' +
    '<div id="toastMsg"></div></div>';
  setSelectedIds(new Set());
  initTrash({ persist: vi.fn(async () => {}), render: vi.fn() });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

describe('patchTrashRow', () => {
  it('removes only the matching row and preserves sibling node identity', () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta'), trashed('3', 'Gamma')]);
    renderTrashView();
    const list = document.getElementById('trashList');
    const [row1, , row3] = list.children;
    expect(row1.getAttribute('data-trash-row')).toBe('1');

    expect(patchTrashRow('2', 3, 2)).toBe(true);

    expect(list.children.length).toBe(2);
    expect(list.children[0]).toBe(row1);
    expect(list.children[1]).toBe(row3);
    expect(document.getElementById('trashSummary').textContent).toBe('共 2 筆');
  });

  it('shows the empty banner when the last row is patched away', () => {
    setBookmarks([trashed('1', 'Only')]);
    renderTrashView();
    expect(patchTrashRow('1', 1, 0)).toBe(true);
    expect(document.getElementById('trashList').children.length).toBe(0);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
  });

  it('refuses to patch a stale DOM (row count mismatch)', () => {
    setBookmarks([trashed('1', 'Alpha'), trashed('2', 'Beta')]);
    renderTrashView();

    expect(patchTrashRow('1', 5, 1)).toBe(false);
    expect(document.getElementById('trashList').children.length).toBe(2);
  });

  it('refuses to patch an id that is not in the list', () => {
    setBookmarks([trashed('1', 'Alpha')]);
    renderTrashView();

    expect(patchTrashRow('missing', 1, 0)).toBe(false);
    expect(document.getElementById('trashList').children.length).toBe(1);
  });

  it('captureDomRowCount mirrors the mounted list', () => {
    setBookmarks([trashed('1', 'A'), trashed('2', 'B')]);
    renderTrashView();
    expect(captureDomRowCount()).toBe(2);
  });
});

describe('actions: single-row patch with full-render fallback', () => {
  it('restore removes exactly that row, siblings keep identity', async () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta')]);
    renderTrashView();
    const list = document.getElementById('trashList');
    // Newest-deleted-first order: children[0] is id '1' (Alpha, NEWER),
    // children[1] is id '2' (Beta). Restoring '2' must leave the id-'1' node.
    const rowOne = list.children[0];

    expect(await restoreBookmark('2')).toBe(true);

    expect(bookmarks.find((b) => b.id === '2').deleted_at).toBeNull();
    expect(list.children.length).toBe(1);
    expect(list.children[0]).toBe(rowOne);
    expect(list.children[0].getAttribute('data-trash-row')).toBe('1');
    expect(document.getElementById('trashSummary').textContent).toBe('共 1 筆');
  });

  it('purge removes exactly that row and updates the summary', async () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta')]);
    renderTrashView();
    const list = document.getElementById('trashList');
    // children[0] carries data-trash-row="1" (newest-deleted-first); id '2'
    // sits at children[1]. Purging '1' must leave the id-'2' node in place.
    const rowTwo = list.children[1];

    expect(await purgeBookmark('1')).toBe(true);

    expect(bookmarks.map((b) => b.id)).toEqual(['2']);
    expect(list.children.length).toBe(1);
    expect(list.children[0]).toBe(rowTwo);
    expect(list.children[0].getAttribute('data-trash-row')).toBe('2');
    expect(document.getElementById('trashSummary').textContent).toBe('共 1 筆');
  });

  it('falls back to a full render when the DOM drifted (rebuilt from state)', async () => {
    setBookmarks([trashed('1', 'Alpha'), trashed('2', 'Beta')]);
    renderTrashView();
    // Simulate a stale screen: the DOM lost a row the projection still has
    // (e.g. an interrupted earlier render). The count the action captures now
    // (2 visible... but only 1 node was left after we remove one) will not
    // match, so the patch must refuse and the full rebuild must run.
    document.getElementById('trashList').children[0].remove();

    expect(await purgeBookmark('1')).toBe(true);

    // Full rebuild from state: only the projection's remaining row survives.
    const list = document.getElementById('trashList');
    expect(list.children.length).toBe(1);
    expect(list.children[0].getAttribute('data-trash-row')).toBe('2');
    expect(document.getElementById('trashSummary').textContent).toBe('共 1 筆');
  });

  it('purge of the last row ends at the empty banner', async () => {
    setBookmarks([trashed('1', 'Only')]);
    renderTrashView();

    expect(await purgeBookmark('1')).toBe(true);

    expect(bookmarks).toHaveLength(0);
    expect(document.getElementById('trashList').children.length).toBe(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('toastMsg').innerText).toBe('已永久刪除該筆書籤');
  });
});
