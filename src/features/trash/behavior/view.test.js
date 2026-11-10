// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { trashed, live, OLDER, NEWER } from 'tests/features/trash/harness.js';
import { renderTrashView, patchTrashRow, captureDomRowCount } from './view.js';
import { restoreBookmark, purgeBookmark, emptyTrash } from '@/features/trash';
import { setBookmarks, bookmarks } from '@/core/state';

describe('renderTrashView (real DOM)', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setBookmarks([]);
  });

  it('lists only trashed bookmarks, newest-deleted first', () => {
    setBookmarks([
      live('live', 'Active'),
      trashed('0', 'Older', OLDER),
      trashed('1', 'Newer', NEWER),
    ]);

    renderTrashView();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(2);

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

    setBookmarks([]);
    renderTrashView();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });
});

describe('patchTrashRow + captureDomRowCount', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setBookmarks([]);
  });

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

describe('is a no-op when the panel is not mounted', () => {
  it('does not throw when DOM elements are missing', () => {
    const originalGetElementById = document.getElementById.bind(document);
    document.getElementById = () => null;
    expect(() => renderTrashView()).not.toThrow();
    document.getElementById = originalGetElementById;
  });
});

describe('single-row patch + full-render fallback', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setBookmarks([]);
  });

  it('restore removes exactly that row, siblings keep identity', async () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta'), trashed('3', 'Gamma')]);
    renderTrashView();
    const list = document.getElementById('trashList');
    const [row1, , row3] = list.children;
    expect(row1.getAttribute('data-trash-row')).toBe('1');

    await restoreBookmark('2');

    expect(list.children.length).toBe(2);
    expect(list.children[0]).toBe(row1);
    expect(list.children[1]).toBe(row3);
    expect(document.getElementById('trashSummary').textContent).toBe('共 2 筆');
  });

  it('purge removes exactly that row and updates the summary', async () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta'), trashed('3', 'Gamma')]);
    renderTrashView();
    const list = document.getElementById('trashList');
    const [row1, , row3] = list.children;
    expect(row1.getAttribute('data-trash-row')).toBe('1');

    await purgeBookmark('2');

    expect(list.children.length).toBe(2);
    expect(list.children[0]).toBe(row1);
    expect(list.children[1]).toBe(row3);
    expect(document.getElementById('trashSummary').textContent).toBe('共 2 筆');
  });

  it('falls back to a full render when the DOM drifted (rebuilt from state)', async () => {
    setBookmarks([trashed('1', 'Alpha', NEWER), trashed('2', 'Beta'), trashed('3', 'Gamma')]);
    renderTrashView();
    document.getElementById('trashList').children[0].remove();

    await purgeBookmark('1');

    const list = document.getElementById('trashList');
    expect(list.children.length).toBe(2);
    expect(list.children[0].getAttribute('data-trash-row')).toBe('2');
    expect(list.children[1].getAttribute('data-trash-row')).toBe('3');
    expect(document.getElementById('trashSummary').textContent).toBe('共 2 筆');
  });

  it('purge of the last row ends at the empty banner', async () => {
    setBookmarks([trashed('1', 'Only')]);
    renderTrashView();

    await purgeBookmark('1');

    expect(bookmarks).toHaveLength(0);
    expect(document.getElementById('trashList').children.length).toBe(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });
});

describe('emptyTrash removes rows from DOM', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setBookmarks([]);
  });

  it('removes rows from DOM', async () => {
    setBookmarks([trashed('0', 'Older', OLDER), trashed('1', 'Newer', NEWER)]);
    renderTrashView();

    expect(document.getElementById('trashList').children).toHaveLength(2);

    await emptyTrash();

    const list = document.getElementById('trashList');
    expect(list.children).toHaveLength(0);
    expect(document.getElementById('trashEmptyState').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trashSummary').textContent).toBe('共 0 筆');
  });
});
