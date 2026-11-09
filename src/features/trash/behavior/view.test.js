// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { setupTrash, trashed, live, OLDER, NEWER } from 'tests/features/trash/harness.js';
import { renderTrashView, patchTrashRow, captureDomRowCount } from './view.js';
import { setBookmarks, setSelectedIds } from '@/core/state';

// ---- DOM fields that beforeEach sets up via the harness ----
// (the harness onBeforeEach hook handles document.body innerHTML)

describe('renderTrashView (real DOM)', () => {
  beforeEach(() => {
    // DOM: minimal trash modal shell + list + summary + empty state
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

    // Newest-deleted first
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
});

describe('patchTrashRow + captureDomRowCount', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="trashList" class="space-y-3"></div>' +
      '<div id="trashEmptyState" class="hidden"></div>' +
      '<div id="trashSummary"></div>';
    setupTrash({ fresh: true });
    setSelectedIds(new Set());
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

it('is a no-op when the panel is not mounted', () => {
  // Simulate the panel not being mounted by removing the list element.
  globalThis.document.getElementById = () => null;
  expect(() => renderTrashView()).not.toThrow();
  globalThis.document.getElementById = (id) => {
    if (id === 'trashList') return { innerHTML: '', children: [] }; // minimal stub
    return null;
  };
  // Re-run with a mounted panel to ensure no leak.
  globalThis.document.getElementById = (id) => {
    if (id === 'trashList') return { innerHTML: '', children: [] };
    if (id === 'trashSummary') return { textContent: '' };
    if (id === 'trashEmptyState')
      return { classList: { contains: () => false, add: () => {}, remove: () => {} } };
    return null;
  };
});
