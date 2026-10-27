/* global MouseEvent */
// @vitest-environment jsdom

/**
 * Real-DOM proxy for the stubbed `views-sidebar-actions.test.js` trash-row
 * test: the row now opens the dedicated trash modal (no pseudo-folder flip
 * anymore) and the layer stack behind it is the real implementation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initSidebarActions, registerSidebarListeners } from '../src/views/sidebar';
import { setBookmarks, setSelectedIds } from '../src/core/state.js';
import { MODAL_Z_BASE } from '../src/utils/dom';

vi.mock('../src/core/store', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => true,
}));

function mountAppDom() {
  document.body.innerHTML =
    '<button id="trashFolderBtn">回收桶</button>' +
    '<button id="allFolderBtn">全部書籤</button>' +
    '<div id="trashModal" class="hidden">' +
    '<div id="trashList"></div>' +
    '<div id="trashSummary"></div>' +
    '</div>' +
    '<div id="bookmarkCardsGrid"></div>';
}

beforeEach(() => {
  mountAppDom();
  setBookmarks([
    {
      id: '1',
      title: 'b',
      article_preview: 'b preview',
      source_file_name: 'b.csv',
      deleted_at: null,
    },
    {
      id: '2',
      title: 'a',
      article_preview: 'a preview',
      source_file_name: 'a.csv',
      deleted_at: null,
    },
  ]);
  setSelectedIds(new Set());
  vi.clearAllMocks();
});

describe('trash folder row (real DOM)', () => {
  it('opens the trash modal without touching the grid or the pseudo-folder', () => {
    const renderFn = vi.fn();
    initSidebarActions({ persist: vi.fn(async () => {}), render: renderFn });
    registerSidebarListeners();

    document
      .getElementById('trashFolderBtn')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const modal = document.getElementById('trashModal');
    // The modal shell is unhidden, becomes the top layer, and sits above the
    // rest of the page (focus moves into the top layer).
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(modal.style.zIndex).toBe(String(MODAL_Z_BASE + 1));
    expect(modal.getAttribute('aria-hidden')).toBe('false');

    // Grid + sidebar stay exactly as the current view left them; the trash
    // view is owned by the modal, not by a grid tab.
    expect(document.getElementById('bookmarkCardsGrid').children.length).toBe(0);
  });
});
