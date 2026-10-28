/**
 * @fileoverview Workspace DOM listeners — sort, tabs, select-all, batch and
 * graph controls.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html.
 * Must be registered AFTER mountWorkspace() (src/components/workspace.js).
 */
import * as state from '../../core/state';
import { getFilteredBookmarks } from '../../core/filters.js';
import { renderBookmarkCards, updateBatchActionBar } from '../bookmarks';
import { WORKSPACE_IDS } from '../../components/workspace/constants.js';
import { getDeps } from './deps.js';
import { switchTab } from './tabActions.js';
import { zoomIn, zoomOut, resetZoom, applyWeighting } from './graphActions.js';
import { confirmDeleteBookmark, confirmDeleteSelectedBookmarks } from './actions.js';

/**
 * Attach the workspace listeners (sort, tabs, select-all, batch, zoom).
 */
export function registerWorkspaceListeners() {
  // The deps are read at EVENT time, not at registration time: the listeners
  // may be registered before the orchestrator injects the real callbacks, and
  // a captured snapshot would then keep calling the no-op defaults forever.

  // Sort dropdown — monolith parity: sets sort and re-renders only.
  document.getElementById(WORKSPACE_IDS.SORT_SELECT)?.addEventListener('change', (e) => {
    state.setSortBy(e.target.value);
    getDeps().render();
  });

  // Tab switcher delegation
  document.querySelectorAll('.main-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Select All checkbox
  document.getElementById('selectAllCheckbox')?.addEventListener('change', (e) => {
    const filtered = getFilteredBookmarks();
    if (e.target.checked) {
      filtered.forEach((b) => state.selectedIds.add(b.id));
    } else {
      state.selectedIds.clear();
    }
    renderBookmarkCards();
    updateBatchActionBar();
  });

  // Batch Delete — confirm first, then the extracted monolith-order body.
  document
    .getElementById(WORKSPACE_IDS.BATCH_DELETE_BTN)
    ?.addEventListener('click', confirmDeleteSelectedBookmarks);

  // Batch Cancel
  document.getElementById(WORKSPACE_IDS.BATCH_CANCEL_BTN)?.addEventListener('click', () => {
    state.selectedIds.clear();
    renderBookmarkCards();
    updateBatchActionBar();
  });

  // Bookmark delete — delegated from bookmark grid (confirm first).
  document.getElementById('bookmarkCardsGrid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete-bookmark]');
    if (btn) await confirmDeleteBookmark(btn.dataset.deleteBookmark);
  });

  // D3 Zoom Controls (zoom/pan state lives in src/views/linkage.js)
  document.getElementById('zoomInBtn')?.addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn')?.addEventListener('click', zoomOut);
  document.getElementById('resetGraphBtn')?.addEventListener('click', resetZoom);

  // TF ⇄ TF-IDF toggle — re-renders the graph with the new scoring mode.
  document.getElementById('weightingTfidfToggle')?.addEventListener('change', (e) => {
    applyWeighting(e.target.checked);
  });
}
