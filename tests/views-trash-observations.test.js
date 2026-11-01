// @vitest-environment jsdom

/**
 * Render-output observations for the trash view (src/views/trash/).
 *
 * The stub suite in views-trash.test.js fakes innerHTML + dataset, so it can
 * never observe what renderTrashView actually writes into list.children (the
 * modern modal assigns `list.innerHTML = trashed.map(trashItemHtml).join('')`,
 * and no stub can parse that back into nodes). These run against a REAL DOM
 * instead, keeping the stub file focused on handler-level tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTrashView, initTrash, emptyTrash } from '../src/views/trash';
import { setBookmarks, setSelectedIds } from '../src/core/state';

// The cross-tab gate is transparent for these observations.
vi.mock('../src/core/persistence', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => true,
}));

const OLDER = '2026-01-01T00:00:00.000Z';
const NEWER = '2026-02-01T00:00:00.000Z';

const live = (id, title) => ({ id, title, article_preview: `${title} preview` });

const trashed = (id, title, deletedAt = NEWER) => ({
  ...live(id, title),
  source_file_name: 'b.csv',
  deleted_at: deletedAt,
});

function mountTrashDom() {
  document.body.innerHTML =
    '<div id="trashList"></div>' +
    '<div id="trashEmptyState" class="hidden"></div>' +
    '<div id="trashSummary"></div>';
}

beforeEach(() => {
  mountTrashDom();
  setBookmarks([]);
  setSelectedIds(new Set());
  initTrash({ persist: vi.fn(), render: vi.fn() });
  vi.clearAllMocks();
});

describe('renderTrashView (real DOM)', () => {
  it('lists only trashed bookmarks, newest-deleted first', () => {
    setBookmarks([
      live('live', 'Active'),
      trashed('0', 'Older', OLDER),
      trashed('1', 'Newer', NEWER),
    ]);

    renderTrashView();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(2);

    // Newest-deleted first, in the real card shape (title h3, preview, source).
    expect(list.children[0].querySelector('h3').textContent).toBe('Newer');
    expect(list.children[1].querySelector('h3').textContent).toBe('Older');
    expect(list.children[0].innerHTML).toContain('Newer preview');
    expect(list.children[1].innerHTML).toContain('Older preview');

    expect(document.getElementById('trashSummary').textContent).toBe('共 2 筆');
  });

  it('shows the trash empty state when nothing is trashed', () => {
    setBookmarks([live('live', 'Active')]);

    renderTrashView();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });

  it('clears previously rendered rows once the trash is emptied', () => {
    setBookmarks([trashed('0', 'Older', OLDER), trashed('1', 'Newer', NEWER)]);
    renderTrashView();
    expect(document.getElementById('trashList').children).toHaveLength(2);

    // After the last purge the projection is empty: the rows must not linger
    // behind the empty-state banner.
    setBookmarks([]);
    renderTrashView();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });

  it('removes the rows from the DOM after emptyTrash() purges them', async () => {
    setBookmarks([trashed('0', 'Older', OLDER), trashed('1', 'Newer', NEWER)]);
    renderTrashView();
    expect(document.getElementById('trashList').children).toHaveLength(2);

    // The reported 清空回收桶 flow: the button's handler is confirmEmptyTrash ->
    // emptyTrash -> renderTrashView, so asserting on emptyTrash() pins the
    // click-to-DOM path the confirm wrapper only gates.
    expect(await emptyTrash()).toBe(true);

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });
});
